/**
 * GET  /api/settings/workspace — fetch workspace settings
 * PATCH /api/settings/workspace — update one or more workspace settings
 *
 * Supported fields: supportEmail, brandVoice, appCategory, defaultTone
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { Redis } from "@upstash/redis";
import { getBrandVoiceStub } from "@/lib/brand-voice-stubs";

// Invalidate persona cache on save so next draft picks up changes immediately
async function bustPersonaCache(workspaceId: string) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    const redis = new Redis({ url, token });
    await redis.del(`persona:${workspaceId}`);
  } catch { /* best-effort */ }
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: "WORKSPACE_NOT_FOUND" }, { status: 404 });
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("workspaces")
    .select("name, support_email, brand_voice, default_tone, slack_webhook_url")
    .eq("id", workspaceId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    name:            data.name              ?? "",
    supportEmail:    data.support_email      ?? "",
    brandVoice:      data.brand_voice        ?? "",
    defaultTone:     data.default_tone       ?? "professional",
    slackWebhookUrl: (data as Record<string, unknown>).slack_webhook_url ?? null,
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: "WORKSPACE_NOT_FOUND" }, { status: 404 });
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
  const VALID_TONES = new Set(["professional", "empathetic", "casual", "direct"]);
  if (typeof body.defaultTone === "string") {
    if (!VALID_TONES.has(body.defaultTone)) {
      return NextResponse.json({ error: "INVALID_TONE", message: "defaultTone must be professional|empathetic|casual|direct" }, { status: 400 });
    }
    updates.default_tone = body.defaultTone;
  }
  if ("slackWebhookUrl" in body) {
    if (body.slackWebhookUrl) {
      const url = body.slackWebhookUrl.trim();
      if (!url.startsWith("https://hooks.slack.com/")) {
        return NextResponse.json({ error: "INVALID_SLACK_URL", message: "Slack webhook URL must start with https://hooks.slack.com/" }, { status: 400 });
      }
      updates.slack_webhook_url = url;
    } else {
      updates.slack_webhook_url = null;
    }
  }

  if (typeof body.appCategory === "string") {
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
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  const sb = getServiceClient();
  const { error } = await sb
    .from("workspaces")
    .update(updates)
    .eq("id", workspaceId);

  if (error) {
    console.error("workspace update failed:", error);
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  await bustPersonaCache(workspaceId);

  return NextResponse.json({ ok: true });
}
