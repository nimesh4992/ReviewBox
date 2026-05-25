import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError, captureAndError } from "@/lib/api-response";

interface AcceptBody {
  token: string;
}

/**
 * POST /api/account/accept-invite { token }
 *
 * Adds the signed-in user as a workspace member using the invite token.
 * Marks them as onboarded so the middleware doesn't trap them in the
 * onboarding wizard.
 *
 * No email match required — the inviter shared the token with the
 * intended recipient. (We could enforce email match later if needed.)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    const rl = await rateLimit(req, userId, { bucket: "invite-accept", limit: 20, window: "10 m" });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429);
    }

    const body = (await req.json()) as AcceptBody;
    if (!body.token || typeof body.token !== "string") {
      return apiError("MISSING_FIELDS", 400, "Invite token is required.");
    }

    const sb = getServiceClient();

    const { data: invite } = await sb
      .from("workspace_invites")
      .select("id, workspace_id, role, email, expires_at, accepted_at")
      .eq("token", body.token)
      .maybeSingle();

    if (!invite) {
      return apiError("NOT_FOUND", 404, "Invite link is invalid.");
    }
    if (invite.accepted_at) {
      return apiError("INVALID_INPUT", 410, "This invite has already been accepted.");
    }
    if (new Date(invite.expires_at) < new Date()) {
      return apiError("INVALID_INPUT", 410, "This invite has expired. Ask the workspace owner to send a new one.");
    }

    // Fetch current user once — used for email-match check and audit log
    const me = await currentUser();

    // Enforce email match — invite must be addressed to the signed-in user
    if (invite.email) {
      const userEmail = me?.emailAddresses?.[0]?.emailAddress ?? "";
      if (userEmail.toLowerCase() !== invite.email.toLowerCase()) {
        return apiError("FORBIDDEN", 403, "This invite was sent to a different email address.");
      }
    }

    // If the user already belongs to this workspace, just mark them onboarded and ack
    const { data: existing } = await sb
      .from("workspace_members")
      .select("workspace_id")
      .eq("clerk_user_id", userId)
      .eq("workspace_id", invite.workspace_id)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await sb
        .from("workspace_members")
        .insert({
          workspace_id: invite.workspace_id,
          clerk_user_id: userId,
          role: invite.role,
        });

      if (insertError) {
        console.error("[accept-invite] member insert:", insertError);
        return apiError("INTERNAL_SERVER_ERROR", 500);
      }
    }

    // Mark invite as accepted
    await sb
      .from("workspace_invites")
      .update({ accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", invite.id);

    // Mark user as onboarded in Clerk so middleware lets them through
    try {
      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(userId);
      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: { ...clerkUser.publicMetadata, onboarded: true },
      });
    } catch (err) {
      console.error("[accept-invite] clerk metadata:", err);
    }

    await audit({
      workspaceId: invite.workspace_id,
      actorUserId: userId,
      action: "member.accept_invite",
      targetType: "member",
      targetId: userId,
      payload: { event: "accepted", inviteId: invite.id, email: me?.emailAddresses?.[0]?.emailAddress },
      request: req,
    });

    return NextResponse.json({ workspaceId: invite.workspace_id });
  } catch (err) {
    return captureAndError(err, "POST /api/account/accept-invite");
  }
}
