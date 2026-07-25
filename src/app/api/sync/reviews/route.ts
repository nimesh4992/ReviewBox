import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { fetchReviews as fetchGooglePlayReviews } from "@/services/google-play/publisher-api";
import {
  buildJWT,
  fetchAppStoreId,
  fetchReviews as fetchAppStoreReviews,
} from "@/services/app-store/connect-api";
import { fetchGooglePlayMetadata, fetchAppStoreMetadata } from "@/services/store-search";
import { buildEnrichedRow } from "@/lib/review-mapper";
import { bootstrapReviews } from "@/services/bootstrap-reviews";
import { planSyncWrites, mergeReviewRows } from "@/lib/sync-writes";
import { sendRatingSpikeAlert } from "@/lib/email/send-rating-spike-alert";
import { notifyRatingSpike, notifyUrgentReview } from "@/lib/slack";
import { runAutomationRules } from "@/lib/automation-executor";
import {
  generateKbEntriesFromReviews,
  generateTemplatesFromReviews,
} from "@/lib/gemini";
import { Redis } from "@upstash/redis";
import type { AppReview } from "@/types/review";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

function getRedis(): Redis | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // If CRON_SECRET is not configured:
  //   - In production: FAIL CLOSED. A missing secret must never grant
  //     coordinator mode (sync ALL workspaces) or arbitrary ?workspaceId=
  //     syncs to an unauthenticated caller. Callers fall back to the Clerk
  //     session path, which pins them to their own workspace.
  //   - In dev / preview: allow through so local onboarding-triggered syncs
  //     aren't blocked before the env var is set.
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

interface DbApp {
  id: string;
  workspace_id: string;
  name: string;
  platform: "google_play" | "app_store";
  store_id: string;
  access_token: string | null;        // App Store: JSON { keyId, issuerId }
  refresh_token: string | null;       // App Store: .p8 private key
  last_sync_attempted_at: string | null;
  last_synced_at: string | null;      // timestamp of last SUCCESSFUL sync
}

interface SyncSummary {
  appsProcessed: number;
  reviewsUpserted: number;
  spikesDetected: number;
  errors: string[];
}

// Per-app outcome returned by each sync function. Used to record per-app status
// locally rather than diffing the shared mutable `summary` (which races under
// the concurrent Promise.allSettled fanout — wrong counts/status attribution).
interface AppSyncResult {
  reviewCount: number;
  error?: string;
}

// ── Metadata refresh (lifetime rating + review count) ────────────────────────
//
// Runs best-effort before each review fetch. Keeps apps.lifetime_rating and
// apps.lifetime_review_count in sync with what users actually see on the
// store, regardless of how many reviews the API returns per call.

async function refreshAppMetadata(app: DbApp): Promise<void> {
  const sb = getServiceClient();
  try {
    const meta =
      app.platform === "google_play"
        ? await fetchGooglePlayMetadata(app.store_id)
        : await fetchAppStoreMetadata(app.store_id);
    if (!meta) return;

    const update: Record<string, unknown> = {};
    if (meta.rating      !== null) update.lifetime_rating       = meta.rating;
    if (meta.reviewCount !== null) update.lifetime_review_count = meta.reviewCount;
    if (meta.icon)                 update.icon_url              = meta.icon;
    if (meta.developer)            update.developer             = meta.developer;
    if (Object.keys(update).length === 0) return;

    await sb.from("apps").update(update).eq("id", app.id);
  } catch (err) {
    // Non-fatal — review sync still proceeds if the scrape fails
    console.warn(`[sync] metadata refresh failed for app ${app.id}:`, err);
  }
}

// ── Google Play sync ───────────────────────────────────────────────────────────

