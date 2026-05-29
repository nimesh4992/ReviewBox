import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { canAddApp } from "@/lib/plan-enforcement";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";

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
      "id, name, platform, store_id, last_synced_at, access_token, refresh_token, icon_url, developer, lifetime_rating, lifetime_review_count, last_sync_attempted_at, last_sync_status, last_sync_error, last_sync_review_count, deleted_at",
    )
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("created_at");

  let apps: Record<string, unknown>[] = (full.data as Record<string, unknown>[] | null) ?? [];

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

  const { data: app, error } = await sb
    .from("apps")
    .insert({
      workspace_id: workspaceId,
      name: body.name,
      platform: body.platform,
      store_id: storeId,
    })
    .select()
    .single();

  if (error) {
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  // 7. Audit
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
  return NextResponse.json({ app }, { status: 201 });
}
