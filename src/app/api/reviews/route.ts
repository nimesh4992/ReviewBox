import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { mockReviews } from "@/features/reviews/data/mock-reviews";
import { AppReview } from "@/types/review";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // 2. Parse query params
    const { searchParams } = req.nextUrl;
    const limitParam = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
    const limit = Math.min(isNaN(limitParam) ? DEFAULT_LIMIT : limitParam, MAX_LIMIT);
    const cursor = searchParams.get("cursor") ?? undefined;
    const status = searchParams.get("status") ?? undefined;
    const sentiment = searchParams.get("sentiment") ?? undefined;
    const rating = searchParams.get("rating") ? parseInt(searchParams.get("rating")!, 10) : undefined;
    const platform = searchParams.get("platform") ?? undefined;

    // 3. Workspace lookup
    const workspaceId = await getWorkspaceId(userId);

    if (!workspaceId) {
      // No workspace yet — return mock data so the UI isn't broken in dev
      return NextResponse.json({
        reviews: mockReviews.slice(0, limit),
        nextCursor: null,
        hasMore: false,
      });
    }

    // 4. Build Supabase query
    const sb = getServiceClient();
    let query = sb
      .from("reviews")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit + 1); // fetch one extra to determine hasMore

    if (cursor) {
      query = query.lt("created_at", cursor);
    }
    if (status) {
      query = query.eq("reply_status", status);
    }
    if (sentiment) {
      query = query.eq("sentiment", sentiment);
    }
    if (rating !== undefined && !isNaN(rating)) {
      query = query.eq("rating", rating);
    }
    if (platform) {
      query = query.eq("source", platform);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase reviews query error:", error);
      // Graceful fallback to mock data
      return NextResponse.json({
        reviews: mockReviews.slice(0, limit),
        nextCursor: null,
        hasMore: false,
      });
    }

    const rows = (data ?? []) as AppReview[];
    const hasMore = rows.length > limit;
    const reviews = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = reviews[reviews.length - 1];
    const nextCursor = hasMore && lastItem ? lastItem.createdAt : null;

    return NextResponse.json({ reviews, nextCursor, hasMore });
  } catch (err) {
    console.error("Unexpected error in GET /api/reviews:", err);
    // Graceful fallback
    return NextResponse.json({
      reviews: mockReviews,
      nextCursor: null,
      hasMore: false,
    });
  }
}
