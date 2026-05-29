/**
 * GET /api/auth/slack/callback
 *
 * OAuth state cookie pattern (reusable for future OAuth flows):
 *   1. Authorize route generates a random `state` and stores it in a
 *      short-lived httpOnly cookie (`slack_oauth_state`).
 *   2. This callback route reads the cookie, compares it with the
 *      `state` query param Slack returned, and rejects on mismatch.
 *   3. The cookie is cleared on success or failure.
 *
 * On success: upserts `workspace_slack`, writes the webhook URL to
 * `workspaces.slack_webhook_url`, audits the event, redirects to
 * /settings?slack=connected.
 *
 * On failure: redirects to /settings?slack=error&reason=<reason>.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function errorRedirect(reason: string): NextResponse {
  return NextResponse.redirect(
    new URL(`/settings?slack=error&reason=${reason}`, APP_URL),
  );
}

interface SlackOAuthResponse {
  ok:               boolean;
  error?:           string;
  access_token?:    string;
  scope?:           string;
  team?:            { id: string; name: string };
  incoming_webhook?: {
    url:          string;
    channel:      string;
    channel_id:   string;
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", APP_URL));
  }

  // Rate limit: 5 per 5 min per user
  const rl = await rateLimit(req, userId, {
    bucket: "slack-oauth-callback",
    limit:  5,
    window: "5 m",
  });
  if (!rl.allowed) return errorRedirect("rate_limited");

  // CSRF: validate state cookie
  const cookieStore = await cookies();
  const storedState = cookieStore.get("slack_oauth_state")?.value;
  const queryState  = req.nextUrl.searchParams.get("state");
  const code        = req.nextUrl.searchParams.get("code");

  // Clear the state cookie regardless of outcome
  cookieStore.set("slack_oauth_state", "", { maxAge: 0, path: "/" });

  if (!storedState || !queryState || storedState !== queryState) {
    return errorRedirect("csrf");
  }

  if (!code) {
    return errorRedirect("no_code");
  }

  const clientId     = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri  = `${APP_URL}/api/auth/slack/callback`;

  if (!clientId || !clientSecret) {
    return errorRedirect("not_configured");
  }

  // Exchange code for token
  let slackData: SlackOAuthResponse;
  try {
    const body = new URLSearchParams({
      client_id:     clientId,
      client_secret: clientSecret,
      code,
      redirect_uri:  redirectUri,
    });
    const res = await fetch("https://slack.com/api/oauth.v2.access", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body:    body.toString(),
    });
    slackData = (await res.json()) as SlackOAuthResponse;
  } catch {
    return errorRedirect("slack_error");
  }

  if (
    !slackData.ok ||
    !slackData.access_token ||
    !slackData.team?.id ||
    !slackData.incoming_webhook?.url ||
    !slackData.incoming_webhook?.channel_id
  ) {
    return errorRedirect("slack_error");
  }

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return errorRedirect("no_workspace");

  const sb = getServiceClient();

  // Upsert workspace_slack — reconnecting replaces the old row atomically
  const { error: upsertErr } = await sb.from("workspace_slack").upsert(
    {
      workspace_id:       workspaceId,
      slack_team_id:      slackData.team.id,
      slack_team_name:    slackData.team.name ?? null,
      slack_channel_id:   slackData.incoming_webhook.channel_id,
      slack_channel_name: slackData.incoming_webhook.channel.replace(/^#/, ""),
      access_token:       slackData.access_token,
      scope:              slackData.scope ?? "",
      installed_by:       userId,
    },
    { onConflict: "workspace_id" },
  );

  if (upsertErr) {
    console.error("[slack/callback] upsert:", upsertErr);
    return errorRedirect("db_error");
  }

  // Write the webhook URL so the existing notification path works unchanged
  await sb
    .from("workspaces")
    .update({ slack_webhook_url: slackData.incoming_webhook.url })
    .eq("id", workspaceId);

  await audit({
    workspaceId,
    actorUserId: userId,
    action:      "slack.connect",
    targetType:  "workspace",
    targetId:    workspaceId,
    payload:     {
      slack_team_id:  slackData.team.id,
      slack_channel:  slackData.incoming_webhook.channel,
    },
  });

  return NextResponse.redirect(new URL("/settings?slack=connected", APP_URL));
}
