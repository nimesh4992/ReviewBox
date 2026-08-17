import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId, isWorkspaceAdmin } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { bustWorkspaceDerivedCaches } from "@/lib/cache-bust";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PatchBody {
  name?: string;
  keyId?: string;
  issuerId?: string;
  p8Key?: string;
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  // PATCH can overwrite App Store .p8 credentials — owner/admin only.
  if (!(await isWorkspaceAdmin(userId, workspaceId))) {
    return apiError("FORBIDDEN", 403, "Only the workspace owner or an admin can modify apps.");
  }

  const { id: appId } = await params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return apiError("INVALID_INPUT", 400, "Invalid JSON body");
  }

  const sb = getServiceClient();

  const { data: app } = await sb
    .from("apps")
    .select("id, platform")
    .eq("id", appId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!app) return apiError("NOT_FOUND", 404);

  const updates: Record<string, unknown> = {};

  if (body.name?.trim()) updates.name = body.name.trim();

  if (app.platform === "app_store") {
    if (body.keyId && body.issuerId && body.p8Key) {
      updates.access_token = JSON.stringify({
        keyId: body.keyId.trim(),
        issuerId: body.issuerId.trim(),
      });
      updates.refresh_token = body.p8Key.trim();
    }
  }

  if (!Object.keys(updates).length) {
    return apiError("INVALID_INPUT", 400, "Nothing to update");
  }

  const { error } = await sb
    .from("apps")
    .update(updates)
    .eq("id", appId)
    .eq("workspace_id", workspaceId);

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);

  await audit({
    workspaceId,
    actorUserId: userId,
    action: "app.update",
    targetType: "app",
    targetId: appId,
    payload: { fields: Object.keys(updates) },
    request: req,
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  // Deleting an app removes a connected store — owner/admin only.
  if (!(await isWorkspaceAdmin(userId, workspaceId))) {
    return apiError("FORBIDDEN", 403, "Only the workspace owner or an admin can delete apps.");
  }

  const { id: appId } = await params;
  const sb = getServiceClient();

  // Remove the app's reviews FIRST, then soft-delete the app.
  //
  // The app row was soft-deleted and its reviews left behind, on the reasoning
  // that this "preserves review history". But nothing downstream excludes them:
  // every reviews query filters on workspace_id alone, so a deleted app's
  // reviews kept counting in Sentiment, the dashboard KPIs and the inbox. A
  // workspace with no connected apps still reported 200 reviews and a 4.32
  // average — data the customer cannot see the source of, cannot act on, and
  // cannot get rid of.
  //
  // docs/decisions.md D015 names app disconnect as one of the three valid
  // reasons to delete review data, so this is the sanctioned behaviour.
  // Bounded by BOTH app_id and workspace_id (D006).
  const { count: removedReviews, error: reviewsError } = await sb
    .from("reviews")
    .delete({ count: "exact" })
    .eq("app_id", appId)
    .eq("workspace_id", workspaceId);

  if (reviewsError) {
    console.error("[apps] review cleanup failed on delete:", {
      appId, code: reviewsError.code, message: reviewsError.message,
    });
    // Stop here rather than half-deleting: an app marked deleted whose reviews
    // are still counted is exactly the state this fix exists to prevent.
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  const { error } = await sb
    .from("apps")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", appId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null); // idempotent — don't clobber existing delete timestamp

  if (error) {
    console.error("[apps] delete failed:", { appId, code: error.code, message: error.message });
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  // The AI summary (1h) and ASO suggestions (24h) were generated FROM the
  // reviews just deleted. Without this they keep describing a disconnected
  // app — and the summary's Refresh button reads the same cached payload, so
  // the user has no way to clear it.
  await bustWorkspaceDerivedCaches(workspaceId);

  await audit({
    workspaceId,
    actorUserId: userId,
    action: "app.delete",
    targetType: "app",
    targetId: appId,
    payload: { removedReviews: removedReviews ?? 0 },
    request: req,
  });

  // Onboarding-loop fix: if this was the workspace's LAST live app, clear the
  // `rb_onboarded` cookie. Otherwise the cookie keeps middleware treating the
  // user as onboarded while the DB has zero live apps — the dashboard shows the
  // empty state, but a stale cookie can bounce them into the onboarding loop.
  // If other apps remain, the user is still onboarded — leave the cookie alone.
  const { count: liveApps } = await sb
    .from("apps")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  const res = NextResponse.json({ success: true });
  if ((liveApps ?? 0) === 0) {
    res.cookies.set("rb_onboarded", "", {
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  return res;
}
