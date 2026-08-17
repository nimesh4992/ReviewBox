import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { isNoRowsError } from "@/lib/db-errors";
import { audit } from "@/lib/audit";

const VALID_CATEGORIES = ["bug", "feature", "praise", "billing", "general"] as const;

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const { id } = await params;
  const raw = (await req.json()) as Record<string, unknown>;

  // Build an explicit allowlist — never pass raw body to .update()
  const patch: Record<string, unknown> = {};
  if (typeof raw.title === "string") {
    const t = raw.title.trim();
    if (!t || t.length > 200) return apiError("INVALID_INPUT", 400, "title max 200 chars");
    patch.title = t;
  }
  if (typeof raw.content === "string") {
    const c = raw.content.trim();
    if (!c || c.length > 5000) return apiError("INVALID_INPUT", 400, "content max 5000 chars");
    patch.content = c;
  }
  if (typeof raw.category === "string") {
    if (!VALID_CATEGORIES.includes(raw.category as typeof VALID_CATEGORIES[number]))
      return apiError("INVALID_INPUT", 400, "invalid category");
    patch.category = raw.category;
  }

  if (Object.keys(patch).length === 0) return apiError("INVALID_INPUT", 400, "no valid fields to update");

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("knowledge_base")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  // Order matters: `.single()` reports "no rows matched" AS an error, so
  // checking `error` first made the 404 below unreachable for the one case it
  // exists for — a row already deleted in another tab answered 500.
  if (isNoRowsError(error) || !data) return apiError("NOT_FOUND", 404);
  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);

  await audit({
    workspaceId,
    actorUserId: session.userId,
    action: "kb.update",
    targetType: "kb",
    targetId: id,
    payload: { fields: Object.keys(patch) },
    request: req,
  });

  return NextResponse.json({ entry: data }, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const { id } = await params;

  const sb = getServiceClient();
  const { error } = await sb
    .from("knowledge_base")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);

  await audit({
    workspaceId,
    actorUserId: session.userId,
    action: "kb.delete",
    targetType: "kb",
    targetId: id,
    request: _req,
  });

  return new NextResponse(null, { status: 204 });
}
