"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertOctagon,
  Bot,
  Download,
  Loader2,
  MessageSquare,
  Sparkles,
  Star,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";
import { useApps } from "@/hooks/use-apps";
import { useIncidents } from "@/hooks/use-incidents";
import { Skeleton } from "@/components/ui/skeleton";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { UpgradeToast } from "@/components/dashboard/upgrade-toast";
import { EmptyWorkspaceWelcome } from "@/components/dashboard/empty-workspace-welcome";
import { GooglePlaySetupModal } from "@/components/dashboard/google-play-setup-modal";
import { AiSummaryPanel } from "@/features/dashboard/components/ai-summary-panel";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#DC2626",
  high:     "#D97706",
  medium:   "#6B7280",
};

// ── Sparkline ─────────────────────────────────────────────────────────────────

function PortfolioSparkline({ data }: { data: number[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-[130px] items-center justify-center text-[12px] text-fg-3">
        Trend appears here once 2+ days of reviews are synced.
      </div>
    );
  }

  const w = 560, h = 130, padL = 28, padR = 8, padT = 10, padB = 20;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const lo = Math.max(1, Math.floor((min - 0.1) * 10) / 10);
  const hi = Math.min(5, Math.ceil((max + 0.1) * 10) / 10);
  const range = hi - lo || 0.5;

  const xs = (i: number) => padL + (i / (data.length - 1)) * (w - padL - padR);
  const ys = (v: number) => padT + (1 - (v - lo) / range) * (h - padT - padB);
  const d = data.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");
  const ticks = [lo, lo + range * 0.33, lo + range * 0.66, hi].map(
    (v) => Math.round(v * 10) / 10,
  );

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full" style={{ height: 130, display: "block" }}>
      {ticks.map((g) => (
        <g key={g}>
          <line x1={padL} x2={w - padR} y1={ys(g)} y2={ys(g)} stroke="rgba(0,0,0,0.06)" />
          <text x={padL - 6} y={ys(g) + 3} fontSize="9" fill="var(--rb-fg-3)" textAnchor="end" style={{ fontVariantNumeric: "tabular-nums" }}>{g.toFixed(1)}</text>
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

// ── WorkspaceStatusStrip ──────────────────────────────────────────────────────
// Exactly ONE status element, chosen by priority: sync errors beat an
// in-flight first sync, which beats "connected but quiet", which beats
// background AI enrichment. The dashboard previously stacked one banner per
// app plus a separate AI panel — with the trial nudge and the global
// credentials bar, a fresh workspace could open on four banners and an
// uninvited modal. One strip, one action, everything else waits its turn.

function WorkspaceStatusStrip({
  apps,
  aiEnriching,
  onRetry,
  onConnectPlayConsole,
  onOpenSetup,
}: {
  apps: ReturnType<typeof useApps>["apps"];
  aiEnriching: boolean;
  onRetry: () => void;
  onConnectPlayConsole: () => void;
}) {
  return (
    <>
      {apps.map((app) => {
        const succeeded = app.last_sync_status === "success";
        const emptySuccess = succeeded && (app.last_sync_review_count ?? 0) === 0;

        // Synced from PUBLIC data only — the customer hasn't granted Play
        // Console access yet. Reviews and rating are real (scraped from the
        // public listing), so this is informational, not an error: explain
        // what connecting unlocks.
        if (
          succeeded && !emptySuccess &&
          app.platform === "google_play" &&
          app.publisher_api_connected !== true
        ) {
          return (
            <div
              key={app.id}
              className="flex items-start gap-3 rounded-xl border border-[#0A84FF]/20 bg-[#0A84FF]/[0.04] px-4 py-3"
            >
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[#0A84FF]" strokeWidth={2} />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-fg-1">
                  {app.name} is showing public Play Store data
                </div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-fg-3">
                  Your rating and latest reviews are synced from the public store listing.
                  Connect your Play Console to reply to reviews from ReviewBox, see device
                  details, and sync everything automatically.
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={onConnectPlayConsole}
                    className="rounded-md bg-[#0A84FF] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#0070e0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
                  >
                    Connect Play Console
                  </button>
                  <Link
                    href="/help/connect-google-play"
                    className="text-[11px] font-medium text-fg-3 hover:text-fg-2"
                  >
                    How it works →
                  </Link>
                </div>
              </div>
            </div>
          );
        }

        // Fully synced with reviews — no banner
        if (succeeded && !emptySuccess) return null;

        const hasError = app.last_sync_status && app.last_sync_status !== "success";
        const isPending = !app.last_synced_at && !hasError && !emptySuccess;

        if (isPending) {
          return (
            <div
              key={app.id}
              className="flex items-start gap-3 rounded-xl border border-[#0A84FF]/20 bg-[#0A84FF]/[0.04] px-4 py-3"
            >
              <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-[#0A84FF]" strokeWidth={2} />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-fg-1">
                  Syncing {app.name} from {app.platform === "google_play" ? "Google Play" : "App Store"}…
                </div>
                <div className="mt-0.5 text-[11px] text-fg-3">
                  First sync usually takes 10–30 seconds. Reviews will appear automatically.
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={onRetry}
                    className="rounded-md border border-[#0A84FF]/30 bg-white px-3 py-1 text-[11px] font-semibold text-[#0A84FF] hover:bg-[#0A84FF]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
                  >
                    Sync now
                  </button>
                  <Link
                    href={app.platform === "google_play" ? "/help/connect-google-play" : "/help/connect-app-store"}
                    className="text-[11px] font-medium text-fg-3 hover:text-fg-2"
                  >
                    Troubleshooting →
                  </Link>
                </div>
              </div>
            </div>
          );
        }

        if (emptySuccess) {
          return (
            <div
              key={app.id}
              className="flex items-start gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface px-4 py-3 shadow-[var(--rb-shadow-xs)]"
            >
              <Sparkles className="mt-0.5 size-4 shrink-0 text-[#0A84FF]" strokeWidth={2} />
              <div className="flex-1">
                <div className="text-[13px] font-semibold text-fg-1">
                  {app.name} is connected — no recent reviews yet
                </div>
                <div className="mt-0.5 text-[11px] leading-relaxed text-fg-3">
                  {app.platform === "google_play"
                    ? "Google Play only exposes reviews from the last 7 days. New reviews will appear here as customers leave them."
                    : "App Store reviews appear once customers leave them. We'll keep checking daily."}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    onClick={onRetry}
                    className="rounded-md border border-[var(--rb-border-2)] bg-surface px-3 py-1 text-[11px] font-semibold text-fg-2 hover:bg-[var(--rb-bg-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
                  >
                    Check again
                  </button>
                  <Link
                    href={app.platform === "google_play" ? "/help/connect-google-play" : "/help/connect-app-store"}
                    className="text-[11px] font-medium text-fg-3 hover:text-fg-2"
                  >
                    Why no reviews? →
                  </Link>
                </div>
              </div>
            </div>
          );
        }

        // Error state
        return (
          <div
            key={app.id}
            className="flex items-start gap-3 rounded-xl border border-[var(--rb-amber-200,#FDE68A)] bg-[var(--rb-amber-50,#FFFBEB)] px-4 py-3"
          >
            <AlertOctagon className="mt-0.5 size-4 shrink-0 text-[#D97706]" strokeWidth={2} />
            <div className="flex-1">
              <div className="text-[13px] font-semibold text-fg-1">
                {app.name} hasn&apos;t synced yet — action needed
              </div>
              <div className="mt-1 text-[12px] leading-relaxed text-fg-2">
                {app.last_sync_error ?? "Unknown sync error. Try Settings → Apps → Sync now."}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Link
                  href={app.platform === "google_play" ? "/help/connect-google-play" : "/help/connect-app-store"}
                  target="_blank"
                  className="rounded-md bg-[#D97706] px-3 py-1 text-[11px] font-semibold text-white hover:bg-[#B45309] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]"
                >
                  Step-by-step guide
                </Link>
                <Link
                  href="/settings"
                  className="rounded-md border border-[#FCD34D] bg-white px-3 py-1 text-[11px] font-semibold text-[#92400E] hover:bg-[#FEF3C7]"
                >
                  Open Settings
                </Link>
                <button
                  onClick={onRetry}
                  className="rounded-md border border-[#FCD34D] bg-white px-3 py-1 text-[11px] font-semibold text-[#92400E] hover:bg-[#FEF3C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706]"
                >
                  Retry sync
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </>
  onOpenSetup: () => void;
}) {
  const errored = apps.filter(
    (a) => a.last_sync_status && a.last_sync_status !== "success",
  );
  const pending = apps.filter(
    (a) => !a.last_synced_at && !(a.last_sync_status && a.last_sync_status !== "success"),
  );
  const quietOk = apps.filter(
    (a) => a.last_sync_status === "success" && (a.last_sync_review_count ?? 0) === 0,
  );

  const actionBtn =
    "rounded-md px-2.5 py-1 text-rb-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]";
  const quietBtn =
    `${actionBtn} border border-[var(--rb-border-2)] bg-surface text-fg-2 hover:bg-[var(--rb-bg-hover)]`;

  if (errored.length > 0) {
    const first = errored[0];
    const names = errored.map((a) => a.name).join(", ");
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--rb-amber-500)]/30 bg-[var(--rb-amber-100)]/40 px-4 py-2.5">
        <AlertOctagon className="size-4 shrink-0 text-[var(--rb-amber-600)]" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <span className="text-rb-base font-medium text-fg-1">
            {errored.length === 1 ? `${names} can’t sync yet` : `${errored.length} apps can’t sync yet`}
          </span>
          <span className="ml-2 hidden text-rb-sm text-fg-3 sm:inline">
            {first.last_sync_error ?? "Finish the store connection so reviews can flow."}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {first.platform === "google_play" ? (
            <button onClick={onOpenSetup} className={`${actionBtn} bg-[var(--rb-amber-600)] text-white hover:opacity-90`}>
              Finish setup
            </button>
          ) : (
            <Link href="/help/connect-app-store" className={`${actionBtn} bg-[var(--rb-amber-600)] text-white hover:opacity-90`}>
              Setup guide
            </Link>
          )}
          <button onClick={onRetry} className={quietBtn}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (pending.length > 0) {
    const label =
      pending.length === 1 ? `Syncing ${pending[0].name}…` : `Syncing ${pending.length} apps…`;
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface px-4 py-2.5">
        <Loader2 className="size-4 shrink-0 animate-spin text-[#0A84FF]" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <span className="text-rb-base font-medium text-fg-1">{label}</span>
          <span className="ml-2 hidden text-rb-sm text-fg-3 sm:inline">
            First sync takes about 30 seconds — reviews appear automatically.
          </span>
        </div>
        <button onClick={onRetry} className={quietBtn}>
          Sync now
        </button>
      </div>
    );
  }

  if (quietOk.length > 0) {
    const app = quietOk[0];
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface px-4 py-2.5">
        <Sparkles className="size-4 shrink-0 text-[#0A84FF]" strokeWidth={2} />
        <div className="min-w-0 flex-1">
          <span className="text-rb-base font-medium text-fg-1">
            {app.name} is connected — no recent reviews yet
          </span>
          <span className="ml-2 hidden text-rb-sm text-fg-3 sm:inline">
            {app.platform === "google_play"
              ? "Google Play only exposes the last 7 days of reviews."
              : "New reviews appear as customers leave them."}
          </span>
        </div>
        <Link
          href={app.platform === "google_play" ? "/help/connect-google-play" : "/help/connect-app-store"}
          className="shrink-0 text-rb-xs font-medium text-fg-3 hover:text-fg-2"
        >
          Why? →
        </Link>
      </div>
    );
  }

  if (aiEnriching) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface px-4 py-2.5">
        <Bot className="size-4 shrink-0 text-[#0A84FF]" strokeWidth={2} />
        <span className="min-w-0 flex-1 text-rb-base text-fg-2">
          Preparing reply templates from your reviews — about 10 seconds.
        </span>
        <Loader2 className="size-4 shrink-0 animate-spin text-fg-3" strokeWidth={2} />
      </div>
    );
  }

  return null;
}

// ── KpiCard ───────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  sub,
  kind,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  delta: string;
  sub: string;
  kind: "positive" | "warning" | "neutral";
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface px-5 py-4 shadow-[var(--rb-shadow-xs)]">
      {/* Label row with icon */}
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--rb-bg-sunken)]">
          <Icon className="size-3.5 text-fg-3" strokeWidth={1.5} />
        </div>
        <span className="text-[12px] font-medium text-fg-3 truncate leading-none">{label}</span>
      </div>
      {/* Value + delta */}
      <div className="flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-8 w-14 rounded-md" />
        ) : (
          <span className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-fg-1">
            {value}
          </span>
        )}
        {!loading && (
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums shrink-0",
              kind === "positive" ? "text-[#1F8A5B]" :
              kind === "warning"  ? "text-[#D97706]" :
              "text-fg-3",
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {/* Sub label */}
      <div className="text-[11px] text-fg-3 leading-none">{sub}</div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: metrics, isLoading, refetch: refetchMetrics } = useDashboardMetrics();
  const { apps, isLoading: appsLoading, refetch: refetchApps } = useApps();
  const { data: incidents } = useIncidents();
  const [exporting, setExporting] = useState(false);
  const [aiEnriching, setAiEnriching] = useState<boolean | null>(null);

  // Poll metrics + apps every 10s while any app hasn't attempted a sync yet.
  const hasUnsyncedApp = apps.some((a) => a.last_sync_attempted_at === null);
  useEffect(() => {
    if (!hasUnsyncedApp) return;
    const id = setInterval(() => {
      refetchMetrics();
      refetchApps();
    }, 10_000);
    return () => clearInterval(id);
  }, [hasUnsyncedApp, refetchMetrics, refetchApps]);

  // Self-heal: if an app has NEVER attempted a sync (the signup-time trigger
  // can be lost — deploy rollout, serverless timeout), kick one from here.
  // This request is Clerk-authenticated, so the sync route pins it to the
  // user's own workspace. Fires at most once per page mount; the 10s polling
  // above picks up the results.
  const syncKickedRef = useRef(false);
  useEffect(() => {
    if (syncKickedRef.current || appsLoading || !hasUnsyncedApp) return;
    syncKickedRef.current = true;
    void fetch("/api/sync/reviews").catch(() => {
      // Best-effort — the daily cron remains the fallback.
    });
  }, [appsLoading, hasUnsyncedApp]);

  const firstSyncDone = apps.some((a) => a.last_synced_at !== null);
  const totalReviews  = metrics?.totalReviews ?? 0;

  const checkEnrichment = useCallback(async () => {
    try {
      const res = await fetch("/api/reply-kit/knowledge-base");
      if (!res.ok) return;
      const data = (await res.json()) as { entries?: unknown[] };
      const hasEntries = Array.isArray(data.entries) && data.entries.length > 0;
      setAiEnriching(!hasEntries);
    } catch {
      setAiEnriching(false);
    }
  }, []);

  useEffect(() => {
    if (!firstSyncDone || totalReviews === 0) return;
    void checkEnrichment();
  }, [firstSyncDone, totalReviews, checkEnrichment]);

  useEffect(() => {
    if (!aiEnriching) return;
    const id = setInterval(() => void checkEnrichment(), 8_000);
    return () => clearInterval(id);
  }, [aiEnriching, checkEnrichment]);

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

  function handleRetry() {
    void fetch("/api/sync/reviews");
    setTimeout(() => { refetchApps(); refetchMetrics(); }, 3000);
  }

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const avgRating      = metrics?.avgRating ?? null;
  const displayRating  = metrics?.lifetimeRating ?? avgRating;
  const displayReviews = metrics?.lifetimeReviewCount ?? metrics?.totalReviews ?? 0;
  const unreplied      = metrics?.unrepliedCount ?? 0;
  const urgent         = metrics?.urgentCount ?? 0;
  const reviewsToday   = metrics?.reviewsToday ?? 0;
  const aiDrafts       = metrics?.aiDraftsThisWeek ?? 0;
  const reviewsWeekDelta = metrics?.reviewsWeekDelta ?? null;
  const avgRatingDelta   = metrics?.avgRatingDelta ?? null;
  const ratingTrend      = metrics?.ratingTrend ?? [];
  const ratingIsLifetime = metrics?.lifetimeRating != null;

  const reviewsDeltaKind: "positive" | "warning" | "neutral" =
    reviewsWeekDelta === null ? "neutral" : reviewsWeekDelta < 0 ? "warning" : "positive";
  const avgRatingDeltaKind: "positive" | "warning" | "neutral" =
    avgRatingDelta === null ? "neutral" : avgRatingDelta < 0 ? "warning" : "positive";

  const firstGooglePlayApp = apps.find((a) => a.platform === "google_play");

  // The setup modal used to open itself on load whenever a Google Play app
  // hadn't synced, on top of the status banners — a dialog nobody asked for,
  // covering the screen it was explaining. It now opens only from the status
  // strip's "Finish setup" action (and from Settings).
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  const kpis = [
    {
      icon: MessageSquare,
      label: "Unreplied",
      value: String(unreplied),
      delta: `${urgent} urgent`,
      kind: urgent > 5 ? ("warning" as const) : ("positive" as const),
      sub: "across all apps",
    },
    {
      icon: Star,
      label: "Avg. rating",
      value: displayRating !== null ? displayRating.toFixed(2) : "—",
      delta: formatDelta(avgRatingDelta),
      kind: avgRatingDeltaKind,
      sub: ratingIsLifetime ? "all-time (store)" : "last 30 days",
    },
    {
      icon: TrendingUp,
      label: "Reviews today",
      value: String(reviewsToday),
      delta: formatDelta(reviewsWeekDelta, "%"),
      kind: reviewsDeltaKind,
      sub: reviewsWeekDelta !== null ? "vs last week" : "no prior week data",
    },
    {
      icon: Sparkles,
      label: "AI drafts",
      value: String(aiDrafts),
      delta: aiDrafts > 0 ? "generated" : "none yet",
      kind: "neutral" as const,
      sub: "this week",
    },
  ];

  if (!appsLoading && apps.length === 0) {
    return <EmptyWorkspaceWelcome />;
  }

  return (
    <div className="flex w-full flex-col gap-5 overflow-auto p-4 sm:p-6 lg:p-8 max-w-[1280px] mx-auto">
      <GooglePlaySetupModal
        open={setupModalOpen}
        onClose={() => setSetupModalOpen(false)}
        app={firstGooglePlayApp
          ? { id: firstGooglePlayApp.id, store_id: firstGooglePlayApp.store_id, name: firstGooglePlayApp.name }
          : undefined}
      />
      <Suspense fallback={null}>
        <UpgradeToast />
      </Suspense>
      <TrialBanner />

      {/* ── Page header ── */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium text-fg-3">{dateStr}</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.022em] text-fg-1 sm:text-[28px]">
            {greeting}
          </h1>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex h-9 w-fit items-center gap-1.5 rounded-lg border border-[var(--rb-border-1)] bg-surface px-4 text-[13px] font-medium text-fg-2 transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
        >
          <Download className="size-3.5" strokeWidth={2} />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </header>

      {/* ── Sync banners (single, merged) ── */}
      <SyncBanners
        apps={apps}
        onRetry={handleRetry}
        onConnectPlayConsole={() => setSetupModalOpen(true)}
      />

      {/* ── AI enrichment banner ── */}
      {aiEnriching === true && (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--rb-indigo-500)]/20 bg-[var(--rb-indigo-500)]/[0.04] px-4 py-3">
          <Bot className="mt-0.5 size-4 shrink-0 animate-pulse text-[var(--rb-indigo-500)]" strokeWidth={2} />
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-fg-1">
              AI is preparing your workspace…
            </div>
            <div className="mt-0.5 text-[11px] text-fg-3">
              Gemini is reading your reviews and generating your Knowledge Base and reply templates. This takes about 10 seconds.
            </div>
          </div>
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-[var(--rb-indigo-500)]" strokeWidth={2} />
        </div>
      )}
      {/* ── One status strip: errors > syncing > quiet > AI prep ── */}
      <WorkspaceStatusStrip
        apps={apps}
        aiEnriching={aiEnriching === true}
        onRetry={handleRetry}
        onOpenSetup={() => setSetupModalOpen(true)}
      />

      {/* ── Hero — portfolio rating ── */}
      <section className="grid grid-cols-1 gap-6 rounded-2xl border border-[var(--rb-border-1)] bg-surface px-5 py-5 shadow-[var(--rb-shadow-xs)] sm:grid-cols-[minmax(0,260px)_1fr] sm:items-center sm:gap-8 sm:px-8 sm:py-7">
        <div>
          <div className="text-xs font-medium text-fg-3 uppercase tracking-[0.06em]">
            {ratingIsLifetime ? "Portfolio rating · all-time" : "Portfolio rating · 30 days"}
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-5xl font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg-1 sm:text-[60px]">
              {displayRating !== null ? displayRating.toFixed(2) : "—"}
            </span>
            {displayRating !== null && (
              <div className="mb-1 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className={cn("size-4", i < Math.round(displayRating) ? "text-amber-400" : "text-[var(--rb-border-2)]")}
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
            <div className="mt-3 flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                  avgRatingDelta >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700",
                )}
              >
                {formatDelta(avgRatingDelta)}
              </span>
              <span className="text-xs text-fg-3">vs previous 30 days</span>
            </div>
          ) : (
            <div className="mt-3 text-xs text-fg-3">
              {avgRating !== null ? "No prior data to compare" : "Sync reviews to see your rating"}
            </div>
          )}
          <p className="mt-4 max-w-[240px] text-[13px] leading-relaxed text-fg-3">
            {unreplied > 0
              ? `${unreplied} reviews awaiting reply.${urgent > 0 ? ` ${urgent} marked urgent.` : ""}`
              : "All reviews replied to. Great work!"}
          </p>
        </div>
        <div className="min-w-0">
          <PortfolioSparkline data={ratingTrend} />
        </div>
      </section>

      {/* ── KPI strip ── */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((s) => (
          <KpiCard key={s.label} {...s} loading={isLoading} />
        ))}
      </section>

      {/* ── Two-column: incidents + apps ── */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr]">

        {/* Active incidents */}
        <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
          <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-4">
            <div>
              <div className="text-[15px] font-semibold text-fg-1">Active incidents</div>
              <div className="mt-0.5 text-xs text-fg-3">
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
            <div className="space-y-3 px-5 py-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : incidents.filter((i) => i.status !== "resolved").length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--rb-bg-sunken)]">
                <AlertOctagon className="size-5 text-fg-3" strokeWidth={1.5} />
              </div>
              <div className="mt-3 text-[13px] font-medium text-fg-2">No active incidents</div>
              <div className="mt-1 text-[11px] text-fg-3">ReviewBox monitors for rating spikes automatically</div>
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
                      "flex cursor-pointer items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-[var(--rb-bg-hover)]",
                      i < arr.length - 1 && "border-b border-[var(--rb-border-1)]",
                    )}
                  >
                    <div
                      className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: color + "1A", color }}
                    >
                      <AlertOctagon className="size-3.5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold tracking-[-0.005em] text-fg-1">
                        {inc.title}
                      </div>
                      <div className="mt-0.5 truncate text-xs leading-snug text-fg-3">
                        {inc.severity} · {inc.owner}
                      </div>
                    </div>
                    <div className="shrink-0 tabular-nums text-[11px] text-fg-3">{inc.detectedAt}</div>
                  </Link>
                );
              })
          )}
        </div>

        {/* Apps overview */}
        <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
          <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-4">
            <div>
              <div className="text-[15px] font-semibold text-fg-1">Apps</div>
              <div className="mt-0.5 text-xs text-fg-3">Portfolio overview</div>
            </div>
            <Link href="/settings" className="ml-auto text-xs font-semibold text-[#0A84FF] hover:underline">
              Manage →
            </Link>
          </div>
          {appsLoading ? (
            <div className="space-y-3 px-5 py-4">
              <Skeleton className="h-10 w-full rounded-lg" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ) : apps.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-fg-3">
              No apps connected yet.{" "}
              <Link href="/settings" className="text-[#0A84FF] hover:underline">Add one →</Link>
            </div>
          ) : (
            apps.map((a, i) => (
              <div
                key={a.id}
                className={cn(
                  "flex cursor-pointer items-center gap-3.5 px-5 py-3.5 transition-colors hover:bg-[var(--rb-bg-hover)]",
                  i < apps.length - 1 && "border-b border-[var(--rb-border-1)]",
                )}
              >
                {a.icon_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.icon_url} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--rb-bg-sunken)] text-[12px] font-bold text-fg-3">
                    {a.name[0]?.toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold text-fg-1">{a.name}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-fg-3">
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
                        <span className="tabular-nums">{a.lifetime_review_count.toLocaleString()} reviews</span>
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

      {/* ── AI Review Summary ── */}
      <AiSummaryPanel />

      {/* ── 3-column bottom ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Ratings */}
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface p-5 shadow-[var(--rb-shadow-xs)]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-fg-1">Ratings</span>
            <Link href="/alerts" className="text-[11px] font-medium text-[#0A84FF] hover:underline">Set alert →</Link>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[36px] font-semibold tabular-nums leading-none text-fg-1">
              {displayRating != null ? displayRating.toFixed(1) : "—"}
            </span>
            <span className="text-[14px] text-fg-3">★</span>
            {metrics?.avgRatingDelta != null && (
              <span className={cn("text-[12px] font-medium tabular-nums", metrics.avgRatingDelta >= 0 ? "text-[#1F8A5B]" : "text-[#DC2626]")}>
                {metrics.avgRatingDelta >= 0 ? "+" : ""}{metrics.avgRatingDelta.toFixed(2)}
              </span>
            )}
          </div>
          <div className="text-[11px] text-fg-3">
            {ratingIsLifetime ? "all-time (store)" : "vs previous period"}
          </div>
        </div>

        {/* Reviews */}
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface p-5 shadow-[var(--rb-shadow-xs)]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-fg-1">Reviews</span>
            <Link href="/reviews" className="text-[11px] font-medium text-[#0A84FF] hover:underline">View all →</Link>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[36px] font-semibold tabular-nums leading-none text-fg-1">
              {displayReviews.toLocaleString()}
            </span>
          </div>
          <div className="flex gap-3 text-[11px] text-fg-3">
            <span>{unreplied} unreplied</span>
            <span>·</span>
            <span>{urgent} urgent</span>
          </div>
        </div>

        {/* Feedback */}
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface p-5 shadow-[var(--rb-shadow-xs)]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-fg-1">Feedback</span>
            <Link href="/reports" className="text-[11px] font-medium text-[#0A84FF] hover:underline">Full report →</Link>
          </div>
          <div className="flex flex-col gap-2">
            {[
              { label: "Crash / bugs",       color: "#DC2626" },
              { label: "Feature requests",   color: "#D97706" },
              { label: "Login / billing",    color: "#0A84FF" },
            ].map((tag) => (
              <div key={tag.label} className="flex items-center gap-2">
                <div className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: tag.color }} />
                <span className="flex-1 text-[12px] text-fg-2">{tag.label}</span>
                <span className="tabular-nums text-[11px] text-fg-3">—</span>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-fg-3">Sync reviews to see tag breakdown</div>
        </div>

      </section>

    </div>
  );
}
