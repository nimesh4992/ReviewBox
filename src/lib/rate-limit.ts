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
  const limit = PLAN_LIMITS[planKey].aiDraftsPerDay;

  // If the plan allows zero drafts, deny immediately without hitting Redis
  if (limit === 0) {
    return { allowed: false, remaining: 0 };
  }

  const redis = new Redis({ url, token });

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, "1 d"),
    prefix: "ai_draft",
  });

  // Pass just userId — the Ratelimit prefix option already namespaces the key.
  // Passing "ai_draft:userId" would produce "ai_draft:ai_draft:userId" in Redis.
  const { success, remaining } = await ratelimit.limit(userId);

  return { allowed: success, remaining };
}
