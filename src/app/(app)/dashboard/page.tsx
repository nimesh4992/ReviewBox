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
import { resolveSelectedApp } from "@/lib/selected-app";
import { exportFileName } from "@/lib/export-filename";
import { useWorkspaceStore } from "@/store/use-workspace-store";
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";
import { useApps } from "@/hooks/use-apps";
import { useIncidents } from "@/hooks/use-incidents";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrialBanner } from "@/components/dashboard/trial-banner";
import { ReviewQuotaBanner } from "@/components/dashboard/review-quota-banner";
import { UpgradeToast } from "@/components/dashboard/upgrade-toast";
import { EmptyWorkspaceWelcome } from "@/components/dashboard/empty-workspace-welcome";
import { GooglePlaySetupModal } from "@/components/dashboard/google-play-setup-modal";
import { AiSummaryPanel } from "@/features/dashboard/components/ai-summary-panel";
import { PortfolioSparkline } from "@/components/dashboard/portfolio-sparkline";
import { WorkspaceStatusStrip } from "@/components/dashboard/workspace-status-strip";
import { KpiCard } from "@/components/dashboard/kpi-card";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#DC2626",
  high:     "#D97706",
  medium:   "#6B7280",
};

// ── Sparkline ─────────────────────────────────────────────────────────────────

function formatDelta(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${suffix}`;
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
  // A saved selection can't be resolved until the app list arrives. Firing
  // before then would request the UNSCOPED figures first and the scoped ones
  // a moment later — two round trips per page view, and for the AI summary
  // two generations against a 10/hour limit.
  const selectionResolved = !(appsLoading && !!selectedApp);
  const {
    data: metrics,
    isLoading,
    refetch: refetchMetrics,
    isStaleForApp,
  } = useDashboardMetrics(selectedAppId, { enabled: selectionResolved });
  const { data: incidents, isError: incidentsError } = useIncidents(selectedAppId);
  // Numbers belong to another app (or aren't loaded yet) → render them as
  // loading rather than as this app's figures.
  const metricsPending = isLoading || isStaleForApp || !selectionResolved;
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

  /**
   * Retry / "Sync now" on the status strip.
   *
   * Resolves to a short message to show the user, or null when there is
   * nothing worth saying. It never rejects — the strip renders whatever comes
   * back and clears its busy state either way.
   *
   * The previous version fired an un-awaited fetch with no `.catch()` at all,
   * then refetched on a blind 3-second timer. This is the button shown *when a
   * sync has already failed*, so it was the one place a second failure most
   * needed to be visible — and it was the only place in this file that
   * discarded it. Awaiting the request also means the refetch happens when the
   * sync has actually finished rather than 3 seconds later, whatever the state.
   */
  async function handleRetry(): Promise<string | null> {
    let res: Response;
    try {
      res = await fetch("/api/sync/reviews");
    } catch {
      return "Couldn’t reach the server. Check your connection and try again.";
    }

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      return apiErrorMessage(body, "Sync failed. Try again in a moment.");
    }

    const body = (await res.json().catch(() => null)) as { skipped?: string } | null;
    refetchApps();
    refetchMetrics();

    // Syncs are serialised per workspace (lib/sync-lock.ts). A declined run is
    // not a failure — the run holding the lock is fetching the same reviews —
    // but saying nothing makes the button look broken.
    return body?.skipped
      ? "A sync is already running — results will appear shortly."
      : null;
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
  // Did a sync actually TRY to read the listing, or has one never run?
  //
  // `metadata_refreshed_at` is the honest signal, but it isn't on the apps
  // payload; `last_sync_attempted_at` is, and for this message the distinction
  // that matters is "a sync has run and we still have no rating" versus "no
  // sync has run yet". Telling someone to run a sync that finished twenty
  // minutes ago and failed the same way is worse than saying nothing.
  const storeListingWasTried = scopedApps.some((a) => a.last_sync_attempted_at !== null);

  // Which country's listing we tried, when that's unambiguous. Both stores
  // publish per-country ratings, so "we couldn't read it" is far more useful
  // with the storefront attached — it is frequently the wrong country.
  const scopedCountries   = new Set(scopedApps.map((a) => a.store_country).filter(Boolean));
  const storeCountryLabel = scopedCountries.size === 1
    ? String([...scopedCountries][0]).toUpperCase()
    : null;

  // "As shown on X" is only true when the number IS one listing's figure. The
  // all-apps view of a multi-app workspace averages listings (weighted by
  // review count), and claiming a store shows that number would be the exact
  // lie the store-vs-synced split exists to prevent.
  //
  // Count the apps that actually CONTRIBUTED to the average, not the apps the
  // workspace owns: an app whose listing we haven't read yet has no rating and
  // is not in it. Captioning a single app's rating "weighted across your 2
  // apps" is the same species of untruth.
  const ratingAppCount     = metrics?.lifetimeRatingAppCount ?? 0;
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
      <ReviewQuotaBanner />

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
                    : ratingAppCount > 1
                      ? `Weighted across ${ratingAppCount} apps — pick one in the sidebar for its own rating`
                      // Several apps, but only one listing has been read. The
                      // figure is that one app's, so it must not be described
                      // as covering the portfolio.
                      : `From the one app whose listing we've read — pick an app in the sidebar for its own rating`
                }${reviewsAreLifetime ? ` · ${displayReviews.toLocaleString()} ratings` : ""}`
              : storeListingWasTried
                // A sync HAS run — it just came back with nothing usable from
                // the store listing. "We haven't read it yet" sent the founder
                // to re-run a sync that had finished twenty minutes earlier and
                // would fail the same way. Saying which storefront we tried is
                // the actionable part: it is often the wrong country.
                ? `We couldn't read the ${storeName || "store"} listing on the last sync${
                    storeCountryLabel ? ` (${storeCountryLabel} store)` : ""
                  }. The store may be rate-limiting us, or this app may live in a different country — you can change that in Settings → Apps.`
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
          <KpiCard key={s.label} {...s} loading={metricsPending} />
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
      <AiSummaryPanel appId={selectedAppId} enabled={selectionResolved} />

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
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-fg-3">
            <span>{syncedReviews.toLocaleString()} synced</span>
            <span>·</span>
            <span>{unreplied} unreplied</span>
            <span>·</span>
            <span>{urgent} urgent</span>
          </div>
          {/* The gap between the two numbers is the single most-asked support
              question, and without an answer next to it the honest reading is
              "the sync lost my reviews". Only shown when there IS a gap —
              offering to explain a discrepancy that isn't on screen invents
              a doubt rather than settling one. Opens in a new tab because
              /help is outside the app shell and losing the dashboard to read
              a help page is its own small annoyance. */}
          {reviewsAreLifetime && syncedReviews < displayReviews && (
            <a
              href="/help/review-history"
              target="_blank"
              rel="noreferrer"
              className="self-start text-[11px] font-medium text-[#0A84FF] hover:underline"
            >
              Why not all {displayReviews.toLocaleString()}?
            </a>
          )}
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
