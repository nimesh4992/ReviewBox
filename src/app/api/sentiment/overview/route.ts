import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

export interface SentimentTopic {
  topic: string;
  count: number;
  share: number;    // 0–100, 1dp
  trend: "up" | "down" | "flat";
  sentiment: number; // -1 to +1, net sentiment score
}

export interface SentimentOverview {
  avgRating: number | null;
  totalReviews: number;
  positiveShare: number;    // 0–100 integer
  avgReplyMinutes: number | null;
  trend: { positive: number[]; negative: number[] }; // 14 data points, % each day
  topics: SentimentTopic[];
}

const EMPTY: SentimentOverview = {
  avgRating: null,
  totalReviews: 0,
  positiveShare: 0,
  avgReplyMinutes: null,
  trend: { positive: [], negative: [] },
  topics: [],
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

// Negative tags score -0.7, positive/neutral score +0.3
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
    if (!userId) return NextResponse.json(EMPTY, { status: 401 });

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

    // base filter helper — select("*") first so .eq() is available on FilterBuilder
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = (): any => {
      const q = sb.from("reviews").select("*").eq("workspace_id", workspaceId);
      return appId ? q.eq("app_id", appId) : q;
    };

    // ── 1. KPI metrics ───────────────────────────────────────────────────────
    const [ratingRows, positiveCount, repliedRows] = await Promise.all([
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
    ]);

    const ratings = ((ratingRows.data ?? []) as { rating: number }[]).map(
      (r) => r.rating,
    );
    const totalReviews = ratings.length;
    const avgRating =
      totalReviews > 0
        ? parseFloat(
            (ratings.reduce((s, r) => s + r, 0) / totalReviews).toFixed(2),
          )
        : null;
    const positiveShare =
      totalReviews > 0
        ? Math.round(((positiveCount.count ?? 0) / totalReviews) * 100)
        : 0;

    const replied = (
      repliedRows.data ?? []
    ) as { store_created_at: string; replied_at: string }[];
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

    // ── 2. 14-day trend ──────────────────────────────────────────────────────
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
      if (r.sentiment === "critical" || r.sentiment === "negative")
        dayBuckets[key].neg++;
    }

    const trendPositive: number[] = [];
    const trendNegative: number[] = [];
    for (const b of Object.values(dayBuckets)) {
      trendPositive.push(b.total > 0 ? Math.round((b.pos / b.total) * 100) : 0);
      trendNegative.push(b.total > 0 ? Math.round((b.neg / b.total) * 100) : 0);
    }

    // ── 3. Topics ────────────────────────────────────────────────────────────
    const topicRows = await base()
      .select("issue_tags, sentiment")
      .gte("store_created_at", windowStart.toISOString())
      .not("issue_tags", "is", null);

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

    const tagCount: Record<string, number> = {};
    for (const row of (topicRows.data ?? []) as { issue_tags: string[] }[]) {
      for (const tag of row.issue_tags ?? []) {
        tagCount[tag] = (tagCount[tag] ?? 0) + 1;
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
          topic: TAG_LABEL[tag] ?? tag,
          count,
          share:
            totalReviews > 0
              ? Math.round((count / totalReviews) * 1000) / 10
              : 0,
          trend,
          sentiment: TAG_SENTIMENT[tag] ?? 0,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const result: SentimentOverview = {
      avgRating,
      totalReviews,
      positiveShare,
      avgReplyMinutes,
      trend: { positive: trendPositive, negative: trendNegative },
      topics,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[GET /api/sentiment/overview]", err);
    return NextResponse.json(EMPTY);
  }
}
