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

/**
 * Display prices.
 *
 * Two currencies at genuinely different levels, not a converted number.
 * ₹6,999 is real money to a Bangalore founder; $129 is unthinkable to the
 * same person. Serving both markets at a price each considers fair is an
 * advantage — our nearest competitor runs one global price.
 *
 * `monthlyUsd` is the list price. `annualUsd` is the per-month price when
 * billed yearly, and both are shown together: the struck-through anchor is
 * standard in this category, and going without it while a competitor uses it
 * makes us look cheaper than we are rather than better value.
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
