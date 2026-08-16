import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { buildRatingTrend } from "@/lib/rating-trend";
import { isMissingColumnError } from "@/lib/db-errors";

export interface DashboardMetrics {
  unrepliedCount: number;
  urgentCount: number;
  avgRating: number | null;
  aiDraftsThisWeek: number;
  reviewsToday: number;
  /** Reviews in the last 7 days — the figure reviewsWeekDelta compares. */
  reviewsThisWeek: number;
  totalReviews: number;
  /** % change in reviews-this-week vs previous week. Null if no prior data. */
  reviewsWeekDelta: number | null;
  /** Avg rating change vs previous 30 days. Null if no prior data. */
  avgRatingDelta: number | null;
  /**
   * One point per calendar day (oldest → newest), each a trailing 7-day average
   * rating. `null` marks a day whose window held no reviews — the chart breaks
   * the line there rather than joining across the gap.
   */
  ratingTrend: (number | null)[];
  /**
   * Lifetime average rating scraped from the store (matches what users see on
   * Google Play / App Store). Null if metadata not yet refreshed.
   * Prefer this over avgRating for the main "Portfolio rating" display.
   */
  lifetimeRating: number | null;
  /**
   * Sum of lifetime_review_count across all workspace apps (store-side count,
   * not the count of rows we've synced). Null if metadata not yet refreshed.
   */
  lifetimeReviewCount: number | null;
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
  reviewsThisWeek: 0,
  totalReviews: 0,
  reviewsWeekDelta: null,
  avgRatingDelta: null,
  ratingTrend: [],
  lifetimeRating: null,
  lifetimeReviewCount: null,
};