/**
 * Draft Mode (D018): the PUBLIC SCRAPER is the primary sync path.
 *
 * The launch tier requires zero store credentials from the customer, so the
 * scraper must run on EVERY sync — not just the first one. Previously the
 * scraper only ran when the app had zero reviews, and every subsequent sync
 * went straight to the Publisher API. For any customer who had not invited our
 * service account to their Play Console (i.e. the documented launch path) that
 * meant:
 *   - reviews stopped updating permanently after day one, and
 *   - last_sync_status was pinned to a failure code, which drove a red
 *     dashboard banner and a "hasn't synced in 2 days" nag email every 3 days.
 *
 * The Publisher API is still used when it is available because it carries data
 * the public page does not (developer replies, device). Its rows take
 * precedence for any review both sources return. When it is unavailable the
 * sync still succeeds on scraper data alone.
 */
async function syncGooglePlayApp(app: DbApp, summary: SyncSummary, isFirstSync: boolean): Promise<AppSyncResult> {
  const [, scraped, apiReviews] = await Promise.all([
    refreshAppMetadata(app),
    // Public scrape — no credentials. Failure here is fatal only if the API
    // path also produced nothing.
    bootstrapReviews("google_play", app.id, app.workspace_id, app.store_id).catch((err) => {
      console.warn(`[sync] gplay scrape failed for ${app.store_id}:`, err instanceof Error ? err.message : err);
      return null;
    }),
    // Official Publisher API — optional. Absent/unauthorized credentials are
    // an expected state in Draft Mode, not an error.
    fetchGooglePlayReviews(app.store_id).catch((err) => {
      console.warn(`[sync] gplay publisher API unavailable for ${app.store_id}:`, err instanceof Error ? err.message : err);
      return null;
    }),
  ]);

  if (scraped === null && apiReviews === null) {
    return { reviewCount: 0, error: `Google Play app ${app.id}: both public scrape and Publisher API failed` };
  }

  const apiRows = (apiReviews ?? [])
    // Skip rows with no reviewId — an empty external_id collapses every such
    // review onto a single row under onConflict "app_id,external_id" (data loss).
    .filter((r) => !!r.reviewId)
    .map((r) => {
      const uc  = r.comments?.[0]?.userComment;
      const dc  = r.comments?.[0]?.developerComment;
      const at  = uc?.lastModified?.seconds
        ? new Date(Number(uc.lastModified.seconds) * 1000).toISOString()
        : new Date().toISOString();

      return buildEnrichedRow(
        app.id, app.workspace_id,
        r.reviewId as string,
        "google_play",
        r.authorName ?? "Anonymous",
        uc?.starRating ?? 3,
        uc?.text ?? "",
        uc?.appVersionName ?? null,
        uc?.device ?? null,
        null,
        at,
        !!dc,
        dc?.text ?? null,
      );
    });

  // Scraper first, then let Publisher API rows win on the same external_id —
  // they carry developer replies and device, which the public page lacks.
  return upsertAndFinalize(app, mergeReviewRows(scraped, apiRows), summary, isFirstSync);
}

// ── App Store sync ────────────────────────────────────────────────────────────

/**
 * Same Draft Mode contract as Google Play (D018): the public iTunes RSS feed is
 * the primary path and needs no credentials. App Store Connect API credentials
 * are optional and only add developer-reply state.
 */
async function syncAppStoreApp(app: DbApp, summary: SyncSummary, isFirstSync: boolean): Promise<AppSyncResult> {
  const [, scraped] = await Promise.all([
    refreshAppMetadata(app),
    bootstrapReviews("app_store", app.id, app.workspace_id, app.store_id).catch((err) => {
      console.warn(`[sync] app store RSS failed for ${app.store_id}:`, err instanceof Error ? err.message : err);
      return null;
    }),
  ]);

  // Official Connect API — optional in Draft Mode. Missing or broken
  // credentials must not fail the sync when the public feed worked.
  const apiRows = await fetchAppStoreApiRows(app).catch((err) => {
    console.warn(`[sync] app store Connect API unavailable for ${app.store_id}:`, err instanceof Error ? err.message : err);
    return null;
  });

  if (scraped === null && apiRows === null) {
    return { reviewCount: 0, error: `App Store app ${app.id}: both public feed and Connect API failed` };
  }

  return upsertAndFinalize(app, mergeReviewRows(scraped, apiRows), summary, isFirstSync);
}

