/**
 * Runtime proof that the monthly review quota does NOT gate the sync pipeline.
 *
 * **This file used to assert the exact opposite, and that is why it is worth
 * reading before changing anything here.** Its previous version proved that
 * "an over-limit workspace reaches NO provider, on every run" — ADR 009's
 * Option A, the option that ADR says in writing not to build. It was added
 * alongside the gate itself, so the behaviour arrived already defended.
 *
 * What that produced for a customer: over the calendar-month count, every app
 * in the workspace stopped syncing on every scheduled run until the 1st. The
 * cron path pushed the message into `summary.errors` and discarded it, so
 * there was no email, no banner and no `last_sync_error` — the app row still
 * read healthy while their reviews silently stopped arriving.
 *
 * Founder decision 2026-08-22: **Option B, soft cap.** Ingestion never stops;
 * usage is reported by `getReviewUsage()` and shown as a banner. So the
 * property under test inverts:
 *
 *   1. an over-limit workspace still reaches the provider, on every run,
 *   2. an under-limit workspace does too, and
 *   3. nothing in the summary reads as a quota failure.
 *
 * Asserted against the real `syncWorkspace()` with only the module boundaries
 * (database, stores, notifications) mocked. `plan-enforcement.test.ts` holds
 * the shape half — that the gating function is gone from the tree — and
 * neither half is sufficient alone.
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

describe("the monthly review quota does not gate the sync pipeline (runtime)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queriedTables = [];
    tableResults = {};
  });

  it("still reaches the provider when the workspace is at its monthly limit", async () => {
    tableResults = {
      apps: { data: [GOOGLE_PLAY_APP], error: null },
      workspaces: { data: { plan: "free" }, error: null },
      // Exactly at the free plan's ceiling — the case that used to stop it.
      reviews: { count: PLAN_LIMITS.free.reviewsPerMonth, data: [], error: null },
    };

    const { syncWorkspace } = await import("@/services/review-sync");
    const summary = await syncWorkspace("ws-1");

    // The whole point of the soft cap: the reviews still arrive.
    expect(bootstrapReviews).toHaveBeenCalled();
    expect(summary.errors.join(" ")).not.toMatch(/limit/i);
    expect(summary.errors.join(" ")).not.toMatch(/quota/i);
  });

  it("stays open on every repeated scheduled run while far over the allowance", async () => {
    tableResults = {
      apps: { data: [GOOGLE_PLAY_APP], error: null },
      workspaces: { data: { plan: "starter" }, error: null },
      reviews: { count: PLAN_LIMITS.starter.reviewsPerMonth * 10, data: [], error: null },
    };

    const { syncWorkspace } = await import("@/services/review-sync");

    // One full day of the 3-hourly cron. Ten times over the allowance is not
    // a hypothetical: the count is on rows STORED this month, so a single
    // first import of a large back catalogue lands there on day one.
    for (let run = 0; run < 8; run++) {
      const summary = await syncWorkspace("ws-1");
      expect(summary.errors.join(" ")).not.toMatch(/limit|quota/i);
    }

    expect(bootstrapReviews).toHaveBeenCalled();
  });

  it("does not stop any app in a multi-app workspace that is over the shared count", async () => {
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

    expect(summary.errors.join(" ")).not.toMatch(/limit|quota/i);
    expect(bootstrapReviews).toHaveBeenCalled();
  });

  it("an under-limit workspace is unaffected", async () => {
    tableResults = {
      apps: { data: [GOOGLE_PLAY_APP], error: null },
      workspaces: { data: { plan: "free" }, error: null },
      reviews: { count: 3, data: [], error: null },
    };

    const { syncWorkspace } = await import("@/services/review-sync");
    await syncWorkspace("ws-1");

    // Guards the assertions above against a mock that lets everything through
    // unconditionally: this case has to pass for the same reason, not a
    // different one.
    expect(bootstrapReviews).toHaveBeenCalled();
  });

  it("a database failure on the review count cannot stop a sync", async () => {
    // The old gate called checkReviewLimit(), which THREW on a query error;
    // the caller caught it and continued, but only because someone remembered
    // to. Under the soft cap there is nothing on this path to throw at all —
    // asserted here so a reintroduced read cannot quietly become load-bearing.
    tableResults = {
      apps: { data: [GOOGLE_PLAY_APP], error: null },
      workspaces: { data: { plan: "free" }, error: null },
      reviews: { count: null, data: [], error: { message: "connection reset" } },
    };

    const { syncWorkspace } = await import("@/services/review-sync");
    const summary = await syncWorkspace("ws-1");

    expect(bootstrapReviews).toHaveBeenCalled();
    expect(summary.errors.join(" ")).not.toMatch(/limit|quota/i);
  });
});
