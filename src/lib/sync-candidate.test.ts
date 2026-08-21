import { describe, expect, it } from "vitest";
import {
  evaluateWorkspaceSyncCandidate,
  FRESHNESS_OBJECTIVE_HOURS,
  SUB_DAILY_CADENCE_HOURS,
  SYNC_CRON_INTERVAL_HOURS,
  type AppSyncState,
} from "./sync-candidate";

describe("evaluateWorkspaceSyncCandidate", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  it("returns shouldSync: false when workspace has no apps", () => {
    const result = evaluateWorkspaceSyncCandidate([], now);
    expect(result.shouldSync).toBe(false);
    expect(result.reason).toBe("no_active_apps");
  });

  it("returns shouldSync: false when all apps are deleted or missing store_id", () => {
    const apps: AppSyncState[] = [
      {
        id: "app-1",
        workspace_id: "ws-1",
        store_id: null,
        deleted_at: null,
        last_synced_at: null,
        last_sync_attempted_at: null,
      },
      {
        id: "app-2",
        workspace_id: "ws-1",
        store_id: "com.example.app",
        deleted_at: "2026-08-19T10:00:00Z",
        last_synced_at: null,
        last_sync_attempted_at: null,
      },
    ];
    const result = evaluateWorkspaceSyncCandidate(apps, now);
    expect(result.shouldSync).toBe(false);
    expect(result.reason).toBe("no_active_apps");
  });

  it("returns shouldSync: true when an active app has never synced", () => {
    const apps: AppSyncState[] = [
      {
        id: "app-1",
        workspace_id: "ws-1",
        store_id: "com.example.app",
        deleted_at: null,
        last_synced_at: null,
        last_sync_attempted_at: null,
      },
    ];
    const result = evaluateWorkspaceSyncCandidate(apps, now);
    expect(result.shouldSync).toBe(true);
    expect(result.reason).toBe("never_synced");
  });

  it("returns shouldSync: false when active apps were synced inside the cadence window", () => {
    const apps: AppSyncState[] = [
      {
        id: "app-1",
        workspace_id: "ws-1",
        store_id: "com.example.app",
        deleted_at: null,
        last_synced_at: "2026-08-20T11:45:00.000Z", // 15 minutes ago
        last_sync_attempted_at: "2026-08-20T11:45:00.000Z",
      },
    ];
    const result = evaluateWorkspaceSyncCandidate(apps, now);
    expect(result.shouldSync).toBe(false);
    expect(result.reason).toBe("up_to_date");
  });

  it("returns shouldSync: true when the last successful sync is older than the cadence window", () => {
    const apps: AppSyncState[] = [
      {
        id: "app-1",
        workspace_id: "ws-1",
        store_id: "com.example.app",
        deleted_at: null,
        last_synced_at: "2026-08-20T08:30:00.000Z", // 3.5 hours ago
        last_sync_attempted_at: "2026-08-20T08:30:00.000Z",
      },
    ];
    const result = evaluateWorkspaceSyncCandidate(apps, now);
    expect(result.shouldSync).toBe(true);
    expect(result.reason).toBe("stale_sync");
  });

  it("returns shouldSync: true if at least one active app in the workspace is stale", () => {
    const apps: AppSyncState[] = [
      {
        id: "app-fresh",
        workspace_id: "ws-1",
        store_id: "com.example.app1",
        deleted_at: null,
        last_synced_at: "2026-08-20T11:30:00.000Z", // 30 mins ago
        last_sync_attempted_at: "2026-08-20T11:30:00.000Z",
      },
      {
        id: "app-stale",
        workspace_id: "ws-1",
        store_id: "com.example.app2",
        deleted_at: null,
        last_synced_at: "2026-08-20T07:00:00.000Z", // 5 hours ago
        last_sync_attempted_at: "2026-08-20T07:00:00.000Z",
      },
    ];
    const result = evaluateWorkspaceSyncCandidate(apps, now);
    expect(result.shouldSync).toBe(true);
    expect(result.reason).toBe("stale_sync");
  });
});

// ── Scheduling simulation ─────────────────────────────────────────────────────
//
// The tests above check one decision in isolation. They cannot see the property
// that actually matters to a customer: how long a review can sit in the store
// before we show it. That is a function of the cron interval AND the threshold
// together, so it is only observable by running the scheduler.
//
// These drive the REAL evaluateWorkspaceSyncCandidate over a simulated week of
// cron ticks and measure the largest gap between successful syncs. A regression
// in either constant fails here rather than being discovered by a customer
// looking at a stale dashboard.

const HOUR_MS = 3_600_000;
const T0 = new Date("2026-08-20T00:00:00.000Z").getTime();

function syncedApp(lastSyncedMs: number): AppSyncState {
  return {
    id: "app-1",
    workspace_id: "ws-1",
    store_id: "com.example.app",
    deleted_at: null,
    last_synced_at: new Date(lastSyncedMs).toISOString(),
    last_sync_attempted_at: new Date(lastSyncedMs).toISOString(),
  };
}