/**
 * Fetch reviews via the App Store Connect API. Returns null when the workspace
 * has not supplied credentials — an expected, non-error state in Draft Mode.
 * Throws only on a genuine API failure so the caller can log it.
 */
async function fetchAppStoreApiRows(
  app: DbApp,
): Promise<ReturnType<typeof buildEnrichedRow>[] | null> {
  if (!app.access_token || !app.refresh_token) return null;

  let creds: { keyId: string; issuerId: string };
  try {
    creds = JSON.parse(app.access_token) as { keyId: string; issuerId: string };
  } catch {
    throw new Error("invalid access_token JSON");
  }

  const jwt = await buildJWT(creds.keyId, creds.issuerId, app.refresh_token);
  const appStoreId = await fetchAppStoreId(app.store_id, jwt);
  if (!appStoreId) {
    throw new Error(`could not resolve app ID for ${app.store_id}`);
  }

  const ascReviews = await fetchAppStoreReviews(appStoreId, jwt);

  return ascReviews
    .filter((r) => !!r.id)
    .map((r) => {
      const hasReply = !!r.relationships?.response?.data;
      return buildEnrichedRow(
        app.id, app.workspace_id,
        r.id,
        "app_store",
        r.attributes.reviewerNickname ?? "Anonymous",
        r.attributes.rating,
        [r.attributes.title, r.attributes.body].filter(Boolean).join("\n\n"),
        null,
        null,
        r.attributes.territory ?? null,
        r.attributes.createdDate,
        hasReply,
        null,
      );
    });
}

// ── Upsert + spike detection (shared) ─────────────────────────────────────────

