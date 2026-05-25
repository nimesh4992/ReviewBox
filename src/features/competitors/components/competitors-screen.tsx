"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface CompetitorRow {
  name: string;
  rating: number;
  reviewsPerWeek: number;
  replyRate: number;
  trend: number[];
  you: boolean;
  illustrative: boolean;
}

interface CompetitorsResponse {
  yourApp: CompetitorRow;
  competitors: CompetitorRow[];
  hasRealData: boolean;
}

async function fetchCompetitors(): Promise<CompetitorsResponse> {
  const res = await fetch("/api/competitors");
  if (!res.ok) throw new Error("Failed to fetch competitors");
  return res.json() as Promise<CompetitorsResponse>;
}

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

function MiniSparkline({ values, positive = true }: { values: number[]; positive?: boolean }) {
  const w = 64, h = 24;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const xs = (i: number) => (i / (values.length - 1)) * w;
  const ys = (v: number) => h - ((v - min) / range) * h;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={positive ? "#1F8A5B" : "#DC2626"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RatingKpi({ yourApp, competitors }: { yourApp: CompetitorRow; competitors: CompetitorRow[] }) {
  if (!yourApp.rating) return null;

  const all = [yourApp, ...competitors];
  const sorted = [...all].sort((a, b) => b.rating - a.rating);
  const yourRank = sorted.findIndex((c) => c.you) + 1;
  const top = sorted[0];
  const gap = top.you ? null : Math.round((top.rating - yourApp.rating) * 10) / 10;
  const avgReplyRate = Math.round(
    competitors.reduce((s, c) => s + c.replyRate, 0) / (competitors.length || 1),
  );
  const replyDiff = yourApp.replyRate - avgReplyRate;

  return (
    <section className="grid grid-cols-3 gap-3">
      <MetricCard
        label="Your rank"
        value={`#${yourRank}`}
        sub={`of ${all.length} tracked`}
      />
      <MetricCard
        label={gap ? "Gap to #1" : "You're #1"}
        value={gap ? `${gap}★` : "🏆"}
        positive={!gap}
        sub={gap ? `vs ${top.name}` : "Keep it up"}
      />
      <MetricCard
        label="Reply rate vs avg"
        value={`${replyDiff >= 0 ? "+" : ""}${replyDiff}%`}
        positive={replyDiff >= 0}
        sub={`${yourApp.replyRate}% vs ${avgReplyRate}% avg`}
      />
    </section>
  );
}

export function CompetitorsScreen() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  const { data, isLoading } = useQuery<CompetitorsResponse>({
    queryKey: ["competitors"],
    queryFn: fetchCompetitors,
    staleTime: 5 * 60_000,
  });

  const yourApp = data?.yourApp;
  const competitors = data?.competitors ?? [];
  const rows: CompetitorRow[] = yourApp ? [yourApp, ...competitors] : competitors;

  return (
    <div className="flex w-full flex-col gap-6 overflow-auto p-8 max-w-[1240px] mx-auto">

      {/* Header */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[12px] font-medium text-fg-3">
            {yourApp?.name ?? "All apps"}
          </div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.022em] text-fg-1">
            Competitors
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

      {/* KPI strip — only when we have real data */}
      {yourApp && !isLoading && (
        <RatingKpi yourApp={yourApp} competitors={competitors} />
      )}

      {/* Benchmark table */}
      <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
        <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-4">
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">
              Competitive benchmark
            </div>
            <div className="mt-0.5 text-[12px] text-fg-3">
              last {range}
            </div>
          </div>
          <span
            title="Competitor tracking coming soon — you'll be able to add any app by store URL"
            className="ml-auto flex h-7 cursor-default items-center rounded-[7px] border border-dashed border-[var(--rb-border-2)] px-3 text-[12px] font-medium text-fg-3"
          >
            Add competitor · coming soon
          </span>
        </div>

        {/* Illustrative data notice */}
        {competitors.some((c) => c.illustrative) && (
          <div className="border-b border-[var(--rb-border-1)] bg-amber-50 px-5 py-2.5 text-[12px] text-amber-700 dark:bg-amber-950/20 dark:text-amber-300">
            Competitor rows are illustrative placeholders — your real data is in the <strong>You</strong> row.
            Actual competitor tracking lands in a future update.
          </div>
        )}

        {isLoading ? (
          <div className="px-5 py-8 text-center text-[13px] text-fg-3">Loading…</div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["App", "Rating", "Reviews / week", "Reply rate", "6-week trend"].map((h) => (
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
              {rows.map((c, i) => (
                <tr
                  key={c.name}
                  className={cn(
                    "transition-colors hover:bg-[var(--rb-bg-hover)]",
                    c.you && "bg-[#0A84FF]/[0.04]",
                    c.illustrative && "opacity-60",
                  )}
                >
                  <td className={cn("px-5 py-3", i < rows.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white",
                        c.you ? "bg-gradient-to-br from-[#4592FF] to-[#0058B3]" : "bg-[var(--rb-bg-raised)]",
                      )}>
                        <span className={c.you ? "text-white" : "text-fg-2"}>{c.name[0]}</span>
                      </div>
                      <span className={cn("text-[13px] font-semibold", c.you ? "text-fg-1" : "text-fg-2")}>
                        {c.name}
                        {c.you && (
                          <span className="ml-1.5 rounded-full bg-[#0A84FF]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0A84FF]">
                            You
                          </span>
                        )}
                        {c.illustrative && (
                          <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            sample
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className={cn("px-5 py-3 tabular-nums text-[13px] font-semibold text-fg-1", i < rows.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    {c.rating ? `★ ${c.rating.toFixed(1)}` : "—"}
                  </td>
                  <td className={cn("px-5 py-3 tabular-nums text-[13px] text-fg-2", i < rows.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    {c.reviewsPerWeek}
                  </td>
                  <td className={cn("px-5 py-3", i < rows.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    <div className="flex items-center gap-2.5">
                      <div className="h-1.5 w-[80px] overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            c.replyRate >= 60 ? "bg-[#1F8A5B]" : c.replyRate >= 40 ? "bg-amber-400" : "bg-[#DC2626]",
                          )}
                          style={{ width: `${c.replyRate}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-[12px] text-fg-3">{c.replyRate}%</span>
                    </div>
                  </td>
                  <td className={cn("px-5 py-3", i < rows.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    <MiniSparkline
                      values={c.trend}
                      positive={c.trend[c.trend.length - 1] >= c.trend[0]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
