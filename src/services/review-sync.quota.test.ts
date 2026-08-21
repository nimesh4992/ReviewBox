/**
 * Runtime proof that the monthly review quota gates the sync pipeline.
 *
 * Why this file exists: the quota's only other coverage is
 * `plan-enforcement.test.ts`, which greps `src/` for the string
 * "checkReviewLimit" and asserts it appears somewhere. That proves an import
 * exists, not that a workspace over its limit actually stops fetching — the
 * call could sit after the provider calls, or its result could be ignored, and
 * the grep would still pass.
 *
 * Moving from a daily cron to a sub-daily one (P1-1) multiplies the number of
 * times this gate is asked per day, so what matters is:
 *
 *   1. an over-limit workspace reaches NO provider, on every run, and
 *   2. an under-limit workspace still does.
 *
 * Both are asserted below against the real `syncWorkspace()` with only the
 * module boundaries (database, stores, notifications) mocked.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLAN_LIMITS } from "@/lib/plans";

// ── Database boundary ─────────────────────────────────────────────────────────

interface QueryResult {
  data?: unknown;
  count?: number | null;
  error?: { code?: string; message: string } | null;
}

/** Per-table canned results, plus a log of which tables were queried. */
let tableResults: Record<string, QueryResult> = {};
let queriedTables: string[] = [];

/**
 * A chainable PostgREST-shaped stub. Every filter/modifier returns `this`, and
 * awaiting the builder (or calling maybeSingle/single) resolves the canned
 * result for the table. Deliberately permissive about which methods are called
 * — this test asserts on the provider spies, not on query shape.
 */
function makeQueryBuilder(table: string): Record<string, unknown> {
  const result = (): QueryResult => tableResults[table] ?? { data: [], count: 0, error: null };

  const builder: Record<string, unknown> = {};
  const chainable = [
    "select", "eq", "is", "in", "gte", "lte", "not", "or", "order", "limit",
    "range", "update", "upsert", "insert", "delete", "head",
  ];
  for (const method of chainable) builder[method] = () => builder;

  builder.maybeSingle = () => Promise.resolve(result());
  builder.single = () => Promise.resolve(result());
  builder.then = (
    onFulfilled: (v: QueryResult) => unknown,
    onRejected?: (e: unknown) => unknown,
  ) => Promise.resolve(result()).then(onFulfilled, onRejected);

  return builder;
}

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      queriedTables.push(table);
      return makeQueryBuilder(table);
    },
  }),
  getWorkspaceId: vi.fn(),
}));

// ── Provider boundaries — the things a quota-blocked sync must never touch ────

const bootstrapReviews = vi.fn(async () => []);
const fetchAppMetadata = vi.fn(async () => null);
const findAppAcrossStorefronts = vi.fn(async () => null);
const fetchGooglePlayReviews = vi.fn(async () => []);

vi.mock("@/services/bootstrap-reviews", () => ({
  bootstrapReviews: (...args: unknown[]) => bootstrapReviews(...(args as [])),
}));
vi.mock("@/services/store-search", () => ({
  fetchAppMetadata: (...args: unknown[]) => fetchAppMetadata(...(args as [])),
  findAppAcrossStorefronts: (...args: unknown[]) => findAppAcrossStorefronts(...(args as [])),
}));
vi.mock("@/services/google-play/publisher-api", () => ({
  fetchReviews: (...args: unknown[]) => fetchGooglePlayReviews(...(args as [])),
}));
vi.mock("@/services/app-store/connect-api", () => ({
  buildJWT: vi.fn(() => "jwt"),
  fetchAppStoreId: vi.fn(async () => null),
  fetchReviews: vi.fn(async () => []),
}));

// ── Side-effect boundaries, silenced ─────────────────────────────────────────

vi.mock("@sentry/nextjs", () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));
vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: async () => ({ users: { getUser: async () => ({ emailAddresses: [] }) } }),
}));
vi.mock("@/lib/slack", () => ({ notifyRatingSpike: vi.fn(), notifyUrgentReview: vi.fn() }));
vi.mock("@/lib/automation-executor", () => ({ runAutomationRules: vi.fn() }));
vi.mock("@/lib/email/send-rating-spike-alert", () => ({ sendRatingSpikeAlert: vi.fn() }));
vi.mock("@/lib/gemini", () => ({
  generateKbEntriesFromReviews: vi.fn(async () => []),
  generateTemplatesFromReviews: vi.fn(async () => []),
}));
vi.mock("@/lib/seed-templates", () => ({ seedStarterTemplates: vi.fn() }));

