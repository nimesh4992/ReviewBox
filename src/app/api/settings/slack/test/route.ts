/**
 * POST /api/settings/slack/test
 * Sends a test message to the provided Slack webhook URL.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { sendSlackNotification } from "@/lib/slack";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { webhookUrl } = (await req.json()) as { webhookUrl?: string };
  if (!webhookUrl?.startsWith("https://hooks.slack.com/")) {
    return NextResponse.json({ error: "INVALID_URL" }, { status: 400 });
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

  if (!ok) {
    return NextResponse.json({ error: "SEND_FAILED" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
