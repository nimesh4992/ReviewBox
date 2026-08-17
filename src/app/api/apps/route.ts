import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { canAddApp } from "@/lib/plan-enforcement";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { resolveAppMetadata, resolvePastedStoreUrl } from "@/services/store-search";
import { parseStoreUrl } from "@/lib/store-urls";
import { isMissingColumnError, writeWithOptionalColumns } from "@/lib/db-errors";
import { looksLikeStoreId } from "@/lib/storefronts";
import { syncWorkspace } from "@/services/review-sync";

// POST triggers a public-store scrape via after() — needs more than the
// default function budget so the first sync isn't cut off mid-write.
export const maxDuration = 60;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return NextResponse.json({ apps: [] });

  const sb = getServiceClient();
  // Try the full select first. If migrations 012/013/015 aren't applied yet,
  // fall back through progressively simpler queries so /api/apps never breaks.
  // NOTE: .is("deleted_at", null) requires migration 015. Both branches omit
  // deleted_at filter as fallback if the column doesn't exist yet.
  const full = await sb
    .from("apps")
    .select(
      "id, name, platform, store_id, last_synced_at, access_token, refresh_token, icon_url, developer, lifetime_rating, lifetime_review_count, last_sync_attempted_at, last_sync_status, last_sync_error, last_sync_review_count, publisher_api_connected, deleted_at",
    )
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at");

  let apps: Record<string, unknown>[] = (full.data as Record<string, unknown>[] | null) ?? [];

  if (isMissingColumnError(full.error)) {
    // publisher_api_connected missing (migration 016 pending) — retry without
    // it before dropping all the way to the minimal column set.
    const mid = await sb
      .from("apps")
      .select(
        "id, name, platform, store_id, last_synced_at, access_token, refresh_token, icon_url, developer, lifetime_rating, lifetime_review_count, last_sync_attempted_at, last_sync_status, last_sync_error, last_sync_review_count, deleted_at",
      )
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .order("created_at");
    apps = (mid.data as Record<string, unknown>[] | null) ?? [];
    full.error = mid.error;
  }

  if (isMissingColumnError(full.error)) {
    // One or more columns missing (pre-migration state). Try without the newer
    // metadata columns. Also drop deleted_at filter — if 015 isn't applied yet
    // no apps have been soft-deleted so returning all is equivalent and safe.
    const minimal = await sb
      .from("apps")
      .select("id, name, platform, store_id, last_synced_at, access_token, refresh_token")
      .eq("workspace_id", workspaceId)
      .order("created_at");
    apps = (minimal.data as Record<string, unknown>[] | null) ?? [];
    full.error = minimal.error;
  }

  // Only a missing column (pre-migration) is a degrade-and-continue case.
  // Any other error used to fall through to `apps = []` and a 200, so a
  // timeout or permission failure was reported to the client as "this
  // workspace has no apps" — which the dashboard renders as the first-run
  // "connect your first app" screen to an established customer.
  if (full.error) {
    console.error("[api/apps GET]", full.error);
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  const mapped = apps.map((r) => ({
    id:                     r.id as string,
    name:                   r.name as string,
    platform:               r.platform as string,
    store_id:               r.store_id as string,
    last_synced_at:         (r.last_synced_at as string | null) ?? null,
    icon_url:               (r.icon_url as string | null) ?? null,
    developer:              (r.developer as string | null) ?? null,
    lifetime_rating:        (r.lifetime_rating as number | null) ?? null,
    lifetime_review_count:  (r.lifetime_review_count as number | null) ?? null,
    has_credentials:        !!(r.access_token && r.refresh_token),
    publisher_api_connected: (r.publisher_api_connected as boolean | null) ?? null,
    last_sync_attempted_at: (r.last_sync_attempted_at as string | null) ?? null,
    last_sync_status:       (r.last_sync_status as string | null) ?? null,
    last_sync_error:        (r.last_sync_error as string | null) ?? null,
    last_sync_review_count: (r.last_sync_review_count as number | null) ?? null,
  }));

  return NextResponse.json({ apps: mapped });
}

