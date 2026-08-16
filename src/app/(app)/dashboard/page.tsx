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

import { apiErrorMessage } from "@/lib/api-error-message";
import { cn } from "@/lib/utils";
import { isSyncFailureStatus } from "@/lib/sync-status";
import { resolveSelectedApp } from "@/lib/selected-app";
import { exportFileName } from "@/lib/export-filename";
import { useWorkspaceStore } from "@/store/use-workspace-store";
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";
import { useApps } from "@/hooks/use-apps";
import { useIncidents } from "@/hooks/use-incidents";
import { Button } from "@/components/ui/button";
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

function PortfolioSparkline({ data }: { data: (number | null)[] }) {
  // Null entries are days with no reviews in the trailing window. They keep
  // their slot on the x-axis — that is the whole point, so the spacing between
  // points means elapsed time — but the line must not be drawn across them.
  const values = data.filter((v): v is number => v !== null);

  if (values.length < 2) {
    return (
      <div className="flex h-[130px] items-center justify-center text-[12px] text-fg-3">
        Trend appears here once 2+ days of reviews are synced.
      </div>
    );
  }

  const w = 560, h = 130, padL = 28, padR = 8, padT = 10, padB = 20;

  // Fixed 1–5 domain — ratings live on a five-star scale and the axis must say
  // so. The old domain auto-zoomed to the data (min→max), so a rough month
  // rendered as a 1.4–2.5 window, which reads as "the rating axis ends at 2.5"
  // rather than as a trend on a 5-star scale.
  const ticks = [1, 2, 3, 4, 5];

  const xs = (i: number) => padL + (i / Math.max(1, data.length - 1)) * (w - padL - padR);
  const ys = (v: number) => padT + (1 - (v - 1) / 4) * (h - padT - padB);

  // "M" starts a fresh subpath after every gap, so a break in the data reads as
  // a break in the line instead of a straight run between two distant days.
  let penDown = false;
  const d = data
    .map((v, i) => {
      if (v === null) { penDown = false; return ""; }
      const cmd = penDown ? "L" : "M";
      penDown = true;
      return `${cmd}${xs(i)},${ys(v)}`;
    })
    .filter(Boolean)
    .join(" ");

  // `preserveAspectRatio="none"` is what lets the line stretch to whatever width
  // the card happens to be — but it scales x and y independently, and it scales
  // EVERYTHING in the SVG, glyphs included. On a wide screen the viewBox is
  // stretched about 2x horizontally and not at all vertically, so the axis
  // numbers came out visibly distorted.
  //
  // So the labels leave the SVG. The stretched box keeps only geometry
  // (gridlines and the path, which are supposed to stretch) and the numbers are
  // HTML positioned over it, rendering at their natural proportions.
  const pct = (v: number) => `${(ys(v) / h) * 100}%`;

  return (
    <div className="relative w-full" style={{ height: h }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        {ticks.map((g) => (
          <line
            key={g}
            x1={padL}
            x2={w - padR}
            y1={ys(g)}
            y2={ys(g)}
            stroke="var(--rb-border-1)"
          />
        ))}
        <path
          d={d}
          fill="none"
          stroke="#0A84FF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          // Stroke width is a length like any other, so the horizontal stretch
          // would thin the line as the card widens. This keeps it at 2px.
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {ticks.map((g) => (
        <span
          key={g}
          className="absolute text-[10px] tabular-nums text-fg-3"
          style={{ top: pct(g), left: 0, width: padL - 6, transform: "translateY(-50%)", textAlign: "right" }}
        >
          {g}
        </span>
      ))}
    </div>
  );
}

function formatDelta(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix}`;
}

// ── WorkspaceStatusStrip ──────────────────────────────────────────────────────
// Exactly ONE status element, chosen by priority: sync errors beat an
// in-flight first sync, which beats "connected but quiet", which beats the
// "connect Play Console" nudge. AI enrichment is NOT one of these — it has its
// own banner in the page body, and having it here too rendered both at once.
//
// FOURTH repair of this component. Every occurrence has the same shape: a
// merge keeps both the old per-app SyncBanners body and this strip, splicing
// one into the other's signature. If you are here again: keep THIS version,
// delete the per-app `apps.map()` body, and render the strip once.

function WorkspaceStatusStrip({
  apps,
  onRetry,
  onConnectPlayConsole,
  onOpenSetup,
}: {
  apps: ReturnType<typeof useApps>["apps"];
  onRetry: () => void;
  onConnectPlayConsole: () => void;
  onOpenSetup: () => void;
}) {
  // `isSyncFailureStatus` rather than `status !== "success"`: the latter
  // treated `credentials_verified` — written by the connection test the user
  // had just passed — as a broken app, so finishing setup made the "can't sync
  // yet" banner appear rather than disappear.
  const errored = apps.filter((a) => isSyncFailureStatus(a.last_sync_status));
  const pending = apps.filter(
    (a) => !a.last_synced_at && !isSyncFailureStatus(a.last_sync_status),
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
        <AlertOctagon className="size-4 shrink-0 text-[var(--rb-amber-600)]" />
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
        <Loader2 className="size-4 shrink-0 animate-spin text-[#0A84FF]" />
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
        <Sparkles className="size-4 shrink-0 text-[#0A84FF]" />
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

  // NOTE: no `aiEnriching` branch here. The dashboard renders its own, richer
  // enrichment banner below the strip, and this one duplicated it — two
  // spinners saying the same thing, stacked, which is most of why the screen
  // read as "stuck in a loop". The strip is for app/sync state; enrichment is
  // workspace state and belongs to the one banner.

  // Synced from PUBLIC data only — the customer hasn't granted Play Console
  // access yet. Reviews and rating are real (scraped from the public store
  // listing), so this is a nudge, not an error: say what connecting unlocks.
  const publicOnly = apps.filter(
    (a) =>
      a.platform === "google_play" &&
      a.last_sync_status === "success" &&
      (a.last_sync_review_count ?? 0) > 0 &&
      a.publisher_api_connected !== true,
  );

  if (publicOnly.length > 0) {
    const app = publicOnly[0];
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#0A84FF]/20 bg-[#0A84FF]/[0.04] px-4 py-2.5">
        <Sparkles className="size-4 shrink-0 text-[#0A84FF]" />
        <div className="min-w-0 flex-1">
          <span className="text-rb-base font-medium text-fg-1">
            {app.name} is showing public Play Store data
          </span>
          <span className="ml-2 hidden text-rb-sm text-fg-3 sm:inline">
            Connect your Play Console to reply to reviews and sync everything automatically.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={onConnectPlayConsole}
            className={`${actionBtn} bg-[#0A84FF] text-white hover:bg-[#0070e0]`}
          >
            Connect Play Console
          </button>
          <Link
            href="/help/connect-google-play"
            className="shrink-0 text-rb-xs font-medium text-fg-3 hover:text-fg-2"
          >
            How it works →
          </Link>
        </div>
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
  const { apps, isLoading: appsLoading, isError: appsError, refetch: refetchApps } = useApps();
  // Scope the numbers to the sidebar's app selector. The dashboard was the
  // one screen that ignored it: a two-app workspace showed a single blended
  // rating (dominated by whichever app has the bigger store review count) and
  // switching apps changed nothing.
  const selectedApp = useWorkspaceStore((s) => s.selectedApp);
  const { appId: selectedAppId, appName: selectedAppName } = resolveSelectedApp(apps, selectedApp);
  const { data: metrics, isLoading, refetch: refetchMetrics } = useDashboardMetrics(selectedAppId);
  const { data: incidents, isError: incidentsError } = useIncidents();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
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

  // "Enrichment is running" was inferred purely from the Knowledge Base being
  // empty — a condition that is also true when enrichment finished and simply
  // produced nothing (Gemini returns no entries, or the call failed and was
  // swallowed). Nothing ever cleared it, so the banner promised "about 10
  // seconds" indefinitely and polled every 8s forever. It has to be bounded by
  // something that ends.
  //
  // Enrichment runs as part of a sync, so it can only be in flight shortly
  // after one. Outside that window an empty Knowledge Base means "no Knowledge
  // Base", not "still working".
  const ENRICH_WINDOW_MS = 5 * 60 * 1000;
  const lastSyncedAt = apps.reduce<number | null>((latest, a) => {
    if (!a.last_synced_at) return latest;
    const t = new Date(a.last_synced_at).getTime();
    return latest === null || t > latest ? t : latest;
  }, null);
  const syncedRecently = lastSyncedAt !== null && Date.now() - lastSyncedAt < ENRICH_WINDOW_MS;

  const checkEnrichment = useCallback(async () => {
    try {
      const res = await fetch("/api/reply-kit/knowledge-base");
      if (!res.ok) return;
      const data = (await res.json()) as { entries?: unknown[] };
      const hasEntries = Array.isArray(data.entries) && data.entries.length > 0;
      setAiEnriching(!hasEntries && syncedRecently);
    } catch {
      setAiEnriching(false);
    }
  }, [syncedRecently]);

  useEffect(() => {
    if (!firstSyncDone || totalReviews === 0) return;
    void checkEnrichment();
  }, [firstSyncDone, totalReviews, checkEnrichment]);

  useEffect(() => {
    if (!aiEnriching) return;
    // Second bound, belt and braces: stop after ~2 minutes even if the sync
    // timestamp keeps looking fresh. A spinner with no end state is worse than
    // no spinner — it reads as the whole product being stuck.
    let polls = 0;
    const id = setInterval(() => {
      polls += 1;
      if (polls > 15) {
        setAiEnriching(false);
        clearInterval(id);
        return;
      }
      void checkEnrichment();
    }, 8_000);
    return () => clearInterval(id);
  }, [aiEnriching, checkEnrichment]);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      // Export what the screen is showing. Every KPI above this button is
      // scoped to the selected app; the CSV was not, so a user looking at
      // app B's numbers downloaded a file containing app A as well.
      const res  = await fetch(
        `/api/reports/export?days=30${selectedAppId ? `&appId=${encodeURIComponent(selectedAppId)}` : ""}`,
      );
      // On failure this route returns a JSON error envelope. Without this
      // check it was blobbed and saved as `reviews-<date>.csv`, so the user
      // got a file full of {"error":…} and believed the export had worked.
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setExportError(apiErrorMessage(body, "Export failed. Please try again."));
        return;
      }
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = href;
      // Name the scope in the filename — the file outlives the screen that
      // produced it, and no column inside says which app it covers.
      a.download = exportFileName(selectedAppName, selectedAppId);
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
  // The hero is the STORE's rating — the number the customer sees on their
  // listing and gets judged by. It is deliberately NOT allowed to fall back to
  // the 30-day average, because the second row already shows that: falling back
  // printed the same figure twice under two different labels, which reads as
  // broken and hides that we simply have not scraped the store yet.
  const storeRating    = metrics?.lifetimeRating ?? null;
  // Name the source. "As shown on Google Play" tells the reader why this number
  // differs from the 30-day average below it; "the store" would not. When one
  // app is selected, the source is that app's store — not the whole portfolio.
  const scopedApps     = selectedAppId ? apps.filter((a) => a.id === selectedAppId) : apps;
  const platforms      = new Set(scopedApps.map((a) => a.platform));
  const storeName      =
    platforms.size === 1
      ? (platforms.has("app_store") ? "the App Store" : "Google Play")
      : "the stores";
  // "As shown on X" is only true when the number IS one listing's figure. The
  // all-apps view of a multi-app workspace averages listings (weighted by
  // review count), and claiming a store shows that number would be the exact
  // lie the store-vs-synced split exists to prevent.
  const ratingIsOneListing = selectedAppId !== undefined || apps.length === 1;
  const displayReviews = metrics?.lifetimeReviewCount ?? metrics?.totalReviews ?? 0;
  // What we hold in the DB for this storefront, as opposed to the store's
  // global lifetime figure above.
  const syncedReviews  = metrics?.totalReviews ?? 0;
  const reviewsAreLifetime = metrics?.lifetimeReviewCount != null;
  const unreplied      = metrics?.unrepliedCount ?? 0;
  const urgent         = metrics?.urgentCount ?? 0;
  const reviewsToday   = metrics?.reviewsToday ?? 0;
  const aiDrafts       = metrics?.aiDraftsThisWeek ?? 0;
  const reviewsWeekDelta = metrics?.reviewsWeekDelta ?? null;
  const avgRatingDelta   = metrics?.avgRatingDelta ?? null;
  const ratingTrend      = metrics?.ratingTrend ?? [];
  const reviewsThisWeek  = metrics?.reviewsThisWeek ?? 0;
  const ratingIsLifetime = metrics?.lifetimeRating != null;
  // Row 2 keeps the 30-day average, which is a different question:
  // "how are we doing lately" rather than "what does the store say".

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
      sub: selectedAppId ? "for this app" : "across all apps",
    },
    {
      icon: Star,
      label: "Avg. rating",
      value: avgRating !== null ? avgRating.toFixed(2) : "—",
      delta: formatDelta(avgRatingDelta),
      kind: avgRatingDeltaKind,
      sub: "last 30 days",
    },
    {
      icon: TrendingUp,
      // Was "Reviews today" with a week-over-week delta beside it — "0" next to
      // "+8% vs last week" reads as a made-up number because the two halves are
      // measuring different periods. The delta describes the week, so the
      // headline does too, and today's count moves to the subtitle.
      label: "Reviews this week",
      value: String(reviewsThisWeek),
      delta: formatDelta(reviewsWeekDelta, "%"),
      kind: reviewsDeltaKind,
      sub: `${reviewsToday} today${reviewsWeekDelta !== null ? " · vs last week" : ""}`,
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

  // "Couldn't load your apps" and "you have no apps" are different states and
  // must not render the same screen: showing the first-run welcome to an
  // existing customer reads as "my workspace was wiped".
  if (!appsLoading && appsError) {
    return (
      <div className="flex w-full flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-rb-lg font-semibold text-fg-1">We couldn&apos;t load your apps</p>
        <p className="max-w-md text-rb-sm text-fg-3">
          This is a problem on our side, not with your workspace — your apps and reviews are safe.
        </p>
        <Button onClick={() => refetchApps()} size="sm" className="mt-1">
          Try again
        </Button>
      </div>
    );
  }

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
          className="flex h-9 w-fit items-center gap-1.5 rounded-lg border border-[var(--rb-border-3)] bg-surface px-4 text-[13px] font-medium text-fg-2 transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
        >
          <Download className="size-3.5" />
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
      </header>
      {exportError !== null && (
        <div
          role="alert"
          className="rounded-lg border border-[var(--rb-red-500)]/25 bg-[var(--rb-red-500)]/10 px-4 py-2 text-rb-sm font-medium text-[var(--rb-red-500)]"
        >
          {exportError}
        </div>
      )}
      {/* ── One status strip: errors > syncing > quiet > AI prep > connect nudge ── */}
      <WorkspaceStatusStrip
        apps={apps}
        onRetry={handleRetry}
        onConnectPlayConsole={() => setSetupModalOpen(true)}
        onOpenSetup={() => setSetupModalOpen(true)}
      />

      {/* ── AI enrichment banner ── */}
      {aiEnriching === true && (
        <div className="flex items-start gap-3 rounded-xl border border-[#0A84FF]/20 bg-[#0A84FF]/[0.04] px-4 py-3">
          <Bot className="mt-0.5 size-4 shrink-0 animate-pulse text-[#0A84FF]" />
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-fg-1">
              AI is preparing your workspace…
            </div>
            <div className="mt-0.5 text-[11px] text-fg-3">
              Gemini is reading your reviews and generating your Knowledge Base and reply templates. This takes about 10 seconds.
            </div>
          </div>
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-[#0A84FF]" />
        </div>
      )}

      {/* ── Hero — portfolio rating ── */}
      <section className="grid grid-cols-1 gap-6 rounded-2xl border border-[var(--rb-border-1)] bg-surface px-5 py-5 shadow-[var(--rb-shadow-xs)] sm:grid-cols-[minmax(0,260px)_1fr] sm:items-center sm:gap-8 sm:px-8 sm:py-7">
        <div>
          <div className="text-xs font-medium text-fg-3 uppercase tracking-[0.06em]">
            {ratingIsLifetime ? "Store rating · all-time" : "Store rating"}
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-5xl font-semibold leading-none tracking-[-0.04em] tabular-nums text-fg-1 sm:text-[60px]">
              {storeRating !== null ? storeRating.toFixed(2) : "—"}
            </span>
            {storeRating !== null && (
              <div className="mb-1 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg
                    key={i}
                    className={cn("size-4", i < Math.round(storeRating) ? "text-amber-400" : "text-[var(--rb-border-2)]")}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            )}
          </div>
          {/* No delta here on purpose. The only rating change we can compute is
              over the last 30 days of synced reviews, and pinning that to an
              all-time store figure states two different measurements as one
              fact — the same mistake as the old "Reviews today · +8% vs last
              week" tile. The 30-day movement has its own tile below. */}
          <div className="mt-3 text-xs text-fg-3">
            {storeRating !== null
              ? `${
                  ratingIsOneListing
                    ? `As shown on ${storeName}`
                    : `Weighted across your ${apps.length} apps — pick one in the sidebar for its own rating`
                }${reviewsAreLifetime ? ` · ${displayReviews.toLocaleString()} ratings` : ""}`
              : "We haven't read your store listing yet. Run a sync from Settings → Apps."}
          </div>
          <p className="mt-4 max-w-[240px] text-[13px] leading-relaxed text-fg-3">
            {/* An empty workspace is not an inbox-zero achievement — congratulating
                someone for replying to reviews they don't have reads as broken. */}
            {totalReviews === 0
              ? "No reviews synced yet. Connect your store to start tracking."
              : unreplied > 0
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
                  : incidentsError
                    ? "Unavailable"
                    : "Loading…"}
              </div>
            </div>
            <Link href="/incidents" className="ml-auto text-xs font-semibold text-[#0A84FF] hover:underline">
              View all →
            </Link>
          </div>
          {/* The error branch matters: useIncidents() throws on a failed fetch,
              so `incidents` stays undefined forever and this card used to sit
              on skeletons permanently with no way out. */}
          {!incidents && incidentsError ? (
            <div className="flex flex-col items-center justify-center gap-1 py-10 text-center">
              <div className="text-[13px] font-medium text-fg-2">Couldn&apos;t load incidents</div>
              <div className="mt-1 text-[11px] text-fg-3">
                This section is temporarily unavailable — nothing is wrong with your workspace.
              </div>
            </div>
          ) : !incidents ? (
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
                      <AlertOctagon className="size-3.5" />
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
            <Link href="/settings?tab=integrations" className="ml-auto text-xs font-semibold text-[#0A84FF] hover:underline">
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
              <Link href="/settings?tab=integrations" className="text-[#0A84FF] hover:underline">Add one →</Link>
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

      {/* ── AI Review Summary — scoped to the same app selection as the metrics ── */}
      <AiSummaryPanel appId={selectedAppId} />

      {/* ── 3-column bottom ── */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Ratings */}
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface p-5 shadow-[var(--rb-shadow-xs)]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-fg-1">Ratings</span>
            {/* Alert preferences live in Settings — /alerts is not a route */}
            <Link href="/settings" className="text-[11px] font-medium text-[#0A84FF] hover:underline">Set alert →</Link>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-[36px] font-semibold tabular-nums leading-none text-fg-1">
              {avgRating != null ? avgRating.toFixed(1) : "—"}
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
          {/* The big number is the store's lifetime, global count; everything
              below it (and the inbox behind "View all") is the subset we have
              actually synced for this storefront. Printing them together with
              no qualifier made an app with 12,400 lifetime reviews and 40
              synced rows look like the sync had lost data. */}
          {reviewsAreLifetime && (
            <div className="text-[11px] text-fg-3">all-time (store)</div>
          )}
          <div className="flex gap-3 text-[11px] text-fg-3">
            <span>{syncedReviews.toLocaleString()} synced</span>
            <span>·</span>
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
