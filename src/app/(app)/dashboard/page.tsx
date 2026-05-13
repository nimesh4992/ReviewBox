"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertOctagon, Download, Sparkles, TrendingUp, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";

// ── Static attention items (real data from incident feed — wire later) ─────────

const ATTENTION_ITEMS = [
  {
    icon: AlertOctagon,
    color: "#DC2626",
    title: "Rating spike detected",
    subtitle: "14 reviews in 2h · 11 mention crash on latest version",
    time: "2h ago",
  },
  {
    icon: Sparkles,
    color: "#8E5BFF",
    title: "New AI topic cluster",
    subtitle: "8 reviews about \"login slow\" — none last week",
    time: "4h ago",
  },
  {
    icon: TrendingUp,
    color: "#1F8A5B",
    title: "Onboarding praise rising",
    subtitle: "+0.18 ★ on first-run reviews · 18 positive in 24h",
    time: "Yesterday",
  },
  {
    icon: Users,
    color: "#86868B",
    title: "Competitor rating dropped",
    subtitle: "Rival app −0.05 vs prior week · opportunity",
    time: "Yesterday",
  },
];

// ── Sparkline chart ────────────────────────────────────────────────────────────

function PortfolioSparkline() {
  const data = [4.18, 4.20, 4.25, 4.32, 4.38, 4.40, 4.44, 4.46, 4.47, 4.48];
  const w = 560, h = 130, padL = 28, padR = 8, padT = 10, padB = 20;
  const lo = 4.1, hi = 4.6;
  const xs = (i: number) => padL + (i / (data.length - 1)) * (w - padL - padR);
  const ys = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (h - padT - padB);
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: 130, display: "block" }}>
      {[4.2, 4.3, 4.4, 4.5].map((g) => (
        <g key={g}>
          <line x1={padL} x2={w - padR} y1={ys(g)} y2={ys(g)} stroke="rgba(0,0,0,0.06)" />
          <text x={padL - 6} y={ys(g) + 3} fontSize="9" fill="#86868B" textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>{g.toFixed(1)}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: metrics, isLoading } = useDashboardMetrics();
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const avgRating = metrics?.avgRating ?? null;
  const unreplied = isLoading ? 0 : (metrics?.unrepliedCount ?? 0);
  const urgent    = isLoading ? 0 : (metrics?.urgentCount ?? 0);
  const reviewsToday = isLoading ? 0 : (metrics?.reviewsToday ?? 0);
  const aiDrafts  = isLoading ? 0 : (metrics?.aiDraftsThisWeek ?? 0);

  const kpis = [
    { label: "Reviews today",       value: String(reviewsToday), delta: "+18%",            kind: "positive" as const, sub: "this week" },
    { label: "AI drafts this week",  value: String(aiDrafts),    delta: "generated",       kind: "neutral"  as const, sub: "draft replies" },
    { label: "Unreplied",           value: String(unreplied),    delta: `${urgent} urgent`, kind: urgent > 5 ? "warning" as const : "positive" as const, sub: "across apps" },
    { label: "Avg. rating",         value: avgRating !== null ? avgRating.toFixed(2) : "—", delta: "+0.31", kind: "positive" as const, sub: `last ${range}` },
  ];

  return (
    <div className="flex w-full flex-col gap-6 overflow-auto p-8" style={{ maxWidth: 1240, margin: "0 auto" }}>

      {/* Page header */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-xs font-medium text-[#86868B]">{dateStr}</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.022em] text-[#1D1D1F]">
            {greeting}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Segmented time range */}
          <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5">
            {(["7d", "30d", "90d"] as const).map((o) => (
              <button
                key={o}
                onClick={() => setRange(o)}
                className={cn(
                  "h-[26px] rounded-md px-3 text-[12px] font-semibold transition-colors",
                  range === o
                    ? "bg-white text-[#1D1D1F] shadow-sm"
                    : "text-[#86868B] hover:text-[#48484D]",
                )}
              >
                {o}
              </button>
            ))}
          </div>
          <button className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 text-[13px] font-medium text-[#48484D] transition-colors hover:bg-gray-50">
            <Download className="size-3.5" strokeWidth={2} />
            Export
          </button>
        </div>
      </header>

      {/* Hero — portfolio rating */}
      <section className="grid items-center gap-10 rounded-2xl border border-gray-100 bg-white px-8 py-7 shadow-sm" style={{ gridTemplateColumns: "minmax(0,280px) 1fr" }}>
        <div>
          <div className="text-xs font-medium text-[#86868B]">Portfolio rating · {range}</div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-[64px] font-semibold leading-none tracking-[-0.04em] tabular-nums text-[#1D1D1F]">
              {avgRating !== null ? avgRating.toFixed(2) : "—"}
            </span>
            {avgRating !== null && (
              <div className="mb-1 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className={cn("size-4", i < Math.round(avgRating) ? "text-amber-400" : "text-gray-200")}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3.5 flex items-center gap-2">
            <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-green-700">
              +0.31
            </span>
            <span className="text-xs text-[#86868B]">vs previous {range}</span>
          </div>
          <p className="mt-4 max-w-[260px] text-[13px] leading-relaxed text-[#86868B]">
            {unreplied > 0
              ? `${unreplied} reviews awaiting reply.${urgent > 0 ? ` ${urgent} marked urgent.` : ""}`
              : "All reviews replied to. Great work!"}
          </p>
        </div>
        <div className="min-w-0">
          <PortfolioSparkline />
        </div>
      </section>

      {/* KPI strip */}
      <section className="grid grid-cols-4 gap-3">
        {kpis.map((s) => (
          <div key={s.label} className="rounded-xl border border-gray-100 bg-white px-[18px] py-4 shadow-sm">
            <div className="text-xs font-medium text-[#86868B]">{s.label}</div>
            <div className="mt-1.5 flex items-baseline gap-2.5">
              <span className="text-[28px] font-semibold leading-tight tracking-[-0.025em] tabular-nums text-[#1D1D1F]">
                {s.value}
              </span>
              <span
                className={cn(
                  "text-xs font-medium tabular-nums",
                  s.kind === "positive" ? "text-[#1F8A5B]" :
                  s.kind === "warning"  ? "text-amber-600" :
                  "text-[#86868B]",
                )}
              >
                {s.delta}
              </span>
            </div>
            <div className="mt-1.5 text-[11px] text-[#86868B]">{s.sub}</div>
          </div>
        ))}
      </section>

      {/* Two-column lower */}
      <section className="grid gap-4" style={{ gridTemplateColumns: "1.4fr 1fr" }}>

        {/* Needs your eyes */}
        <div className="overflow-hidden rounded-[14px] border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center border-b border-gray-100 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-[#1D1D1F]">Needs your eyes</div>
              <div className="mt-0.5 text-xs text-[#86868B]">{urgent} things flagged today</div>
            </div>
            <Link href="/reviews" className="ml-auto text-xs font-semibold text-[#0A84FF] hover:underline">
              Open inbox →
            </Link>
          </div>
          {ATTENTION_ITEMS.map((e, i) => (
            <div
              key={i}
              className={cn(
                "flex cursor-pointer items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-gray-50",
                i < ATTENTION_ITEMS.length - 1 && "border-b border-gray-50",
              )}
            >
              <div
                className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                style={{ background: e.color + "1A", color: e.color }}
              >
                <e.icon className="size-3.5" strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold tracking-[-0.005em] text-[#1D1D1F]">{e.title}</div>
                <div className="mt-0.5 text-xs leading-snug text-[#86868B]">{e.subtitle}</div>
              </div>
              <div className="shrink-0 tabular-nums text-[11px] text-[#86868B]">{e.time}</div>
            </div>
          ))}
        </div>

        {/* Apps overview */}
        <div className="overflow-hidden rounded-[14px] border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center border-b border-gray-100 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-[#1D1D1F]">Apps</div>
              <div className="mt-0.5 text-xs text-[#86868B]">Portfolio overview</div>
            </div>
            <Link href="/settings" className="ml-auto text-xs font-semibold text-[#0A84FF] hover:underline">
              Manage →
            </Link>
          </div>
          {MOCK_APPS.map((a, i) => (
            <div
              key={a.name}
              className={cn(
                "flex cursor-pointer items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-gray-50",
                i < MOCK_APPS.length - 1 && "border-b border-gray-50",
              )}
            >
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[12px] font-bold text-[#86868B]">
                {a.name[0]}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-[#1D1D1F]">{a.name}</div>
                <div className="mt-0.5 text-[11px] text-[#86868B]">{a.store} · {a.unreplied} unreplied</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[17px] font-semibold leading-tight tracking-[-0.018em] tabular-nums text-[#1D1D1F]">
                  {a.rating.toFixed(2)}
                </div>
                <div className={cn("mt-0.5 text-[11px] tabular-nums font-medium", a.delta >= 0 ? "text-[#1F8A5B]" : "text-[#DC2626]")}>
                  {a.delta >= 0 ? "+" : "−"}{Math.abs(a.delta).toFixed(2)}
                </div>
              </div>
            </div>
          ))}
        </div>

      </section>
    </div>
  );
}

// ── Mock app data (replace when Google Play sync ships) ────────────────────────

const MOCK_APPS = [
  { name: "Acme Banking",  store: "iOS · Android", rating: 4.62, delta:  0.42, unreplied: 14 },
  { name: "Trailhead",     store: "iOS · Android", rating: 4.71, delta:  0.08, unreplied:  3 },
  { name: "Pocket Lock",   store: "Android",       rating: 4.21, delta: -0.03, unreplied:  5 },
  { name: "Nova",          store: "iOS",           rating: 4.39, delta:  0.18, unreplied:  1 },
];
