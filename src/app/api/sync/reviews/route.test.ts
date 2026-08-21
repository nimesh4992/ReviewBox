/**
 * Coordinator-mode behaviour of the sub-daily sync cron (P1-1).
 *
 * `lib/sync-candidate.test.ts` proves the scheduling decision in isolation.
 * This file proves the coordinator ACTS on it: that the decision reaches the
 * fanout, and — more importantly — what happens when the query the decision
 * depends on fails. The candidate filter is an optimisation layered on top of a
 * working sync, so every failure mode has to fall back to syncing everyone.
 * Trusting an empty result instead means the cron reports "all up to date"
 * having queued nothing, which is a total sync outage that looks like success.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import * as supabaseServer from "@/lib/supabase-server";
import { SUB_DAILY_CADENCE_HOURS, SYNC_CRON_INTERVAL_HOURS } from "@/lib/sync-candidate";

// `after()` normally defers work past the response. Run it inline so the test
// can observe the fanout instead of racing it.
const afterCallbacks: Array<() => Promise<void> | void> = [];

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (cb: () => Promise<void> | void) => {
      afterCallbacks.push(cb);
    },
  };
});

vi.mock("@clerk/nextjs/server", () => ({ auth: vi.fn(async () => ({ userId: null })) }));
vi.mock("@/lib/api-rate-limit", () => ({ rateLimit: vi.fn(async () => ({ allowed: true })) }));
vi.mock("@/services/review-sync", () => ({ syncWorkspace: vi.fn(async () => ({})) }));
vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: vi.fn(),
  getWorkspaceId: vi.fn(),
}));

const CRON_SECRET = "cron-secret-for-tests";
const HOUR_MS = 3_600_000;

interface AppRow {
  id: string;
  workspace_id: string;
  store_id: string | null;
  deleted_at: string | null;
  last_synced_at: string | null;
  last_sync_attempted_at: string | null;
}

/** Awaitable PostgREST-shaped stub for the coordinator's two queries. */
function thenable(result: unknown): Record<string, unknown> {
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "eq", "is", "in", "order", "limit"]) builder[m] = () => builder;
  builder.then = (ok: (v: unknown) => unknown, err?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(ok, err);
  return builder;
}

function mockDb(opts: {
  workspaceIds: string[];
  apps: AppRow[];
  appsError?: { code?: string; message: string };
}): void {
  vi.mocked(supabaseServer.getServiceClient).mockReturnValue({
    from: (table: string) => {
      if (table === "workspaces") {
        return thenable({ data: opts.workspaceIds.map((id) => ({ id })), error: null });
      }
      if (table === "apps") {
        return thenable(
          opts.appsError
            ? { data: null, error: opts.appsError }
            : { data: opts.apps, error: null },
        );
      }
      return thenable({ data: [], error: null });
    },
  } as never);
}

function app(overrides: Partial<AppRow> & { workspace_id: string }): AppRow {
  return {
    id: `app-${overrides.workspace_id}`,
    store_id: "com.example.app",
    deleted_at: null,
    last_synced_at: null,
    last_sync_attempted_at: null,
    ...overrides,
  };
}

/** Hours ago, as an ISO timestamp. */
function hoursAgo(h: number): string {
  return new Date(Date.now() - h * HOUR_MS).toISOString();
}

async function runCoordinator(query = ""): Promise<{
  status: number;
  body: Record<string, unknown>;
  queuedWorkspaceIds: string[];
}> {
  const fetchSpy = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchSpy);

  const { GET } = await import("./route");
  const res = await GET(
    new NextRequest(`http://localhost:3000/api/sync/reviews${query}`, {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    }),
  );
  const body = (await res.json()) as Record<string, unknown>;

  // Drain the deferred fanout so we can see who was queued.
  for (const cb of afterCallbacks.splice(0)) await cb();

  // The stub is declared arg-less so eslint sees no unused parameters; the real
  // call passes (url, init), so read the recorded args through a cast.
  const calls = fetchSpy.mock.calls as unknown as Array<[string]>;
  const queuedWorkspaceIds = calls
    .map(([url]) => new URL(url).searchParams.get("workspaceId"))
    .filter((id): id is string => !!id);

  return { status: res.status, body, queuedWorkspaceIds };
}

