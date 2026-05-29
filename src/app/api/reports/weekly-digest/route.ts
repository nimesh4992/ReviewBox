/**
 * GET/POST /api/reports/weekly-digest
 *
 * Vercel Cron: every Monday at 09:00 UTC
 * Manual trigger: POST with Bearer CRON_SECRET
 *
 * For each active workspace:
 *   - Count reviews in the past 7 days
 *   - Avg rating, urgent count, unreplied count, top issue tag
 *   - Send weekly digest email to workspace owner
 */

import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/supabase-server";
import { sendWeeklyDigest } from "@/lib/email/send-weekly-digest";
import { notifySlack } from "@/lib/slack";

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
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch all active workspaces
  const { data: workspaces } = await sb
    .from("workspaces")
    .select("id, name")
    .is("deleted_at", null);

  if (!workspaces?.length) {
    return NextResponse.json({ message: "No workspaces", sent: 0 });
  }

  // Process workspaces in parallel batches of 10 — keeps total runtime under
  // Vercel's 60s function limit even for 200+ workspaces.
  const BATCH_SIZE = 10;
  const errors: string[] = [];
  let sent = 0;

  async function processWorkspace(ws: { id: string; name: string }): Promise<boolean> {
    try {
      const { data: member } = await sb
        .from("workspace_members")
        .select("clerk_user_id")
        .eq("workspace_id", ws.id)
        .eq("role", "owner")
        .limit(1)
        .maybeSingle();

      if (!member) return false;

      const clerk = await clerkClient();
      const clerkUser = await clerk.users.getUser(member.clerk_user_id as string);
      const email = clerkUser.emailAddresses[0]?.emailAddress;
      if (!email) return false;

      const { data: reviews } = await sb
        .from("reviews")
        .select("rating, priority, reply_status, issue_tags, app_id")
        .eq("workspace_id", ws.id)
        .gte("store_created_at", since);

      if (!reviews?.length) return false;

      const totalReviews   = reviews.length;
      const avgRating      = reviews.reduce((sum, r) => sum + (r.rating as number), 0) / totalReviews;
      const urgentCount    = reviews.filter((r) => r.priority === "urgent").length;
      const unrepliedCount = reviews.filter((r) => r.reply_status === "needs_reply").length;

      const tagCounts: Record<string, number> = {};
      for (const r of reviews) {
        const tags = (r.issue_tags as string[] | null) ?? [];
        for (const t of tags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      }
      const topIssue = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      const { data: apps } = await sb
        .from("apps")
        .select("name")
        .eq("workspace_id", ws.id)
        .limit(1);
      const appName = apps?.[0]?.name ?? ws.name ?? "your app";

      await sendWeeklyDigest(email, { totalReviews, avgRating, urgentCount, unrepliedCount, topIssue, appName });

      void notifySlack(ws.id, {
        text: `📊 Weekly digest — ${totalReviews} reviews, ${avgRating.toFixed(1)}★ avg`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: [
                `📊 *Weekly digest — ${appName}*`,
                `Reviews: *${totalReviews}* · Avg rating: *${avgRating.toFixed(1)}★*`,
                unrepliedCount > 0 ? `Needs reply: *${unrepliedCount}*` : null,
                urgentCount > 0    ? `🔴 Urgent: *${urgentCount}*` : null,
                topIssue           ? `Top issue: \`${topIssue}\`` : null,
              ].filter(Boolean).join("\n"),
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `<${process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com"}/reviews|View review queue →>`,
            },
          },
        ],
      });

      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`workspace ${ws.id}: ${msg}`);
      console.error("[weekly-digest]", ws.id, err);
      return false;
    }
  }

  for (let i = 0; i < workspaces.length; i += BATCH_SIZE) {
    const batch = workspaces.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((ws) => processWorkspace(ws as { id: string; name: string })));
    sent += results.filter((r) => r.status === "fulfilled" && r.value === true).length;
  }

  return NextResponse.json({ sent, total: workspaces.length, errors });
}

export const GET  = handler;
export const POST = handler;
