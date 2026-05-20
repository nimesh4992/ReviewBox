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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WorkspacePersona {
  /** Display name of the app / product (e.g. "Acme Tracker") */
  appName: string;
  /** Support email shown in reply CTAs */
  supportEmail: string;
  /** Sign-off team name (e.g. "The Acme Tracker Team") */
  teamName: string;
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
 * Fetch (and cache) the persona for a workspace.
 * Falls back to DEFAULT_PERSONA on any error.
 */
export async function getWorkspacePersona(
  workspaceId: string,
): Promise<WorkspacePersona> {
  // 1. Try Redis cache
  const redis = getRedis();
  const cacheKey = `persona:${workspaceId}`;
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
    const { data } = await sb
      .from("workspaces")
      .select("name, support_email")
      .eq("id", workspaceId)
      .single();

    if (data) {
      const name    = (data.name as string | null) ?? "";
      const email   = (data.support_email as string | null) ?? DEFAULT_PERSONA.supportEmail;
      const persona: WorkspacePersona = {
        appName:      name || DEFAULT_PERSONA.appName,
        supportEmail: email,
        teamName:     name ? `The ${name} Team` : DEFAULT_PERSONA.teamName,
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
