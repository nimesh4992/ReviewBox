// Plan limits and prices — single source of truth
//
// IMPORTANT: `trial` must exist here. Both consumers resolve an unknown plan
// name to `free` as a fail-closed default:
//
//   plan-enforcement.ts  resolvePlan()   -> "free" if not in PLAN_LIMITS
//   rate-limit.ts        isPlanName()    -> "free" if not in PLAN_LIMITS
//
// Onboarding stamps every new user with plan: "trial". While `trial` was
// missing from this object, every trial user silently resolved to `free` —
// so the 14-day trial once shipped with AI drafting switched off entirely.
//
// If you add a new plan name anywhere (onboarding, Stripe webhooks, admin),
// add it here too, or it will silently degrade to `free`.

/**
 * AI drafts are metered per MONTH, not per day.
 *
 * A daily cap punishes the behaviour real customers actually have: they sit
 * down once or twice a week and clear the whole inbox. Someone working
 * through 40 reviews on a Monday would hit a daily wall while using a
 * fraction of what they pay for. Monthly matches how the work happens.
 *
 * `publishedRepliesPerMonth` is the meter that matters commercially. It is
 * our unit of value — a reply posted to the store is the thing the customer
 * is buying — and unlike "apps" it grows with the customer rather than
 * charging someone with ten dormant listings like a heavy user.
 */
