import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError, captureAndError } from "@/lib/api-response";

/**
 * POST /api/account/cancel
 *
 * Soft-deletes the caller's workspace. Hard delete happens via
 * pg_cron after a 30-day grace window. User keeps access to a
 * "restore" prompt on sign-in until then.
 *
 * Only the workspace owner can cancel. Members get FORBIDDEN.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    const rl = await rateLimit(req, userId, { bucket: "account-cancel", limit: 3, window: "10 m" });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429);
    }

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) {
      return apiError("NO_WORKSPACE", 404);
    }

    const sb = getServiceClient();

    // Only the owner can cancel
    const { data: member } = await sb
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("clerk_user_id", userId)
      .single();

    if (!member || member.role !== "owner") {
      return apiError("FORBIDDEN", 403, "Only the workspace owner can cancel the account.");
    }

    const deletedAt = new Date().toISOString();
    const { error } = await sb
      .from("workspaces")
      .update({ deleted_at: deletedAt })
      .eq("id", workspaceId);

    if (error) {
      console.error("[account/cancel] update:", error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    // Mark in Clerk so middleware can show a banner if they sign in
    try {
      const clerk = await clerkClient();
      const user = await clerk.users.getUser(userId);
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: { ...user.publicMetadata, accountDeletedAt: deletedAt },
      });
    } catch (err) {
      console.error("[account/cancel] clerk metadata:", err);
    }

    await audit({
      workspaceId,
      actorUserId: userId,
      action: "workspace.delete",
      targetType: "workspace",
      targetId: workspaceId,
      payload: { hardDeleteAt: new Date(Date.now() + 30 * 86400000).toISOString() },
      request: req,
    });

    return NextResponse.json({ success: true, hardDeleteAt: new Date(Date.now() + 30 * 86400000).toISOString() });
  } catch (err) {
    return captureAndError(err, "POST /api/account/cancel");
  }
}
