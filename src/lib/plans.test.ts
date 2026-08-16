import { describe, expect, it } from "vitest";

import { PAID_PLANS, PLAN_LIMITS, PLAN_PRICING, type PlanName } from "./plans";

describe("PLAN_LIMITS", () => {
  it("defines every plan tier, including trial", () => {
    const expected: PlanName[] = ["free", "trial", "starter", "pro", "enterprise"];
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
    expect(PLAN_LIMITS.trial.aiDraftsPerMonth).toBeGreaterThan(0);
  });

  it("never leaves trial on free-tier allowances", () => {
    expect(PLAN_LIMITS.trial.aiDraftsPerMonth).toBeGreaterThan(PLAN_LIMITS.free.aiDraftsPerMonth);
    expect(PLAN_LIMITS.trial.appsMax).toBeGreaterThan(PLAN_LIMITS.free.appsMax);
    expect(PLAN_LIMITS.trial.reviewsPerMonth).toBeGreaterThan(PLAN_LIMITS.free.reviewsPerMonth);
  });

  it("each plan has the three required fields", () => {
    for (const plan of Object.values(PLAN_LIMITS)) {
      expect(plan).toHaveProperty("aiDraftsPerMonth");
      expect(plan).toHaveProperty("appsMax");
      expect(plan).toHaveProperty("reviewsPerMonth");
      expect(typeof plan.aiDraftsPerMonth).toBe("number");
      expect(typeof plan.appsMax).toBe("number");
      expect(typeof plan.reviewsPerMonth).toBe("number");
    }
  });

  it("limits scale up as plans get more expensive", () => {
    // Each tier must not have LOWER limits than the previous one.
    // Catches accidental swaps if someone reorders the plans.
    const tiers: PlanName[] = ["free", "starter", "pro", "enterprise"];
    for (let i = 1; i < tiers.length; i++) {
      const prev = PLAN_LIMITS[tiers[i - 1]];
      const curr = PLAN_LIMITS[tiers[i]];
      expect(curr.aiDraftsPerMonth).toBeGreaterThanOrEqual(prev.aiDraftsPerMonth);
      expect(curr.appsMax).toBeGreaterThanOrEqual(prev.appsMax);
      expect(curr.reviewsPerMonth).toBeGreaterThanOrEqual(prev.reviewsPerMonth);
    }
  });

  it("free plan gets a small but non-zero AI allowance", () => {
    // Deliberately changed from 0. A free tier that cannot try the headline
    // feature is a demo of something you can't use, and now that the starter
    // templates actually seed, most replies don't need AI anyway.
    expect(PLAN_LIMITS.free.aiDraftsPerMonth).toBeGreaterThan(0);
    expect(PLAN_LIMITS.free.aiDraftsPerMonth).toBeLessThan(PLAN_LIMITS.starter.aiDraftsPerMonth);
  });

  it("meters published replies, the thing customers actually buy", () => {
    for (const plan of Object.values(PLAN_LIMITS)) {
      expect(typeof plan.publishedRepliesPerMonth).toBe("number");
      expect(plan.publishedRepliesPerMonth).toBeGreaterThan(0);
    }
    expect(PLAN_LIMITS.pro.publishedRepliesPerMonth)
      .toBeGreaterThan(PLAN_LIMITS.starter.publishedRepliesPerMonth);
  });

  it("free plan caps at 1 app", () => {
    expect(PLAN_LIMITS.free.appsMax).toBe(1);
  });
});

describe("PLAN_PRICING", () => {
  it("prices every plan that exists", () => {
    for (const name of Object.keys(PLAN_LIMITS) as PlanName[]) {
      expect(PLAN_PRICING[name]).toBeDefined();
    }
  });

  it("only sells the plans a customer can self-serve", () => {
    // Enterprise is quote-only: we have no seat management, SSO or
    // procurement story, so a published number would promise what we can't
    // deliver. Trial and free are states, not products.
    expect([...PAID_PLANS]).toEqual(["starter", "pro"]);
    expect(PLAN_PRICING.enterprise.onRequest).toBe(true);
    expect(PLAN_PRICING.enterprise.monthlyUsd).toBeNull();
  });

  it("makes annual cheaper per month than monthly for every sellable plan", () => {
    for (const name of PAID_PLANS) {
      const p = PLAN_PRICING[name];
      expect(p.annualUsd!).toBeLessThan(p.monthlyUsd!);
    }
  });

  it("prices India separately rather than converting", () => {
    // A converted $129 would be ~₹11,000, which no Indian founder pays for
    // this. These are independent price points for independent markets.
    expect(PLAN_PRICING.pro.monthlyInr!).toBeLessThan(PLAN_PRICING.pro.monthlyUsd! * 85);
    expect(PLAN_PRICING.pro.monthlyInr!).toBeGreaterThan(PLAN_PRICING.starter.monthlyInr!);
  });
});
