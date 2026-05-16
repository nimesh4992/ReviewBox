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

/**
 * Derive a cache key using Web Crypto SHA-256.
 * Available in Node 18+ and all Edge Runtimes without any imports.
 */
async function buildCacheKey(
  review: { text: string; rating: number },
  tone: string,
): Promise<string> {
  const raw = (review.text ?? "").slice(0, 200) + "|" + review.rating + "|" + tone;
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
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
  review: { text: string; rating: number },
  tone: string,
): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const key    = await buildCacheKey(review, tone);
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
  review: { text: string; rating: number },
  tone: string,
  reply: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = await buildCacheKey(review, tone);
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
  review: { text: string; rating: number },
  tone: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    const key = await buildCacheKey(review, tone);
    await redis.del(key);
  } catch {
    // Best-effort: ignore errors
  }
}
