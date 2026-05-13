"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

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

function SentimentChart() {
  const pos = [60, 62, 58, 65, 64, 67, 63, 70, 68, 65, 72, 70, 74, 72];
  const neg = [22, 20, 24, 18, 19, 16, 20, 14, 16, 18, 12, 14, 10, 12];
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
      <div className="absolute left-1/2 top-[-3px] h-[12px] w-px -translate-x-0.5 bg-[var(--rb-border-3)]" />
      <div
        className={cn("absolute top-0 h-1.5 rounded-full", pos ? "bg-[#1F8A5B]" : "bg-[#DC2626]")}
        style={{ left: pos ? half : half - fill, width: fill }}
      />
    </div>
  );
}

// ── Topic data ────────────────────────────────────────────────────────────────

const TOPICS = [
  { topic: "Auth & login",  count: 142, share: 22, trend: "up",   sentiment: -0.4 },
  { topic: "Onboarding",   count: 98,  share: 16, trend: "up",   sentiment:  0.7 },
  { topic: "Performance",  count: 87,  share: 14, trend: "down", sentiment: -0.2 },
  { topic: "Pricing",      count: 56,  share: 9,  trend: "flat", sentiment: -0.6 },
  { topic: "Notifications",count: 41,  share: 7,  trend: "up",   sentiment:  0.3 },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export function SentimentScreen() {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("90d");

  return (
    <div className="flex w-full flex-col gap-6 overflow-auto p-8 max-w-[1240px] mx-auto">

      {/* Header */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[12px] font-medium text-fg-3">Acme Banking · iOS</div>
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
        <MetricCard label="Avg rating"       value="4.62" delta="+0.42" positive sub="last 30 days" />
        <MetricCard label="Reviews"          value="312"  delta="+18%"  positive sub="this week" />
        <MetricCard label="Positive share"   value="64%"  delta="+3 pp" positive sub="of all reviews" />
        <MetricCard label="Median reply time" value="14m"  delta="−6m"   positive sub="p50, last 7d" />
      </section>

      {/* Trend chart */}
      <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
        <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-4">
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">Sentiment trend</div>
            <div className="mt-0.5 text-[12px] text-fg-3">Acme Banking · iOS · last {range}</div>
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
          <SentimentChart />
        </div>
      </div>

      {/* Topics table */}
      <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
        <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-4">
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">Topics · auto-clustered</div>
            <div className="mt-0.5 text-[12px] text-fg-3">624 reviews grouped into 5 clusters</div>
          </div>
          <button className="ml-auto h-7 rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)]">
            Re-cluster
          </button>
        </div>
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
            {TOPICS.map((t, i) => (
              <tr key={t.topic} className="transition-colors hover:bg-[var(--rb-bg-hover)]">
                <td className={cn("px-5 py-3 text-[13px] font-semibold text-fg-1", i < TOPICS.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                  {t.topic}
                </td>
                <td className={cn("px-5 py-3 tabular-nums text-[13px] text-fg-2", i < TOPICS.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                  {t.count}
                </td>
                <td className={cn("px-5 py-3", i < TOPICS.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-[100px] overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
                      <div
                        className="h-full rounded-full bg-[#0A84FF]"
                        style={{ width: t.share * 4 }}
                      />
                    </div>
                    <span className="tabular-nums text-[12px] text-fg-3">{t.share}%</span>
                  </div>
                </td>
                <td className={cn("px-5 py-3", i < TOPICS.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                  <Pill positive={t.trend === "up"}>
                    {t.trend === "up" ? "↑ Rising" : t.trend === "down" ? "↓ Falling" : "→ Steady"}
                  </Pill>
                </td>
                <td className={cn("px-5 py-3", i < TOPICS.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                  <SentimentBar value={t.sentiment} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
