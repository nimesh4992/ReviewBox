/**
 * reply-cache.ts
 *
 * Redis-backed exact-match reply cache.
 * Key: "reply_cache:" + SHA-256(review.text.slice(0,200) + rating + tone)
 * TTL: 7 days (604 800 seconds)
 *
 * Designed to be called in the reply/draft route AFTER template matching
 * and BEFORE the Groq API call.
 *
 * Expected hit rate after 2 weeks: ~40-60% of non-template requests
 * (reviews cluster into common patterns across users).
 *
 * Graceful degradation: every function swallows Redis errors and returns
 * a safe fallback — the reply pipeline is never blocked by a cache failure.
 */

import { Redis } from "@upstash/redis";

const CACHE_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const KEY_PREFIX = "reply_cache:";

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
//
// The workspace is part of the key, and `workspaceId` is a REQUIRED first
// argument so this cannot regress silently — omitting it is a compile error,
// not a quiet cross-tenant hit.
//
// It keyed on review text + rating + tone alone, in one global Redis namespace
// with a 7-day TTL. What lands in that namespace is not generic text: the AI
// tier builds the draft from the workspace's brand voice and its knowledge-base
// entries. Two customers with the same app, or the same boilerplate 1-star
// review ("app keeps crashing"), would serve each other's replies — one
// tenant's internal KB wording delivered to another, and to the public store.

/**
 * Derive a cache key using Web Crypto SHA-256.
 * Available in Node 18+ and all Edge Runtimes without any imports.
 */
async function buildCacheKey(
  workspaceId: string,
  review: { text: string; rating: number },
  tone: string,
): Promise<string> {
  // workspaceId is INSIDE the hash and also in the prefix. Inside, because two
  // tenants seeing the same review text must not collide. In the prefix,
  // because a human staring at Redis should be able to tell whose key it is.
  const raw =
    workspaceId + "|" + (review.text ?? "").slice(0, 200) + "|" + review.rating + "|" + tone;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${KEY_PREFIX}${workspaceId}:${hex}`;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Look up a cached reply.
 * Returns the cached string on hit, or null on miss / error / missing config.
 */
export async function getCachedReply(
  workspaceId: string,
  review: { text: string; rating: number },
  tone: string,
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const key    = await buildCacheKey(workspaceId, review, tone);
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
  workspaceId: string,
  review: { text: string; rating: number },
  tone: string,
  reply: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = await buildCacheKey(workspaceId, review, tone);
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
  workspaceId: string,
  review: { text: string; rating: number },
  tone: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = await buildCacheKey(workspaceId, review, tone);
    await redis.del(key);
  } catch {
    // Best-effort: ignore errors
  }
}
