import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError, captureAndError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";
import { translateText } from "@/lib/groq";
import { isLikelyEnglish } from "@/lib/language";
import { Redis } from "@upstash/redis";

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return apiError("NO_WORKSPACE", 404);

    // Rate limit: 100 translations / hour per workspace
    const rl = await rateLimit(req, workspaceId, {
      bucket: "translate",
      limit: 100,
      window: "1 h",
    });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429, "Too many translations. Try again later.");
    }

    const { id: reviewId } = await params;

    // Verify the review belongs to this workspace
    const sb = getServiceClient();
    const { data: review, error: reviewError } = await sb
      .from("reviews")
      .select("id, body")
      .eq("id", reviewId)
      .eq("workspace_id", workspaceId)
      .single();

    if (reviewError || !review) return apiError("NOT_FOUND", 404);

    const redis    = getRedis();
    const cacheKey = `translate:${reviewId}`;

    // Return cached translation if available
    if (redis) {
      const cached = await redis.get<{ translatedText: string; sourceLang: string }>(cacheKey);
      if (cached) {
        return NextResponse.json({ ...cached, cached: true });
      }
    }

    const body = (review.body as string | null) ?? "";

    // Second line of defence behind the hidden button: an older client, a
    // bookmarked request or a retry must not spend a Groq call to be told the
    // review was already English.
    if (isLikelyEnglish(body)) {
      return NextResponse.json({ translatedText: body, sourceLang: "en", cached: false });
    }

    const { translatedText, sourceLang } = await translateText(body);

    // Cache it
    if (redis) {
      await redis.set(cacheKey, { translatedText, sourceLang }, { ex: CACHE_TTL_SECONDS });
    }

    return NextResponse.json({ translatedText, sourceLang, cached: false });
  } catch (err) {
    return captureAndError(err, "POST /api/reviews/[id]/translate");
  }
}
