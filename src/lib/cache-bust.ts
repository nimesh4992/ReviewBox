/**
 * cache-bust.ts
 *
 * Deleting Redis keys by pattern, for the mutations that invalidate a whole
 * family of cached derivations at once.
 *
 * The case this exists for: removing an app deletes its reviews from the
 * database, but the AI review summary (1h TTL) and the ASO suggestions (24h)
 * were computed from those reviews and cached under keys nothing ever
 * cleared. The dashboard kept describing an app the customer had just
 * disconnected, and the summary's own Refresh button could not shift it.
 *
 * Best-effort throughout: a cache we failed to clear is a stale read, never a
 * failed request.
 */

import { Redis } from "@upstash/redis";

/** Cap the SCAN so an unexpectedly large keyspace can't hold a request open. */
const MAX_KEYS = 500;
/** …and cap the number of SCAN round trips per pattern for the same reason. */
const MAX_SWEEPS = 20;

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Delete every key matching any of `patterns` (Redis MATCH globs).
 * Returns the number of keys deleted; 0 when Redis isn't configured.
 */
export async function deleteKeysByPattern(patterns: readonly string[]): Promise<number> {
  const redis = getRedis();
  if (!redis || patterns.length === 0) return 0;

  try {
    const keys: string[] = [];
    for (const match of patterns) {
      let cursor = "0";
      // SCAN walks the WHOLE keyspace regardless of how many keys match, so a
      // key-count bound alone would let each pattern sweep the entire database
      // on a workspace that has nothing cached. Bound the iterations too.
      let sweeps = 0;
      do {
        const [next, batch] = await redis.scan(cursor, { match, count: 500 });
        keys.push(...batch);
        cursor = String(next);
        sweeps += 1;
      } while (cursor !== "0" && keys.length < MAX_KEYS && sweeps < MAX_SWEEPS);
    }
    if (!keys.length) return 0;
    await redis.del(...keys);
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Clear the workspace-scoped derived caches after a change to which apps
 * exist (add / remove). Anything keyed per (workspace, app) belongs here.
 */
export async function bustWorkspaceDerivedCaches(workspaceId: string): Promise<void> {
  await deleteKeysByPattern([
    `ai_summary_text:${workspaceId}:*`,
    `aso_suggest:${workspaceId}:*`,
    `persona:${workspaceId}:*`,
  ]);
}
