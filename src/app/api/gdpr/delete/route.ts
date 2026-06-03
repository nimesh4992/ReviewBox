import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";

import { getServiceClient, getWorkspaceId, getWorkspaceRole } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import { apiError, captureAndError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";

export const dynamic = "force-dynamic";

const CONFIRM_PHRASE = "DELETE MY ACCOUNT" as const;

/**
 * POST /api/gdpr/delete  { confirm: "DELETE MY ACCOUNT" }
 *
 * Immediate hard delete — fulfills the GDPR right-to-erasure request.
 * Different from /api/account/cancel which is a 30-day grace soft-delete.
 *
 * Cascades:
 *   workspaces → workspace_members, apps, reviews, automation_rules,
 *                reply_templates, knowledge_base, ai_usage, incidents,
 *                alert_preferences, audit_log
 *   Clerk user record
 *   Stripe customer (if we can find one by email)
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    // Strict rate limit — 3 attempts per 24h. Prevents session-replay attacks.
    const rl = await rateLimit(req, userId, { bucket: "gdpr-delete", limit: 3, window: "24 h" });
    if (!rl.allowed) return apiError("RATE_LIMITED", 429);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return apiError("INVALID_INPUT", 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      (body as Record<string, unknown>).confirm !== CONFIRM_PHRASE
    ) {
      return apiError(
        "INVALID_INPUT",
        400,
        `Confirmation required. Send { "confirm": "${CONFIRM_PHRASE}" } to proceed.`,
      );
    }

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) {
      return apiError("NO_WORKSPACE", 404);
    }

    // Only the owner may hard-delete the workspace. Without this, ANY member
    // (e.g. an invited teammate) could erase all tenant data + every member's
    // Clerk record. Mirrors the owner gate in /api/account/cancel.
    const role = await getWorkspaceRole(userId, workspaceId);
    if (role !== "owner") {
      return apiError("FORBIDDEN", 403, "Only the workspace owner can delete the account.");
    }

    // Audit BEFORE delete so the record outlives the workspace cascade.
    // We log into a "system" workspace_id=null row so it isn't cascaded.
    await audit({
      workspaceId: null,
      actorUserId: userId,
      action: "gdpr.delete",
      targetType: "workspace",
      targetId: workspaceId,
      payload: { mode: "gdpr_hard_delete" },
      request: req,
    });

    const sb = getServiceClient();

    // Best-effort: revoke Slack token before cascade delete
    const { data: slackRow } = await sb
      .from("workspace_slack")
      .select("access_token")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if ((slackRow as { access_token?: string } | null)?.access_token) {
      void fetch("https://slack.com/api/auth.revoke", {
        method:  "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body:    `token=${(slackRow as { access_token: string }).access_token}`,
      }).catch(() => undefined);
    }

    const { error: deleteError } = await sb
      .from("workspaces")
      .delete()
      .eq("id", workspaceId);

    if (deleteError) {
      console.error("[gdpr/delete] supabase:", deleteError);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    // Best-effort Stripe customer cleanup
    try {
      if (process.env.STRIPE_SECRET_KEY) {
        const user = await currentUser();
        const email = user?.emailAddresses?.[0]?.emailAddress;
        if (email) {
          const { stripe } = await import("@/lib/stripe");
          const customers = await stripe.customers.list({ email, limit: 5 });
          for (const c of customers.data) {
            await stripe.customers.del(c.id);
          }
        }
      }
    } catch (err) {
      console.error("[gdpr/delete] stripe cleanup:", err);
    }

    // Delete Clerk user last — once this succeeds the user can't sign in again
    try {
      const clerk = await clerkClient();
      await clerk.users.deleteUser(userId);
    } catch (err) {
      console.error("[gdpr/delete] clerk:", err);
    }

    return NextResponse.json({ deleted: true }, { status: 200 });
  } catch (err) {
    return captureAndError(err, "POST /api/gdpr/delete");
  }
}
