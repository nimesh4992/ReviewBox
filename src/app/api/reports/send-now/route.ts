/**
 * POST /api/reports/send-now
 *
 * User-triggered "Send now" for the built-in reports. Unlike the cron routes
 * (which require CRON_SECRET and fan out to every workspace), this is scoped
 * to the signed-in user: it computes stats for THEIR workspace only and
 * emails THEM, so the Reports screen button works without exposing the
 * mass-send cron endpoints.
 *
 * Body: { report: "weekly-digest" | "unreplied-alert" }
 * 200 → { sent: true } or { sent: false, reason: "NO_DATA", message }
 */

import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { sendWeeklyDigest } from "@/lib/email/send-weekly-digest";
import { sendUnrepliedAlert } from "@/lib/email/send-unreplied-alert";
import { apiError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  // Each send is a real email through Resend — keep the button un-spammable.
  const rl = await rateLimit(req, session.userId, {
    bucket: "report-send-now",
    limit: 5,
    window: "1 h",
  });
  if (!rl.allowed) {
    return apiError("RATE_LIMITED", 429, "You can send up to 5 reports per hour.");
  }

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const body = (await req.json().catch(() => null)) as { report?: string } | null;
  const report = body?.report;
  if (report !== "weekly-digest" && report !== "unreplied-alert") {
    return apiError("INVALID_INPUT", 400, "report must be 'weekly-digest' or 'unreplied-alert'");
  }

  const clerk = await clerkClient();
  const user = await clerk.users.getUser(session.userId);
  const email = user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress
    ?? user.emailAddresses[0]?.emailAddress;
  if (!email) return apiError("INVALID_INPUT", 400, "No email address on your account.");

  const sb = getServiceClient();

  const { data: apps } = await sb
    .from("apps")
    .select("name")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .limit(1);
  const appName = apps?.[0]?.name ?? "your app";

  if (report === "weekly-digest") {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: reviews } = await sb
      .from("reviews")
      .select("rating, priority, reply_status, issue_tags")
      .eq("workspace_id", workspaceId)
      .gte("store_created_at", since);

    if (!reviews?.length) {
      return NextResponse.json({
        sent: false,
        reason: "NO_DATA",
        message: "No reviews in the last 7 days — nothing to digest yet.",
      });
    }

    const totalReviews   = reviews.length;
    const avgRating      = reviews.reduce((sum, r) => sum + (r.rating as number), 0) / totalReviews;
    const urgentCount    = reviews.filter((r) => r.priority === "urgent").length;
    const unrepliedCount = reviews.filter((r) => r.reply_status === "needs_reply").length;

    const tagCounts: Record<string, number> = {};
    for (const r of reviews) {
      for (const t of (r.issue_tags as string[] | null) ?? []) {
        tagCounts[t] = (tagCounts[t] ?? 0) + 1;
      }
    }
    const topIssue = Object.entries(tagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    await sendWeeklyDigest(email, {
      totalReviews, avgRating, urgentCount, unrepliedCount, topIssue, appName,
    });
    return NextResponse.json({ sent: true });
  }

  // unreplied-alert
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: reviews } = await sb
    .from("reviews")
    .select("priority")
    .eq("workspace_id", workspaceId)
    .eq("reply_status", "needs_reply")
    .lte("store_created_at", cutoff);

  if (!reviews?.length) {
    return NextResponse.json({
      sent: false,
      reason: "NO_DATA",
      message: "Nothing has waited 48+ hours for a reply — you're all caught up.",
    });
  }

  const urgentCount = reviews.filter((r) => r.priority === "urgent").length;
  await sendUnrepliedAlert(email, appName, reviews.length, urgentCount);
  return NextResponse.json({ sent: true });
}
