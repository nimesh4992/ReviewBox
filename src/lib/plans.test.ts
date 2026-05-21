import { describe, expect, it } from "vitest";

import { PLAN_LIMITS, type PlanName } from "./plans";

describe("PLAN_LIMITS", () => {
  it("defines all four plan tiers", () => {
    const expected: PlanName[] = ["free", "starter", "pro", "team"];
    for (const name of expected) {
      expect(PLAN_LIMITS[name]).toBeDefined();
    }
  });

  it("each plan has the three required fields", () => {
    for (const plan of Object.values(PLAN_LIMITS)) {
      expect(plan).toHaveProperty("aiDraftsPerDay");
      expect(plan).toHaveProperty("appsMax");
      expect(plan).toHaveProperty("reviewsPerMonth");
      expect(typeof plan.aiDraftsPerDay).toBe("number");
      expect(typeof plan.appsMax).toBe("number");
      expect(typeof plan.reviewsPerMonth).toBe("number");
    }
  });

  it("limits scale up as plans get more expensive", () => {
    // Each tier must not have LOWER limits than the previous one.
    // Catches accidental swaps if someone reorders the plans.
    const tiers: PlanName[] = ["free", "starter", "pro", "team"];
    for (let i = 1; i < tiers.length; i++) {
      const prev = PLAN_LIMITS[tiers[i - 1]];
      const curr = PLAN_LIMITS[tiers[i]];
      expect(curr.aiDraftsPerDay).toBeGreaterThanOrEqual(prev.aiDraftsPerDay);
      expect(curr.appsMax).toBeGreaterThanOrEqual(prev.appsMax);
      expect(curr.reviewsPerMonth).toBeGreaterThanOrEqual(prev.reviewsPerMonth);
    }
  });

  it("free plan has 0 AI drafts (forces upgrade for AI features)", () => {
    expect(PLAN_LIMITS.free.aiDraftsPerDay).toBe(0);
  });

  it("free plan caps at 1 app", () => {
    expect(PLAN_LIMITS.free.appsMax).toBe(1);
  });
});
