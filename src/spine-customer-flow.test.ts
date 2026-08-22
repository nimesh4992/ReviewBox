/**
 * Customer Spine E2E Automated Test Suite
 *
 * Verifies the complete production customer journey contract:
 * 1. App Connection with Storefront Country persistence (P0-2)
 * 2. Regional Storefront Review Ingestion (P0-2)
 * 3. Monthly Plan Quota Enforcement (P0-3)
 * 4. AI Reply Generation & Draft Mode Contract
 * 5. Re-Sync State Preservation (replied reviews retain local reply state)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildEnrichedRow } from "@/lib/review-mapper";
import { getReviewUsage } from "@/lib/plan-enforcement";
import { PLAN_LIMITS } from "@/lib/plans";

// Mock Supabase module boundary for plan limit tests
interface CountResult {
  count: number | null;
  error: { code?: string; message: string } | null;
}

let reviewsResult: CountResult = { count: 0, error: null };

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (_table: string) => ({
      select: () => ({
        eq: () => ({
          gte: () => ({
            then: (resolve: (v: CountResult) => unknown) => resolve(reviewsResult),
          }),
        }),
      }),
    }),
  }),
}));

describe("Customer Spine E2E Automated Contract", () => {
  beforeEach(() => {
    reviewsResult = { count: 0, error: null };
    vi.restoreAllMocks();
  });

  describe("1 & 2. Regional App Connect & Storefront Review Ingestion (P0-2)", () => {
    it("preserves country parameter 'in' as alpha-2 'IN' on review mapping", () => {
      const row = buildEnrichedRow(
        "app-mumbai-1",
        "ws-mumbai",
        "ext-rev-101",
        "app_store",
        "Rohan M",
        5,
        "Great metro booking app!",
        "2.4.1",
        null,
        "in",
        new Date().toISOString(),
        false,
        null,
      );

      expect(row.app_id).toBe("app-mumbai-1");
      expect(row.workspace_id).toBe("ws-mumbai");
      expect(row.country).toBe("IN");
      expect(row.source).toBe("app_store");
      expect(row.rating).toBe(5);
    });
  });

  // Renamed from "Monthly Plan Quota Enforcement (P0-3)". Nothing is enforced
  // any more: ADR 009 Option B (founder decision 2026-08-22) makes the monthly
  // review count a REPORT. The old pair of tests asserted that reaching the
  // limit produced an error string the sync returned early on — the behaviour
  // this step of the spine now exists to prove is absent.
  describe("3. Monthly Plan Quota Reporting (soft cap, ADR 009 B)", () => {
    it("reports usage below the plan limit without flagging it", async () => {
      reviewsResult = { count: 10, error: null };
      const usage = await getReviewUsage("ws-mumbai", "free");
      expect(usage.over).toBe(false);
      expect(usage.used).toBe(10);
      expect(usage.unknown).toBe(false);
    });

    it("flags being over the limit — and still refuses to withhold anything", async () => {
      reviewsResult = { count: PLAN_LIMITS.free.reviewsPerMonth, error: null };
      const usage = await getReviewUsage("ws-mumbai", "free");
      expect(usage.over).toBe(true);
      expect(usage.percentUsed).toBeGreaterThanOrEqual(100);
      // The point of the rename: there is no error to return early on. A
      // caller wanting to gate would have to write the comparison itself.
      expect(Object.keys(usage)).not.toContain("error");
    });

    it("fails open when the count cannot be read", async () => {
      reviewsResult = { count: null, error: { message: "boom" } };
      const usage = await getReviewUsage("ws-mumbai", "free");
      expect(usage.unknown).toBe(true);
      expect(usage.over).toBe(false);
    });
  });

  describe("4 & 5. Reply State & Re-sync State Preservation", () => {
    it("marks review as replied when devReplyText is present", () => {
      const row = buildEnrichedRow(
        "app-mumbai-1",
        "ws-mumbai",
        "ext-rev-101",
        "app_store",
        "Rohan M",
        5,
        "Great app",
        "2.4.1",
        null,
        "IN",
        new Date().toISOString(),
        true,
        "Thank you for your feedback!",
      );

      expect(row.reply_status).toBe("replied");
      expect(row.reply_text).toBe("Thank you for your feedback!");
    });

    it("stays needs_reply when hasDevReply is true but devReplyText is missing", () => {
      const row = buildEnrichedRow(
        "app-mumbai-1",
        "ws-mumbai",
        "ext-rev-101",
        "app_store",
        "Rohan M",
        5,
        "Great app",
        "2.4.1",
        null,
        "IN",
        new Date().toISOString(),
        true,
        null,
      );

      expect(row.reply_status).toBe("needs_reply");
      expect(row.reply_text).toBeNull();
    });
  });
});
