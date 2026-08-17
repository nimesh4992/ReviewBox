/**
 * reply-cache.ts
 *
 * Redis-backed exact-match reply cache.
 * Key: "reply_cache:" + SHA-256(workspace | app | review text | rating | tone | system prompt)
 * TTL: 7 days (604 800 seconds)
 *
 * Designed to be called in the reply/draft route AFTER template matching
 * and BEFORE the Groq API call.
 *
 * ── Why the key carries the workspace, app and prompt ────────────────────────
 * The cached value is the RAW MODEL OUTPUT, and the model's system prompt bakes
 * in the workspace's team sign-off ("- The Acme Team"), its brand voice, a
 * snippet of its private Knowledge Base, and the platform char limit. The
 * original key hashed only text+rating+tone, which made the cache GLOBAL across
 * tenants: workspace B could be served workspace A's draft — signed with A's
 * team name and referencing A's internal KB notes — and publish it to the store
 * under B's developer account. Short negative reviews ("Crashes on login",
 * "Doesn't work") are byte-identical across thousands of apps, so this was a
 * live cross-tenant leak, not a theoretical one. Scoping the key trades hit
 * rate for isolation; isolation wins.
 *
 * Graceful degradation: every function swallows Redis errors and returns
 * a safe fallback — the reply pipeline is never blocked by a cache failure.
 */

import { Redis } from "@upstash/redis";

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const KEY_PREFIX = "reply_cache:";

/** Everything that shapes the cached model output besides the review itself. */
export interface ReplyCacheScope {
  /** Tenant boundary — a cached draft must never cross it. */
  workspaceId: string | null;
  /** App the reply is signed for; null/undefined = workspace default persona. */
  appId?: string | null;
  /**
   * The full system prompt sent to the model. Covers brand voice, team
   * sign-off, KB snippet and char limit in one field, so a change to any of
   * them naturally misses the cache instead of serving a stale draft.
   */
  systemPrompt: string;
}

// ── Redis singleton ───────────────────────────────────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

// ── Cache key ─────────────────────────────────────────────────────────────────

/**
 * The exact string that gets hashed. Exported for tests: the tenant boundary
 * being part of the key is a security property, and a refactor that drops it
 * must fail a test, not a customer.
 */
export function buildCacheKeyRaw(
  scope: ReplyCacheScope,
  review: { text: string; rating: number },
  tone: string,
): string {
  return [
    scope.workspaceId ?? "anon",
    scope.appId ?? "ws",
    // The WHOLE body, not the first 200 characters. The model is given the
    // full text, so two reviews that share an opening paragraph and diverge
    // afterwards would otherwise collide and be answered with each other's
    // reply. Hashing costs the same either way.
    review.text ?? "",
    review.rating,
    tone,
    scope.systemPrompt,
  ].join("|");
}

/**
 * Derive a cache key using Web Crypto SHA-256.
 * Available in Node 18+ and all Edge Runtimes without any imports.
 */
async function buildCacheKey(
  scope: ReplyCacheScope,
  review: { text: string; rating: number },
  tone: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(buildCacheKeyRaw(scope, review, tone));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return KEY_PREFIX + hex;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up a cached reply.
 * Returns the cached string on hit, or null on miss / error / missing config.
 */
export async function getCachedReply(
  scope: ReplyCacheScope,
  review: { text: string; rating: number },
  tone: string,
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  // No workspace = no tenant boundary to key on. Sharing an "anon" bucket
  // would be the very leak this module was rewritten to close, so such a
  // caller simply does not use the cache.
  if (!scope.workspaceId) return null;
  try {
    const key    = await buildCacheKey(scope, review, tone);
    const cached = await redis.get<string>(key);
    return cached ?? null;
  } catch {
    return null;
  }
}

/**
 * Store a generated reply in the cache.
 * Best-effort — swallows all errors so it never blocks the response.
 */
export async function setCachedReply(
  scope: ReplyCacheScope,
  review: { text: string; rating: number },
  tone: string,
  reply: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  if (!scope.workspaceId) return; // see getCachedReply
  try {
    const key = await buildCacheKey(scope, review, tone);
    await redis.setex(key, CACHE_TTL_SECONDS, reply);
  } catch {
    // Best-effort: ignore errors
  }
}

/**
 * Remove a cached reply (e.g. after a template update makes it stale).
 * Graceful no-op if the key doesn't exist.
 */
export async function invalidateCachedReply(
  scope: ReplyCacheScope,
  review: { text: string; rating: number },
  tone: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = await buildCacheKey(scope, review, tone);
    await redis.del(key);
  } catch {
    // Best-effort: ignore errors
  }
}
