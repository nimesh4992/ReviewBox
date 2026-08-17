"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertOctagon, Loader2, Sparkles } from "lucide-react";

import { isSyncFailureStatus } from "@/lib/sync-status";
import { useApps } from "@/hooks/use-apps";

/** Extracted verbatim from dashboard/page.tsx. See the note below — this
 *  component has been repaired after bad merges four separate times. */

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

/**
 * The Retry / "Sync now" button keeps its own busy + message state here rather
 * than taking them as props. dashboard/page.tsx has been mangled by bad merges
 * six times; widening its component signatures is how that keeps happening, so
 * the page hands over one async function and nothing else.
 *
 * `onRetry` resolves to a short message to show, or null for "done, nothing to
 * say". It is contracted never to reject.
 */
export function WorkspaceStatusStrip({
  apps,
  onRetry,
  onConnectPlayConsole,
  onOpenSetup,
}: {
  apps: ReturnType<typeof useApps>["apps"];
  onRetry: () => Promise<string | null>;
  onConnectPlayConsole: () => void;
  onOpenSetup: () => void;
}) {
  const [retrying, setRetrying] = useState(false);
  const [retryNote, setRetryNote] = useState<string | null>(null);

  async function runRetry() {
    if (retrying) return;
    setRetrying(true);
    setRetryNote(null);
    try {
      setRetryNote(await onRetry());
    } catch {
      // The contract says this can't happen; if it ever does, a wedged
      // spinner would be the worst outcome, so say something and move on.
      setRetryNote("Sync failed. Try again in a moment.");
    } finally {
      setRetrying(false);
    }
  }

  /**
   * Shared retry control — same behaviour wherever the strip offers one.
   *
   * A plain function returning JSX, NOT a nested component. A component
   * declared inside a render body is a new type on every render, so React
   * unmounts and remounts it — which would drop keyboard focus from this
   * button the instant `retrying` flips, i.e. exactly when someone has just
   * pressed it.
   */
  function retryControl(label: string, className: string) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        {retryNote && (
          <span className="hidden text-rb-xs text-fg-3 sm:inline" role="status">
            {retryNote}
          </span>
        )}
        <button onClick={runRetry} disabled={retrying} className={`${className} disabled:opacity-60`}>
          {retrying ? "Syncing…" : label}
        </button>
      </div>
    );
  }
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
          {retryControl("Retry", quietBtn)}
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
        {retryControl("Sync now", quietBtn)}
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
