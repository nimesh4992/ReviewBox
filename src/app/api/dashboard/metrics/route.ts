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
  /** % change in reviews-this-week vs previous week. Null if no prior data. */
  reviewsWeekDelta: number | null;
  /** Avg rating change vs previous 30 days. Null if no prior data. */
  avgRatingDelta: number | null;
  /** Daily avg rating for last 10 days (oldest → newest). Empty if no data. */
  ratingTrend: number[];
}

/**
 * Bucket review ratings into daily averages between `start` and `end`.
 * Returns one value per day (oldest first). Days with no reviews are skipped
 * so the sparkline doesn't show fake zero dips.
 */
function buildDailyTrend(
  rows: { rating: number; store_created_at: string }[],
  start: Date,
  end: Date,
): number[] {
  const buckets: Map<string, { sum: number; n: number }> = new Map();
  for (const r of rows) {
    const key = new Date(r.store_created_at).toISOString().slice(0, 10);
    const b = buckets.get(key) ?? { sum: 0, n: 0 };
    b.sum += r.rating;
    b.n += 1;
    buckets.set(key, b);
  }
  const days: number[] = [];
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  const stop = new Date(end);
  stop.setHours(0, 0, 0, 0);
  while (cursor <= stop) {
    const key = cursor.toISOString().slice(0, 10);
    const b = buckets.get(key);
    if (b && b.n > 0) days.push(parseFloat((b.sum / b.n).toFixed(2)));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
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
  reviewsWeekDelta: null,
  avgRatingDelta: null,
  ratingTrend: [],
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

    const fourteenDaysAgo = new Date(now);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const tenDaysAgo = new Date(now);
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    // Run all queries in parallel
    const [
      unrepliedResult,
      urgentResult,
      avgRatingResult,
      aiDraftsResult,
      reviewsTodayResult,
      totalReviewsResult,
      reviewsThisWeekResult,
      reviewsLastWeekResult,
      prevAvgRatingResult,
      trendRowsResult,
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

      // 7. Reviews this week (for week-over-week delta)
      sb
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("store_created_at", sevenDaysAgo.toISOString()),

      // 8. Reviews last week (for week-over-week delta)
      sb
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .gte("store_created_at", fourteenDaysAgo.toISOString())
        .lt("store_created_at", sevenDaysAgo.toISOString()),

      // 9. Avg rating in the previous 30 days (for avg-rating delta)
      sb
        .from("reviews")
        .select("rating")
        .eq("workspace_id", workspaceId)
        .gte("store_created_at", sixtyDaysAgo.toISOString())
        .lt("store_created_at", thirtyDaysAgo.toISOString()),

      // 10. Daily rating rows for last 10 days (for sparkline trend)
      sb
        .from("reviews")
        .select("rating, store_created_at")
        .eq("workspace_id", workspaceId)
        .gte("store_created_at", tenDaysAgo.toISOString())
        .order("store_created_at", { ascending: true }),
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
            ).toFixed(2),
          )
        : null;

    // Reviews this week vs last week — week-over-week delta
    const thisWeek = reviewsThisWeekResult.count ?? 0;
    const lastWeek = reviewsLastWeekResult.count ?? 0;
    const reviewsWeekDelta =
      lastWeek > 0
        ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
        : thisWeek > 0
          ? null // No prior data; growing from zero — don't show a misleading %
          : null;

    // Avg rating delta vs the prior 30-day window
    const prevRatingRows = prevAvgRatingResult.data as { rating: number }[] | null;
    const prevAvgRating =
      prevRatingRows && prevRatingRows.length > 0
        ? prevRatingRows.reduce((sum, r) => sum + r.rating, 0) / prevRatingRows.length
        : null;
    const avgRatingDelta =
      avgRating !== null && prevAvgRating !== null
        ? parseFloat((avgRating - prevAvgRating).toFixed(2))
        : null;

    // Daily rating trend for last 10 days
    const trendRows =
      (trendRowsResult.data as { rating: number; store_created_at: string }[] | null) ?? [];
    const ratingTrend = buildDailyTrend(trendRows, tenDaysAgo, now);

    const metrics: DashboardMetrics = {
      unrepliedCount: unrepliedResult.count ?? 0,
      urgentCount: urgentResult.count ?? 0,
      avgRating,
      aiDraftsThisWeek: aiDraftsResult.count ?? 0,
      reviewsToday: reviewsTodayResult.count ?? 0,
      totalReviews: totalReviewsResult.count ?? 0,
      reviewsWeekDelta,
      avgRatingDelta,
      ratingTrend,
    };

    return NextResponse.json(metrics);
  } catch (err) {
    console.error("Unexpected error in GET /api/dashboard/metrics:", err);
    return NextResponse.json(EMPTY_METRICS);
  }
}
