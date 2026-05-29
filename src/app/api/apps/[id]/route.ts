import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";

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

  const { id: appId } = await params;
  const sb = getServiceClient();

  // Soft-delete: preserves review history, can be recovered by support
  const { error } = await sb
    .from("apps")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", appId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null); // idempotent — don't clobber existing delete timestamp

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);

  await audit({
    workspaceId,
    actorUserId: userId,
    action: "app.delete",
    targetType: "app",
    targetId: appId,
    payload: {},
    request: req,
  });

  // Clear the onboarding cookie so the user can reach /onboarding to add
  // a new app without looping dashboard ↔ onboarding.
  const res = NextResponse.json({ success: true });
  res.cookies.set("rb_onboarded", "", {
    maxAge: 0,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return res;
}