async function upsertAndFinalize(
  app: DbApp,
  rows: ReturnType<typeof buildEnrichedRow>[],
  summary: SyncSummary,
  isFirstSync: boolean,
): Promise<AppSyncResult> {
  const sb = getServiceClient();

  if (!rows.length) return { reviewCount: 0 };

  // ── Split new vs already-known reviews ────────────────────────────────────
  //
  // A blanket `upsert(rows, { onConflict: "app_id,external_id" })` rewrites
  // EVERY column of an existing row from freshly-scraped store data, including
  // reply_status and reply_text. Those two are user-owned: a saved AI draft
  // (draft_ready) or a Draft Mode "mark as replied" would be silently reset to
  // needs_reply / null on the very next sync. The iTunes RSS feed never
  // reports developer replies at all, so every App Store review was reset
  // daily, including ones replied to through the Connect API.
  //
  // So: insert genuinely new reviews, and for known ones touch only the
  // store-owned content columns. Reply state is promoted to "replied" only
  // when the store now shows a developer reply we did not already have — it is
  // never downgraded.
  const externalIds = rows.map((r) => r.external_id);
  const existing = new Map<string, { id: string; reply_status: string }>();

  // Chunked so a busy app doesn't build an over-long PostgREST `in.()` filter.
  for (let i = 0; i < externalIds.length; i += 200) {
    const { data, error: lookupError } = await sb
      .from("reviews")
      .select("id, external_id, reply_status")
      .eq("app_id", app.id)
      .in("external_id", externalIds.slice(i, i + 200));

    if (lookupError) {
      const msg = `app ${app.id}: ${lookupError.message}`;
      summary.errors.push(msg);
      return { reviewCount: 0, error: msg };
    }
    for (const r of data ?? []) {
      existing.set(r.external_id as string, {
        id: r.id as string,
        reply_status: r.reply_status as string,
      });
    }
  }

  const { inserts: newRows, promotions } = planSyncWrites(rows, existing);

  if (newRows.length) {
    // ignoreDuplicates guards the race where a concurrent sync inserted the
    // same review between our lookup and this write — it must not clobber.
    const { error } = await sb
      .from("reviews")
      .upsert(newRows, { onConflict: "app_id,external_id", ignoreDuplicates: true });

    if (error) {
      const msg = `app ${app.id}: ${error.message}`;
      summary.errors.push(msg);
      return { reviewCount: 0, error: msg };
    }
  }

  // Promote known reviews that the store now shows a developer reply for.
  // planSyncWrites() guarantees these are all needs_reply → replied; it never
  // downgrades a user-owned draft_ready or replied.
  if (promotions.length) {
    await Promise.allSettled(
      promotions.map((p) =>
        sb
          .from("reviews")
          .update({
            reply_status: "replied",
            reply_text:   p.replyText,
            replied_at:   new Date().toISOString(),
          })
          .eq("id", p.id)
          // Re-assert the precondition at write time so a reply the user saved
          // between our lookup and now isn't overwritten.
          .eq("reply_status", "needs_reply"),
      ),
    );
  }

  summary.appsProcessed++;
  summary.reviewsUpserted += newRows.length;
  // last_synced_at is written by recordSyncResult() after all processing completes

  // Fire Gemini onboarding enrichment once, on the first sync that produced data.
  // Generates KB entries + reply templates from the workspace's real reviews.
  if (isFirstSync && newRows.length) {
    enrichOnboarding(
      app.workspace_id,
      app.name,
      newRows.map((r) => ({ text: r.body ?? "", rating: r.rating })),
    ).catch((err) =>
      console.warn("[sync] enrich:", err instanceof Error ? err.message : err),
    );
  }

  // Run automation rules on NEWLY synced reviews only. Running them over every
  // row each sync would re-fire auto-draft / auto-reply on the same months-old
  // reviews every single day.
  const unrepliedReviews: AppReview[] = newRows
    .filter((r) => r.reply_status === "needs_reply")
    .map((r) => ({
      id:              r.external_id,
      author:          r.author,
      rating:          r.rating,
      text:            r.body,
      appVersion:      r.app_version ?? "",
      device:          r.device ?? "",
      country:         r.country ?? "",
      issueTags:       r.issue_tags as AppReview["issueTags"],
      sentiment:       r.sentiment as AppReview["sentiment"],
      priority:        r.priority as AppReview["priority"],
      replyStatus:     "needs_reply" as const,
      escalationState: r.escalation_state as AppReview["escalationState"],
      createdAt:       r.store_created_at,
      source:          (r.source === "google_play" ? "Google Play" : "App Store") as AppReview["source"],
      hasAiSuggestion: false,
    }));

  if (unrepliedReviews.length) {
    runAutomationRules(app.workspace_id, unrepliedReviews, app.id).catch(
      (e) => console.error("[sync] automation rules:", e),
    );
  }

  // Urgent review → Slack with per-review dedup (48h TTL)
  const urgentNew = unrepliedReviews.filter((r) => r.priority === "urgent");
  for (const r of urgentNew.slice(0, 3)) {
    void notifyUrgentReview(app.workspace_id, r.id, {
      author:    r.author,
      rating:    r.rating,
      text:      r.text,
      appName:   app.name,
      reviewUrl: `${APP_URL}/reviews`,
    });
  }

  // Rating spike detection — ≥5 reviews rated ≤2★ for same version in 24h
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: spikeRows } = await sb
    .from("reviews")
    .select("app_version")
    .eq("app_id", app.id)
    .lte("rating", 2)
    .gte("store_created_at", since)
    .not("app_version", "is", null);

  if (spikeRows?.length) {
    const counts = spikeRows.reduce<Record<string, number>>((acc, r) => {
      const v = r.app_version as string;
      acc[v] = (acc[v] ?? 0) + 1;
      return acc;
    }, {});

    for (const [version, count] of Object.entries(counts)) {
      if (count >= 5) {
        summary.spikesDetected++;
        notifyWorkspaceOwner(app.workspace_id, app.id, app.name, version, count).catch(
          (e) => console.error("[sync] spike notify:", e),
        );
      }
    }
  }

  return { reviewCount: rows.length };
}

// ── Worker: sync one workspace's apps ──────────────────────────────────────────

/**
 * Classify a raw error message into an actionable status code + user-friendly
 * message. The dashboard surfaces the message directly so the user knows what
 * to do (e.g. "Invite this email to Play Console").
 */
