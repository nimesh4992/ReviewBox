import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextRequest } from "next/server";

/**
 * Generic per-route rate limiter. Keyed by user ID when signed in,
 * otherwise by IP. Use this on every route that touches paid services
 * (Groq, Gemini, Stripe, Resend) or that an attacker could abuse to
 * enumerate data (slug-check, search, etc).
 *
 * Falls open (allows the request) if Upstash env vars are missing —
 * dev-friendly, matches the pattern in checkAiRateLimit.
 */

interface RateLimitOptions {
  /** Stable identifier for this route — used as the Redis key prefix. */
  bucket: string;
  /** Max requests per window. */
  limit: number;
  /** Window duration. Examples: "1 m", "10 s", "1 h", "1 d". */
  window: `${number} ${"s" | "m" | "h" | "d"}`;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number; // Unix ms
}

// Cache Ratelimit instances per bucket so we don't recreate the Redis
// client on every request.
const limiters = new Map<string, Ratelimit>();

function getLimiter(options: RateLimitOptions): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const cacheKey = `${options.bucket}:${options.limit}:${options.window}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.slidingWindow(options.limit, options.window),
      prefix: `rl:${options.bucket}`,
      analytics: false,
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

export async function rateLimit(
  req: NextRequest,
  identifier: string | null,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const limiter = getLimiter(options);
  if (!limiter) {
    return { allowed: true, remaining: options.limit, reset: Date.now() + 60_000 };
  }

  const key = identifier ?? extractIp(req) ?? "anonymous";
  const result = await limiter.limit(key);
  return {
    allowed: result.success,
    remaining: result.remaining,
    reset: result.reset,
  };
}

function extractIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}
