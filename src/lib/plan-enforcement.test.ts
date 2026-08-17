/**
 * Plan enforcement — the three gates that decide what a workspace may do.
 *
 * Untested until now, despite carrying the fix for a documented
 * whole-population failure: `canAddApp` counted soft-deleted apps against the
 * limit, so a customer on a 1-app plan who disconnected an app could never add
 * another. The row is still there (soft delete), so the count never dropped
 * and every attempt was refused — for an app they could no longer see anywhere
 * in the product.
 *
 * The fail-open/fail-closed choices here are deliberate and asymmetric, which
 * is exactly why they need pinning down:
 *
 *   - `resolvePlan` fails CLOSED (unknown plan -> free's small limits)
 *   - `canPublishReply` fails OPEN (if we cannot count, allow the reply)
 *
 * Both are correct, and an agent "tidying" either one into consistency would
 * break something real — so each has a test saying so.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Supabase stub ─────────────────────────────────────────────────────────────
// Mocked at the module boundary so the real enforcement logic runs.

interface CountResult {
  count: number | null;
  error: { code?: string; message: string } | null;
}

/** Queued results, consumed in order — lets a test model the 42703 retry. */
let appsResults: CountResult[] = [];
let reviewsResult: CountResult = { count: 0, error: null };
let auditResult: CountResult = { count: 0, error: null };

/**
 * Filters each query actually applied, e.g. `is:deleted_at=null`.
 *
 * Recorded because the result alone cannot prove the query was scoped: a stub
 * that returns a queued count regardless of the chain makes the deleted-apps
 * regression test vacuous — deleting the `.is("deleted_at", null)` line still
 * passes. Verified: without this, that mutation goes undetected.
 */
let appliedFilters: string[] = [];

function selectChain(result: CountResult) {
  const thenable = {
    eq: (col: string, val: unknown) => {
      appliedFilters.push(`eq:${col}=${String(val)}`);
      return thenable;
    },
    is: (col: string, val: unknown) => {
      appliedFilters.push(`is:${col}=${String(val)}`);
      return thenable;
    },
    gte: (col: string) => {
      appliedFilters.push(`gte:${col}`);
      return thenable;
    },
    then: (resolve: (v: CountResult) => unknown) => resolve(result),
  };
  return thenable;
}

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (table: string) => ({
      select: () => {
        if (table === "apps") {
          return selectChain(appsResults.shift() ?? { count: 0, error: null });
        }
        if (table === "reviews") return selectChain(reviewsResult);
        return selectChain(auditResult);
      },
    }),
  }),
}));

import { canAddApp, canPublishReply, checkReviewLimit } from "./plan-enforcement";
import { PLAN_LIMITS } from "./plans";

beforeEach(() => {
  appsResults = [];
  reviewsResult = { count: 0, error: null };
  auditResult = { count: 0, error: null };
  appliedFilters = [];
  vi.restoreAllMocks();
});