function classifySyncError(
  platform: "google_play" | "app_store",
  errMsg: string,
): { status: string; message: string } {
  const lower = errMsg.toLowerCase();

  if (platform === "google_play") {
    if (lower.includes("403") || lower.includes("permission") || lower.includes("forbidden")) {
      return {
        status: "needs_play_console_access",
        message:
          "Google Play Console hasn't authorized ReviewBox yet. Open Settings → Apps to find the service account email — invite it to your Play Console with View+Reply permissions.",
      };
    }
    if (lower.includes("401") || lower.includes("unauthorized")) {
      return {
        status: "google_credentials_invalid",
        message:
          "Google service account credentials are invalid. Contact support — this is on our side.",
      };
    }
    if (lower.includes("404") || lower.includes("not found")) {
      return {
        status: "package_not_found",
        message:
          "Google Play couldn't find this app's package name. Double-check the package ID in Settings → Apps.",
      };
    }
  }

  if (platform === "app_store") {
    if (lower.includes("missing credentials")) {
      return {
        status: "needs_app_store_credentials",
        message:
          "App Store needs API credentials. Open Settings → Apps → expand this app and paste your .p8 key, Key ID, and Issuer ID.",
      };
    }
    if (lower.includes("could not resolve app id")) {
      return {
        status: "bundle_id_not_found",
        message:
          "App Store Connect couldn't find this bundle ID under your API key. Check that the key has access to this app.",
      };
    }
    if (lower.includes("401") || lower.includes("403")) {
      return {
        status: "app_store_unauthorized",
        message:
          "App Store API key is invalid or doesn't have permission. Regenerate the key in App Store Connect and re-upload.",
      };
    }
  }

  return {
    status: "store_api_error",
    message: errMsg.slice(0, 300),
  };
}

async function recordSyncResult(
  appId: string,
  result:
    | { ok: true; reviewCount: number }
    | { ok: false; platform: "google_play" | "app_store"; errMsg: string },
): Promise<void> {
  // The public scrape is the primary data path (D018), so a sync that produced
  // nothing is now the loudest signal that the product has stopped working for
  // a customer. Without this it was a console.warn nobody reads: reviews would
  // quietly stop arriving and the first we'd hear is a churn email.
  if (!result.ok) {
    Sentry.captureMessage(`[sync] app ${appId} failed: ${result.errMsg}`, {
      level: "error",
      tags: { route: "api/sync/reviews", platform: result.platform },
    });
  }
  const sb = getServiceClient();
  const now = new Date().toISOString();

  if (result.ok) {
    await sb
      .from("apps")
      .update({
        last_synced_at:         now,
        // last_sync_attempted_at already written at sync start — don't overwrite
        last_sync_status:       "success",
        last_sync_error:        null,
        last_sync_review_count: result.reviewCount,
      })
      .eq("id", appId);
    return;
  }

  const classified = classifySyncError(result.platform, result.errMsg);
  await sb
    .from("apps")
    .update({
      // last_sync_attempted_at already written at sync start — don't overwrite
      last_sync_status: classified.status,
      last_sync_error:  classified.message,
    })
    .eq("id", appId);
}