export async function GET(): Promise<NextResponse> {
  try {
    // 1. Auth
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    // 2. Workspace lookup
    const workspaceId = await getWorkspaceId(userId);

    if (!workspaceId) {
      return NextResponse.json(EMPTY_METRICS);
    }

    const sb = getServiceClient();

    // Scope every review count to the workspace's LIVE apps.
    //
    // The inbox does this (/api/reviews) and the dashboard did not, so the two
    // disagreed: 200 reviews on the dashboard, 20 in the inbox. The extra 180
    // belong to a disconnected app whose rows are still in the table. Counting
    // by workspace alone is the same mistake that produced the phantom
    // "200 reviews, 4.32 average" on a workspace with nothing connected.
    //
    // Migration 021 deletes the orphans, but this filter is what stops it
    // happening again the next time someone removes an app.
    const liveApps = await sb
      .from("apps")
      .select("id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);

    const liveAppIds = ((liveApps.data as { id: string }[] | null) ?? []).map((a) => a.id);

    if (liveApps.error) {
      console.error("[dashboard/metrics] live app lookup failed:", liveApps.error);
    }

    // No live apps means no reviews to count. Returning zeros is correct and
    // is what the empty-workspace screen expects.
    if (!liveAppIds.length) {
      return NextResponse.json(EMPTY_METRICS);
    }

    /** Every reviews query goes through this so none can forget the filter. */
    const reviewsIn = () =>
      sb.from("reviews").select("id", { count: "exact", head: true }).in("app_id", liveAppIds);

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
      appsMetaResult,
    ] = await Promise.all([
      // 1. Unreplied reviews
      reviewsIn()
        .eq("reply_status", "needs_reply"),

      // 2. Urgent unreplied reviews
      reviewsIn()
        .eq("priority", "urgent")
        .neq("reply_status", "replied"),

      // 3. Avg rating last 30 days (by store posting date)
      sb
        .from("reviews")
        .select("rating")
        .in("app_id", liveAppIds)
        .gte("store_created_at", thirtyDaysAgo.toISOString()),

      // 4. AI drafts this week (DB created_at is correct here — when WE drafted)
      sb
        .from("ai_usage")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .eq("action", "draft_reply")
        .gte("created_at", sevenDaysAgo.toISOString()),

      // 5. Reviews posted today on the store (not synced today)
      reviewsIn()
        .gte("store_created_at", todayStart.toISOString()),

      // 6. Total reviews
      reviewsIn(),

      // 7. Reviews this week (for week-over-week delta)
      reviewsIn()
        .gte("store_created_at", sevenDaysAgo.toISOString()),

      // 8. Reviews last week (for week-over-week delta)
      reviewsIn()
        .gte("store_created_at", fourteenDaysAgo.toISOString())
        .lt("store_created_at", sevenDaysAgo.toISOString()),

      // 9. Avg rating in the previous 30 days (for avg-rating delta)
      sb
        .from("reviews")
        .select("rating")
        .in("app_id", liveAppIds)
        .gte("store_created_at", sixtyDaysAgo.toISOString())
        .lt("store_created_at", thirtyDaysAgo.toISOString()),

      // 10. Daily rating rows for last 10 days (for sparkline trend)
      sb
        .from("reviews")
        .select("rating, store_created_at")
        .in("app_id", liveAppIds)
        .gte("store_created_at", tenDaysAgo.toISOString())
        .order("store_created_at", { ascending: true }),

      // 11. Lifetime rating + review count from the store (scraped metadata).
      //     Weighted average across the workspace's LIVE apps.
      //
      //     `.is("deleted_at", null)` is the whole point: without it a
      //     disconnected app kept contributing its store rating forever, and
      //     because the average is weighted by review count an old app with
      //     thousands of ratings drowned out the one actually connected. A
      //     brand-new workspace showed a confident 4.60 that belonged to an
      //     app the customer had already removed. Same root cause as the
      //     phantom 200 reviews: every query filtered on workspace alone.
      sb
        .from("apps")
        .select("lifetime_rating, lifetime_review_count")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .not("lifetime_rating", "is", null),
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
    const ratingTrend = buildRatingTrend(trendRows, tenDaysAgo, now);

    // Lifetime rating / review count from apps table (store-scraped, authoritative).
    // Weighted average across all workspace apps by review count.
    interface AppMeta { lifetime_rating: number; lifetime_review_count: number | null }
    let appsMeta = (appsMetaResult.data as AppMeta[] | null) ?? [];

    // On a database without migration 015 the `deleted_at` filter above fails.
    // Retry without it: no column means no app has ever been soft-deleted, so
    // the unfiltered result is equivalent rather than a reintroduction of the
    // stale-rating bug.
    if (isMissingColumnError(appsMetaResult.error)) {
      const retry = await sb
        .from("apps")
        .select("lifetime_rating, lifetime_review_count")
        .eq("workspace_id", workspaceId)
        .not("lifetime_rating", "is", null);
      appsMeta = (retry.data as AppMeta[] | null) ?? [];
    } else if (appsMetaResult.error) {
      // Not fatal — the rating falls back to the synced-review average — but
      // it was silently swallowed before, so the dashboard would show "—" with
      // no way to find out why.
      console.error("[dashboard/metrics] apps metadata query failed:", appsMetaResult.error);
    }

    let lifetimeRating: number | null = null;
    let lifetimeReviewCount: number | null = null;
    if (appsMeta.length > 0) {
      let weightedSum = 0;
      let totalWeight = 0;
      let totalCount = 0;
      for (const a of appsMeta) {
        const weight = a.lifetime_review_count ?? 1;
        weightedSum += a.lifetime_rating * weight;
        totalWeight += weight;
        if (a.lifetime_review_count !== null) totalCount += a.lifetime_review_count;
      }
      lifetimeRating       = parseFloat((weightedSum / totalWeight).toFixed(2));
      lifetimeReviewCount  = totalCount > 0 ? totalCount : null;
    }

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
      reviewsThisWeek: thisWeek,
      lifetimeRating,
      lifetimeReviewCount,
    };

    return NextResponse.json(metrics);
  } catch (err) {
    console.error("Unexpected error in GET /api/dashboard/metrics:", err);
    return NextResponse.json(EMPTY_METRICS);
  }
}
