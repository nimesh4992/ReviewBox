import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import { apiError, captureAndError } from "@/lib/api-response";

/**
 * POST /api/account/restore
 *
 * Clears the soft-delete flag if the user is still within the
 * 30-day grace window. After grace, the workspace is gone and
 * this returns 404.
 *
 * Caller must be the workspace owner.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    const sb = getServiceClient();

    // Find the soft-deleted workspace this user owns
    const { data: member } = await sb
      .from("workspace_members")
      .select("workspace_id, role, workspaces(id, deleted_at)")
      .eq("clerk_user_id", userId)
      .eq("role", "owner")
      .maybeSingle();

    const workspaceRow = member?.workspaces as { id: string; deleted_at: string | null }
      | { id: string; deleted_at: string | null }[]
      | null
      | undefined;
    const workspace = Array.isArray(workspaceRow) ? workspaceRow[0] : workspaceRow;

    if (!workspace?.id || !workspace.deleted_at) {
      return apiError("NOT_FOUND", 404, "No pending deletion to restore.");
    }

    const { error } = await sb
      .from("workspaces")
      .update({ deleted_at: null })
      .eq("id", workspace.id);

    if (error) {
      console.error("[account/restore] update:", error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      const meta = { ...user.publicMetadata };
      delete (meta as Record<string, unknown>).accountDeletedAt;
      await clerk.users.updateUserMetadata(userId, { publicMetadata: meta });
    } catch (err) {
      console.error("[account/restore] clerk metadata:", err);
    }

    await audit({
      workspaceId: workspace.id,
      actorUserId: userId,
      action: "workspace.create", // closest available; we treat restore as re-activation
      targetType: "workspace",
      targetId: workspace.id,
      payload: { event: "restore" },
      request: req,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return captureAndError(err, "POST /api/account/restore");
  }
}