describe("canAddApp", () => {
  it("allows a new app below the plan limit", async () => {
    appsResults = [{ count: 0, error: null }];
    await expect(canAddApp("ws_1", "starter")).resolves.toBe(true);
  });

  it("refuses once the limit is reached", async () => {
    // starter allows 2 — at 2 the next one must be refused, not at 3.
    appsResults = [{ count: PLAN_LIMITS.starter.appsMax, error: null }];
    await expect(canAddApp("ws_1", "starter")).resolves.toBe(false);
  });

  it("REGRESSION: a disconnected app must not count against the limit", async () => {
    // The whole-population failure. The query filters `deleted_at is null`, so
    // a workspace on the 1-app free plan that disconnected its only app sees a
    // count of 0 and can add another. Before the fix the soft-deleted row kept
    // the count at 1 forever and the customer was permanently locked out of a
    // product they were paying for.
    appsResults = [{ count: 0, error: null }];
    await expect(canAddApp("ws_1", "free")).resolves.toBe(true);
    expect(PLAN_LIMITS.free.appsMax).toBe(1);

    // The assertion that actually catches the bug: the query must exclude
    // soft-deleted rows AND be scoped to this workspace.
    expect(appliedFilters).toContain("is:deleted_at=null");
    expect(appliedFilters).toContain("eq:workspace_id=ws_1");
  });

  it("still works when the deleted_at column does not exist yet", async () => {
    // Migration 015 pending: the first query fails with 42703 and the code
    // retries without the filter. Nothing has ever been soft-deleted in that
    // world, so counting every row is equivalent — but it must RETRY rather
    // than throw, or app creation breaks entirely on an un-migrated database.
    appsResults = [
      { count: null, error: { code: "42703", message: 'column "deleted_at" does not exist' } },
      { count: 0, error: null },
    ];
    await expect(canAddApp("ws_1", "starter")).resolves.toBe(true);

    // First attempt filters on deleted_at; the retry drops it but keeps the
    // tenant scope — losing workspace_id on the fallback path would count
    // every app in the database against this customer's limit.
    expect(appliedFilters.filter((f) => f === "is:deleted_at=null")).toHaveLength(1);
    expect(appliedFilters.filter((f) => f === "eq:workspace_id=ws_1")).toHaveLength(2);
  });

  it("throws on a real database error rather than silently allowing", async () => {
    // A failure to count must not be read as "zero apps" — that would let a
    // workspace exceed its plan whenever the database hiccupped.
    appsResults = [{ count: null, error: { code: "08006", message: "connection failure" } }];
    await expect(canAddApp("ws_1", "starter")).rejects.toThrow(/canAddApp/);
  });

  it("falls back to free's limits for an unrecognised plan", async () => {
    // resolvePlan fails CLOSED. A workspace whose plan string is corrupt or
    // from a future tier gets the smallest allowance, never the largest.
    appsResults = [{ count: 1, error: null }];
    await expect(canAddApp("ws_1", "nonsense-tier")).resolves.toBe(false);
    expect(PLAN_LIMITS.free.appsMax).toBe(1);
  });
});

describe("canPublishReply", () => {
  it("allows while under the monthly limit", async () => {
    auditResult = { count: 3, error: null };
    const r = await canPublishReply("ws_1", "starter");
    expect(r.allowed).toBe(true);
    expect(r.used).toBe(3);
    expect(r.limit).toBe(PLAN_LIMITS.starter.publishedRepliesPerMonth);
  });

  it("refuses at the limit", async () => {
    auditResult = { count: PLAN_LIMITS.starter.publishedRepliesPerMonth, error: null };
    await expect(canPublishReply("ws_1", "starter")).resolves.toMatchObject({ allowed: false });
  });

  it("fails OPEN when the count cannot be read — deliberately", async () => {
    // Refusing to publish a customer's reply because OUR query failed is a
    // worse outcome than one reply over the line. This asymmetry with
    // canAddApp is intentional; do not "make it consistent".
    vi.spyOn(console, "error").mockImplementation(() => {});
    auditResult = { count: null, error: { message: "audit_log unavailable" } };
    const r = await canPublishReply("ws_1", "starter");
    expect(r.allowed).toBe(true);
  });
});

describe("checkReviewLimit", () => {
  it("returns null while under the limit", async () => {
    reviewsResult = { count: 10, error: null };
    await expect(checkReviewLimit("ws_1", "starter")).resolves.toBeNull();
  });

  it("returns an actionable message at the limit", async () => {
    reviewsResult = { count: PLAN_LIMITS.starter.reviewsPerMonth, error: null };
    const msg = await checkReviewLimit("ws_1", "starter");
    expect(msg).toMatch(/limit reached/i);
    expect(msg).toMatch(/upgrade/i);
  });

  it("is still not wired into the sync pipeline", async () => {
    // Audit finding M-6: this function is fully implemented but has no call
    // site, so the review-volume cap advertised on /pricing and /billing is
    // not enforced anywhere. Recorded as a test so the gap is visible rather
    // than forgotten — delete this case when the call site is added.
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const full = join(dir, e);
        if (statSync(full).isDirectory()) walk(full);
        else if (/\.tsx?$/.test(e) && !e.endsWith(".test.ts")) {
          if (readFileSync(full, "utf8").includes("checkReviewLimit")) hits.push(full);
        }
      }
    };
    walk(join(process.cwd(), "src"));
    // Only its own definition.
    expect(hits.filter((h) => !h.endsWith("plan-enforcement.ts"))).toEqual([]);
  });
});
