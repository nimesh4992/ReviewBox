/**
 * GET  /api/settings/workspace — fetch workspace settings
 * PATCH /api/settings/workspace — update one or more workspace settings
 *
 * Supported fields: supportEmail, brandVoice, appCategory, defaultTone
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId, isWorkspaceAdmin } from "@/lib/supabase-server";
import { Redis } from "@upstash/redis";
import { getBrandVoiceStub } from "@/lib/brand-voice-stubs";
import { apiError, migrationPendingError } from "@/lib/api-response";
import { audit } from "@/lib/audit";

const VALID_APP_CATEGORIES = [
  "productivity", "finance", "health_fitness", "social_networking",
  "entertainment", "education", "shopping", "travel", "food_drink",
  "games", "utilities", "music", "news", "sports", "lifestyle",
  "business", "photo_video", "navigation", "medical", "other",
] as const;

const SLACK_URL_PREFIX = "https://hooks.slack.com/";
const SLACK_URL_MAX    = 500;

// Invalidate persona cache on save so next draft picks up changes immediately.
//
// The persona is cached per (workspace, app) now that replies are signed with
// the app's name rather than the workspace's, so deleting one fixed key would
// leave every per-app entry stale for up to an hour — the customer changes
// their support email in Settings, and drafts keep publishing the old one.
// SCAN over this workspace's keys instead; there is one per app plus the
// workspace-level fallback, so the set is tiny.
async function bustPersonaCache(workspaceId: string) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    const redis = new Redis({ url, token });
    const keys: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await redis.scan(cursor, {
        match: `persona:${workspaceId}:*`,
        count: 100,
      });
      keys.push(...batch);
      cursor = String(next);
      // Guard against an unexpectedly large keyspace holding the request open.
    } while (cursor !== "0" && keys.length < 500);

    // The pre-per-app key, for personas cached before this shape existed.
    keys.push(`persona:${workspaceId}`);
    if (keys.length) await redis.del(...keys);
  } catch { /* best-effort */ }
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("workspaces")
    .select("name, support_email, brand_voice, default_tone, slack_webhook_url")
    .eq("id", workspaceId)
    .single();

  if (error || !data) return apiError("NOT_FOUND", 404);

  const slackUrl = (data as Record<string, unknown>).slack_webhook_url ?? null;

  return NextResponse.json({
    name:            data.name              ?? "",
    supportEmail:    data.support_email      ?? "",
    brandVoice:      data.brand_voice        ?? "",
    defaultTone:     data.default_tone       ?? "professional",
    // The webhook URL is a BEARER SECRET — anyone holding it can post into the
    // customer's Slack channel as ReviewBox. Writing it is owner/admin-gated,
    // but this GET was not: any member — a contractor, an intern, someone
    // leaving next week — could read it back and keep it.
    //
    // So it is never returned. The UI needs to know whether one is configured
    // and to show enough of it for a human to recognise which channel, and
    // both of those are satisfiable without handing back the credential.
    // Changing it means pasting a fresh URL, which is the correct ceremony for
    // rotating a secret.
    slackWebhookConfigured: !!slackUrl,
    slackWebhookHint: slackUrl ? `…${String(slackUrl).slice(-8)}` : null,
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  // Owner/admin only — this writes the Slack webhook URL (alert redirect) and
  // brand/support settings. A plain member must not be able to point alerts at
  // an attacker-controlled webhook.
  if (!(await isWorkspaceAdmin(session.userId, workspaceId))) {
    return apiError("FORBIDDEN", 403, "Only the workspace owner or an admin can change workspace settings.");
  }

  const body = (await req.json()) as {
    supportEmail?:    string;
    brandVoice?:      string;
    appCategory?:     string;
    defaultTone?:     string;
    slackWebhookUrl?: string | null;
  };

  const updates: Record<string, string | null> = {};
  if (typeof body.supportEmail === "string") updates.support_email = body.supportEmail.trim();
  if (typeof body.brandVoice   === "string") updates.brand_voice   = body.brandVoice.slice(0, 500).trim();
  if (typeof body.defaultTone  === "string") updates.default_tone  = body.defaultTone;
  if ("slackWebhookUrl" in body) {
    const raw = body.slackWebhookUrl;
    if (raw !== null && raw !== undefined) {
      const trimmed = raw.trim();
      if (trimmed !== "") {
        if (!trimmed.startsWith(SLACK_URL_PREFIX) || trimmed.length > SLACK_URL_MAX) {
          return apiError("INVALID_INPUT", 400, `slackWebhookUrl must start with ${SLACK_URL_PREFIX} and be ≤${SLACK_URL_MAX} chars`);
        }
        updates.slack_webhook_url = trimmed;
      } else {
        updates.slack_webhook_url = null;
      }
    } else {
      updates.slack_webhook_url = null;
    }
  }

  if (typeof body.appCategory === "string") {
    if (!VALID_APP_CATEGORIES.includes(body.appCategory as typeof VALID_APP_CATEGORIES[number])) {
      return apiError("INVALID_INPUT", 400, "invalid appCategory value");
    }
    updates.app_category = body.appCategory;
    // Pre-fill brand_voice from category stub if not explicitly being set and currently empty
    if (typeof body.brandVoice !== "string") {
      const { data: current } = await getServiceClient()
        .from("workspaces").select("brand_voice").eq("id", workspaceId).single();
      const existing = (current?.brand_voice as string | null) ?? "";
      if (!existing.trim()) {
        updates.brand_voice = getBrandVoiceStub(body.appCategory);
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return apiError("INVALID_INPUT", 400, "no valid fields to update");
  }

  const sb = getServiceClient();
  const { error } = await sb
    .from("workspaces")
    .update(updates)
    .eq("id", workspaceId);

  if (error) {
    // brand_voice / support_email / app_category all arrive here from
    // migration 022. They are what the user just typed — reporting "saved"
    // after discarding them is the failure this branch exists to prevent.
    const pending = migrationPendingError(error, "Saving your workspace settings");
    if (pending) return pending;
    console.error("workspace update failed:", error);
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  await bustPersonaCache(workspaceId);

  // Audit Slack connect / disconnect
  if ("slack_webhook_url" in updates) {
    await audit({
      workspaceId,
      actorUserId: session.userId,
      action: updates.slack_webhook_url ? "slack.connect" : "slack.disconnect",
      targetType: "workspace",
      targetId: workspaceId,
    });
  }

  return NextResponse.json({ ok: true });
}
