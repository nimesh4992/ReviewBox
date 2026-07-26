// Plan limits — single source of truth
//
// IMPORTANT: `trial` must exist here. Both consumers resolve an unknown plan
// name to `free` as a fail-closed default:
//
//   plan-enforcement.ts  resolvePlan()   -> "free" if not in PLAN_LIMITS
//   rate-limit.ts        isPlanName()    -> "free" if not in PLAN_LIMITS
//
// Onboarding stamps every new user with plan: "trial". While `trial` was
// missing from this object, every trial user silently resolved to `free` —
// which is 0 AI drafts per day, 1 app, and 1,000 reviews a month. So the
// 14-day trial shipped with the AI drafting feature switched off entirely,
// and `rate-limit.ts` denied it before even reaching Redis.
//
// The trial is advertised as Pro tier (see /faq and /pricing), so it mirrors
// `pro` exactly. Trial *expiry* is a separate concern, enforced in
// middleware.ts, which redirects to /billing once trialEndsAt passes — so
// generous limits here are not a way to use the product for free forever.
//
// If you add a new plan name anywhere (onboarding, Stripe webhooks, admin),
// add it here too, or it will silently degrade to `free`.
export const PLAN_LIMITS = {
  free:    { aiDraftsPerDay: 0,   appsMax: 1,   reviewsPerMonth: 1_000   },
  trial:   { aiDraftsPerDay: 200, appsMax: 10,  reviewsPerMonth: 50_000  }, // = pro
  starter: { aiDraftsPerDay: 50,  appsMax: 2,   reviewsPerMonth: 5_000   },
  pro:     { aiDraftsPerDay: 200, appsMax: 10,  reviewsPerMonth: 50_000  },
  team:    { aiDraftsPerDay: 999, appsMax: 999, reviewsPerMonth: 999_999 },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;

/** Plans a customer can actually be billed for. `free` and `trial` are states, not products. */
export const PAID_PLANS = ["starter", "pro", "team"] as const;
export type PaidPlanName = (typeof PAID_PLANS)[number];
