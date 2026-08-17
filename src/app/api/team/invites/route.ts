import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError, captureAndError } from "@/lib/api-response";
import { getResend, FROM } from "@/lib/email/client";
import { inviteEmail } from "@/lib/email/templates";

/** Whole days from now until `iso`, floored at 1. Falls back to the migration-006 default. */
function daysUntil(iso: string | null): number {
  if (!iso) return 14;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms)) return 14;
  return Math.max(1, Math.round(ms / 86_400_000));
}

interface CreateInviteBody {
  email: string;
  role?: "admin" | "member";
}

// 32-byte hex token; Node 18+ has crypto.randomUUID but we need wider entropy.
function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.userId) {
      return apiError("UNAUTHORIZED", 401);
    }
    const workspaceId = await getWorkspaceId(session.userId);
    if (!workspaceId) {
      return apiError("NO_WORKSPACE", 404);
    }

    const sb = getServiceClient();
    const { data, error } = await sb
      .from("workspace_invites")
      .select("id, email, role, invited_by, expires_at, accepted_at, created_at")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[team/invites GET]", error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    return NextResponse.json({ invites: data ?? [] });
  } catch (err) {
    return captureAndError(err, "GET /api/team/invites");
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    const rl = await rateLimit(req, userId, { bucket: "invite-send", limit: 20, window: "1 h" });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429);
    }

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) {
      return apiError("NO_WORKSPACE", 404);
    }

    const body = (await req.json()) as CreateInviteBody;
    const email = body.email?.trim().toLowerCase();
    const role = body.role ?? "member";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return apiError("INVALID_INPUT", 400, "A valid email is required.");
    }

    const sb = getServiceClient();

    // Only owners/admins may invite
    const { data: member } = await sb
      .from("workspace_members")
      .select("role, workspaces(name)")
      .eq("workspace_id", workspaceId)
      .eq("clerk_user_id", userId)
      .single();

    if (!member || (member.role !== "owner" && member.role !== "admin")) {
      return apiError("FORBIDDEN", 403, "Only owners and admins can invite teammates.");
    }

    // Revoke any prior unaccepted invite for this email so the new token is the only valid one
    await sb
      .from("workspace_invites")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("email", email)
      .is("accepted_at", null);

    const token = generateToken();
    const { data: invite, error } = await sb
      .from("workspace_invites")
      .insert({
        workspace_id: workspaceId,
        email,
        role,
        token,
        invited_by: userId,
      })
      .select("id, expires_at")
      .single();

    // A unique violation here means another admin invited the same person
    // between our DELETE above and this INSERT (migration 030 enforces one
    // pending invite per workspace+email). That is a race between two people
    // doing something reasonable, not a server fault — and "Something went
    // wrong on our end" would send the admin looking for a bug that isn't
    // there. Their colleague's invite is live and valid.
    if (error?.code === "23505") {
      return apiError(
        "INVALID_INPUT",
        409,
        "Someone else just invited this person. Their invite is already on its way.",
      );
    }

    if (error || !invite) {
      console.error("[team/invites POST]", error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    // Fire invite email
    const workspaceName =
      Array.isArray(member.workspaces)
        ? (member.workspaces[0] as { name?: string })?.name
        : (member.workspaces as { name?: string } | null)?.name;
    const inviter = await currentUser();
    const inviterName =
      inviter?.firstName ??
      inviter?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ??
      "A teammate";
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const inviteUrl = `${appUrl}/invite/${token}`;

    try {
      const resend = getResend();
      if (resend) {
        // The app name makes the invite recognisable — "join ReviewBox" is a
        // cold ask, "reply to Mumbai One reviews" is a job. Best-effort: an
        // invite that arrives without it is still a working invite.
        const { data: firstApp } = await sb
          .from("apps")
          .select("name")
          .eq("workspace_id", workspaceId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        const message = inviteEmail({
          inviterName,
          workspaceName: workspaceName ?? "ReviewBox",
          appName: (firstApp?.name as string | undefined) ?? null,
          inviteUrl,
          // Derived from the row the database actually wrote, not a constant
          // mirrored in TypeScript. The default lives in migration 006 and the
          // email must not promise a window the token does not have.
          expiresInDays: daysUntil(invite.expires_at as string | null),
        });

        await resend.emails.send({
          from: FROM,
          to: email,
          subject: message.subject,
          html: message.html,
          text: message.text,
        });
      }
    } catch (err) {
      console.error("[team/invites] email send:", err);
      // Don't fail the request — the invite exists, owner can resend
    }

    await audit({
      workspaceId,
      actorUserId: userId,
      action: "member.invite",
      targetType: "member",
      targetId: invite.id as string,
      payload: { email, role },
      request: req,
    });

    return NextResponse.json({ id: invite.id, expiresAt: invite.expires_at }, { status: 201 });
  } catch (err) {
    return captureAndError(err, "POST /api/team/invites");
  }
}
