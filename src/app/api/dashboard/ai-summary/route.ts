import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError, captureAndError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";
import { generateSummary } from "@/lib/groq";
import { Redis } from "@upstash/redis";

const CACHE_TTL_SECONDS = 60 * 60; // 1 hour

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return apiError("NO_WORKSPACE", 404);

    // Rate limit: 10 calls/hour per workspace
    const rl = await rateLimit(req, workspaceId, {
      bucket: "ai_summary",
      limit: 10,
      window: "1 h",
    });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429, "Too many refreshes. Try again later.");
    }

    // Scope to the workspace's LIVE apps — and, when the sidebar has one app
    // selected, to that app alone. Same contract as /api/reviews and
    // /api/dashboard/metrics: a client appId is only honoured if it belongs to
    // this workspace. The live-apps filter also stops the summary reading
    // reviews left behind by a deleted app, which every other review query
    // already excludes.
    const sb = getServiceClient();
    const { data: liveApps, error: appsError } = await sb
      .from("apps")
      .select("id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);

    if (appsError) {
      return captureAndError(appsError, "GET /api/dashboard/ai-summary (apps)");
    }

    let liveAppIds = (liveApps ?? []).map((a) => a.id as string);
    const appId = req.nextUrl.searchParams.get("appId")?.trim() || undefined;
    if (appId) {
      if (!liveAppIds.includes(appId)) {
        return NextResponse.json({
          summary: "Not enough recent review data to generate a summary.",
          reviewCount: 0,
          generatedAt: new Date().toISOString(),
          cached: false,
        });
      }
      liveAppIds = [appId];
    }

    const redis = getRedis();
    // Scope is part of the key — a summary of one app must never be served
    // for another app (or for the all-apps view) out of the hour-long cache.
    const cacheKey = `ai_summary_text:${workspaceId}:${appId ?? "all"}`;

    // Check Redis cache first — unless the user explicitly asked to refresh.
    // The panel's Refresh button returned the identical cached payload for a
    // full hour: the spinner turned and "Updated N minutes ago" never moved.
    // The 10/hour rate limit above already bounds the cost of a real refresh.
    const forceRefresh = req.nextUrl.searchParams.get("refresh") === "1";
    if (redis && !forceRefresh) {
      const cached = await redis.get<{
        summary: string;
        reviewCount: number;
        generatedAt: string;
      }>(cacheKey);

      if (cached) {
        return NextResponse.json({ ...cached, cached: true });
      }
    }

    // Fetch last 50 review bodies from Supabase
    const { data: reviews, error: reviewsError } = await sb
      .from("reviews")
      .select("body, rating, created_at")
      .eq("workspace_id", workspaceId)
      .in("app_id", liveAppIds)
      .order("created_at", { ascending: false })
      .limit(50);

    if (reviewsError) {
      return captureAndError(reviewsError, "GET /api/dashboard/ai-summary");
    }

    const reviewCount = reviews?.length ?? 0;
    const snippets = (reviews ?? [])
      .map((r) => (r.body ?? "").slice(0, 200))
      .filter(Boolean);

    const summary = await generateSummary(snippets);
    const generatedAt = new Date().toISOString();

    // Cache result
    if (redis) {
      await redis.set(cacheKey, { summary, reviewCount, generatedAt }, { ex: CACHE_TTL_SECONDS });
    }

    return NextResponse.json({ summary, reviewCount, generatedAt, cached: false });
  } catch (err) {
    return captureAndError(err, "GET /api/dashboard/ai-summary");
  }
}