const GOOGLE_PLAY_APP = {
  id: "app-1",
  workspace_id: "ws-1",
  name: "Mumbai One",
  platform: "google_play",
  store_id: "com.mmrda.mumbaione",
  access_token: null,
  refresh_token: null,
  last_sync_attempted_at: null,
  last_synced_at: null,
  store_country: "in",
};

describe("monthly review quota gates the sync pipeline (runtime)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queriedTables = [];
    tableResults = {};
  });

  it("halts before any provider call when the workspace is at its monthly limit", async () => {
    tableResults = {
      apps: { data: [GOOGLE_PLAY_APP], error: null },
      workspaces: { data: { plan: "free" }, error: null },
      // checkReviewLimit's count — exactly at the free plan's ceiling.
      reviews: { count: PLAN_LIMITS.free.reviewsPerMonth, data: [], error: null },
    };

    const { syncWorkspace } = await import("@/services/review-sync");
    const summary = await syncWorkspace("ws-1");

    expect(summary.errors.join(" ")).toMatch(/Monthly review limit reached/i);
    expect(summary.appsProcessed).toBe(0);
    expect(summary.reviewsUpserted).toBe(0);

    // The point of the gate: zero outbound store traffic.
    expect(bootstrapReviews).not.toHaveBeenCalled();
    expect(fetchGooglePlayReviews).not.toHaveBeenCalled();
    expect(fetchAppMetadata).not.toHaveBeenCalled();
    expect(findAppAcrossStorefronts).not.toHaveBeenCalled();
  });

  it("stays closed on every repeated scheduled run while the quota is exhausted", async () => {
    tableResults = {
      apps: { data: [GOOGLE_PLAY_APP], error: null },
      workspaces: { data: { plan: "starter" }, error: null },
      reviews: { count: PLAN_LIMITS.starter.reviewsPerMonth + 500, data: [], error: null },
    };

    const { syncWorkspace } = await import("@/services/review-sync");

    // One full day of the 3-hourly cron.
    for (let run = 0; run < 8; run++) {
      const summary = await syncWorkspace("ws-1");
      expect(summary.errors.join(" ")).toMatch(/Monthly review limit reached/i);
    }

    expect(bootstrapReviews).not.toHaveBeenCalled();
    expect(fetchGooglePlayReviews).not.toHaveBeenCalled();
  });

  it("does not let several apps in one workspace each spend the workspace allowance", async () => {
    // Three apps, one workspace, already over the shared limit. The gate is
    // per-WORKSPACE, so none of the three may fetch.
    tableResults = {
      apps: {
        data: [
          GOOGLE_PLAY_APP,
          { ...GOOGLE_PLAY_APP, id: "app-2", store_id: "com.example.two" },
          { ...GOOGLE_PLAY_APP, id: "app-3", store_id: "com.example.three" },
        ],
        error: null,
      },
      workspaces: { data: { plan: "free" }, error: null },
      reviews: { count: PLAN_LIMITS.free.reviewsPerMonth, data: [], error: null },
    };

    const { syncWorkspace } = await import("@/services/review-sync");
    const summary = await syncWorkspace("ws-1");

    expect(summary.errors.join(" ")).toMatch(/Monthly review limit reached/i);
    expect(bootstrapReviews).not.toHaveBeenCalled();
  });

  it("lets an under-limit workspace through to the provider", async () => {
    tableResults = {
      apps: { data: [GOOGLE_PLAY_APP], error: null },
      workspaces: { data: { plan: "free" }, error: null },
      reviews: { count: 3, data: [], error: null },
    };

    const { syncWorkspace } = await import("@/services/review-sync");
    await syncWorkspace("ws-1");

    // Proves the previous assertions come from the quota gate and not from a
    // mock that blocks the provider unconditionally.
    expect(bootstrapReviews).toHaveBeenCalled();
    expect(queriedTables).toContain("workspaces");
  });

  it("resolves the plan from the workspace row, not a hardcoded tier", async () => {
    // A `pro` workspace with 4,000 reviews is under its 50,000 ceiling but well
    // over the free plan's 1,000. Reading the wrong plan would stop a paying
    // customer's sync — the failure mode a source-grep test cannot see.
    tableResults = {
      apps: { data: [GOOGLE_PLAY_APP], error: null },
      workspaces: { data: { plan: "pro" }, error: null },
      reviews: { count: 4_000, data: [], error: null },
    };

    const { syncWorkspace } = await import("@/services/review-sync");
    const summary = await syncWorkspace("ws-1");

    expect(summary.errors.join(" ")).not.toMatch(/Monthly review limit reached/i);
    expect(bootstrapReviews).toHaveBeenCalled();
  });
});
