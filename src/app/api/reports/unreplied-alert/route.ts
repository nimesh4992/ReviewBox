/**
 * GET/POST /api/reports/unreplied-alert
 *
 * Vercel Cron: daily at 10:00 UTC
 *
 * For each active workspace:
 *   - Find reviews older than 48h with reply_status = 'needs_reply'
 *   - If count > 0: email workspace owner + Slack notification
 */

import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendUnrepliedAlert } from "@/lib/email/send-unreplied-alert";
import { notifySlack } from "@/lib/slack";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

async function handler(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const sb = getServiceClient();

  // Reviews older than 48h that still need a reply
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: workspaces } = await sb
    .from("workspaces")
    .select("id, name")
    .is("deleted_at", null);

  if (!workspaces?.length) {
    return NextResponse.json({ message: "No workspaces", notified: 0 });
  }

  let notified = 0;
  const errors: string[] = [];

  for (const ws of workspaces) {
    try {
      // Count unreplied reviews > 48h old
      const { data: reviews } = await sb
        .from("reviews")
        .select("priority, app_id")
        .eq("workspace_id", ws.id)
        .eq("reply_status", "needs_reply")
        .lte("store_created_at", cutoff);

      if (!reviews?.length) continue;

      const count       = reviews.length;
      const urgentCount = reviews.filter((r) => r.priority === "urgent").length;

      // Primary app name
      const { data: apps } = await sb
        .from("apps")
        .select("name")
        .eq("workspace_id", ws.id)
        .limit(1);
      const appName = apps?.[0]?.name ?? ws.name ?? "your app";

      // Owner email
      const { data: member } = await sb
        .from("workspace_members")
        .select("clerk_user_id")
        .eq("workspace_id", ws.id)
        .eq("role", "owner")
        .limit(1)
        .single();

      if (!member) continue;

      const clerk    = await clerkClient();
      const clerkUser = await clerk.users.getUser(member.clerk_user_id);
      const email    = clerkUser.emailAddresses[0]?.emailAddress;

      // Fire email + Slack in parallel (both best-effort)
      await Promise.allSettled([
        email ? sendUnrepliedAlert(email, appName, count, urgentCount) : Promise.resolve(),
        notifySlack(ws.id, {
          text: `⏰ ${count} review${count === 1 ? "" : "s"} waiting 48h+ for a reply`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: [
                  `⏰ *${count} review${count === 1 ? "" : "s"} waiting 48h+* — ${appName}`,
                  urgentCount > 0 ? `🔴 ${urgentCount} urgent` : null,
                  `Replying promptly improves your store rating.`,
                ].filter(Boolean).join("\n"),
              },
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `<${APP_URL}/reviews?filter=needs_reply|Reply now →>`,
              },
            },
          ],
        }),
      ]);

      notified++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`workspace ${ws.id}: ${msg}`);
      console.error("[unreplied-alert]", ws.id, err);
    }
  }

  return NextResponse.json({ notified, total: workspaces.length, errors });
}

export const GET  = handler;
export const POST = handler;
