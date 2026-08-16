import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";

export interface TopicReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  sentiment: string;
  createdAt: string;
  replyStatus: string;
}

export interface SentimentTopic {
  topic: string;
  tag: string;          // raw tag key — used for coloring in UI
  count: number;
  share: number;        // 0–100, 1dp
  trend: "up" | "down" | "flat";
  sentiment: number;    // -1 to +1, net sentiment score
  /** Top 3 most-recent reviews carrying this tag */
  topReviews: TopicReview[];
}

export interface CriticalReview {
  id: string;
  author: string;
  rating: number;
  text: string;
  sentiment: string;
  createdAt: string;
  replyStatus: string;
}

export interface SentimentOverview {
  avgRating: number | null;
  avgRatingPrev: number | null;      // previous period avg (for delta)
  totalReviews: number;
  positiveShare: number;             // 0–100 integer
  positiveSharePrev: number | null;  // previous period (for delta)
  avgReplyMinutes: number | null;
  trend: { positive: number[]; negative: number[] }; // 14 data points, % each day
  /** [1★, 2★, 3★, 4★, 5★] as percentages summing to 100 */
  ratingDistribution: [number, number, number, number, number];
  /** Google Play vs App Store review counts for this period */
  platformSplit: { googlePlay: number; appStore: number };
  topics: SentimentTopic[];
  /** Last 5 critical/negative reviews for the quick-list */
  criticalReviews: CriticalReview[];
}

const EMPTY: SentimentOverview = {
  avgRating: null,
  avgRatingPrev: null,
  totalReviews: 0,
  positiveShare: 0,
  positiveSharePrev: null,
  avgReplyMinutes: null,
  trend: { positive: [], negative: [] },
  ratingDistribution: [0, 0, 0, 0, 0],
  platformSplit: { googlePlay: 0, appStore: 0 },
  topics: [],
  criticalReviews: [],
};

// Human-readable labels for issue_tags values
const TAG_LABEL: Record<string, string> = {
  crash:                "Crashes",
  billing:              "Billing",
  login:                "Auth & login",
  performance:          "Performance",
  "release-regression": "Release regression",
  "feature-request":    "Feature requests",
  "support-delay":      "Support delay",
  localization:         "Localisation",
};

