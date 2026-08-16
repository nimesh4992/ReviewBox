/**
 * workspace-persona.ts
 *
 * Resolves the workspace-specific identity used to personalise reply text.
 * Templates use {appName}, {supportEmail}, {teamName} placeholders — this
 * module replaces them with real values fetched from the workspaces table.
 *
 * Redis caches the persona for 1 hour so we don't hit Supabase on every draft.
 * All functions degrade gracefully — a DB or cache failure returns safe defaults.
 */

import { Redis } from "@upstash/redis";
import { getServiceClient } from "@/lib/supabase-server";
import { getBrandVoiceStub } from "@/lib/brand-voice-stubs";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkspacePersona {
  /** Display name of the app / product (e.g. "Acme Tracker") */
  appName: string;
  /** Support email shown in reply CTAs */
  supportEmail: string;
  /** Sign-off team name (e.g. "The Acme Tracker Team") */
  teamName: string;
  /**
   * 1-3 sentence brand voice description set in workspace settings.
   * Injected into AI system prompts for tone/personality alignment.
   * e.g. "We're a friendly fitness app for beginners. We avoid jargon,
   *        use encouraging language, and always offer a practical next step."
   */
  brandVoice?: string;
}

// ── Defaults ──────────────────────────────────────────────────────────────────

export const DEFAULT_PERSONA: WorkspacePersona = {
  appName:      "the app",
  supportEmail: "hello@tryreviewbox.com",
  teamName:     "The Support Team",
};

// ── Redis ─────────────────────────────────────────────────────────────────────

const PERSONA_TTL = 60 * 60; // 1 hour
let _redis: Redis | null = null;

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Fetch (and cache) the persona used to sign replies, for a workspace and —
 * when known — the specific app the review belongs to.
 *
 * `appName` and `teamName` come from the APP, not the workspace. They used to
 * come from `workspaces.name`, which is the customer's own internal label:
 * a workspace called "AT WORK" containing an app called "Mumbai One" signed
 * every public reply to a Mumbai One reviewer as "The AT WORK Team", and
 * rendered "{appName}" as "AT WORK". The reviewer has never heard of the
 * workspace — they left a review on an app. Whatever we sign has to be the
 * name they recognise, because these replies are published on the store under
 * the developer's name.
 *
 * Passing `appId` is preferred. Without it, a workspace with exactly one live
 * app still resolves correctly; a multi-app workspace falls back to the
 * workspace name rather than picking an app arbitrarily.
 */
export async function getWorkspacePersona(
  workspaceId: string,
  appId?: string,
): Promise<WorkspacePersona> {
  // 1. Try Redis cache
  const redis = getRedis();
  const cacheKey = personaCacheKey(workspaceId, appId);
  if (redis) {
    try {
      const cached = await redis.get<WorkspacePersona>(cacheKey);
      if (cached) return cached;
    } catch {
      // cache miss — continue
    }
  }

  // 2. Query Supabase workspaces table
  try {
    const sb = getServiceClient();

    const [wsRes, appName] = await Promise.all([
      sb
        .from("workspaces")
        .select("name, support_email, brand_voice, app_category")
        .eq("id", workspaceId)
        .maybeSingle(),
      resolveAppName(workspaceId, appId),
    ]);

    const data = wsRes.data;
    if (data) {
      const workspaceName = (data.name as string | null) ?? "";
      const email       = (data.support_email as string | null) ?? DEFAULT_PERSONA.supportEmail;
      const savedVoice  = (data.brand_voice as string | null) ?? undefined;
      const category    = (data.app_category as string | null) ?? undefined;
      // If user hasn't customised brand_voice yet, use category-based stub.
      // This means every workspace gets meaningful AI voice from day 1.
      const brandVoice  = savedVoice || (category ? getBrandVoiceStub(category) : undefined);

      // App name wins; workspace name is the fallback, not the source.
      const signingName = appName || workspaceName;

      const persona: WorkspacePersona = {
        appName:      signingName || DEFAULT_PERSONA.appName,
        supportEmail: email,
        teamName:     signingName ? `The ${signingName} Team` : DEFAULT_PERSONA.teamName,
        brandVoice,
      };

      // Store in cache
      if (redis) {
        redis.setex(cacheKey, PERSONA_TTL, persona).catch(() => undefined);
      }
      return persona;
    }
  } catch {
    // DB unavailable — fall through to default
  }

  return DEFAULT_PERSONA;
}

/**
 * Name of the app a reply is being signed for.
 *
 * With an appId, that app (scoped to the workspace so a foreign id can't leak
 * a name across tenants). Without one, the workspace's single live app —
 * which is the shape of nearly every account. Two or more live apps and there
 * is no right answer, so it returns null and the caller falls back.
 */
async function resolveAppName(workspaceId: string, appId?: string): Promise<string> {
  try {
    const sb = getServiceClient();
    const query = sb
      .from("apps")
      .select("name")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);

    if (appId) {
      const { data } = await query.eq("id", appId).maybeSingle();
      return ((data?.name as string | null) ?? "").trim();
    }

    // limit(2): enough to tell "exactly one" from "more than one".
    const { data } = await query.limit(2);
    const rows = (data ?? []) as { name: string | null }[];
    if (rows.length !== 1) return "";
    return (rows[0].name ?? "").trim();
  } catch {
    return "";
  }
}

/** Cache key for a persona. Exported so settings can invalidate every variant. */
export function personaCacheKey(workspaceId: string, appId?: string): string {
  return `persona:${workspaceId}:${appId ?? "ws"}`;
}

// ── Text personalisation ──────────────────────────────────────────────────────

/**
 * Replace template placeholders with workspace-specific values.
 *
 * Placeholders (case-insensitive):
 *   {appName}      → persona.appName
 *   {supportEmail} → persona.supportEmail
 *   {teamName}     → persona.teamName
 */
export function personalizeText(
  text: string,
  persona: WorkspacePersona,
): string {
  return text
    .replace(/\{appName\}/gi,      persona.appName)
    .replace(/\{supportEmail\}/gi, persona.supportEmail)
    .replace(/\{teamName\}/gi,     persona.teamName);
}
