import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { defer } from "@/lib/defer";
import { audit } from "@/lib/audit";
import { apiError, migrationPendingError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const rl = await rateLimit(req, userId, {
    bucket: "slack-disconnect",
    limit:  5,
    window: "1 m",
  });
  if (!rl.allowed) return apiError("RATE_LIMITED", 429);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const sb = getServiceClient();

  const { data } = await sb
    .from("workspace_slack")
    .select("access_token")
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const token = (data as { access_token?: string } | null)?.access_token;
  if (!token) return apiError("NOT_FOUND", 404);

  // Best-effort token revocation — continue even if Slack is down.
  // after() keeps the invocation alive: a bare fire-and-forget fetch dies
  // when Vercel freezes the lambda on response, leaving the token live.
  defer(async () => {
    await fetch("https://slack.com/api/auth.revoke", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    `token=${token}`,
    }).catch(() => undefined);
  });

  // Delete the workspace_slack row
  await sb.from("workspace_slack").delete().eq("workspace_id", workspaceId);

  // Clear the webhook URL so notifications stop.
  //
  // Checked, for the same reason the CONNECT side is (Wave 6 / M-8): this
  // column is the only thing notifySlack() reads. If the clear silently fails,
  // Settings shows Slack as disconnected and alerts keep arriving — a customer
  // who disconnected because the noise was unwanted has no way to make it stop.
  const { error: clearErr } = await sb
    .from("workspaces")
    .update({ slack_webhook_url: null })
    .eq("id", workspaceId);

  if (clearErr) {
    const pending = migrationPendingError(clearErr, "Disconnecting Slack");
    if (pending) return pending;
    console.error("[settings/slack] clear webhook url:", clearErr);
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  await audit({
    workspaceId,
    actorUserId: userId,
    action:      "slack.disconnect",
    targetType:  "workspace",
    targetId:    workspaceId,
  });

  return NextResponse.json({ ok: true });
}
