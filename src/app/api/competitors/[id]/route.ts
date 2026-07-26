import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";

/** DELETE /api/competitors/[id] — stop tracking a competitor. */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return apiError("INVALID_INPUT", 400, "Invalid competitor id.");

  const sb = getServiceClient();
  const { data: deleted, error } = await sb
    .from("competitor_apps")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId) // scoping: can only delete your own rows
    .select("id, name")
    .maybeSingle();

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500, "Couldn't remove competitor.");
  if (!deleted) return apiError("NOT_FOUND", 404);

  await audit({
    workspaceId,
    actorUserId: session.userId,
    action: "competitor.remove",
    targetType: "competitor",
    targetId: id,
    payload: { name: deleted.name },
    request: req,
  });

  return NextResponse.json({ ok: true });
}