describe("GET /api/sync/reviews — coordinator mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    vi.stubEnv("CRON_SECRET", CRON_SECRET);
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("queues a workspace whose last successful sync is older than the threshold", async () => {
    mockDb({
      workspaceIds: ["ws-stale"],
      apps: [app({ workspace_id: "ws-stale", last_synced_at: hoursAgo(SYNC_CRON_INTERVAL_HOURS) })],
    });

    const { body, queuedWorkspaceIds } = await runCoordinator();

    expect(queuedWorkspaceIds).toEqual(["ws-stale"]);
    expect(body.workspacesQueued).toBe(1);
    expect(body.candidateFilterApplied).toBe(true);
  });

  it("queues a workspace that has never synced", async () => {
    mockDb({
      workspaceIds: ["ws-new"],
      apps: [app({ workspace_id: "ws-new", last_synced_at: null })],
    });

    const { queuedWorkspaceIds } = await runCoordinator();
    expect(queuedWorkspaceIds).toEqual(["ws-new"]);
  });

  it("skips a workspace synced inside the threshold, and one with no apps", async () => {
    mockDb({
      workspaceIds: ["ws-fresh", "ws-empty"],
      apps: [
        app({
          workspace_id: "ws-fresh",
          // Comfortably inside the window whatever the derived threshold is.
          last_synced_at: hoursAgo(SUB_DAILY_CADENCE_HOURS / 4),
        }),
      ],
    });

    const { body, queuedWorkspaceIds } = await runCoordinator();

    expect(queuedWorkspaceIds).toEqual([]);
    expect(body.workspacesQueued).toBe(0);
    expect(body.workspacesEvaluated).toBe(2);
  });

  it("skips a workspace whose only app has no store id", async () => {
    mockDb({
      workspaceIds: ["ws-nameonly"],
      apps: [app({ workspace_id: "ws-nameonly", store_id: "   ", last_synced_at: null })],
    });

    const { queuedWorkspaceIds } = await runCoordinator();
    expect(queuedWorkspaceIds).toEqual([]);
  });

  it("still queues a workspace whose last sync FAILED", async () => {
    // recordSyncResult() only advances last_synced_at on success, so a broken
    // app stays stale and keeps being retried. A backoff would have to be added
    // deliberately; silently dropping it would strand the customer.
    mockDb({
      workspaceIds: ["ws-broken"],
      apps: [
        app({
          workspace_id: "ws-broken",
          last_synced_at: hoursAgo(72),
          last_sync_attempted_at: hoursAgo(0.1),
        }),
      ],
    });

    const { queuedWorkspaceIds } = await runCoordinator();
    expect(queuedWorkspaceIds).toEqual(["ws-broken"]);
  });

  it("fails OPEN and queues everyone when the apps listing errors", async () => {
    // Three of the selected columns come from later migrations, so this is a
    // live possibility. Trusting `data: null` would mark every workspace
    // app-less and queue nobody while reporting success.
    mockDb({
      workspaceIds: ["ws-a", "ws-b"],
      apps: [],
      appsError: { code: "42703", message: `column apps.last_sync_attempted_at does not exist` },
    });

    const { body, queuedWorkspaceIds } = await runCoordinator();

    expect(queuedWorkspaceIds.sort()).toEqual(["ws-a", "ws-b"]);
    expect(body.workspacesQueued).toBe(2);
    expect(body.candidateFilterApplied).toBe(false);
  });

  it("honours force=1 by queueing every workspace regardless of freshness", async () => {
    mockDb({
      workspaceIds: ["ws-fresh"],
      apps: [app({ workspace_id: "ws-fresh", last_synced_at: hoursAgo(0.01) })],
    });

    const { queuedWorkspaceIds } = await runCoordinator("?force=1");
    expect(queuedWorkspaceIds).toEqual(["ws-fresh"]);
  });

  it("reports the cadence it actually runs at rather than a hardcoded string", async () => {
    mockDb({
      workspaceIds: ["ws-new"],
      apps: [app({ workspace_id: "ws-new" })],
    });

    const { body } = await runCoordinator();
    expect(body.cadence).toBe(`${SYNC_CRON_INTERVAL_HOURS}h`);
    expect(body.stalenessThresholdHours).toBe(SUB_DAILY_CADENCE_HOURS);
  });

  it("returns early without a fanout when there are no active workspaces", async () => {
    mockDb({ workspaceIds: [], apps: [] });

    const { body, queuedWorkspaceIds } = await runCoordinator();
    expect(queuedWorkspaceIds).toEqual([]);
    expect(body.workspacesQueued).toBe(0);
  });
});