export const PLAN_LIMITS = {
  free:       { aiDraftsPerMonth:    10, appsMax:   1, reviewsPerMonth:   1_000, publishedRepliesPerMonth:    25, seats:  1 },
  trial:      { aiDraftsPerMonth: 1_500, appsMax:  10, reviewsPerMonth:  50_000, publishedRepliesPerMonth: 1_500, seats:  3 }, // = pro
  starter:    { aiDraftsPerMonth:   300, appsMax:   2, reviewsPerMonth:   5_000, publishedRepliesPerMonth:   300, seats:  1 },
  pro:        { aiDraftsPerMonth: 1_500, appsMax:  10, reviewsPerMonth:  50_000, publishedRepliesPerMonth: 1_500, seats:  3 },
  enterprise: { aiDraftsPerMonth: 50_000, appsMax: 999, reviewsPerMonth: 999_999, publishedRepliesPerMonth: 999_999, seats: 999 },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

/** Plans a customer can self-serve. `free` and `trial` are states, not products. */
export const PAID_PLANS = ["starter", "pro"] as const;
export type PaidPlanName = (typeof PAID_PLANS)[number];

// ── The `workspaces.plan` column vocabulary ───────────────────────────────────
//
// `PlanName` above is "a tier that has limits". The database column holds a
// wider set: it also carries billing states, which have no allowances of their
// own and resolve to `free` via resolvePlan()/isPlanName().
//
// These two being different is real, not accidental — but conflating them is
// what broke the trial. The column had a CHECK constraint that allowed neither
// `free` nor `enterprise`, so every trial-expiry downgrade and every
// trial-abuse downgrade was rejected by Postgres (23514) and no trial ever
// ended. See docs/adr/008-plan-vocabulary.md.
//
// WORKSPACE_PLANS is the single source of truth for that column. It is asserted
// against the live CHECK constraint by plans.test.ts, which parses the
// migration — if you change one without the other, `npm run test` fails.

/** States the column can hold that are not tiers with limits of their own. */
export const BILLING_STATES = ["past_due", "canceled"] as const;
export type BillingState = (typeof BILLING_STATES)[number];

/** Every value `workspaces.plan` may legally hold. Must match migration 025. */
export const WORKSPACE_PLANS = [
  "free",
  "trial",
  "starter",
  "pro",
  "enterprise",
  "past_due",
  "canceled",
] as const;
export type WorkspacePlan = (typeof WORKSPACE_PLANS)[number];

/**
 * Compile-time guard: every tier with limits must be storable in the column.
 * Adding a key to PLAN_LIMITS without adding it to WORKSPACE_PLANS (and to the
 * migration) fails `tsc` here rather than at runtime in Postgres.
 */
type _PlanNamesAreStorable = PlanName extends WorkspacePlan ? true : never;
const _assertPlanNamesAreStorable: _PlanNamesAreStorable = true;
void _assertPlanNamesAreStorable;

export function isWorkspacePlan(value: string): value is WorkspacePlan {
  return (WORKSPACE_PLANS as readonly string[]).includes(value);
}

/**
 * Plans that entitle access to billed routes.
 *
 * `trial` MUST be here — onboarding stamps every new user with it, and the
 * billed set covers the AI draft endpoint the trial exists to demonstrate.
 * `enterprise` MUST be here — it is quote-only and assigned by hand, so a
 * customer who signed a contract would otherwise be the one plan locked out
 * of what they bought. `free` is deliberately absent: it is the post-trial
 * resting state, usable but not entitled to billed routes.
 */
export const ENTITLED_PLANS = [
  "trial",
  "starter",
  "pro",
  "enterprise",
] as const satisfies readonly WorkspacePlan[];

export function isEntitledPlan(value: string): boolean {
  return (ENTITLED_PLANS as readonly string[]).includes(value);
}

// ── Billing interval ──────────────────────────────────────────────────────────

/**
 * How often a subscription renews.
 *
 * This exists because the two halves of the product disagreed about it. The
 * pricing page led with the ANNUAL per-month price ($39 / $99) while checkout
 * had no notion of an interval at all and could only ever charge the monthly
 * price ($49 / $129). A customer who read the headline number and clicked
 * through was charged 26% more than the page quoted.
 *
 * An interval is therefore not a display concern — it has to travel all the
 * way to the Stripe line item, which is why it is typed here next to the
 * prices rather than in the page that renders them.
 */
export const BILLING_INTERVALS = ["monthly", "annual"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

export const DEFAULT_BILLING_INTERVAL: BillingInterval = "monthly";

export function isBillingInterval(value: unknown): value is BillingInterval {
  return typeof value === "string" && (BILLING_INTERVALS as readonly string[]).includes(value);
}

/**
 * Display prices.
 *
 * Two currencies at genuinely different levels, not a converted number.
 * ₹6,999 is real money to a Bangalore founder; $129 is unthinkable to the
 * same person. Serving both markets at a price each considers fair is an
 * advantage — our nearest competitor runs one global price.
 *
 * `monthlyUsd` is the list price. `annualUsd` is the PER-MONTH price when
 * billed yearly — not the yearly total. Everything derived from it goes
 * through the helpers below rather than being multiplied out by hand at the
 * call site.
 *
 * ⚠️ `monthlyInr` is displayed on /pricing but there is no INR price in
 * Stripe, so it is not purchasable. That is a known gap, tracked separately —
 * do not treat the presence of a number here as evidence a customer can pay
 * it.
 *
 * Enterprise is deliberately quote-only. We have no seat management, SSO or
 * procurement story yet, so a published number would promise something we
 * cannot deliver.
 */
export const PLAN_PRICING: Record<
  PlanName,
  {
    label: string;
    monthlyUsd: number | null;
    annualUsd: number | null;
    monthlyInr: number | null;
    tagline: string;
    /** Quote-only: show "Talk to us" instead of a price. */
    onRequest?: boolean;
  }
> = {
  free: {
    label: "Free",
    monthlyUsd: 0,
    annualUsd: 0,
    monthlyInr: 0,
    tagline: "Reply to your first reviews and see them go live.",
  },
  trial: {
    label: "Trial",
    monthlyUsd: null,
    annualUsd: null,
    monthlyInr: null,
    tagline: "Everything in Pro, free for 14 days.",
  },
  starter: {
    label: "Starter",
    monthlyUsd: 49,
    annualUsd: 39,
    monthlyInr: 2_999,
    tagline: "One app, replied to properly.",
  },
  pro: {
    label: "Pro",
    monthlyUsd: 129,
    annualUsd: 99,
    monthlyInr: 6_999,
    tagline: "A portfolio of apps, and a team to answer them.",
  },
  enterprise: {
    label: "Enterprise",
    monthlyUsd: null,
    annualUsd: null,
    monthlyInr: null,
    tagline: "Unlimited apps, custom limits, and a contract.",
    onRequest: true,
  },
};

// ── Trial ─────────────────────────────────────────────────────────────────────

/** Length of the initial free trial, in days. */
export const TRIAL_DAYS = 14;

/**
 * A trial can be extended exactly once, by the same length again.
 *
 * One extension, self-serve, is the shape that converts: someone who asks for
 * more time is engaged, and making them email support to get it loses more
 * deals than the extra fortnight costs. Twice would make "trial" meaningless.
 */
export const TRIAL_EXTENSION_DAYS = 14;
export const MAX_TRIAL_EXTENSIONS = 1;

/** The plan a workspace falls back to when its trial runs out unpaid. */
export const PLAN_AFTER_TRIAL: PlanName = "free";

// ── Derived pricing ───────────────────────────────────────────────────────────
//
// Every number a customer reads about annual billing is COMPUTED from the two
// prices above. None of it is written by hand, because hand-written versions
// of these numbers were wrong in three separate places at once:
//
//   /pricing FAQ   "2 months free (equivalent to ~17% off)"
//   /faq           "2 months free (equivalent to ~17% off)"
//   /compare       "Annual discount: 2 months free"
//
// The real figures are 20.4% / 2.45 months for Starter and 23.3% / 2.79
// months for Pro. A single hardcoded claim cannot be right for two plans whose
// discounts differ, which is why the copy drifted from the prices and stayed
// drifted — nothing connected them.

/** The per-month price to SHOW for an interval. Annual is quoted per month. */
export function planPerMonthUsd(plan: PlanName, interval: BillingInterval): number | null {
  const pricing = PLAN_PRICING[plan];
  return interval === "annual" ? pricing.annualUsd : pricing.monthlyUsd;
}

/** What the customer is actually charged, per billing cycle. */
export function planChargeUsd(plan: PlanName, interval: BillingInterval): number | null {
  const perMonth = planPerMonthUsd(plan, interval);
  if (perMonth === null) return null;
  return interval === "annual" ? perMonth * 12 : perMonth;
}

/** Money saved over a year by paying yearly instead of monthly. */
export function annualSavingsUsd(plan: PlanName): number | null {
  const monthly = PLAN_PRICING[plan].monthlyUsd;
  const annual = PLAN_PRICING[plan].annualUsd;
  if (monthly === null || annual === null || monthly <= 0) return null;
  return monthly * 12 - annual * 12;
}

/** That saving as a whole-number percentage. Rounded down — never oversell. */
export function annualSavingsPercent(plan: PlanName): number | null {
  const saved = annualSavingsUsd(plan);
  const monthly = PLAN_PRICING[plan].monthlyUsd;
  if (saved === null || monthly === null || monthly <= 0) return null;
  return Math.floor((saved / (monthly * 12)) * 100);
}

/**
 * The strongest claim that is true of EVERY sellable plan.
 *
 * Starter saves 20% and Pro 23%, so "save 23%" would be false for half the
 * price list. Taking the minimum makes one sentence safe to print anywhere,
 * and it moves on its own if a price ever changes.
 */
export function minAnnualSavingsPercent(): number | null {
  const percentages = PAID_PLANS.map(annualSavingsPercent).filter(
    (p): p is number => p !== null,
  );
  if (percentages.length === 0) return null;
  return Math.min(...percentages);
}

/**
 * The same discount expressed as free months, which is how this category
 * usually advertises it. Rounded DOWN to a half month for the same reason the
 * percentage is floored: 2.45 months must never be sold as 3.
 */
export function annualFreeMonths(plan: PlanName): number | null {
  const saved = annualSavingsUsd(plan);
  const monthly = PLAN_PRICING[plan].monthlyUsd;
  if (saved === null || monthly === null || monthly <= 0) return null;
  return Math.floor((saved / monthly) * 2) / 2;
}

/** Minimum free months across sellable plans — the safe global claim. */
export function minAnnualFreeMonths(): number | null {
  const months = PAID_PLANS.map(annualFreeMonths).filter((m): m is number => m !== null);
  if (months.length === 0) return null;
  return Math.min(...months);
}