interface CreateAppBody {
  name: string;
  platform: "google_play" | "app_store";
  packageName?: string;
  bundleId?: string;
  /** Storefront hint from search; confirmed server-side before it's stored. */
  country?: string | null;
}

export async function POST(request: NextRequest) {
  // 1. Auth
  const { userId, sessionClaims } = await auth();
  if (!userId) return apiError("UNAUTHORIZED", 401);

  // 2. Workspace lookup
  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  // 3. Get plan from session claims (set via Clerk metadata)
  // A missing plan means Clerk's cached claims haven't caught up with
  // onboarding yet, not that the user is on a free tier — see the same
  // default in middleware.ts:151 and /api/reply/draft.
  const plan = (sessionClaims?.metadata as { plan?: string } | undefined)?.plan ?? "trial";

  // 4. Plan gate — check if workspace can add another app
  const allowed = await canAddApp(workspaceId, plan);
  if (!allowed) {
    return apiError("PLAN_REQUIRED", 403, "Upgrade to add more apps");
  }

  // 5. Parse body
  let body: CreateAppBody;
  try {
    body = (await request.json()) as CreateAppBody;
  } catch {
    return apiError("INVALID_INPUT", 400, "Invalid JSON body");
  }

  if (!body.name || !body.platform) {
    return apiError("INVALID_INPUT", 400, "Missing required fields: name, platform");
  }

  // 6. Resolve the store identifier
  const sb = getServiceClient();
  const rawStoreId = (body.platform === "google_play" ? body.packageName : body.bundleId)?.trim();

  if (!rawStoreId) {
    return apiError("INVALID_INPUT", 400, "Missing store identifier (packageName or bundleId)");
  }

  // People paste the store URL here — it is the thing they actually have in
  // front of them, and the field is the only place to put it. Accept it.
  //
  // Before this, a pasted URL was written into `apps.store_id` verbatim. That
  // is far worse than rejecting it: the app row is created, the UI says the
  // app was added, and then every single sync fails forever because
  // "https://apps.apple.com/..." is not a package name. A silent permanent
  // no-op, dressed as success.
  let storeId = rawStoreId;
  let storeCountry = body.country ?? null;

  const parsedUrl = parseStoreUrl(rawStoreId);
  if (parsedUrl) {
    const wantedPlatform = body.platform === "google_play" ? "google-play" : "app-store";
    if (parsedUrl.platform !== wantedPlatform) {
      // The exact mistake this form invites: an App Store link pasted while
      // the Platform dropdown still says Google Play. Name both sides.
      return apiError(
        "INVALID_INPUT",
        400,
        parsedUrl.platform === "app-store"
          ? "That's an App Store link, but the platform is set to Google Play. Switch the platform to App Store, or paste the Google Play link instead."
          : "That's a Google Play link, but the platform is set to App Store. Switch the platform to Google Play, or paste the App Store link instead.",
      );
    }

    try {
      const resolved = await resolvePastedStoreUrl(parsedUrl);
      if (!resolved) {
        return apiError(
          "INVALID_INPUT",
          400,
          "We couldn't find that app on the store. Double-check the link, or paste the app's package name instead.",
        );
      }
      storeId = resolved.storeId;
      storeCountry = resolved.country ?? storeCountry;
    } catch (err) {
      console.error("[apps] store URL resolution failed:", err);
      return apiError(
        "SERVICE_UNAVAILABLE",
        503,
        "We couldn't reach the store to look that app up. Please try again in a minute.",
      );
    }
  }

  // Whatever path we took, what lands in `store_id` must be a store
  // identifier — never a URL, never free text. Everything downstream (sync,
  // metadata, reply posting) assumes this and fails silently if it's wrong.
  if (!looksLikeStoreId(storeId)) {
    return apiError(
      "INVALID_INPUT",
      400,
      body.platform === "google_play"
        ? "That doesn't look like a package name (e.g. com.company.app). You can also paste your app's Google Play link."
        : "That doesn't look like a bundle ID (e.g. com.company.app). You can also paste your app's App Store link.",
    );
  }

  // Fetch lifetime metadata (icon, rating, review count) before insert, same
  // as onboarding — apps added from Settings previously never got any of it.
  // Best-effort — a failed scrape must not block adding the app.
  let metadata: Awaited<ReturnType<typeof resolveAppMetadata>> = null;
  try {
    metadata = await resolveAppMetadata(
      body.platform === "google_play" ? "google-play" : "app-store",
      storeId,
      // A pasted link often names its storefront ("/in/app/…", "gl=IN"), which
      // is a better hint than the client's, and is what stops a region-locked
      // app being scraped against the US store forever.
      storeCountry,
    );
  } catch (err) {
    console.warn("[apps] metadata fetch failed:", err);
  }

  // Metadata columns sit behind migrations 012 and 019 — drop only the ones
  // this database is missing rather than failing the add entirely, or throwing
  // away the icon and developer name because one other column is absent.
  const insert = await writeWithOptionalColumns<Record<string, unknown>>(
    (payload) => sb.from("apps").insert(payload).select().single(),
    {
      workspace_id: workspaceId,
      name:         body.name,
      platform:     body.platform,
      store_id:     storeId,
    },
    {
      icon_url:               metadata?.icon ?? null,
      developer:              metadata?.developer ?? null,
      lifetime_rating:        metadata?.rating ?? null,
      lifetime_review_count:  metadata?.reviewCount ?? null,
      store_country:          metadata?.country ?? storeCountry,
      metadata_refreshed_at:  metadata ? new Date().toISOString() : null,
    },
  );

  if (insert.droppedColumns.length) {
    console.warn(
      "[apps] columns not in this database — inserted without:",
      insert.droppedColumns.join(", "),
    );
  }

  const { data: app, error } = insert;

  if (error || !app) {
    // Log the actual cause. This returned a bare 500 with nothing written
    // anywhere, so "Something went wrong on our end" was all anyone — user or
    // maintainer — ever got, and the reason was unknowable after the fact.
    console.error("[apps] insert failed:", {
      code: error?.code,
      message: error?.message,
      details: error?.details,
      platform: body.platform,
      storeId,
    });

    // A duplicate is a user-fixable state, not a server fault.
    if (error?.code === "23505") {
      return apiError("INVALID_INPUT", 409, "That app is already connected to this workspace.");
    }
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  // 7. Kick off the first review sync (public scrape — no credentials
  // needed). Runs in-process via after(), AFTER the response is sent, so an
  // app added from Settings shows reviews within ~30s instead of sitting
  // empty until the daily cron. An HTTP self-fetch is NOT reliable here:
  // Vercel freezes the lambda on response, and without CRON_SECRET the sync
  // route rejects cookieless server-to-server calls in production.
  after(async () => {
    // Syncs are serialised per workspace (lib/sync-lock.ts). If another run
    // already holds the lock it may have loaded the workspace's app list a
    // moment BEFORE this app was inserted, so it won't cover the new app — and
    // a declined sync would leave it empty until the daily cron. Retry a
    // couple of times, spaced so the whole loop stays comfortably inside
    // maxDuration = 60 even when the final attempt has a full sync to run.
    //
    // This is only needed here: the onboarding routes sync a workspace that is
    // seconds old, so nothing else can be holding its lock.
    const RETRY_DELAY_MS = 12_000;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const summary = await syncWorkspace(workspaceId);
        if (!summary.skipped) return;
      } catch (err) {
        console.error("[apps] first sync failed:", err);
        return;
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
    console.warn("[apps] first sync skipped — another sync held the lock; the daily cron will pick it up");
  });

  // 8. Audit
  await audit({
    workspaceId,
    actorUserId: userId,
    action: "app.create",
    targetType: "app",
    targetId: (app as { id: string }).id,
    payload: { name: body.name, platform: body.platform, storeId },
    request,
  });

  // 9. Return new app
  return NextResponse.json({ app }, { status: 201 });
}
