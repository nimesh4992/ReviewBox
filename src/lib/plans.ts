// Plan limits — single source of truth
export const PLAN_LIMITS = {
  free:    { aiDraftsPerDay: 0,   appsMax: 1,   reviewsPerMonth: 1_000   },
  starter: { aiDraftsPerDay: 50,  appsMax: 2,   reviewsPerMonth: 5_000   },
  pro:     { aiDraftsPerDay: 200, appsMax: 10,  reviewsPerMonth: 50_000  },
  team:    { aiDraftsPerDay: 999, appsMax: 999, reviewsPerMonth: 999_999 },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;
