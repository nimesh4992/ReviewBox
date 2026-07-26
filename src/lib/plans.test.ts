import { describe, expect, it } from "vitest";

import { PLAN_LIMITS, type PlanName } from "./plans";

describe("PLAN_LIMITS", () => {
  it("defines every plan tier, including trial", () => {
    const expected: PlanName[] = ["free", "trial", "starter", "pro", "team"];
    for (const name of expected) {
      expect(PLAN_LIMITS[name]).toBeDefined();
    }
  });

  // Regression guard. `trial` was missing from PLAN_LIMITS, and both consumers
  // fail closed to `free` for unknown names — so every trial user got 0 AI
  // drafts, 1 app and 1,000 reviews. The 14-day trial shipped with its
  // headline feature switched off. These three assertions fail loudly if the
  // key is ever removed or quietly downgraded again.
  it("gives trial users the advertised Pro allowances", () => {
    expect(PLAN_LIMITS.trial).toEqual(PLAN_LIMITS.pro);
  });

  it("lets trial users generate AI drafts — the point of the trial", () => {
    expect(PLAN_LIMITS.trial.aiDraftsPerDay).toBeGreaterThan(0);
  });

  it("never leaves trial on free-tier allowances", () => {
    expect(PLAN_LIMITS.trial.aiDraftsPerDay).toBeGreaterThan(PLAN_LIMITS.free.aiDraftsPerDay);
    expect(PLAN_LIMITS.trial.appsMax).toBeGreaterThan(PLAN_LIMITS.free.appsMax);
    expect(PLAN_LIMITS.trial.reviewsPerMonth).toBeGreaterThan(PLAN_LIMITS.free.reviewsPerMonth);
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
