import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";

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

  if (typeof raw.name === "string") {
    const n = raw.name.trim();
    if (!n || n.length > 120) return apiError("INVALID_INPUT", 400, "name max 120 chars");
    patch.name = n;
  }
  if (typeof raw.content === "string") {
    const c = raw.content.trim();
    if (!c || c.length > 5950) return apiError("INVALID_INPUT", 400, "content max 5950 chars");
    patch.content = c;
  }
  if (Array.isArray(raw.tags)) {
    patch.tags = (raw.tags as unknown[]).filter((t) => typeof t === "string") as string[];
  }
  if (typeof raw.ratingMin === "number") {
    patch.rating_min = Math.max(1, Math.min(5, Math.floor(raw.ratingMin)));
  }
  if (typeof raw.ratingMax === "number") {
    patch.rating_max = Math.max(1, Math.min(5, Math.floor(raw.ratingMax)));
  }
  if (typeof raw.language === "string") {
    patch.language = raw.language.slice(0, 10);
  }

  if (Object.keys(patch).length === 0) return apiError("INVALID_INPUT", 400, "no valid fields to update");

  // Validate ratingMin ≤ ratingMax if both present
  const rMin = patch.rating_min as number | undefined;
  const rMax = patch.rating_max as number | undefined;
  if (rMin !== undefined && rMax !== undefined && rMin > rMax) {
    return apiError("INVALID_INPUT", 400, "ratingMin must be ≤ ratingMax");
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reply_templates")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);
  if (!data)  return apiError("NOT_FOUND", 404);

  await audit({
    workspaceId,
    actorUserId: session.userId,
    action: "template.update",
    targetType: "template",
    targetId: id,
    payload: { fields: Object.keys(patch) },
    request: req,
  });

  return NextResponse.json({ template: data }, { status: 200 });
}

export async function DELETE(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const { id } = await params;

  const sb = getServiceClient();
  const { error } = await sb
    .from("reply_templates")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);

  await audit({
    workspaceId,
    actorUserId: session.userId,
    action: "template.delete",
    targetType: "template",
    targetId: id,
    request: _req,
  });

  return new NextResponse(null, { status: 204 });
}