/**
 * Largest interval (in hours) between two successful syncs of one active
 * workspace, over `horizonHours` of cron ticks.
 *
 * @param offCycleAtHour When an off-cycle sync lands, in hours after T0.
 *   Models onboarding's inline sync, Settings → "Sync now", and the dashboard
 *   self-heal kick — all of which write `last_synced_at` between cron ticks.
 *   `null` means cron is the only trigger.
 */
function maxSyncGapHours(params: {
  cronHours: number;
  cadenceHours: number;
  offCycleAtHour?: number | null;
  horizonHours?: number;
}): number {
  const { cronHours, cadenceHours, offCycleAtHour = null, horizonHours = 24 * 7 } = params;

  let lastSynced = T0; // a sync completed at T0
  let maxGap = 0;
  const recordSync = (atMs: number): void => {
    maxGap = Math.max(maxGap, (atMs - lastSynced) / HOUR_MS);
    lastSynced = atMs;
  };

  const offCycleMs = offCycleAtHour === null ? null : T0 + offCycleAtHour * HOUR_MS;
  let offCyclePending = offCycleMs !== null;

  for (let h = cronHours; h <= horizonHours; h += cronHours) {
    const tick = T0 + h * HOUR_MS;

    // The off-cycle sync happens before this tick is evaluated.
    if (offCyclePending && offCycleMs! <= tick) {
      recordSync(offCycleMs!);
      offCyclePending = false;
    }

    if (evaluateWorkspaceSyncCandidate([syncedApp(lastSynced)], new Date(tick), cadenceHours).shouldSync) {
      recordSync(tick);
    }
  }

  return maxGap;
}

describe("sub-daily sync cadence — end-to-end scheduling behaviour", () => {
  it("derives the threshold from the cron interval so the two cannot drift apart", () => {
    expect(SYNC_CRON_INTERVAL_HOURS + SUB_DAILY_CADENCE_HOURS).toBeLessThanOrEqual(
      FRESHNESS_OBJECTIVE_HOURS,
    );
    // A cron slower than the objective cannot be rescued by any threshold.
    expect(SYNC_CRON_INTERVAL_HOURS).toBeLessThanOrEqual(FRESHNESS_OBJECTIVE_HOURS);
  });

  it("syncs a cron-only workspace once per cron tick", () => {
    expect(
      maxSyncGapHours({
        cronHours: SYNC_CRON_INTERVAL_HOURS,
        cadenceHours: SUB_DAILY_CADENCE_HOURS,
      }),
    ).toBe(SYNC_CRON_INTERVAL_HOURS);
  });

  it("stays within the freshness objective no matter when an off-cycle sync lands", () => {
    // Sweep every 5-minute offset across a whole cron window. An off-cycle sync
    // is the only thing that can desynchronise a workspace from the tick grid,
    // so this covers every reachable phase.
    const gaps: Array<{ offsetHours: number; gap: number }> = [];
    for (let minutes = 0; minutes < SYNC_CRON_INTERVAL_HOURS * 60; minutes += 5) {
      gaps.push({
        offsetHours: minutes / 60,
        gap: maxSyncGapHours({
          cronHours: SYNC_CRON_INTERVAL_HOURS,
          cadenceHours: SUB_DAILY_CADENCE_HOURS,
          offCycleAtHour: minutes / 60,
        }),
      });
    }

    const worst = gaps.reduce((a, b) => (b.gap > a.gap ? b : a));
    expect(
      worst.gap,
      `worst gap ${worst.gap}h with an off-cycle sync ${worst.offsetHours}h after a tick`,
    ).toBeLessThanOrEqual(FRESHNESS_OBJECTIVE_HOURS);
  });

  it("would breach the objective at the 2-hour threshold this replaced", () => {
    // Documents WHY the threshold is derived rather than hand-picked. The
    // shipped pairing (3h cron + 2h threshold) skipped any workspace whose last
    // sync landed 1-3h after a tick, pushing it to the tick after — 5 hours.
    expect(
      maxSyncGapHours({ cronHours: 3, cadenceHours: 2, offCycleAtHour: 1 }),
    ).toBe(5);
  });

  it("holds the objective if the cron interval is widened to the objective itself", () => {
    // At C = objective the derived threshold is 0: every tick syncs every
    // active workspace, which is the only correct behaviour there.
    expect(
      maxSyncGapHours({
        cronHours: FRESHNESS_OBJECTIVE_HOURS,
        cadenceHours: Math.max(0, FRESHNESS_OBJECTIVE_HOURS - FRESHNESS_OBJECTIVE_HOURS),
        offCycleAtHour: 3.5,
      }),
    ).toBeLessThanOrEqual(FRESHNESS_OBJECTIVE_HOURS);
  });
});