// Net sentiment score per tag (-1 to +1)
const TAG_SENTIMENT: Record<string, number> = {
  crash:                -0.8,
  billing:              -0.7,
  login:                -0.6,
  performance:          -0.5,
  "release-regression": -0.8,
  "feature-request":     0.3,
  "support-delay":      -0.6,
  localization:          0.1,
};

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return NextResponse.json(EMPTY);

    const url = new URL(req.url);
    const appId = url.searchParams.get("appId");
    const range = (url.searchParams.get("range") ?? "30d") as "7d" | "30d" | "90d";

    const days = range === "7d" ? 7 : range === "90d" ? 90 : 30;
    const sb = getServiceClient();
    const now = new Date();

    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - days);

    // previous period window (for deltas)
    const prevWindowStart = new Date(now);
    prevWindowStart.setDate(prevWindowStart.getDate() - days * 2);
    const prevWindowEnd = windowStart;

    // base filter helper — select("*") first so .eq() is available on FilterBuilder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = (): any => {
      const q = sb.from("reviews").select("*").eq("workspace_id", workspaceId);
      return appId ? q.eq("app_id", appId) : q;
    };

    // ── 1. KPI metrics (current + previous period) ───────────────────────────
    const [ratingRows, positiveCount, repliedRows, prevRatingRows, prevPositiveCount] =
      await Promise.all([
        base()
          .select("rating")
          .gte("store_created_at", windowStart.toISOString()),
        base()
          .select("id", { count: "exact", head: true })
          .eq("sentiment", "positive")
          .gte("store_created_at", windowStart.toISOString()),
        base()
          .select("store_created_at, replied_at")
          .eq("reply_status", "replied")
          .not("replied_at", "is", null)
          .gte("store_created_at", windowStart.toISOString()),
        // previous period
        base()
          .select("rating")
          .gte("store_created_at", prevWindowStart.toISOString())
          .lt("store_created_at", prevWindowEnd.toISOString()),
        base()
          .select("id", { count: "exact", head: true })
          .eq("sentiment", "positive")
          .gte("store_created_at", prevWindowStart.toISOString())
          .lt("store_created_at", prevWindowEnd.toISOString()),
      ]);

    const ratings = ((ratingRows.data ?? []) as { rating: number }[]).map((r) => r.rating);
    const totalReviews = ratings.length;
    const avgRating =
      totalReviews > 0
        ? parseFloat((ratings.reduce((s, r) => s + r, 0) / totalReviews).toFixed(2))
        : null;
    const positiveShare =
      totalReviews > 0
        ? Math.round(((positiveCount.count ?? 0) / totalReviews) * 100)
        : 0;

    // previous period
    const prevRatings = ((prevRatingRows.data ?? []) as { rating: number }[]).map((r) => r.rating);
    const prevTotal = prevRatings.length;
    const avgRatingPrev =
      prevTotal > 0
        ? parseFloat((prevRatings.reduce((s, r) => s + r, 0) / prevTotal).toFixed(2))
        : null;
    const positiveSharePrev =
      prevTotal > 0
        ? Math.round(((prevPositiveCount.count ?? 0) / prevTotal) * 100)
        : null;

    const replied = (repliedRows.data ?? []) as {
      store_created_at: string;
      replied_at: string;
    }[];
    const avgReplyMinutes =
      replied.length > 0
        ? Math.round(
            replied.reduce((sum, r) => {
              const ms =
                new Date(r.replied_at).getTime() -
                new Date(r.store_created_at).getTime();
              return sum + ms / 60_000;
            }, 0) / replied.length,
          )
        : null;

    // ── 2. Rating distribution [1★…5★] ──────────────────────────────────────
    const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    for (const r of ratings) {
      const idx = Math.min(Math.max(Math.round(r) - 1, 0), 4);
      dist[idx]++;
    }
    const ratingDistribution: [number, number, number, number, number] =
      totalReviews > 0
        ? [
            Math.round((dist[0] / totalReviews) * 100),
            Math.round((dist[1] / totalReviews) * 100),
            Math.round((dist[2] / totalReviews) * 100),
            Math.round((dist[3] / totalReviews) * 100),
            Math.round((dist[4] / totalReviews) * 100),
          ]
        : [0, 0, 0, 0, 0];

    // ── 3. 14-day trend ──────────────────────────────────────────────────────
    const trendStart = new Date(now);
    trendStart.setDate(trendStart.getDate() - 14);

    const trendRows = await base()
      .select("store_created_at, sentiment")
      .gte("store_created_at", trendStart.toISOString())
      .order("store_created_at", { ascending: true });

    const dayBuckets: Record<string, { pos: number; neg: number; total: number }> = {};
    for (let i = 0; i < 14; i++) {
      const d = new Date(trendStart);
      d.setDate(d.getDate() + i);
      dayBuckets[d.toISOString().slice(0, 10)] = { pos: 0, neg: 0, total: 0 };
    }

    for (const r of (trendRows.data ?? []) as {
      store_created_at: string;
      sentiment: string;
    }[]) {
      const key = new Date(r.store_created_at).toISOString().slice(0, 10);
      if (!dayBuckets[key]) continue;
      dayBuckets[key].total++;
      if (r.sentiment === "positive") dayBuckets[key].pos++;
      if (r.sentiment === "critical" || r.sentiment === "negative") dayBuckets[key].neg++;
    }

    const trendPositive: number[] = [];
    const trendNegative: number[] = [];
    for (const b of Object.values(dayBuckets)) {
      trendPositive.push(b.total > 0 ? Math.round((b.pos / b.total) * 100) : 0);
      trendNegative.push(b.total > 0 ? Math.round((b.neg / b.total) * 100) : 0);
    }

    // ── 4. Platform split ────────────────────────────────────────────────────
    const platformRows = await base()
      .select("source")
      .gte("store_created_at", windowStart.toISOString());

    // `reviews.source` is a DB enum — 'google_play' / 'app_store' (the check
    // constraint in 001). This compared against the *display* strings
    // ("Google Play" / "App Store"), so neither branch ever matched: both
    // counters stayed 0 and the panel rendered "Google Play 0 · 0%" beside
    // "App Store 0 · 100%" for a workspace whose only app is on Google Play.
    // The display strings only exist after /api/reviews maps the row for the
    // client; this route reads the raw column.
    let gpCount = 0, asCount = 0;
    for (const r of (platformRows.data ?? []) as { source: string }[]) {
      if (r.source === "google_play") gpCount++;
      else if (r.source === "app_store") asCount++;
    }
    const platformSplit = { googlePlay: gpCount, appStore: asCount };

    // ── 5. Topics ────────────────────────────────────────────────────────────
    const topicRows = await base()
      .select("id, author, rating, text:body, sentiment, store_created_at, reply_status, issue_tags")
      .gte("store_created_at", windowStart.toISOString())
      .not("issue_tags", "is", null)
      .order("store_created_at", { ascending: false });

    // last 7d for trend comparison
    const prev7Start = new Date(now);
    prev7Start.setDate(prev7Start.getDate() - 14);
    const curr7Start = new Date(now);
    curr7Start.setDate(curr7Start.getDate() - 7);

    const [prev7Rows, curr7Rows] = await Promise.all([
      base()
        .select("issue_tags")
        .gte("store_created_at", prev7Start.toISOString())
        .lt("store_created_at", curr7Start.toISOString()),
      base()
        .select("issue_tags")
        .gte("store_created_at", curr7Start.toISOString()),
    ]);

    type TopicRow = {
      id: string; author: string; rating: number; text: string;
      sentiment: string; store_created_at: string; reply_status: string;
      issue_tags: string[];
    };
    const topicRowsTyped = (topicRows.data ?? []) as TopicRow[];

    const tagCount: Record<string, number> = {};
    // top 3 most-recent reviews per tag (rows already ordered desc by store_created_at)
    const tagTopReviews: Record<string, TopicReview[]> = {};

    for (const row of topicRowsTyped) {
      for (const tag of row.issue_tags ?? []) {
        tagCount[tag] = (tagCount[tag] ?? 0) + 1;
        if (!tagTopReviews[tag]) tagTopReviews[tag] = [];
        if (tagTopReviews[tag].length < 3) {
          tagTopReviews[tag].push({
            id:          row.id,
            author:      row.author,
            rating:      row.rating,
            text:        row.text,
            sentiment:   row.sentiment,
            createdAt:   row.store_created_at,
            replyStatus: row.reply_status,
          });
        }
      }
    }

    const prev7Count: Record<string, number> = {};
    for (const row of (prev7Rows.data ?? []) as { issue_tags: string[] }[]) {
      for (const tag of row.issue_tags ?? []) {
        prev7Count[tag] = (prev7Count[tag] ?? 0) + 1;
      }
    }
    const curr7Count: Record<string, number> = {};
    for (const row of (curr7Rows.data ?? []) as { issue_tags: string[] }[]) {
      for (const tag of row.issue_tags ?? []) {
        curr7Count[tag] = (curr7Count[tag] ?? 0) + 1;
      }
    }

    const topics: SentimentTopic[] = Object.entries(tagCount)
      .map(([tag, count]) => {
        const prev = prev7Count[tag] ?? 0;
        const curr = curr7Count[tag] ?? 0;
        const trend: "up" | "down" | "flat" =
          prev === 0
            ? curr > 0
              ? "up"
              : "flat"
            : curr > prev * 1.1
              ? "up"
              : curr < prev * 0.9
                ? "down"
                : "flat";
        return {
          tag,
          topic:      TAG_LABEL[tag] ?? tag,
          count,
          share:      totalReviews > 0 ? Math.round((count / totalReviews) * 1000) / 10 : 0,
          trend,
          sentiment:  TAG_SENTIMENT[tag] ?? 0,
          topReviews: tagTopReviews[tag] ?? [],
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ── 5. Critical reviews quick-list ───────────────────────────────────────
    const criticalRows = await base()
      .select("id, author, rating, text:body, sentiment, store_created_at, reply_status")
      .in("sentiment", ["critical", "negative"])
      .order("store_created_at", { ascending: false })
      .limit(5);

    const criticalReviews: CriticalReview[] = (
      (criticalRows.data ?? []) as {
        id: string;
        author: string;
        rating: number;
        text: string;
        sentiment: string;
        store_created_at: string;
        reply_status: string;
      }[]
    ).map((r) => ({
      id: r.id,
      author: r.author,
      rating: r.rating,
      text: r.text,
      sentiment: r.sentiment,
      createdAt: r.store_created_at,
      replyStatus: r.reply_status,
    }));

    const result: SentimentOverview = {
      avgRating,
      avgRatingPrev,
      totalReviews,
      positiveShare,
      positiveSharePrev,
      avgReplyMinutes,
      trend: { positive: trendPositive, negative: trendNegative },
      ratingDistribution,
      platformSplit,
      topics,
      criticalReviews,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/sentiment/overview]", err);
    return NextResponse.json(EMPTY);
  }
}
