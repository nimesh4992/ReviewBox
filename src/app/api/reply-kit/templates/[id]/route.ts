import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  // 1. Auth
  const session = await auth();
  const userId = session?.userId;
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // 2. Resolve workspace
  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) {
    return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });
  }

  const { id } = await params;
  const raw = (await req.json()) as Record<string, unknown>;

  // 3. Whitelist allowed fields — prevents workspace_id / column injection
  const ALLOWED = ["name", "content", "tags", "rating_min", "rating_max", "language"] as const;
  const body: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in raw) body[key] = raw[key];
  }
  if (typeof body.name    === "string") body.name    = body.name.slice(0, 100).trim();
  if (typeof body.content === "string") body.content = body.content.slice(0, 2000).trim();
  if (Object.keys(body).length === 0) {
    return NextResponse.json({ error: "NO_VALID_FIELDS" }, { status: 400 });
  }

  // 4. Update — scope to workspace so users can't touch other workspaces' data
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reply_templates")
    .update(body)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) {
    console.error("reply-kit/templates PATCH error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ template: data }, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  // 1. Auth
  const session = await auth();
  const userId = session?.userId;
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // 2. Resolve workspace
  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) {
    return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });
  }

  const { id } = await params;

  // 3. Delete — scoped to workspace
  const sb = getServiceClient();
  const { error } = await sb
    .from("reply_templates")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("reply-kit/templates DELETE error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
