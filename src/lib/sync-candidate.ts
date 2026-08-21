/**
 * sync-candidate.ts
 *
 * Evaluates whether a workspace is an active candidate for sub-daily review sync.
 * Prevents unconnected/empty workspaces and recently-synced workspaces from
 * consuming provider rate limits and Vercel compute on every cron tick.
 */

export interface AppSyncState {
  id: string;
  workspace_id: string;
  store_id: string | null;
  deleted_at: string | null;
  last_synced_at: string | null;
  last_sync_attempted_at: string | null;
}

/**
 * The freshness we promise a customer: a review posted to the store is visible
 * in ReviewBox within this many hours. P1-1's objective.
 */
export const FRESHNESS_OBJECTIVE_HOURS = 4;

/**
 * How often the coordinator cron actually fires. MUST match the
 * `/api/sync/reviews` schedule in `vercel.json`; `subdaily-sync.test.ts` parses
 * the cron expression and fails if the two drift apart.
 */
export const SYNC_CRON_INTERVAL_HOURS = 3;

/**
 * ── The scheduling math. Read this before changing either constant. ──────────
 *
 * The coordinator can only act when the cron fires, so the threshold and the
 * cron interval COMPOUND. They are not independent knobs.
 *
 * Let C = cron interval, h = this threshold, and s = how long after a cron tick
 * the workspace's last sync landed (an off-cycle sync — onboarding's inline
 * kick, Settings → "Sync now", or the dashboard self-heal — can land at any s;
 * a cron-only workspace always has s = 0).
 *
 *   The next tick is C - s after that sync. It SKIPS the workspace when
 *   C - s < h, i.e. whenever s > C - h. The tick after that is C later, so
 *
 *       worst-case interval = C + h   (approached as s → C - h)
 *
 * With the shipped C = 3 and h = 2 that is **5 hours** — over the 4-hour
 * objective, and reached by nothing more exotic than a customer clicking
 * "Sync now" 1–3 hours after a cron tick. The 3h cron alone was never the
 * problem; pairing it with a 2h threshold was.
 *
 * So the threshold is DERIVED, not chosen: h = objective - C. Changing the cron
 * in `vercel.json` moves it automatically instead of silently re-opening the
 * same gap. At h = 0 every tick syncs every active workspace, which is the
 * correct degenerate case when C already equals the objective.
 */
export const SUB_DAILY_CADENCE_HOURS = Math.max(
  0,
  FRESHNESS_OBJECTIVE_HOURS - SYNC_CRON_INTERVAL_HOURS,
);

export interface SyncCandidateEvaluation {
  shouldSync: boolean;
  reason: "no_active_apps" | "stale_sync" | "never_synced" | "up_to_date";
}

/**
 * Determine if a workspace needs to be queued for sub-daily sync.
 *
 * @param apps List of active (non-deleted) apps for the workspace
 * @param now Reference timestamp (defaults to current time)
 * @param cadenceHours Minimum elapsed hours since last sync before triggering a
 *   new sync. Defaults to SUB_DAILY_CADENCE_HOURS — pass an override only from
 *   tests that are exploring the scheduling math.
 */
export function evaluateWorkspaceSyncCandidate(
  apps: AppSyncState[],
  now: Date = new Date(),
  cadenceHours: number = SUB_DAILY_CADENCE_HOURS,
): SyncCandidateEvaluation {
  // Filter out deleted apps or apps without a store identifier
  const activeApps = apps.filter((a) => !a.deleted_at && !!a.store_id?.trim());

  if (activeApps.length === 0) {
    return { shouldSync: false, reason: "no_active_apps" };
  }

  const cutoff = new Date(now.getTime() - cadenceHours * 60 * 60 * 1000);

  // If any active app has never had a successful sync, workspace needs sync
  const hasNeverSynced = activeApps.some((a) => !a.last_synced_at);
  if (hasNeverSynced) {
    return { shouldSync: true, reason: "never_synced" };
  }

  // If any active app's last_synced_at is older than the cadence window, workspace needs sync
  const hasStaleSync = activeApps.some((a) => {
    const lastSynced = new Date(a.last_synced_at!);
    return lastSynced < cutoff;
  });

  if (hasStaleSync) {
    return { shouldSync: true, reason: "stale_sync" };
  }

  return { shouldSync: false, reason: "up_to_date" };
}
