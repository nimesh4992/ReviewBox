/**
 * POST /api/settings/slack/test
 * Sends a test message to the provided Slack webhook URL.
 * Rate-limited to 5 requests / minute per workspace.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";
import { sendSlackNotification } from "@/lib/slack";

const SLACK_URL_PREFIX = "https://hooks.slack.com/";
const SLACK_URL_MAX    = 500;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const rl = await rateLimit(req, workspaceId, {
    bucket: "slack_test",
    limit:  5,
    window: "1 m",
  });
  if (!rl.allowed) return apiError("RATE_LIMITED", 429, "Too many test attempts. Try again in a minute.");

  const { webhookUrl } = (await req.json()) as { webhookUrl?: string };

  if (
    typeof webhookUrl !== "string" ||
    !webhookUrl.startsWith(SLACK_URL_PREFIX) ||
    webhookUrl.length > SLACK_URL_MAX
  ) {
    return apiError("INVALID_INPUT", 400, "webhookUrl must start with https://hooks.slack.com/ (max 500 chars)");
  }

  const ok = await sendSlackNotification(webhookUrl, {
    text: "✅ ReviewBox is connected! You'll receive rating spikes, incidents, and urgent review alerts here.",
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ *ReviewBox connected*\nYou'll receive alerts here for:\n• ⚠️ Rating spikes\n• 🚨 New incidents\n• 🔴 Urgent reviews",
        },
      },
    ],
  });

  if (!ok) return apiError("SERVICE_UNAVAILABLE", 502, "Failed to send to Slack — check the webhook URL.");

  return NextResponse.json({ ok: true });
}
