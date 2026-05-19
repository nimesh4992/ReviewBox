import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

export interface DashboardMetrics {
  unrepliedCount: number;
  urgentCount: number;
  avgRating: number | null;
  aiDraftsThisWeek: number;
  reviewsToday: number;
  totalReviews: number;
}

// Zeroes — used when the user has no workspace yet or a query fails.
// We never show fake numbers; an empty workspace shows real zeros so
// the dashboard accurately reflects the state of their data.
const EMPTY_METRICS: DashboardMetrics = {
  unrepliedCount: 0,
  urgentCount: 0,
  avgRating: null,
  aiDraftsThisWeek: 0,
  reviewsToday: 0,
  totalReviews: 0,
};

export async function GET(): Promise<NextResponse> {
  try {
    // 1. Auth
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // 2. Workspace lookup
    const workspaceId = await getWorkspaceId(userId);

    if (!workspaceId) {
      return NextResponse.json(EMPTY_METRICS);
    }

    const sb = getServiceClient();

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Run all queries in parallel
    const [
      unrepliedResult,
      urgentResult,
      avgRatingResult,
      aiDraftsResult,
      reviewsTodayResult,
      totalReviewsResult,
    ] = await Promise.all([
      // 1. Unreplied reviews
      sb
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("reply_status", "needs_reply"),

      // 2. Urgent unreplied reviews
      sb
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("priority", "urgent")
        .neq("reply_status", "replied"),

      // 3. Avg rating last 30 days (by store posting date)
      sb
        .from("reviews")
        .select("rating")
        .eq("workspace_id", workspaceId)
        .gte("store_created_at", thirtyDaysAgo.toISOString()),

      // 4. AI drafts this week (DB created_at is correct here — when WE drafted)
      sb
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("action", "draft_reply")
        .gte("created_at", sevenDaysAgo.toISOString()),

      // 5. Reviews posted today on the store (not synced today)
      sb
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("store_created_at", todayStart.toISOString()),

      // 6. Total reviews
      sb
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId),
    ]);

    if (
      unrepliedResult.error ||
      urgentResult.error ||
      avgRatingResult.error ||
      aiDraftsResult.error ||
      reviewsTodayResult.error ||
      totalReviewsResult.error
    ) {
      console.error("Dashboard metrics query error", {
        unreplied: unrepliedResult.error,
        urgent: urgentResult.error,
        avgRating: avgRatingResult.error,
        aiDrafts: aiDraftsResult.error,
        reviewsToday: reviewsTodayResult.error,
        totalReviews: totalReviewsResult.error,
      });
      return NextResponse.json(EMPTY_METRICS);
    }

    // Compute avg rating from returned rows
    const ratingRows = avgRatingResult.data as { rating: number }[] | null;
    const avgRating =
      ratingRows && ratingRows.length > 0
        ? parseFloat(
            (
              ratingRows.reduce((sum, r) => sum + r.rating, 0) / ratingRows.length
            ).toFixed(1),
          )
        : null;

    const metrics: DashboardMetrics = {
      unrepliedCount: unrepliedResult.count ?? 0,
      urgentCount: urgentResult.count ?? 0,
      avgRating,
      aiDraftsThisWeek: aiDraftsResult.count ?? 0,
      reviewsToday: reviewsTodayResult.count ?? 0,
      totalReviews: totalReviewsResult.count ?? 0,
    };

    return NextResponse.json(metrics);
  } catch (err) {
    console.error("Unexpected error in GET /api/dashboard/metrics:", err);
    return NextResponse.json(EMPTY_METRICS);
  }
}
