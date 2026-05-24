"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AlertOctagon, Download, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";
import { useApps } from "@/hooks/use-apps";
import { useIncidents } from "@/hooks/use-incidents";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { UpgradeToast } from "@/components/dashboard/upgrade-toast";
import { EmptyWorkspaceWelcome } from "@/components/dashboard/empty-workspace-welcome";
import { GooglePlayInviteModal } from "@/components/dashboard/google-play-invite-modal";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#DC2626",
  high:     "#D97706",
  medium:   "#6B7280",
};

// ── Sparkline chart ────────────────────────────────────────────────────────────

function PortfolioSparkline({ data }: { data: number[] }) {
  // Need at least 2 points to draw a line
  if (data.length < 2) {
    return (
      <div className="flex h-[130px] items-center justify-center text-[12px] text-[#86868B]">
        Trend appears here once 2+ days of reviews are synced.
      </div>
    );
  }

  const w = 560, h = 130, padL = 28, padR = 8, padT = 10, padB = 20;
  // Auto-scale Y axis to data range, padded by 0.1 on each side, clamped 1–5
  const min = Math.min(...data);
  const max = Math.max(...data);
  const lo = Math.max(1, Math.floor((min - 0.1) * 10) / 10);
  const hi = Math.min(5, Math.ceil((max + 0.1) * 10) / 10);
  const range = hi - lo || 0.5;

  const xs = (i: number) => padL + (i / (data.length - 1)) * (w - padL - padR);
  const ys = (v: number) => padT + (1 - (v - lo) / range) * (h - padT - padB);
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");

  // Y-axis gridlines: 4 evenly spaced ticks between lo and hi
  const ticks = [lo, lo + range * 0.33, lo + range * 0.66, hi].map(
    (v) => Math.round(v * 10) / 10,
  );

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: 130, display: "block" }}>
      {ticks.map((g) => (
        <g key={g}>
          <line x1={padL} x2={w - padR} y1={ys(g)} y2={ys(g)} stroke="rgba(0,0,0,0.06)" />
          <text x={padL - 6} y={ys(g) + 3} fontSize="9" fill="#86868B" textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>{g.toFixed(1)}</text>
        </g>
      ))}
      <path d={d} fill="none" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatDelta(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix}`;
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: metrics, isLoading, refetch: refetchMetrics } = useDashboardMetrics();
  const { apps, isLoading: appsLoading, refetch: refetchApps } = useApps();
  const { data: incidents } = useIncidents();
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [exporting, setExporting] = useState(false);

  // Poll metrics + apps every 10s while any app is still in its first sync,
  // so the dashboard updates without a manual refresh when reviews arrive.
  // Stops polling automatically once last_synced_at is set on every app.
  const hasUnsyncedApp = apps.some((a) => a.last_synced_at === null);
  useEffect(() => {
    if (!hasUnsyncedApp) return;
    const id = setInterval(() => {
      refetchMetrics();
      refetchApps();
    }, 10_000);
    return () => clearInterval(id);
  }, [hasUnsyncedApp, refetchMetrics, refetchApps]);

  async function handleExport() {
    setExporting(true);
    try {
      const res  = await fetch("/api/reports/export?days=30");
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = href;
      a.download = `reviews-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setExporting(false);
    }
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const avgRating = metrics?.avgRating ?? null;
  const unreplied = isLoading ? 0 : (metrics?.unrepliedCount ?? 0);
  const urgent    = isLoading ? 0 : (metrics?.urgentCount ?? 0);
  const reviewsToday = isLoading ? 0 : (metrics?.reviewsToday ?? 0);
  const aiDrafts  = isLoading ? 0 : (metrics?.aiDraftsThisWeek ?? 0);
  const reviewsWeekDelta = metrics?.reviewsWeekDelta ?? null;
  const avgRatingDelta   = metrics?.avgRatingDelta ?? null;
  const ratingTrend      = metrics?.ratingTrend ?? [];

  const reviewsDeltaKind: "positive" | "warning" | "neutral" =
    reviewsWeekDelta === null ? "neutral"
      : reviewsWeekDelta < 0 ? "warning"
        : "positive";
  const avgRatingDeltaKind: "positive" | "warning" | "neutral" =
    avgRatingDelta === null ? "neutral"
      : avgRatingDelta < 0 ? "warning"
        : "positive";

  const kpis = [
    {
      label: "Reviews today",
      value: String(reviewsToday),
      delta: formatDelta(reviewsWeekDelta, "%"),
      kind: reviewsDeltaKind,
      sub: reviewsWeekDelta !== null ? "vs last week" : "no prior week",
    },
    {
      label: "AI drafts this week",
      value: String(aiDrafts),
      delta: aiDrafts > 0 ? "generated" : "none yet",
      kind: "neutral" as const,
      sub: "draft replies",
    },
    {
      label: "Unreplied",
      value: String(unreplied),
      delta: `${urgent} urgent`,
      kind: urgent > 5 ? ("warning" as const) : ("positive" as const),
      sub: "across apps",
    },
    {
      label: "Avg. rating",
      value: avgRating !== null ? avgRating.toFixed(2) : "—",
      delta: formatDelta(avgRatingDelta),
      kind: avgRatingDeltaKind,
      sub: `last ${range}`,
    },
  ];

  // No apps yet → show the welcome / "connect your first app" empty state
  // instead of an empty dashboard. Skips the loop-prone middleware redirect.
  if (!appsLoading && apps.length === 0) {
    return <EmptyWorkspaceWelcome />;
  }

  const hasGooglePlayApp = apps.some((a) => a.platform === "google_play");

  return (
    <div className="flex w-full flex-col gap-6 overflow-auto p-8" style={{ maxWidth: 1240, margin: "0 auto" }}>
      <GooglePlayInviteModal hasGooglePlayApp={hasGooglePlayApp} />
      <Suspense fallback={null}>
        <UpgradeToast />
      </Suspense>
      <TrialBanner />

      {/* Sync status banner per app — shows real attempts, errors, action */}
      {apps.map((app) => {
        // Already-synced and no error → no banner
        if (app.last_synced_at && app.last_sync_status === "success") return null;

        const hasError = app.last_sync_status && app.last_sync_status !== "success";
        const isPending = !app.last_synced_at && !hasError;

        if (isPending) {
          return (
            <div
              key={app.id}
              className="flex items-start gap-3 rounded-xl border border-[#0A84FF]/20 bg-[#0A84FF]/[0.04] px-4 py-3"
            >
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-[#0A84FF]" strokeWidth={2} />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-[#1D1D1F]">
                  Syncing {app.name} from {app.platform === "google_play" ? "Google Play" : "App Store"}…
                </div>
                <div className="mt-0.5 text-[11px] text-[#86868B]">
                  First sync usually takes 10–30 seconds. Reviews will appear automatically.
                </div>
              </div>
            </div>
          );
        }

        return (
          <div
            key={app.id}
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <AlertOctagon className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={2} />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-[#1D1D1F]">
                {app.name} hasn&apos;t synced yet — action needed
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-[#48484D]">
                {app.last_sync_error ?? "Unknown sync error. Try Settings → Apps → Sync now."}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Link
                  href="/settings"
                  className="rounded-md bg-amber-600 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-700"
                >
                  Open Settings
                </Link>
                <button
                  onClick={async () => {
                    await fetch("/api/sync/reviews");
                    setTimeout(() => { refetchApps(); refetchMetrics(); }, 3000);
                  }}
                  className="rounded-md border border-amber-300 bg-white px-3 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100"
                >
                  Retry sync
                </button>
              </div>
            </div>
          </div>
        );
      })}

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
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 text-[13px] font-medium text-[#48484D] transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <Download className="size-3.5" strokeWidth={2} />
            {exporting ? "Exporting…" : "Export"}
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
          {avgRatingDelta !== null ? (
            <div className="mt-3.5 flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                  avgRatingDelta >= 0
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-700",
                )}
              >
                {formatDelta(avgRatingDelta)}
              </span>
              <span className="text-xs text-[#86868B]">vs previous 30 days</span>
            </div>
          ) : (
            <div className="mt-3.5 text-xs text-[#86868B]">
              {avgRating !== null ? "No prior data to compare" : "Sync reviews to see your rating"}
            </div>
          )}
          <p className="mt-4 max-w-[260px] text-[13px] leading-relaxed text-[#86868B]">
            {unreplied > 0
              ? `${unreplied} reviews awaiting reply.${urgent > 0 ? ` ${urgent} marked urgent.` : ""}`
              : "All reviews replied to. Great work!"}
          </p>
        </div>
        <div className="min-w-0">
          <PortfolioSparkline data={ratingTrend} />
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

        {/* Needs your eyes — live incidents */}
        <div className="overflow-hidden rounded-[14px] border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center border-b border-gray-100 px-5 py-4">
            <div>
              <div className="text-sm font-semibold text-[#1D1D1F]">Active incidents</div>
              <div className="mt-0.5 text-xs text-[#86868B]">
                {incidents
                  ? `${incidents.filter((i) => i.status !== "resolved").length} open`
                  : "Loading…"}
              </div>
            </div>
            <Link href="/incidents" className="ml-auto text-xs font-semibold text-[#0A84FF] hover:underline">
              View all →
            </Link>
          </div>
          {!incidents ? (
            <div className="px-5 py-8 text-center text-xs text-[#86868B]">Loading…</div>
          ) : incidents.filter((i) => i.status !== "resolved").length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <AlertOctagon className="size-8 text-gray-200" strokeWidth={1.5} />
              <div className="mt-3 text-[13px] font-medium text-[#86868B]">No active incidents</div>
              <div className="mt-1 text-[11px] text-[#86868B]">ReviewBox monitors for rating spikes automatically</div>
            </div>
          ) : (
            incidents
              .filter((i) => i.status !== "resolved")
              .slice(0, 4)
              .map((inc, i, arr) => {
                const color = SEVERITY_COLOR[inc.severity] ?? "#6B7280";
                return (
                  <Link
                    key={inc.id}
                    href={`/incidents/${inc.id}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-gray-50",
                      i < arr.length - 1 && "border-b border-gray-50",
                    )}
                  >
                    <div
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: color + "1A", color }}
                    >
                      <AlertOctagon className="size-3.5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold tracking-[-0.005em] text-[#1D1D1F] truncate">
                        {inc.title}
                      </div>
                      <div className="mt-0.5 text-xs leading-snug text-[#86868B] truncate">
                        {inc.severity} · {inc.owner}
                      </div>
                    </div>
                    <div className="shrink-0 tabular-nums text-[11px] text-[#86868B]">{inc.detectedAt}</div>
                  </Link>
                );
              })
          )}
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
          {appsLoading ? (
            <div className="px-5 py-8 text-center text-xs text-[#86868B]">Loading…</div>
          ) : apps.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-[#86868B]">
              No apps connected yet.{" "}
              <Link href="/settings" className="text-[#0A84FF] hover:underline">Add one →</Link>
            </div>
          ) : (
            apps.map((a, i) => (
              <div
                key={a.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-gray-50",
                  i < apps.length - 1 && "border-b border-gray-50",
                )}
              >
                {a.icon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.icon_url}
                    alt=""
                    className="size-8 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-[12px] font-bold text-[#86868B]">
                    {a.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-[#1D1D1F]">{a.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#86868B]">
                    <span>{a.platform === "google_play" ? "Google Play" : "App Store"}</span>
                    {a.lifetime_rating !== null && (
                      <>
                        <span>·</span>
                        <span className="tabular-nums">{a.lifetime_rating.toFixed(1)}★</span>
                      </>
                    )}
                    {a.lifetime_review_count !== null && a.lifetime_review_count > 0 && (
                      <>
                        <span>·</span>
                        <span className="tabular-nums">
                          {a.lifetime_review_count.toLocaleString()} reviews
                        </span>
                      </>
                    )}
                  </div>
                </div>
                {a.last_synced_at === null && (
                  <span className="shrink-0 rounded-full bg-[#0A84FF]/10 px-2 py-0.5 text-[10px] font-semibold text-[#0A84FF]">
                    Syncing…
                  </span>
                )}
              </div>
            ))
          )}
        </div>

      </section>
    </div>
  );
}
