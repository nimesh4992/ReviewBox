/**
 * sync-lock.ts — one review sync per workspace at a time.
 *
 * `syncWorkspace()` is reachable from four independent triggers:
 *
 *   1. the daily cron coordinator, which fans out one worker request per
 *      workspace (`/api/sync/reviews`),
 *   2. the Settings → Apps "Sync now" button,
 *   3. the dashboard's self-heal kick, which fires on page load whenever an
 *      app looks unsynced, and
 *   4. `/api/onboarding/complete` and `POST /api/apps`, which sync inline so a
 *      brand-new workspace isn't empty until the next cron run.
 *
 * Nothing stopped two of those from running at the same moment for one
 * workspace, and the sync is a read-then-write over shared rows:
 * `planSyncWrites()` asks "which of these reviews have I already got?", then
 * inserts the ones it hasn't. Two overlapping runs both read before either
 * writes, so both classify the same fetched review as new.
 *
 * ── What that actually costs ─────────────────────────────────────────────────
 *
 * Two things are already safe, and are listed here so nobody re-solves them:
 *
 *   - Duplicate review ROWS cannot happen. `reviews` carries
 *     `unique (app_id, external_id)` and the write is an upsert with
 *     `ignoreDuplicates: true`, so the loser of the race no-ops.
 *   - Duplicate spike alerts cannot happen. Both the email and the Slack path
 *     take a Redis SET NX claim per app+version.
 *
 * What is NOT safe:
 *
 *   - `runAutomationRules()` runs twice over the same reviews. The losing
 *     upsert still resolves the same review ids afterwards, so both runs
 *     execute every matching rule: two Groq calls per review, `times_run`
 *     counted twice, two rows in `automation_execution_logs`.
 *   - `enrichOnboarding()` runs twice. Its idempotency guard is a count read
 *     followed by an insert — itself a read-then-write — so two runs both see
 *     an empty knowledge base and both fill it, and the workspace starts life
 *     with every KB entry and starter template duplicated.
 *   - Every store fetch happens twice. That doubles the outbound volume the
 *     manual-sync rate limit exists to keep under Google's block threshold,
 *     against a shared egress IP.
 *
 * All of those are internal or wasteful. The one that is neither is
 * `auto_reply`, which publishes to the live Google Play / App Store listing —
 * two runs means two different AI-written replies posted publicly under one
 * customer's review. That is why `auto_reply` is excluded from
 * `SELECTABLE_AUTOMATION_ACTIONS` and why this module is its stated
 * prerequisite (backlog AS1).
 *
 * ── Fail-open, deliberately ──────────────────────────────────────────────────
 *
 * If Redis is unconfigured or unreachable, the sync runs WITHOUT the lock
 * rather than not at all. A lock that can take the product offline when the
 * cache has a bad minute is a worse trade than the race it prevents — and the
 * un-locked path is exactly today's behaviour, so failing open is never a
 * regression. `auto_reply` must therefore still not be enabled on the strength
 * of this module alone without a Redis availability story; see ADR 009.
 */

import { Redis } from "@upstash/redis";

/**
 * How long a lock survives without being released.
 *
 * The sync route declares `maxDuration = 60`, so a worker that is killed
 * mid-run is gone by 60s; 90 leaves headroom for the response to be written
 * and for clock skew, without stranding the workspace for minutes if a run
 * dies in a way that skips the `finally`.
 */
export const SYNC_LOCK_TTL_SECONDS = 90;

function lockKey(workspaceId: string): string {
  return `sync:lock:${workspaceId}`;
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

/**
 * Release only if we still hold the lock.
 *
 * A plain `DEL` is wrong: if our run overran the TTL, the key we would delete
 * belongs to whoever acquired it after us, and deleting it lets a third run
 * start alongside them — the lock would actively cause the race it exists to
 * prevent. Comparing the token and deleting in one round trip closes that.
 */
const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

export type SyncLockOutcome<T> =
  /** The lock was acquired (or Redis was unavailable) and `run` executed. */
  | { ran: true; result: T }
  /** Another sync for this workspace was already in flight; `run` did not execute. */
  | { ran: false; reason: "already_running" };

/**
 * Run `work` while holding this workspace's sync lock.
 *
 * Returns `{ ran: false }` — not an error — when another sync holds the lock.
 * A skipped sync is a correct outcome, not a failure: the run that holds the
 * lock is fetching the same reviews from the same stores, so the caller loses
 * nothing by standing down. Callers surface it as `skipped`, never as an error,
 * so a user clicking "Sync now" during the cron run isn't shown a red banner
 * for something that is working exactly as intended.
 *
 * Errors thrown by `work` propagate to the caller unchanged, and the lock is
 * still released.
 */
export async function withWorkspaceSyncLock<T>(
  workspaceId: string,
  work: () => Promise<T>,
): Promise<SyncLockOutcome<T>> {
  const redis = getRedis();
  if (!redis) return { ran: true, result: await work() };

  const token = crypto.randomUUID();
  const key = lockKey(workspaceId);

  let acquired: string | null;
  try {
    // NX = only set if absent. Upstash returns "OK" on success, null when the
    // key already exists.
    acquired = await redis.set(key, token, { nx: true, ex: SYNC_LOCK_TTL_SECONDS });
  } catch (err) {
    // Redis is down. Run unlocked rather than refusing to sync at all.
    console.error("[sync-lock] acquire failed, running unlocked:", err);
    return { ran: true, result: await work() };
  }

  if (acquired === null) return { ran: false, reason: "already_running" };

  try {
    return { ran: true, result: await work() };
  } finally {
    try {
      await redis.eval(RELEASE_SCRIPT, [key], [token]);
    } catch (err) {
      // The TTL will clear it. Worst case the workspace can't sync again for
      // ~90s, which is invisible next to a daily cron.
      console.error("[sync-lock] release failed, TTL will clear it:", err);
    }
  }
}
