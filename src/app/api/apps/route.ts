import { NextRequest, NextResponse, after } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { canAddApp } from "@/lib/plan-enforcement";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { fetchAppMetadata } from "@/services/store-search";
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

  if (full.error?.code === "42703") {
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

  if (full.error?.code === "42703") {
    // One or more columns missing (pre-migration state). Try without the newer
    // metadata columns. Also drop deleted_at filter — if 015 isn't applied yet
    // no apps have been soft-deleted so returning all is equivalent and safe.
    const minimal = await sb
      .from("apps")
      .select("id, name, platform, store_id, last_synced_at, access_token, refresh_token")
      .eq("workspace_id", workspaceId)
      .order("created_at");
    apps = (minimal.data as Record<string, unknown>[] | null) ?? [];
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
}

export async function POST(request: NextRequest) {
  // 1. Auth
  const { userId, sessionClaims } = await auth();
  if (!userId) return apiError("UNAUTHORIZED", 401);

  // 2. Workspace lookup
  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  // 3. Get plan from session claims (set via Clerk metadata)
  const plan = (sessionClaims?.metadata as { plan?: string } | undefined)?.plan ?? "free";

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

  // 6. Insert into apps table
  const sb = getServiceClient();
  const storeId = body.platform === "google_play" ? body.packageName : body.bundleId;

  if (!storeId) {
    return apiError("INVALID_INPUT", 400, "Missing store identifier (packageName or bundleId)");
  }

  // Grab public store metadata (icon, lifetime rating, review count) before
  // insert so the app row isn't blank while the first sync runs. Best-effort —
  // a failed scrape must not block adding the app.
  let metadata: {
    icon_url?: string | null;
    developer?: string | null;
    lifetime_rating?: number | null;
    lifetime_review_count?: number | null;
    metadata_refreshed_at?: string;
  } = {};
  try {
    const platform = body.platform === "google_play" ? "google-play" : "app-store";
    const meta = await fetchAppMetadata(platform, storeId);
    if (meta) {
      metadata = {
        icon_url:              meta.icon,
        developer:             meta.developer || null,
        lifetime_rating:       meta.rating,
        lifetime_review_count: meta.reviewCount,
        metadata_refreshed_at: new Date().toISOString(),
      };
    }
  // Fetch lifetime metadata (icon, rating, review count) before insert, same
  // as onboarding — apps added from Settings previously never got any of it.
  let metadata: Awaited<ReturnType<typeof fetchAppMetadata>> = null;
  try {
    metadata = await fetchAppMetadata(
      body.platform === "google_play" ? "google-play" : "app-store",
      storeId,
    );
  } catch (err) {
    console.warn("[apps] metadata fetch failed:", err);
  }

  let insert = await sb
    .from("apps")
    .insert({
      workspace_id: workspaceId,
      name: body.name,
      platform: body.platform,
      store_id: storeId,
      ...metadata,
      workspace_id:           workspaceId,
      name:                   body.name,
      platform:               body.platform,
      store_id:               storeId,
      icon_url:               metadata?.icon ?? null,
      developer:              metadata?.developer ?? null,
      lifetime_rating:        metadata?.rating ?? null,
      lifetime_review_count:  metadata?.reviewCount ?? null,
      metadata_refreshed_at:  metadata ? new Date().toISOString() : null,
    })
    .select()
    .single();

  // 42703 = metadata columns missing (migration 012 pending) — insert without.
  // 42703 = metadata columns missing (migration 012 not applied) — insert
  // without them rather than failing the add entirely.
  if (insert.error?.code === "42703") {
    insert = await sb
      .from("apps")
      .insert({
        workspace_id: workspaceId,
        name: body.name,
        platform: body.platform,
        store_id: storeId,
      })
      .select()
      .single();
  }

  const { data: app, error } = insert;

  if (error) {
  if (error || !app) {
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  // 7. Kick off the first review sync (public scrape — no credentials
  // needed). Runs in-process via after(), AFTER the response is sent, so an
  // app added from Settings shows reviews within ~30s instead of sitting
  // empty until the daily cron. An HTTP self-fetch is NOT reliable here:
  // Vercel freezes the lambda on response, and without CRON_SECRET the sync
  // route rejects cookieless server-to-server calls in production.
  after(async () => {
    try {
      await syncWorkspace(workspaceId);
    } catch (err) {
      console.error("[apps] first sync failed:", err);
    }
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

  // 8. Return new app
  // 9. Return new app
  return NextResponse.json({ app }, { status: 201 });
}
