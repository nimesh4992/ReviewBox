/**
 * GET /api/debug/sync-status
 *
 * Returns sync diagnostic info for the signed-in user's workspace.
 * Surfaces the EXACT state of every connected app so we (or the user)
 * can see why reviews aren't appearing on the dashboard.
 *
 * Auth: signed-in users only, restricted to their own workspace.
 * No admin gate — users should be able to debug their own setup.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const sb = getServiceClient();

  // Explicitly exclude access_token / refresh_token — these hold App Store private keys
  const { data: apps } = await sb
    .from("apps")
    .select("id, name, platform, store_id, created_at, last_synced_at, last_sync_attempted_at, last_sync_status, last_sync_error, last_sync_review_count")
    .eq("workspace_id", workspaceId);

  const { count: reviewCount } = await sb
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  const playClientEmail = process.env.GOOGLE_CLIENT_EMAIL ?? "(not configured)";

  return NextResponse.json({
    workspaceId,
    googleServiceAccountEmail: playClientEmail,
    reviewsInDb: reviewCount ?? 0,
    apps: (apps ?? []).map((a) => {
      const app = a as Record<string, unknown>;
      return {
        id:                     app.id,
        name:                   app.name,
        platform:               app.platform,
        store_id:               app.store_id,
        created_at:             app.created_at,
        last_synced_at:         app.last_synced_at ?? null,
        last_sync_attempted_at: app.last_sync_attempted_at ?? null,
        last_sync_status:       app.last_sync_status ?? null,
        last_sync_error:        app.last_sync_error ?? null,
        last_sync_review_count: app.last_sync_review_count ?? null,
        // Note: credentials are not fetched here for security — check Settings > Apps to verify
        has_app_store_credentials: null,
        // What to check based on platform
        next_action: getNextAction(app),
      };
    }),
  });
}

function getNextAction(app: Record<string, unknown>): string {
  const platform = app.platform as string;
  const lastSyncedAt = app.last_synced_at;
  const lastError = app.last_sync_error as string | null;
  const status = app.last_sync_status as string | null;

  if (lastSyncedAt && status === "success") {
    return `✓ Last synced ${app.last_sync_review_count ?? 0} reviews. All good.`;
  }

  if (status === "needs_play_console_access") {
    return `⚠ INVITE the ReviewBox service account email (see GOOGLE_CLIENT_EMAIL above) to Google Play Console → Users & Permissions with 'View app information' + 'Reply to reviews'. Then click Retry sync in Settings.`;
  }

  if (status === "needs_app_store_credentials") {
    return `⚠ Upload App Store Connect API credentials in Settings → Apps → expand this app.`;
  }

  if (lastError) {
    return `⚠ ${lastError}`;
  }

  if (!app.last_sync_attempted_at) {
    return `⚠ No sync has been attempted yet. The trigger from /api/onboarding/complete may have failed. Click "Sync now" in Settings → Apps.`;
  }

  return `⚠ Sync attempted but no result recorded. Click "Sync now" in Settings → Apps.`;
}
