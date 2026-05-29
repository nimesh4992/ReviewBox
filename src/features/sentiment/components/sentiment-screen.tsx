"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2, MessageSquare, Sparkles, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useSentimentAnalysis } from "@/hooks/use-sentiment-analysis";
import { useSentimentOverview } from "@/hooks/use-sentiment-overview";
import { useReviewQueue } from "@/hooks/use-review-queue";
import { useWorkspaceStore } from "@/store/use-workspace-store";
import { useReviewQueue } from "@/hooks/use-review-queue";
import type { AnalysisResult } from "@/app/api/sentiment/analyze/route";
import type { SentimentTopic, CriticalReview, TopicReview } from "@/app/api/sentiment/overview/route";

// ── Shared primitives ─────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  delta,
  deltaPositive,
  sub,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  sub?: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--rb-border-1)] bg-surface p-[18px] shadow-[var(--rb-shadow-xs)]">
      <div className="text-[12px] font-medium text-fg-3">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2.5">
        <span className="text-[28px] font-semibold leading-tight tracking-[-0.025em] tabular-nums text-fg-1">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "text-[12px] font-medium tabular-nums",
              deltaPositive ? "text-[#1F8A5B]" : "text-[#DC2626]",
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-fg-3">{sub}</div>}
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="rounded-[12px] border border-[var(--rb-border-1)] bg-surface p-[18px] shadow-[var(--rb-shadow-xs)] animate-pulse">
      <div className="h-3 w-20 rounded bg-[var(--rb-bg-sunken)] mb-3" />
      <div className="h-7 w-16 rounded bg-[var(--rb-bg-sunken)]" />
    </div>
  );
}

// ── Sentiment trend chart ─────────────────────────────────────────────────────

function SentimentChart({ pos, neg }: { pos: number[]; neg: number[] }) {
  const w = 800, h = 200, padL = 36, padR = 12, padT = 10, padB = 28;
  const xs = (i: number, n: number) => padL + (i / (n - 1)) * (w - padL - padR);
  const ys = (v: number) => padT + (1 - v / 100) * (h - padT - padB);
  const path = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i, arr.length)},${ys(v)}`).join(" ");
  const area = (arr: number[]) =>
    path(arr) + ` L${xs(arr.length - 1, arr.length)},${ys(0)} L${xs(0, arr.length)},${ys(0)} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      style={{ width: "100%", height: 200, display: "block" }}
    >
      <defs>
        <linearGradient id="pos-g" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#1F8A5B" stopOpacity="0.18" />
          <stop offset="1" stopColor="#1F8A5B" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={padL} x2={w - padR} y1={ys(g)} y2={ys(g)} stroke="var(--rb-border-1)" />
          <text
            x={padL - 8} y={ys(g) + 3}
            fontSize="10" fill="var(--rb-fg-3)"
            textAnchor="end"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {g}%
          </text>
        </g>
      ))}
      <path d={area(pos)} fill="url(#pos-g)" />
      <path d={path(pos)} fill="none" stroke="#1F8A5B" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <path d={path(neg)} fill="none" stroke="#DC2626" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3" />
    </svg>
  );
}

// ── Rating distribution ───────────────────────────────────────────────────────

