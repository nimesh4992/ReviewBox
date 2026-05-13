"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

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

function RankDelta({ delta }: { delta: number }) {
  if (delta === 0) return <span className="text-[12px] text-fg-3">—</span>;
  return (
    <span className={cn("text-[12px] font-semibold tabular-nums", delta > 0 ? "text-[#1F8A5B]" : "text-[#DC2626]")}>
      {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
    </span>
  );
}

function MiniSparkline({ values, positive = true }: { values: number[]; positive?: boolean }) {
  const w = 56, h = 20;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const xs = (i: number) => (i / (values.length - 1)) * w;
  const ys = (v: number) => h - ((v - min) / range) * (h - 4) - 2;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={positive ? "#1F8A5B" : "#DC2626"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const KEYWORDS = [
  { keyword: "banking app",      rank: 3,  delta:  2, volume: 98, trend: [7, 6, 5, 4, 3, 3] },
  { keyword: "mobile bank",      rank: 5,  delta:  1, volume: 87, trend: [8, 7, 7, 6, 5, 5] },
  { keyword: "online banking",   rank: 12, delta: -3, volume: 100, trend: [9, 10, 11, 12, 12, 12] },
  { keyword: "money transfer",   rank: 8,  delta:  0, volume: 76, trend: [8, 8, 8, 8, 8, 8] },
  { keyword: "budget tracker",   rank: 21, delta:  4, volume: 63, trend: [26, 24, 23, 22, 21, 21] },
  { keyword: "savings account",  rank: 18, delta: -1, volume: 58, trend: [16, 17, 18, 18, 18, 18] },
  { keyword: "pay bills app",    rank: 34, delta:  6, volume: 45, trend: [42, 40, 38, 36, 34, 34] },
];

function VolumeBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-[60px] overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
        <div className="h-full rounded-full bg-[#0A84FF]" style={{ width: `${value}%` }} />
      </div>
      <span className="tabular-nums text-[12px] text-fg-3">{value}</span>
    </div>
  );
}

export function ASOScreen() {
  const [tab, setTab] = useState<"keywords" | "ratings">("keywords");

  return (
    <div className="flex w-full flex-col gap-6 overflow-auto p-8 max-w-[1240px] mx-auto">

      {/* Header */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[12px] font-medium text-fg-3">Acme Banking · iOS</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.022em] text-fg-1">
            ASO
          </h1>
        </div>
        <div className="flex items-center rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-0.5">
          {(["keywords", "ratings"] as const).map((o) => (
            <button
              key={o}
              onClick={() => setTab(o)}
              className={cn(
                "h-[26px] rounded-md px-3 text-[12px] font-semibold capitalize transition-colors",
                tab === o
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
      <section className="grid grid-cols-3 gap-3">
        <MetricCard label="Tracked keywords"  value="7"    sub="App Store · iOS" />
        <MetricCard label="Avg rank"          value="14.4" delta="▲2.1" positive sub="last 30 days" />
        <MetricCard label="Top-10 keywords"   value="2"    delta="+1"   positive sub="vs last month" />
      </section>

      {/* Keywords table */}
      <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
        <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-4">
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">Keyword positions</div>
            <div className="mt-0.5 text-[12px] text-fg-3">App Store · iOS · updated today</div>
          </div>
          <button className="ml-auto h-7 rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)]">
            Add keyword
          </button>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Keyword", "Rank", "7-day delta", "Volume", "7-day trend"].map((h) => (
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
            {KEYWORDS.map((k, i) => (
              <tr key={k.keyword} className="transition-colors hover:bg-[var(--rb-bg-hover)]">
                <td className={cn("px-5 py-3 text-[13px] font-semibold text-fg-1", i < KEYWORDS.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                  {k.keyword}
                </td>
                <td className={cn("px-5 py-3 tabular-nums text-[13px] font-bold text-fg-1", i < KEYWORDS.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                  #{k.rank}
                </td>
                <td className={cn("px-5 py-3", i < KEYWORDS.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                  <RankDelta delta={k.delta} />
                </td>
                <td className={cn("px-5 py-3", i < KEYWORDS.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                  <VolumeBar value={k.volume} />
                </td>
                <td className={cn("px-5 py-3", i < KEYWORDS.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                  <MiniSparkline
                    values={k.trend}
                    positive={k.trend[k.trend.length - 1] <= k.trend[0]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
