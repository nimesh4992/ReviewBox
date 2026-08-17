import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  ENTITLED_PLANS,
  PAID_PLANS,
  PLAN_AFTER_TRIAL,
  PLAN_LIMITS,
  PLAN_PRICING,
  WORKSPACE_PLANS,
  isEntitledPlan,
  isWorkspacePlan,
  type PlanName,
} from "./plans";

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

/**
 * The regression guard for C-1 (docs/adr/008-plan-vocabulary.md).
 *
 * `workspaces.plan` carried a CHECK constraint that allowed neither `free` nor
 * `enterprise`, while the application wrote both. Every trial-expiry downgrade
 * and every trial-abuse downgrade was rejected by Postgres for months, so no
 * trial ever ended — and nothing caught it, because TypeScript cannot see a
 * SQL constraint and the unit suite asserted only the TypeScript side.
 *
 * This block closes that gap by reading the migration itself. If the SQL and
 * WORKSPACE_PLANS ever disagree again, `npm run test` fails — which is the one
 * gate this project's autopilot actually relies on (D000).
 */
describe("workspaces.plan constraint matches the app vocabulary", () => {
  const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

  /** The plan list from the LAST migration that (re)defines the constraint. */
  function constraintPlansFromMigrations(): string[] {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

    let latest: string[] | null = null;
    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      // Match the CHECK that belongs to the constraint being added, not the
      // `update ... where plan = 'team'` data fix that may sit above it.
      const match = sql.match(
        /add\s+constraint\s+workspaces_plan_check\s+check\s*\(\s*plan\s+in\s*\(([^)]*)\)/i,
      );
      if (match) {
        latest = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
      }
    }
    return latest ?? [];
  }

  it("finds the constraint in the migrations", () => {
    expect(constraintPlansFromMigrations().length).toBeGreaterThan(0);
  });

  it("allows exactly the values the application can write", () => {
    expect([...constraintPlansFromMigrations()].sort()).toEqual([...WORKSPACE_PLANS].sort());
  });

  it("can store the plan an expired trial drops to", () => {
    // The exact write the cron performs every day. Rejected for months.
    expect(constraintPlansFromMigrations()).toContain(PLAN_AFTER_TRIAL);
  });

  it("can store every tier that has limits", () => {
    const allowed = constraintPlansFromMigrations();
    for (const name of Object.keys(PLAN_LIMITS)) {
      expect(allowed).toContain(name);
    }
  });

  it("no longer carries the retired `team` tier", () => {
    expect(constraintPlansFromMigrations()).not.toContain("team");
    expect(Object.keys(PLAN_LIMITS)).not.toContain("team");
  });
});

describe("plan vocabulary helpers", () => {
  it("accepts every legal column value and rejects anything else", () => {
    for (const p of WORKSPACE_PLANS) expect(isWorkspacePlan(p)).toBe(true);
    expect(isWorkspacePlan("team")).toBe(false);
    expect(isWorkspacePlan("")).toBe(false);
    expect(isWorkspacePlan("PRO")).toBe(false);
  });

  it("entitles trial and every paid tier, but not free or lapsed billing states", () => {
    // `trial` and `enterprise` are the two that have previously been broken by
    // a hand-maintained copy of this list: trial users were bounced off the AI
    // draft endpoint the trial exists to demonstrate, and enterprise (assigned
    // by hand, no Stripe product) would have been locked out after signing.
    expect(isEntitledPlan("trial")).toBe(true);
    expect(isEntitledPlan("enterprise")).toBe(true);
    for (const p of PAID_PLANS) expect(isEntitledPlan(p)).toBe(true);

    expect(isEntitledPlan("free")).toBe(false);
    expect(isEntitledPlan("past_due")).toBe(false);
    expect(isEntitledPlan("canceled")).toBe(false);
  });

  it("only entitles plans that are storable in the column", () => {
    for (const p of ENTITLED_PLANS) expect(isWorkspacePlan(p)).toBe(true);
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