function RatingDistribution({
  dist,
}: {
  dist: [number, number, number, number, number];
}) {
  const stars = [5, 4, 3, 2, 1] as const;
  const STAR_COLOR: Record<number, string> = {
    5: "#1F8A5B",
    4: "#4CAF50",
    3: "#F59E0B",
    2: "#F97316",
    1: "#DC2626",
  };

  return (
    <div className="space-y-2">
      {stars.map((s) => {
        const pct = dist[s - 1];
        return (
          <div key={s} className="flex items-center gap-2.5">
            <div className="flex w-[28px] shrink-0 items-center justify-end gap-0.5">
              <span className="text-[12px] tabular-nums text-fg-2">{s}</span>
              <Star className="size-3 text-fg-3" fill="currentColor" />
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: STAR_COLOR[s] }}
              />
            </div>
            <span className="w-[32px] text-right text-[12px] tabular-nums text-fg-3">
              {pct}%
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Platform split ────────────────────────────────────────────────────────────

function PlatformSplit({
  googlePlay,
  appStore,
}: {
  googlePlay: number;
  appStore: number;
}) {
  const total = googlePlay + appStore || 1;
  const gpPct = Math.round((googlePlay / total) * 100);
  const asPct = 100 - gpPct;

  return (
    <div className="space-y-3">
      {[
        { label: "Google Play", count: googlePlay, pct: gpPct, color: "#1DB954" },
        { label: "App Store",   count: appStore,   pct: asPct, color: "#0A84FF" },
      ].map((p) => (
        <div key={p.label}>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[12px] font-medium text-fg-2">{p.label}</span>
            <span className="text-[12px] tabular-nums text-fg-3">
              {p.count.toLocaleString()} · {p.pct}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${p.pct}%`, backgroundColor: p.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Topic drill-down rows ─────────────────────────────────────────────────────

function TopicDrillDown({ reviews }: { reviews: TopicReview[] }) {
  const router = useRouter();
  if (reviews.length === 0) {
    return (
      <div className="px-5 py-3 text-[12px] text-fg-3 italic">
        No review samples available.
      </div>
    );
  }
  return (
    <div className="divide-y divide-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)]">
      {reviews.map((r) => {
        const badge = SENTIMENT_BADGE[r.sentiment] ?? SENTIMENT_BADGE.mixed;
        return (
          <div
            key={r.id}
            className="group flex items-start gap-4 px-6 py-3 transition-colors hover:bg-[var(--rb-bg-hover)]"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="text-[12px] font-semibold text-fg-1">{r.author}</span>
                <StarRating rating={r.rating} />
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.cls)}>
                  {badge.label}
                </span>
                <span className="text-[11px] text-fg-3">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="line-clamp-2 text-[12px] leading-relaxed text-fg-2">{r.text}</p>
            </div>
            {r.replyStatus === "needs_reply" && (
              <button
                onClick={() => router.push("/reviews")}
                className="ml-2 mt-0.5 flex shrink-0 items-center gap-1.5 rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-fg-1 opacity-0 transition-all hover:bg-[var(--rb-bg-hover)] group-hover:opacity-100"
              >
                <MessageSquare className="size-3" strokeWidth={1.5} />
                Reply
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Sentiment net bar ─────────────────────────────────────────────────────────

function SentimentBar({ value }: { value: number }) {
  const w = 140, half = w / 2;
  const pos = value >= 0;
  const fill = Math.abs(value) * half;
  return (
    <div style={{ width: w }} className="relative h-1.5 rounded-full bg-[var(--rb-bg-sunken)]">
      <div className="absolute left-1/2 top-[-3px] h-[12px] w-px -translate-x-0.5 bg-[var(--rb-border-1)]" />
      <div
        className={cn("absolute top-0 h-1.5 rounded-full", pos ? "bg-[#1F8A5B]" : "bg-[#DC2626]")}
        style={{ left: pos ? half : half - fill, width: fill }}
      />
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtReply(mins: number | null | undefined): string {
  if (mins == null) return "—";
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

function fmtDelta(curr: number | null, prev: number | null, unit = ""): { label: string; positive: boolean } | undefined {
  if (curr == null || prev == null || prev === 0) return undefined;
  const diff = curr - prev;
  if (Math.abs(diff) < 0.01) return undefined;
  const sign = diff > 0 ? "+" : "";
  return { label: `${sign}${diff.toFixed(unit === "%" ? 0 : 2)}${unit}`, positive: diff > 0 };
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

// ── Negative topics — trend context-aware coloring ───────────────────────────
// For inherently negative tags, "rising" is bad (red); "falling" is good (green)
// For positive tags like feature-request, "rising" is neutral/positive

const NEGATIVE_TAGS = new Set([
  "crash", "billing", "login", "performance", "release-regression", "support-delay",
]);

function TrendPill({ trend, tag }: { trend: "up" | "down" | "flat"; tag: string }) {
  const isNegative = NEGATIVE_TAGS.has(tag);

  const config = {
    up: {
      label: "↑ Rising",
      positive: !isNegative,  // rising crashes = bad; rising feature-requests = neutral
    },
    down: {
      label: "↓ Falling",
      positive: isNegative,   // falling crashes = good
    },
    flat: {
      label: "→ Steady",
      positive: null,
    },
  }[trend];

  const cls =
    config.positive === null
      ? "bg-[var(--rb-bg-sunken)] text-fg-3"
      : config.positive
        ? "bg-[rgba(31,138,91,0.10)] text-[#1F8A5B]"
        : "bg-[rgba(220,38,38,0.10)] text-[#DC2626]";

  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", cls)}>
      {config.label}
    </span>
  );
}

// ── Sentiment badge ───────────────────────────────────────────────────────────

const SENTIMENT_BADGE: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical", cls: "bg-[rgba(220,38,38,0.10)] text-[#DC2626]" },
  negative: { label: "Negative", cls: "bg-[rgba(220,38,38,0.08)] text-[#DC2626]" },
  mixed:    { label: "Mixed",    cls: "bg-[rgba(234,179,8,0.10)] text-[#CA8A04]" },
  positive: { label: "Positive", cls: "bg-[rgba(31,138,91,0.10)] text-[#1F8A5B]" },
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn("size-3", s <= rating ? "text-[#F59E0B]" : "text-[var(--rb-border-1)]")}
          fill="currentColor"
        />
      ))}
    </div>
  );
}

// ── Critical reviews quick-list ───────────────────────────────────────────────

function CriticalReviewsList({
  reviews,
  isLoading,
}: {
  reviews: CriticalReview[];
  isLoading: boolean;
}) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="divide-y divide-[var(--rb-border-1)]">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2 px-5 py-4 animate-pulse">
            <div className="flex items-center gap-2">
              <div className="h-3 w-24 rounded bg-[var(--rb-bg-sunken)]" />
              <div className="h-3 w-16 rounded bg-[var(--rb-bg-sunken)]" />
            </div>
            <div className="h-3 w-full rounded bg-[var(--rb-bg-sunken)]" />
            <div className="h-3 w-3/4 rounded bg-[var(--rb-bg-sunken)]" />
          </div>
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="py-10 text-center text-[13px] text-fg-3">
        No critical or negative reviews in this period.
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--rb-border-1)]">
      {reviews.map((r) => {
        const badge = SENTIMENT_BADGE[r.sentiment] ?? SENTIMENT_BADGE.mixed;
        const needsReply = r.replyStatus === "needs_reply";
        return (
          <div key={r.id} className="group flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--rb-bg-hover)]">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="text-[13px] font-semibold text-fg-1">{r.author}</span>
                <StarRating rating={r.rating} />
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.cls)}>
                  {badge.label}
                </span>
                <span className="text-[11px] text-fg-3">{timeAgo(r.createdAt)}</span>
              </div>
              <p className="line-clamp-2 text-[12px] leading-relaxed text-fg-2">{r.text}</p>
            </div>
            {needsReply && (
              <button
                onClick={() => router.push("/reviews")}
                className="ml-2 mt-0.5 flex shrink-0 items-center gap-1.5 rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-fg-1 opacity-0 transition-all hover:bg-[var(--rb-bg-hover)] group-hover:opacity-100"
              >
                <MessageSquare className="size-3" strokeWidth={1.5} />
                Reply
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── AI re-cluster results panel ───────────────────────────────────────────────

function AiResultsPanel({ results }: { results: AnalysisResult[] }) {
  return (
    <div className="overflow-hidden rounded-[14px] border border-[#0A84FF]/20 bg-surface shadow-[var(--rb-shadow-xs)]">
      <div className="flex items-center gap-2 border-b border-[var(--rb-border-1)] px-5 py-4">
        <Sparkles className="size-4 text-[#0A84FF]" strokeWidth={1.5} />
        <div>
          <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">
            AI Re-cluster results
          </div>
          <div className="mt-0.5 text-[12px] text-fg-3">
            {results.length} reviews re-classified · rules engine + Gemini
          </div>
        </div>
      </div>
      <div className="divide-y divide-[var(--rb-border-1)]">
        {results.map((r) => {
          const badge = SENTIMENT_BADGE[r.sentiment] ?? SENTIMENT_BADGE.mixed;
          return (
            <div key={r.id} className="flex items-start gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", badge.cls)}>
                    {badge.label}
                  </span>
                  <span className="text-[11px] capitalize text-fg-3">{r.priority} priority</span>
                  <span className="text-[10px] text-fg-3 opacity-50">{r.source}</span>
                </div>
                {r.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {r.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-2 py-0.5 text-[10px] font-medium text-fg-3"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function SentimentScreen() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [aiResults, setAiResults] = useState<AnalysisResult[] | null>(null);
  const [expandedTopic, setExpandedTopic] = useState<string | null>(null);
  const { mutate: analyze, isPending } = useSentimentAnalysis();

  const selectedApp = useWorkspaceStore((s) => s.selectedApp);
  const appId =
    selectedApp && typeof selectedApp === "object" && "id" in selectedApp
      ? (selectedApp as { id: string }).id
      : undefined;
  const appName =
    selectedApp && typeof selectedApp === "object" && "name" in selectedApp
      ? (selectedApp as { name: string }).name
      : typeof selectedApp === "string"
        ? selectedApp
        : "All apps";

  const { data: overview, isLoading } = useSentimentOverview(appId, range);
  // Pull recent real reviews for the "Re-cluster with AI" button.
  // Without real workspace data, we don't surface the button at all.
  const { reviews: workspaceReviews } = useReviewQueue();

  // Fetch real reviews for Re-cluster button (critical + negative, first page)
  const { reviews: reclusterReviews } = useReviewQueue({ sentiment: "critical" });

  const topics: SentimentTopic[] = overview?.topics ?? [];
  const trendPos = overview?.trend.positive ?? [];
  const trendNeg = overview?.trend.negative ?? [];
  const hasChartData = trendPos.length >= 2;
  const canRecluster = workspaceReviews.length > 0;

  // KPI deltas
  const ratingDelta = fmtDelta(overview?.avgRating ?? null, overview?.avgRatingPrev ?? null);
  const posShareDelta = fmtDelta(
    overview?.positiveShare ?? null,
    overview?.positiveSharePrev ?? null,
    "%",
  );

  // Topics share bar: scale relative to the highest-count topic
  const maxShare = topics.length > 0 ? Math.max(...topics.map((t) => t.share)) : 1;

  function handleRecluster() {
    if (!reclusterReviews.length) return;
    analyze(reclusterReviews, { onSuccess: setAiResults });
  }

  return (
    <div className="flex w-full flex-col gap-6 overflow-auto p-8 max-w-[1240px] mx-auto">

      {/* Header */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[12px] font-medium text-fg-3">{appName}</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.022em] text-fg-1">
            Sentiment
          </h1>
        </div>
        <div className="flex items-center rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-0.5">
          {(["7d", "30d", "90d"] as const).map((o) => (
            <button
              key={o}
              onClick={() => setRange(o)}
              className={cn(
                "h-[26px] rounded-md px-3 text-[12px] font-semibold transition-colors",
                range === o
                  ? "bg-surface text-fg-1 shadow-[var(--rb-shadow-xs)]"
                  : "text-fg-3 hover:text-fg-2",
              )}
            >
              {o}
            </button>
          ))}
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
        ) : (
          <>
            <MetricCard
              label="Avg rating"
              value={overview?.avgRating != null ? overview.avgRating.toFixed(2) : "—"}
              delta={ratingDelta?.label}
              deltaPositive={ratingDelta?.positive}
              sub={`last ${range}`}
            />
            <MetricCard
              label="Reviews"
              value={(overview?.totalReviews ?? 0).toLocaleString()}
              sub={`last ${range}`}
            />
            <MetricCard
              label="Positive share"
              value={`${overview?.positiveShare ?? 0}%`}
              delta={posShareDelta?.label}
              deltaPositive={posShareDelta?.positive}
              sub="of all reviews"
            />
            <MetricCard
              label="Avg reply time"
              value={fmtReply(overview?.avgReplyMinutes)}
              sub="replied reviews"
            />
          </>
        )}
      </section>

      {/* Trend chart + right-column widgets */}
      <div className="grid grid-cols-[1fr_280px] gap-4">

        {/* Trend chart */}
        <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
          <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-4">
            <div>
              <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">Sentiment trend</div>
              <div className="mt-0.5 text-[12px] text-fg-3">{appName} · last {range}</div>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-[12px] text-fg-2">
                <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#1F8A5B" strokeWidth="2" strokeLinecap="round" /></svg>
                Positive
              </span>
              <span className="flex items-center gap-1.5 text-[12px] text-fg-2">
                <svg width="20" height="6"><line x1="0" y1="3" x2="20" y2="3" stroke="#DC2626" strokeWidth="2" strokeDasharray="3 3" strokeLinecap="round" /></svg>
                Negative
              </span>
            </div>
          </div>
          <div className="p-5">
            {isLoading ? (
              <div className="h-[200px] animate-pulse rounded-lg bg-[var(--rb-bg-sunken)]" />
            ) : hasChartData ? (
              <SentimentChart pos={trendPos} neg={trendNeg} />
            ) : (
              <div className="flex h-[200px] items-center justify-center text-[13px] text-fg-3">
                No review data yet for this period. Reviews appear here once synced.
              </div>
            )}
          </div>
        </div>

        {/* Right column: rating distribution + platform split */}
        <div className="flex flex-col gap-4">

          {/* Rating distribution */}
          <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
            <div className="border-b border-[var(--rb-border-1)] px-5 py-3.5">
              <div className="text-[13px] font-semibold tracking-[-0.01em] text-fg-1">Rating distribution</div>
              <div className="mt-0.5 text-[11px] text-fg-3">last {range}</div>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-3 w-8 rounded bg-[var(--rb-bg-sunken)] animate-pulse" />
                      <div className="h-2 flex-1 rounded-full bg-[var(--rb-bg-sunken)] animate-pulse" />
                      <div className="h-3 w-8 rounded bg-[var(--rb-bg-sunken)] animate-pulse" />
                    </div>
                  ))}
                </div>
              ) : (
                <RatingDistribution dist={overview?.ratingDistribution ?? [0, 0, 0, 0, 0]} />
              )}
            </div>
          </div>

          {/* Platform split */}
          <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
            <div className="border-b border-[var(--rb-border-1)] px-5 py-3.5">
              <div className="text-[13px] font-semibold tracking-[-0.01em] text-fg-1">By platform</div>
              <div className="mt-0.5 text-[11px] text-fg-3">last {range}</div>
            </div>
            <div className="p-4">
              {isLoading ? (
                <div className="space-y-3">
                  {[0, 1].map((i) => (
                    <div key={i} className="space-y-1.5">
                      <div className="flex justify-between">
                        <div className="h-3 w-20 animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
                        <div className="h-3 w-12 animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
                      </div>
                      <div className="h-2 w-full animate-pulse rounded-full bg-[var(--rb-bg-sunken)]" />
                    </div>
                  ))}
                </div>
              ) : (
                <PlatformSplit
                  googlePlay={overview?.platformSplit.googlePlay ?? 0}
                  appStore={overview?.platformSplit.appStore ?? 0}
                />
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Topics table */}
      <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
        <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-4">
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">Topics · auto-clustered</div>
            <div className="mt-0.5 text-[12px] text-fg-3">
              {isLoading
                ? "Loading…"
                : topics.length > 0
                  ? `${overview?.totalReviews ?? 0} reviews · ${topics.length} topic${topics.length === 1 ? "" : "s"}`
                  : "No tagged reviews yet"}
            </div>
          </div>
          <button
            onClick={handleRecluster}
            disabled={isPending || reclusterReviews.length === 0}
            className="ml-auto flex h-7 items-center gap-1.5 rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-40"
            onClick={() =>
              analyze(workspaceReviews.slice(0, 100), { onSuccess: setAiResults })
            }
            disabled={isPending || !canRecluster}
            title={canRecluster ? "Run AI sentiment clustering on recent reviews" : "Sync reviews first"}
            className="ml-auto flex h-7 items-center gap-1.5 rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-50"
          >
            {isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3 text-[#0A84FF]" />
            )}
            {isPending ? "Analysing…" : "Re-cluster with AI"}
          </button>
        </div>

        {!isLoading && topics.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-fg-3">
            Tags appear here once reviews are synced and enriched.
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Topic", "Reviews", "Share", "Trend", "Net sentiment"].map((h) => (
                  <th
                    key={h}
                    className="border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(isLoading
                ? Array.from({ length: 5 }, (_, i) => ({
                    tag: `__loading_${i}`,
                    topic: `__loading_${i}`,
                    count: 0,
                    share: 0,
                    trend: "flat" as const,
                    sentiment: 0,
                    topReviews: [],
                  }))
                : topics
              ).map((t, i, arr) => {
                const isExpanded = expandedTopic === t.tag;
                const isLast = i === arr.length - 1;
                return (
                  <>
                    <tr
                      key={t.tag}
                      onClick={() => !isLoading && setExpandedTopic(isExpanded ? null : t.tag)}
                      className={cn(
                        "transition-colors",
                        !isLoading && "cursor-pointer hover:bg-[var(--rb-bg-hover)]",
                        isExpanded && "bg-[var(--rb-bg-sunken)]",
                      )}
                    >
                      <td className={cn("px-5 py-3 text-[13px] font-semibold text-fg-1", (!isLast || isExpanded) && "border-b border-[var(--rb-border-1)]")}>
                        {isLoading ? (
                          <span className="inline-block h-3 w-28 animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
                        ) : (
                          <div className="flex items-center gap-2">
                            {isExpanded
                              ? <ChevronDown className="size-3.5 text-fg-3" strokeWidth={1.5} />
                              : <ChevronRight className="size-3.5 text-fg-3" strokeWidth={1.5} />
                            }
                            {t.topic}
                          </div>
                        )}
                      </td>
                      <td className={cn("px-5 py-3 tabular-nums text-[13px] text-fg-2", (!isLast || isExpanded) && "border-b border-[var(--rb-border-1)]")}>
                        {isLoading ? <span className="inline-block h-3 w-10 animate-pulse rounded bg-[var(--rb-bg-sunken)]" /> : t.count}
                      </td>
                      <td className={cn("px-5 py-3", (!isLast || isExpanded) && "border-b border-[var(--rb-border-1)]")}>
                        {isLoading ? (
                          <span className="inline-block h-3 w-24 animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="h-1.5 w-[100px] overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
                              <div
                                className="h-full rounded-full bg-[#0A84FF] transition-all duration-500"
                                style={{ width: `${maxShare > 0 ? (t.share / maxShare) * 100 : 0}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-[12px] text-fg-3">{t.share}%</span>
                          </div>
                        )}
                      </td>
                      <td className={cn("px-5 py-3", (!isLast || isExpanded) && "border-b border-[var(--rb-border-1)]")}>
                        {isLoading ? (
                          <span className="inline-block h-5 w-16 animate-pulse rounded-full bg-[var(--rb-bg-sunken)]" />
                        ) : (
                          <TrendPill trend={t.trend} tag={t.tag} />
                        )}
                      </td>
                      <td className={cn("px-5 py-3", (!isLast || isExpanded) && "border-b border-[var(--rb-border-1)]")}>
                        {isLoading ? (
                          <span className="inline-block h-3 w-28 animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
                        ) : (
                          <SentimentBar value={t.sentiment} />
                        )}
                      </td>
                    </tr>
                    {isExpanded && !isLoading && (
                      <tr key={`${t.tag}-drill`}>
                        <td colSpan={5} className={cn(!isLast && "border-b border-[var(--rb-border-1)]")}>
                          <TopicDrillDown reviews={t.topReviews} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Critical reviews quick-list */}
      <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
        <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-4">
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">
              Recent critical & negative reviews
            </div>
            <div className="mt-0.5 text-[12px] text-fg-3">Last 5 · hover to reply</div>
          </div>
        </div>
        <CriticalReviewsList
          reviews={overview?.criticalReviews ?? []}
          isLoading={isLoading}
        />
      </div>

      {/* AI re-cluster results */}
      {aiResults && aiResults.length > 0 && (
        <AiResultsPanel results={aiResults} />
      )}
    </div>
  );
}
