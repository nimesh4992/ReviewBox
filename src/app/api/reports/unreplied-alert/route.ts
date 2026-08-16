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
import { getLiveApps } from "@/lib/live-apps";
import { sendUnrepliedAlert } from "@/lib/email/send-unreplied-alert";
import { notifySlack } from "@/lib/slack";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Require the secret — open access would let anyone trigger mass emails for all workspaces
  if (!secret) return false;
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

  const errors: string[] = [];
  // Hoist the Clerk client out of the loop — one instance for the whole run.
  const clerk = await clerkClient();

  async function processWorkspace(ws: { id: string; name: string }): Promise<boolean> {
    // Live apps first — and fail CLOSED if the lookup errors. This alert used
    // to count by workspace_id alone and label the total with an arbitrary
    // app's name: a deleted app's leftover reviews inflated the count, and a
    // two-app workspace was told "«App A» has 127 reviews waiting" where 117
    // of them belonged to App B. One alert per app, each with its own name
    // and its own count.
    const liveApps = await getLiveApps(sb, ws.id);
    if (liveApps === null || liveApps.length === 0) return false;

    const { data: reviews } = await sb
      .from("reviews")
      .select("priority, app_id")
      .eq("workspace_id", ws.id)
      .in("app_id", liveApps.map((a) => a.id))
      .eq("reply_status", "needs_reply")
      .lte("store_created_at", cutoff);

    if (!reviews?.length) return false;

    // Owner email
    const { data: member } = await sb
      .from("workspace_members")
      .select("clerk_user_id")
      .eq("workspace_id", ws.id)
      .eq("role", "owner")
      .limit(1)
      .maybeSingle();

    if (!member) return false;

    const clerkUser = await clerk.users.getUser(member.clerk_user_id);
    const email    = clerkUser.emailAddresses[0]?.emailAddress;

    const byApp = new Map<string, { count: number; urgentCount: number }>();
    for (const r of reviews) {
      const bucket = byApp.get(r.app_id as string) ?? { count: 0, urgentCount: 0 };
      bucket.count += 1;
      if (r.priority === "urgent") bucket.urgentCount += 1;
      byApp.set(r.app_id as string, bucket);
    }

    const sends: Promise<unknown>[] = [];
    for (const app of liveApps) {
      const bucket = byApp.get(app.id);
      if (!bucket) continue;
      const { count, urgentCount } = bucket;
      const appName = app.name || ws.name || "your app";

      // Fire email + Slack in parallel (both best-effort)
      if (email) sends.push(sendUnrepliedAlert(email, appName, count, urgentCount));
      sends.push(
        notifySlack(ws.id, {
          text: `⏰ ${count} review${count === 1 ? "" : "s"} waiting 48h+ for a reply — ${appName}`,
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
      );
    }

    await Promise.allSettled(sends);
    return sends.length > 0;
  }

  // Process in batches of 10 to stay under Vercel's 60s function budget —
  // a sequential loop over many workspaces would time out and silently send
  // only a prefix. Mirrors the weekly-digest batching.
  const BATCH_SIZE = 10;
  let notified = 0;
  for (let i = 0; i < workspaces.length; i += BATCH_SIZE) {
    const batch = workspaces.slice(i, i + BATCH_SIZE) as { id: string; name: string }[];
    const results = await Promise.allSettled(batch.map(processWorkspace));
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") {
        if (r.value) notified++;
      } else {
        const ws = batch[idx];
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        errors.push(`workspace ${ws.id}: ${msg}`);
        console.error("[unreplied-alert]", ws.id, r.reason);
      }
    });
  }

  return NextResponse.json({ notified, total: workspaces.length, errors });
}

export const GET  = handler;
export const POST = handler;
