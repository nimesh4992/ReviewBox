import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { fetchReviews as fetchGooglePlayReviews } from "@/services/google-play/publisher-api";
import {
  buildJWT,
  fetchAppStoreId,
  fetchReviews as fetchAppStoreReviews,
} from "@/services/app-store/connect-api";
import { buildEnrichedRow } from "@/lib/review-mapper";
import { bootstrapReviews } from "@/services/bootstrap-reviews";
import { sendRatingSpikeAlert } from "@/lib/email/send-rating-spike-alert";
import { notifySlack, ratingSpike as slackRatingSpike, urgentReview as slackUrgentReview } from "@/lib/slack";
import { runAutomationRules } from "@/lib/automation-executor";
import type { AppReview } from "@/types/review";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
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
}

interface SyncSummary {
  appsProcessed: number;
  reviewsUpserted: number;
  spikesDetected: number;
  errors: string[];
}

// ── Google Play sync ───────────────────────────────────────────────────────────

async function syncGooglePlayApp(app: DbApp, summary: SyncSummary) {
  const playReviews = await fetchGooglePlayReviews(app.store_id);
  if (!playReviews.length) return;

  const rows = playReviews.map((r) => {
    const uc  = r.comments?.[0]?.userComment;
    const dc  = r.comments?.[0]?.developerComment;
    const at  = uc?.lastModified?.seconds
      ? new Date(Number(uc.lastModified.seconds) * 1000).toISOString()
      : new Date().toISOString();

    return buildEnrichedRow(
      app.id, app.workspace_id,
      r.reviewId ?? "",
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

  await upsertAndFinalize(app, rows, summary);
}

// ── App Store sync ────────────────────────────────────────────────────────────

async function syncAppStoreApp(app: DbApp, summary: SyncSummary) {
  if (!app.access_token || !app.refresh_token) {
    summary.errors.push(`App Store app ${app.id}: missing credentials`);
    return;
  }

  let creds: { keyId: string; issuerId: string };
  try {
    creds = JSON.parse(app.access_token) as { keyId: string; issuerId: string };
  } catch {
    summary.errors.push(`App Store app ${app.id}: invalid access_token JSON`);
    return;
  }

  const jwt = await buildJWT(creds.keyId, creds.issuerId, app.refresh_token);
  const appStoreId = await fetchAppStoreId(app.store_id, jwt);
  if (!appStoreId) {
    summary.errors.push(`App Store app ${app.id}: could not resolve app ID for ${app.store_id}`);
    return;
  }

  const ascReviews = await fetchAppStoreReviews(appStoreId, jwt);
  if (!ascReviews.length) return;

  const rows = ascReviews.map((r) => {
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

  await upsertAndFinalize(app, rows, summary);
}

// ── Upsert + spike detection (shared) ─────────────────────────────────────────

async function upsertAndFinalize(
  app: DbApp,
  rows: ReturnType<typeof buildEnrichedRow>[],
  summary: SyncSummary,
) {
  const sb = getServiceClient();

  const { error } = await sb
    .from("reviews")
    .upsert(rows, { onConflict: "app_id,external_id" });

  if (error) {
    summary.errors.push(`app ${app.id}: ${error.message}`);
    return;
  }

  summary.appsProcessed++;
  summary.reviewsUpserted += rows.length;

  await sb.from("apps").update({ last_synced_at: new Date().toISOString() }).eq("id", app.id);

  // Run automation rules on newly synced reviews (only unreplied ones are candidates)
  const unrepliedReviews: AppReview[] = rows
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
    runAutomationRules(app.workspace_id, unrepliedReviews).catch(
      (e) => console.error("[sync] automation rules:", e),
    );
  }

  // Urgent review → Slack (cap 3 per sync to avoid spam)
  const urgentNew = unrepliedReviews.filter((r) => r.priority === "urgent");
  for (const r of urgentNew.slice(0, 3)) {
    void notifySlack(app.workspace_id, slackUrgentReview({
      author:    r.author,
      rating:    r.rating,
      text:      r.text,
      appName:   app.name,
      reviewUrl: `${APP_URL}/reviews`,
    }));
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
        notifyWorkspaceOwner(app.workspace_id, app.name, version, count).catch(
          (e) => console.error("[sync] spike notify:", e),
        );
      }
    }
  }
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
  const sb = getServiceClient();
  const now = new Date().toISOString();

  if (result.ok) {
    await sb
      .from("apps")
      .update({
        last_synced_at:           now,
        last_sync_attempted_at:   now,
        last_sync_status:         "success",
        last_sync_error:          null,
        last_sync_review_count:   result.reviewCount,
      })
      .eq("id", appId);
    return;
  }

  const classified = classifySyncError(result.platform, result.errMsg);
  await sb
    .from("apps")
    .update({
      last_sync_attempted_at: now,
      last_sync_status:       classified.status,
      last_sync_error:        classified.message,
    })
    .eq("id", appId);
}

async function syncWorkspace(workspaceId: string): Promise<SyncSummary> {
  const sb = getServiceClient();
  const summary: SyncSummary = { appsProcessed: 0, reviewsUpserted: 0, spikesDetected: 0, errors: [] };

  const { data: apps } = await sb
    .from("apps")
    .select("id, workspace_id, name, platform, store_id, access_token, refresh_token, last_sync_attempted_at")
    .eq("workspace_id", workspaceId)
    .not("store_id", "is", null)
    .not("store_id", "eq", "");

  if (!apps?.length) return summary;

  for (const app of apps as DbApp[]) {
    // Mark "attempted" up front so the dashboard can show "we tried 30s ago".
    const attemptedAt = new Date().toISOString();
    try {
      await getServiceClient()
        .from("apps")
        .update({ last_sync_attempted_at: attemptedAt })
        .eq("id", app.id);
    } catch { /* best-effort */ }

    const reviewsBefore = summary.reviewsUpserted;
    try {
      // First sync: fetch up to 50 public reviews before hitting the Publisher API.
      // This gives users immediate data without needing Play Console credentials.
      if (!app.last_sync_attempted_at) {
        try {
          const bootstrapRows = await bootstrapReviews(app.platform, app.id, app.workspace_id, app.store_id);
          if (bootstrapRows.length) {
            const sb = getServiceClient();
            await sb.from("reviews").upsert(bootstrapRows, { onConflict: "app_id,external_id" });
            summary.reviewsUpserted += bootstrapRows.length;
            console.log(`[sync] bootstrap ${app.store_id}: ${bootstrapRows.length} reviews`);
          }
        } catch (err) {
          // Bootstrap is best-effort — don't fail the whole sync if scraping breaks.
          console.warn(`[sync] bootstrap failed for ${app.store_id}:`, err instanceof Error ? err.message : err);
        }
      }

      if (app.platform === "google_play")     await syncGooglePlayApp(app, summary);
      else if (app.platform === "app_store")  await syncAppStoreApp(app, summary);

      const platformErr = summary.errors.find((e) => e.includes(app.id));
      if (platformErr) {
        // syncAppStoreApp pushes errors to summary instead of throwing for
        // some cases (missing credentials). Catch those here.
        await recordSyncResult(app.id, {
          ok: false,
          platform: app.platform,
          errMsg: platformErr,
        });
      } else {
        const fetched = summary.reviewsUpserted - reviewsBefore;
        await recordSyncResult(app.id, { ok: true, reviewCount: fetched });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      summary.errors.push(`${app.platform} app ${app.store_id}: ${msg}`);
      await recordSyncResult(app.id, {
        ok: false,
        platform: app.platform,
        errMsg: msg,
      });
      console.error(`[sync] ${app.platform} ${app.store_id} failed:`, msg);
    }
  }

  return summary;
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
  appName: string,
  version: string,
  count: number,
): Promise<void> {
  const sb = getServiceClient();
  const { data: member } = await sb
    .from("workspace_members")
    .select("clerk_user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")
    .limit(1)
    .single();

  if (!member) return;

  const clerk = await clerkClient();
  const clerkUser = await clerk.users.getUser(member.clerk_user_id);
  const email = clerkUser.emailAddresses[0]?.emailAddress;
  if (!email) return;

  // Email + Slack in parallel (both best-effort)
  await Promise.allSettled([
    sendRatingSpikeAlert(email, appName, version, count),
    notifySlack(workspaceId, slackRatingSpike({
      appName,
      avgRating: 1.5, // spike threshold is ≤2★ reviews
      reviewCount: count,
      appVersion: version,
    })),
  ]);
}