async function syncWorkspace(workspaceId: string): Promise<SyncSummary> {
  const sb = getServiceClient();
  const summary: SyncSummary = { appsProcessed: 0, reviewsUpserted: 0, spikesDetected: 0, errors: [] };

  const { data: apps } = await sb
    .from("apps")
    .select("id, workspace_id, name, platform, store_id, access_token, refresh_token, last_sync_attempted_at, last_synced_at")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .not("store_id", "is", null)
    .not("store_id", "eq", "");

  if (!apps?.length) return summary;

  // Process all apps in parallel — each app's sync is independent.
  // Promise.allSettled so one failing app never blocks the others.
  await Promise.allSettled(
    (apps as DbApp[]).map(async (app) => {
      try {
        // ── FIRST: stamp attempted_at immediately ─────────────────────────────
        // This is the fix for "sync banner on every login". The banner checks
        // last_sync_attempted_at === null to decide whether to show. By writing
        // this BEFORE any API calls, the banner disappears even if bootstrap or
        // the Publisher API times out or throws — the user never sees a stuck
        // "Syncing…" on their next login.
        await sb
          .from("apps")
          .update({ last_sync_attempted_at: new Date().toISOString() })
          .eq("id", app.id);

        // First sync = the app has ZERO reviews in the DB (not merely that
        // last_sync_attempted_at was null), so a retry after a failed first
        // sync doesn't re-run onboarding enrichment on an already-seeded app.
        // The public scrape itself now runs on EVERY sync (D018 Draft Mode) —
        // see syncGooglePlayApp / syncAppStoreApp.
        const { count: existingReviewCount } = await sb
          .from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("app_id", app.id);

        const isFirstSync = (existingReviewCount ?? 0) === 0;

        // Per-app result tracked locally — no cross-app race via shared summary.
        const result: AppSyncResult =
          app.platform === "google_play" ? await syncGooglePlayApp(app, summary, isFirstSync)
          : app.platform === "app_store" ? await syncAppStoreApp(app, summary, isFirstSync)
          : { reviewCount: 0 };

        if (result.error) {
          await recordSyncResult(app.id, { ok: false, platform: app.platform, errMsg: result.error });
        } else {
          await recordSyncResult(app.id, { ok: true, reviewCount: result.reviewCount });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        summary.errors.push(`${app.platform} app ${app.store_id}: ${msg}`);
        await recordSyncResult(app.id, { ok: false, platform: app.platform, errMsg: msg });
        console.error(`[sync] ${app.platform} ${app.store_id} failed:`, msg);
      }
    }),
  );

  return summary;
}

// ── Gemini onboarding enrichment ───────────────────────────────────────────────
//
// Runs once per workspace on first bootstrap. Generates:
//   1. KB entries — distilled knowledge from the first 40 reviews
//   2. Reply templates — 5 app-specific templates from common patterns
//
// Both are idempotent: we check existing counts before inserting so a retry
// or duplicate trigger doesn't create duplicate content.

async function enrichOnboarding(
  workspaceId: string,
  appName: string,
  reviews: Array<{ text: string; rating: number }>,
): Promise<void> {
  if (reviews.length === 0) return;
  const sb = getServiceClient();

  // ── KB entries ──────────────────────────────────────────────────────────────
  // Skip if the workspace already has KB content (idempotency guard).
  const { count: kbCount } = await sb
    .from("knowledge_base")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if ((kbCount ?? 0) === 0) {
    try {
      const entries = await generateKbEntriesFromReviews(reviews, appName);
      if (entries.length) {
        await sb.from("knowledge_base").insert(
          entries.map((e) => ({
            workspace_id: workspaceId,
            title:        e.title,
            content:      e.content,
            category:     e.category ?? "general",
          })),
        );
        console.log(`[enrich] ${workspaceId}: inserted ${entries.length} KB entries`);
      }
    } catch (err) {
      console.warn("[enrich] KB generation failed:", err instanceof Error ? err.message : err);
    }
  }

  // ── Reply templates ─────────────────────────────────────────────────────────
  // Only generate if the workspace has ≤5 templates (just the starter set).
  // Gemini adds 5 app-specific ones on top of the generic starters.
  const { count: templateCount } = await sb
    .from("reply_templates")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if ((templateCount ?? 0) <= 5) {
    try {
      const templates = await generateTemplatesFromReviews(reviews, appName);
      if (templates.length) {
        await sb.from("reply_templates").insert(
          templates.map((t) => ({
            workspace_id: workspaceId,
            name:         t.name,
            content:      t.content,
            tags:         t.tags,
            rating_min:   t.ratingMin,
            rating_max:   t.ratingMax,
            usage_count:  0,
          })),
        );
        console.log(`[enrich] ${workspaceId}: inserted ${templates.length} templates`);
      }
    } catch (err) {
      console.warn("[enrich] template generation failed:", err instanceof Error ? err.message : err);
    }
  }
}

// ── Main handler: coordinator | worker ─────────────────────────────────────────
//
// Worker mode  (?workspaceId=X) → sync that one workspace inline.
// Coordinator mode (no param)   → list active workspaces, fire one
//   worker request per workspace via fetch fanout, return immediately.
//   Each worker runs in its own Vercel invocation with its own 60s budget,
//   so we scale to ~500 workspaces per daily cron run without timeouts.

async function handler(req: NextRequest): Promise<NextResponse> {
  // Two ways to authenticate:
  // 1. Bearer CRON_SECRET — used by Vercel Cron and the onboarding/complete
  //    trigger. Grants access to coordinator mode (all workspaces) AND
  //    worker mode for any workspace.
  // 2. Signed-in Clerk user — used by "Sync now" buttons in the UI. Only
  //    allowed to sync their OWN workspace; the workspaceId param is
  //    overridden with the workspace they're a member of.
  const cronAuthed = isAuthorized(req);
  let workspaceId = req.nextUrl.searchParams.get("workspaceId");

  if (!cronAuthed) {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    // Resolve the user's own workspace — ignore any workspaceId in the URL
    // to prevent one user from syncing another workspace's reviews.
    workspaceId = await getWorkspaceId(session.userId);
    if (!workspaceId) {
      return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });
    }
  }

  // ── Worker mode ────────────────────────────────────────────────────────────
  if (workspaceId) {
    try {
      const summary = await syncWorkspace(workspaceId);
      return NextResponse.json({ ...summary, workspaceId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        { error: "WORKER_FAILED", workspaceId, message: msg },
        { status: 500 },
      );
    }
  }

  // ── Coordinator mode ──────────────────────────────────────────────────────
  // Only the cron can reach here (signed-in users get pinned to their own
  // workspace above and end up in worker mode).
  const sb = getServiceClient();
  const { data: workspaces } = await sb
    .from("workspaces")
    .select("id")
    .is("deleted_at", null);

  if (!workspaces?.length) {
    return NextResponse.json({ message: "No active workspaces to sync", workspacesQueued: 0 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_APP_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

  const secret = process.env.CRON_SECRET;
  const headers: HeadersInit = secret ? { authorization: `Bearer ${secret}` } : {};

  // Fanout: fire and forget. Each worker takes its own invocation budget.
  for (const ws of workspaces) {
    const url = `${baseUrl}/api/sync/reviews?workspaceId=${ws.id}`;
    void fetch(url, { method: "GET", headers }).catch((err) => {
      console.error(`[sync coordinator] failed to fanout ${ws.id}:`, err);
    });
  }

  return NextResponse.json({
    workspacesQueued: workspaces.length,
    coordinatedAt: new Date().toISOString(),
  });
}

// Vercel Cron uses GET. We also accept POST for manual triggers (curl/admin).
export const GET = handler;
export const POST = handler;

// ── Helpers ────────────────────────────────────────────────────────────────────

async function notifyWorkspaceOwner(
  workspaceId: string,
  appId: string,
  appName: string,
  version: string,
  count: number,
): Promise<void> {
  // Dedup the email: this runs on EVERY sync and the spike query re-counts the
  // same ≤2★ reviews for 24h, so without a guard the owner gets the same alert
  // on each sync. Redis SET NX with a 24h TTL ⇒ at most one email per
  // app+version per day. (Slack has its own 23h dedup in notifyRatingSpike.)
  const redis = getRedis();
  if (redis) {
    const key = `spike:email:${appId}:${version}`;
    const fresh = await redis.set(key, "1", { nx: true, ex: 24 * 60 * 60 });
    if (fresh === null) return; // already alerted within the last 24h
  }

  const sb = getServiceClient();
  const { data: member } = await sb
    .from("workspace_members")
    .select("clerk_user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();  // .single() throws PGRST116 when no owner row exists → noisy 500 logs

  if (!member) return;

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(member.clerk_user_id);
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return;

  // Email + Slack in parallel (both best-effort; Slack deduped per app+version for 23h)
  await Promise.allSettled([
    sendRatingSpikeAlert(email, appName, version, count),
    notifyRatingSpike(workspaceId, appId, {
      appName,
      avgRating: 1.5, // spike threshold is ≤2★ reviews
      reviewCount: count,
      appVersion: version,
    }),
  ]);
}
