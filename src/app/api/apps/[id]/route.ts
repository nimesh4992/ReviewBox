import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
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
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });

  const { id: appId } = await params;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const sb = getServiceClient();

  const { data: app } = await sb
    .from("apps")
    .select("id, platform")
    .eq("id", appId)
    .eq("workspace_id", workspaceId)
    .single();

  if (!app) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

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
    return NextResponse.json({ error: "NOTHING_TO_UPDATE" }, { status: 400 });
  }

  const { error } = await sb
    .from("apps")
    .update(updates)
    .eq("id", appId)
    .eq("workspace_id", workspaceId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

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
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });

  const { id: appId } = await params;
  const sb = getServiceClient();

  // Soft-delete: preserves review history, can be recovered by support
  const { error } = await sb
    .from("apps")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", appId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null); // idempotent — don't clobber existing delete timestamp

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await audit({
    workspaceId,
    actorUserId: userId,
    action: "app.delete",
    targetType: "app",
    targetId: appId,
    payload: {},
    request: req,
  });

  return NextResponse.json({ success: true });
}
