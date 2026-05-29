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

    const redis = getRedis();
    const cacheKey = `ai_summary_text:${workspaceId}`;

    // Check Redis cache first
    if (redis) {
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
    const sb = getServiceClient();
    const { data: reviews, error: reviewsError } = await sb
      .from("reviews")
      .select("body, rating, created_at")
      .eq("workspace_id", workspaceId)
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
