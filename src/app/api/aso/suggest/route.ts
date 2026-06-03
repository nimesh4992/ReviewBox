/**
 * POST /api/aso/suggest
 *
 * ASO keyword suggestions for an app.
 * Results are cached in Redis for 24 hours — at most one Gemini call
 * per app per day regardless of how many users view the ASO screen.
 *
 * Request:  { appId: string }
 * Response: { keywords: string[], lastUpdated: string, source: "cache"|"gemini"|"unavailable" }
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

import { suggestAsoKeywords } from "@/lib/gemini";
import { compressReviewText } from "@/lib/prompt-utils";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError, captureAndError } from "@/lib/api-response";

const CACHE_TTL_SECONDS = 24 * 60 * 60; // 24 hours

// ── Redis singleton ───────────────────────────────────────────────────────────

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!_redis) _redis = new Redis({ url, token });
  return _redis;
}

// ── Route handler ─────────────────────────────────────────────────────────────

interface AsoSuggestResponse {
  keywords: string[];
  lastUpdated: string;
  source: "cache" | "gemini" | "unavailable";
}

interface CachedAsoPayload {
  keywords: string[];
  lastUpdated: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId  = session?.userId;
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    // Cache is per-app per-day, but still rate-limit refresh attempts.
    const rl = await rateLimit(req, userId, { bucket: "aso", limit: 10, window: "10 m" });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429);
    }

    const { appId } = (await req.json()) as { appId?: string };
    if (!appId) {
      return apiError("MISSING_FIELDS", 400, "appId is required");
    }

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) {
      return apiError("NO_WORKSPACE", 404);
    }

    const cacheKey = `aso_suggest:${workspaceId}:${appId}`;

    // ── Redis cache check (0 tokens) ─────────────────────────────────────────
    const redis = getRedis();
    if (redis) {
      try {
        const hit = await redis.get<CachedAsoPayload>(cacheKey);
        if (hit) {
          return NextResponse.json<AsoSuggestResponse>({
            keywords:    hit.keywords,
            lastUpdated: hit.lastUpdated,
            source:      "cache",
          });
        }
      } catch {
        // Redis error — continue to Gemini
      }
    }

    // ── Gemini generation ─────────────────────────────────────────────────────
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json<AsoSuggestResponse>({
        keywords:    [],
        lastUpdated: "",
        source:      "unavailable",
      });
    }

    const sb = getServiceClient();

    // Fetch app metadata — apps table has `name` only; description/keywords
    // are not stored, so we derive context from reviews instead.
    const { data: app } = await sb
      .from("apps")
      .select("name")
      .eq("id", appId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!app) {
      return apiError("NOT_FOUND", 404, "App not found");
    }

    // Fetch 20 recent reviews and compress to a ~300-char summary
    // (reviews table column is `body`, not `text`)
    const { data: recentReviews } = await sb
      .from("reviews")
      .select("body, rating")
      .eq("app_id", appId)
      .order("store_created_at", { ascending: false })
      .limit(20);

    const reviewSummary = (recentReviews ?? [])
      .map((r: { body: string; rating: number }) =>
        compressReviewText(r.body ?? "", 60),
      )
      .join("; ")
      .slice(0, 300);

    let keywords: string[] = [];
    try {
      keywords = await suggestAsoKeywords({
        appName:         (app.name as string) ?? "",
        appDescription:  "",
        currentKeywords: [],
        reviewSummary,
      });
    } catch (err) {
      console.warn(
        "Gemini ASO suggestion failed:",
        err instanceof Error ? err.message : String(err),
      );
      return NextResponse.json<AsoSuggestResponse>({
        keywords:    [],
        lastUpdated: "",
        source:      "unavailable",
      });
    }

    const lastUpdated = new Date().toISOString();

    // Store in Redis (24h TTL)
    if (redis) {
      try {
        await redis.setex(
          cacheKey,
          CACHE_TTL_SECONDS,
          JSON.stringify({ keywords, lastUpdated } satisfies CachedAsoPayload),
        );
      } catch {
        // Best-effort — don't fail the response
      }
    }

    return NextResponse.json<AsoSuggestResponse>({
      keywords,
      lastUpdated,
      source: "gemini",
    });
  } catch (err) {
    return captureAndError(err, "POST /api/aso/suggest");
  }
}
