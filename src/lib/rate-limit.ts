import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { PLAN_LIMITS, PlanName } from "@/lib/plans";

const DEV_FALLBACK = { allowed: true, remaining: 99 };

function isPlanName(value: string): value is PlanName {
  return value in PLAN_LIMITS;
}

export async function checkAiRateLimit(
  userId: string,
  plan: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // Graceful dev-mode fallback when Redis is not configured
  if (!url || !token) {
    return DEV_FALLBACK;
  }

  const planKey: PlanName = isPlanName(plan) ? plan : "free";
  const limit: number = PLAN_LIMITS[planKey].aiDraftsPerMonth;

  // A plan with no AI allowance denies without touching Redis. No plan is
  // currently zero — free deliberately gets a small allowance so the headline
  // feature can be tried — but a future tier might be, and paying Upstash a
  // round trip to say "no" would be silly.
  if (limit <= 0) {
    return { allowed: false, remaining: 0 };
  }

  const redis = new Redis({ url, token });

  const ratelimit = new Ratelimit({
    redis,
    // Monthly window. A daily cap punished the way customers actually
    // work — sitting down once a week and clearing 40 reviews would hit a
    // daily wall while using a fraction of the plan. 30d sliding rather than
    // calendar-month so there is no midnight-on-the-1st cliff.
    limiter: Ratelimit.slidingWindow(limit, "30 d"),
    prefix: "ai_draft",
  });

  const { success, remaining } = await ratelimit.limit(`ai_draft:${userId}`);

  return { allowed: success, remaining };
}
