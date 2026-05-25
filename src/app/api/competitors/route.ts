import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";

/**
 * GET /api/competitors
 *
 * Returns:
 *  - `yourApp`   — real metrics for the user's primary app (from DB)
 *  - `competitors` — illustrative placeholder rows (competitor tracking is
 *                    a future feature; rows show the UI layout while real
 *                    data is coming)
 *
 * "your app" metrics:
 *   rating        — lifetime_rating from the apps row (seeded at onboarding)
 *   reviewsPerWeek — count of reviews in the past 7 days
 *   replyRate      — % of reviews with reply_status = 'replied', last 30d
 *   trend          — avg rating per week for last 6 weeks (rounded to 1dp)
 */

interface CompetitorRow {
  name: string;
  rating: number;
  reviewsPerWeek: number;
  replyRate: number;
  trend: number[];
  you: boolean;
  illustrative: boolean;
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const sb = getServiceClient();

  // ── Fetch primary app row ─────────────────────────────────────────────────
  const { data: app } = await sb
    .from("apps")
    .select("id, name, lifetime_rating, platform")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();

  // ── Your-app metrics from the reviews table ───────────────────────────────
  const appId: string | null = app?.id ?? null;
  const appName: string = app?.name ?? "Your app";
  let rating: number = typeof app?.lifetime_rating === "number" ? app.lifetime_rating : 0;
  let reviewsPerWeek = 0;
  let replyRate = 0;
  const trend: number[] = [];

  if (appId) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000).toISOString();
    const sixWeeksAgo = new Date(now.getTime() - 42 * 86400_000).toISOString();

    // Reviews in last 7 days
    const { count: weekCount } = await sb
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("app_id", appId)
      .gte("store_created_at", sevenDaysAgo);
    reviewsPerWeek = weekCount ?? 0;

    // Reply rate — last 30 days
    const { data: replyRows } = await sb
      .from("reviews")
      .select("reply_status")
      .eq("app_id", appId)
      .gte("store_created_at", thirtyDaysAgo);

    if (replyRows?.length) {
      const replied = replyRows.filter((r) => r.reply_status === "replied").length;
      replyRate = Math.round((replied / replyRows.length) * 100);
    }

    // Live avg rating from reviews if lifetime_rating is 0 / missing
    if (!rating) {
      const { data: ratingRows } = await sb
        .from("reviews")
        .select("rating")
        .eq("app_id", appId);
      if (ratingRows?.length) {
        const sum = ratingRows.reduce((acc, r) => acc + (r.rating as number), 0);
        rating = Math.round((sum / ratingRows.length) * 10) / 10;
      }
    }

    // Weekly trend — avg rating per 7-day bucket, last 6 weeks
    const { data: trendRows } = await sb
      .from("reviews")
      .select("rating, store_created_at")
      .eq("app_id", appId)
      .gte("store_created_at", sixWeeksAgo)
      .order("store_created_at", { ascending: true });

    if (trendRows?.length) {
      const buckets: number[][] = Array.from({ length: 6 }, () => []);
      for (const r of trendRows) {
        const ageMs = now.getTime() - new Date(r.store_created_at as string).getTime();
        const weekIdx = Math.min(5, Math.floor(ageMs / (7 * 86400_000)));
        buckets[5 - weekIdx].push(r.rating as number);
      }
      for (const bucket of buckets) {
        if (bucket.length) {
          const avg = bucket.reduce((s, v) => s + v, 0) / bucket.length;
          trend.push(Math.round(avg * 10) / 10);
        } else {
          trend.push(rating || 4.0);
        }
      }
    } else {
      // No reviews yet — flat line at store rating or neutral
      const fill = rating || 4.0;
      trend.push(...[fill, fill, fill, fill, fill, fill]);
    }
  } else {
    trend.push(...[4.0, 4.0, 4.0, 4.0, 4.0, 4.0]);
  }

  const yourApp: CompetitorRow = {
    name: appName,
    rating: rating || 0,
    reviewsPerWeek,
    replyRate,
    trend,
    you: true,
    illustrative: false,
  };

  // ── Illustrative competitor rows ──────────────────────────────────────────
  // These are example rows to show what the competitors table looks like once
  // competitor tracking is enabled. They do NOT represent real apps.
  const illustrativeCompetitors: CompetitorRow[] = [
    { name: "Competitor A", rating: 4.7, reviewsPerWeek: 48, replyRate: 58, trend: [4.4, 4.5, 4.6, 4.7, 4.7, 4.7], you: false, illustrative: true },
    { name: "Competitor B", rating: 4.4, reviewsPerWeek: 31, replyRate: 43, trend: [4.5, 4.4, 4.4, 4.3, 4.4, 4.4], you: false, illustrative: true },
    { name: "Competitor C", rating: 4.2, reviewsPerWeek: 22, replyRate: 28, trend: [4.3, 4.2, 4.1, 4.2, 4.2, 4.2], you: false, illustrative: true },
  ];

  return NextResponse.json({
    yourApp,
    competitors: illustrativeCompetitors,
    hasRealData: (appId !== null),
  });
}
