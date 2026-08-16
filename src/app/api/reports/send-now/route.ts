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
import { getLiveApps } from "@/lib/live-apps";
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

  const body = (await req.json().catch(() => null)) as { report?: string; appId?: string } | null;
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

  // This report used to be computed over the whole workspace (deleted apps
  // included) and titled with an arbitrary app's name — the user pressed
  // "Send now" with App B selected and received App A's name over a blend of
  // both apps' numbers. Scope to live apps, honour the sidebar's selection
  // when the client sends it, and title the email with what it actually is.
  const liveApps = await getLiveApps(sb, workspaceId);
  if (liveApps === null) return apiError("INTERNAL_SERVER_ERROR", 500);
  if (liveApps.length === 0) {
    return NextResponse.json({
      sent: false,
      reason: "NO_DATA",
      message: "Connect an app first — there's nothing to report on yet.",
    });
  }

  const requestedAppId = body?.appId?.trim() || undefined;
  const selectedApp = requestedAppId
    ? liveApps.find((a) => a.id === requestedAppId)
    : undefined;
  if (requestedAppId && !selectedApp) {
    return apiError("INVALID_INPUT", 400, "That app isn't in your workspace.");
  }

  const scopedAppIds = selectedApp ? [selectedApp.id] : liveApps.map((a) => a.id);

  let appName: string;
  if (selectedApp) {
    appName = selectedApp.name;
  } else if (liveApps.length === 1) {
    appName = liveApps[0].name;
  } else {
    const { data: wsRow } = await sb
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .maybeSingle();
    appName = wsRow?.name ? `${wsRow.name} (all apps)` : "all your apps";
  }

  if (report === "weekly-digest") {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: reviews } = await sb
      .from("reviews")
      .select("rating, priority, reply_status, issue_tags")
      .eq("workspace_id", workspaceId)
      .in("app_id", scopedAppIds)
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
    .in("app_id", scopedAppIds)
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
