"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSentimentAnalysis } from "@/hooks/use-sentiment-analysis";
import { useSentimentOverview } from "@/hooks/use-sentiment-overview";
import { useWorkspaceStore } from "@/store/use-workspace-store";
import { mockReviews } from "@/features/reviews/data/mock-reviews";
import type { AnalysisResult } from "@/app/api/sentiment/analyze/route";
import type { SentimentTopic } from "@/app/api/sentiment/overview/route";

// ── Shared primitives ─────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  delta,
  positive = true,
  sub,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
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
              positive ? "text-[#1F8A5B]" : "text-[#DC2626]",
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

function Pill({ positive, children }: { positive: boolean; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
        positive
          ? "bg-[rgba(31,138,91,0.10)] text-[#1F8A5B]"
          : "bg-[rgba(220,38,38,0.10)] text-[#DC2626]",
      )}
    >
      {children}
    </span>
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
          <line
            x1={padL} x2={w - padR}
            y1={ys(g)} y2={ys(g)}
            stroke="var(--rb-border-1)"
          />
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

// ── Sentiment badge ───────────────────────────────────────────────────────────

const SENTIMENT_BADGE: Record<string, { label: string; cls: string }> = {
  critical: { label: "Critical",  cls: "bg-[rgba(220,38,38,0.10)] text-[#DC2626]" },
  negative: { label: "Negative",  cls: "bg-[rgba(220,38,38,0.08)] text-[#DC2626]" },
  mixed:    { label: "Mixed",     cls: "bg-[rgba(234,179,8,0.10)] text-[#CA8A04]" },
  positive: { label: "Positive",  cls: "bg-[rgba(31,138,91,0.10)] text-[#1F8A5B]" },
};

// ── Screen ────────────────────────────────────────────────────────────────────

export function SentimentScreen() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [aiResults, setAiResults] = useState<AnalysisResult[] | null>(null);
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

  const topics: SentimentTopic[] = overview?.topics ?? [];
  const trendPos = overview?.trend.positive ?? [];
  const trendNeg = overview?.trend.negative ?? [];
  const hasChartData = trendPos.length >= 2;

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
            onClick={() => analyze(mockReviews, { onSuccess: setAiResults })}
            disabled={isPending}
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
                    topic: `__loading_${i}`,
                    count: 0,
                    share: 0,
                    trend: "flat" as const,
                    sentiment: 0,
                  }))
                : topics
              ).map((t, i, arr) => (
                <tr key={t.topic} className="transition-colors hover:bg-[var(--rb-bg-hover)]">
                  <td className={cn("px-5 py-3 text-[13px] font-semibold text-fg-1", i < arr.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    {isLoading ? <span className="inline-block h-3 w-28 animate-pulse rounded bg-[var(--rb-bg-sunken)]" /> : t.topic}
                  </td>
                  <td className={cn("px-5 py-3 tabular-nums text-[13px] text-fg-2", i < arr.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    {isLoading ? <span className="inline-block h-3 w-10 animate-pulse rounded bg-[var(--rb-bg-sunken)]" /> : t.count}
                  </td>
                  <td className={cn("px-5 py-3", i < arr.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    {isLoading ? (
                      <span className="inline-block h-3 w-24 animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
                    ) : (
                      <div className="flex items-center gap-2.5">
                        <div className="h-1.5 w-[100px] overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
                          <div className="h-full rounded-full bg-[#0A84FF]" style={{ width: Math.min(t.share * 4, 100) }} />
                        </div>
                        <span className="tabular-nums text-[12px] text-fg-3">{t.share}%</span>
                      </div>
                    )}
                  </td>
                  <td className={cn("px-5 py-3", i < arr.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    {isLoading ? (
                      <span className="inline-block h-5 w-16 animate-pulse rounded-full bg-[var(--rb-bg-sunken)]" />
                    ) : (
                      <Pill positive={t.trend === "up"}>
                        {t.trend === "up" ? "↑ Rising" : t.trend === "down" ? "↓ Falling" : "→ Steady"}
                      </Pill>
                    )}
                  </td>
                  <td className={cn("px-5 py-3", i < arr.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    {isLoading ? (
                      <span className="inline-block h-3 w-28 animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
                    ) : (
                      <SentimentBar value={t.sentiment} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* AI Analysis results (shown after Re-cluster with AI) */}
      {aiResults && aiResults.length > 0 && (
        <div className="overflow-hidden rounded-[14px] border border-[#0A84FF]/20 bg-surface shadow-[var(--rb-shadow-xs)]">
          <div className="flex items-center gap-2 border-b border-[var(--rb-border-1)] px-5 py-4">
            <Sparkles className="size-4 text-[#0A84FF]" strokeWidth={1.5} />
            <div>
              <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">
                AI Sentiment Analysis
              </div>
              <div className="mt-0.5 text-[12px] text-fg-3">
                {aiResults.length} reviews · rules engine + Gemini
              </div>
            </div>
          </div>
          <div className="divide-y divide-[var(--rb-border-1)]">
            {aiResults.map((r) => {
              const badge = SENTIMENT_BADGE[r.sentiment] ?? SENTIMENT_BADGE.mixed;
              return (
                <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="font-mono text-[11px] text-fg-3">{r.id}</span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", badge.cls)}>
                    {badge.label}
                  </span>
                  <span className="text-[12px] capitalize text-fg-2">{r.priority}</span>
                  <div className="ml-auto flex flex-wrap gap-1">
                    {r.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-2 py-0.5 text-[10px] font-medium text-fg-3"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <span className="ml-2 text-[10px] text-fg-3 opacity-50">{r.source}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
