/**
 * GET/POST /api/reports/daily-digest
 *
 * Vercel Cron: daily at 07:00 UTC. Manual trigger: Bearer CRON_SECRET.
 *
 * Sends one digest per app, per day. On the 1st of the month it additionally
 * sends the previous month's retrospective — folded into this same route
 * rather than given its own cron entry, because Vercel's Hobby plan is strict
 * about cron jobs and a rejected `vercel.json` fails the whole deploy
 * (see CLAUDE.md → Known Issues).
 *
 * ── The quiet-day rule ───────────────────────────────────────────────────────
 * We send even when nothing new arrived, showing the most recent review
 * instead. This is deliberate and copied from AppFollow: a daily email that
 * only sometimes turns up teaches people to stop looking for it, and once they
 * stop looking they stop coming back. Silence is the expensive option.
 */

import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getResend, FROM } from "@/lib/email/client";
import { dailyDigestEmail, monthlyDigestEmail } from "@/lib/email/templates";
import { EMAIL_APP_URL } from "@/lib/email/layout";
import {
  distributionOf,
  averageOf,
  reviewMeta,
  topThemes,
  replyRateOf,
} from "@/lib/digest-stats";
import { readTagLabels } from "@/services/tag-label-service";

export const maxDuration = 60;

const DAY_MS = 86_400_000;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed. Open access here would let anyone trigger mass mail for every
  // workspace on the platform.
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

interface AppRow {
  id: string;
  workspace_id: string;
  name: string;
  platform: string;
  icon_url: string | null;
  lifetime_rating: number | null;
}

interface ReviewRow {
  id: string;
  author: string | null;
  rating: number;
  body: string | null;
  store_created_at: string;
  reply_status: string;
  issue_tags: string[] | null;
  sentiment: string | null;
  app_version: string | null;
  country: string | null;
}

async function ownerEmail(sb: ReturnType<typeof getServiceClient>, workspaceId: string): Promise<string | null> {
  const { data: member } = await sb
    .from("workspace_members")
    .select("clerk_user_id")
    .eq("workspace_id", workspaceId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();
  if (!member) return null;

  try {
    const clerk = await clerkClient();
    const user  = await clerk.users.getUser(member.clerk_user_id as string);
    return user.emailAddresses[0]?.emailAddress ?? null;
  } catch {
    return null;
  }
}

async function handler(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const resend = getResend();
  if (!resend) {
    return NextResponse.json({ message: "RESEND_API_KEY not set", sent: 0 });
  }

  const sb  = getServiceClient();
  const now = new Date();

  // Monthly runs on the 1st, covering the month that just ended.
  const isFirstOfMonth = now.getUTCDate() === 1;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const monthEnd   = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthLabel = monthStart.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

  const { data: apps, error: appsError } = await sb
    .from("apps")
    .select("id, workspace_id, name, platform, icon_url, lifetime_rating")
    .is("deleted_at", null);

  if (appsError) {
    console.error("[daily-digest] app query failed:", appsError);
    return NextResponse.json({ error: "APP_QUERY_FAILED" }, { status: 500 });
  }
  if (!apps?.length) {
    return NextResponse.json({ message: "No apps", sent: 0 });
  }

  // Owner email is one Clerk round trip per workspace; resolve each workspace
  // once rather than once per app.
  const emailByWorkspace = new Map<string, string | null>();
  let sentDaily   = 0;
  let sentMonthly = 0;
  const errors: string[] = [];

  async function processApp(app: AppRow): Promise<void> {
    if (!emailByWorkspace.has(app.workspace_id)) {
      emailByWorkspace.set(app.workspace_id, await ownerEmail(sb, app.workspace_id));
    }
    const to = emailByWorkspace.get(app.workspace_id);
    if (!to) return;

    const since = new Date(now.getTime() - DAY_MS).toISOString();
    const columns = "id, author, rating, body, store_created_at, reply_status, issue_tags, sentiment, app_version, country";

    const [newRes, recentRes, allRes, unrepliedRes] = await Promise.all([
      sb.from("reviews").select(columns)
        .eq("app_id", app.id).gte("store_created_at", since)
        .order("store_created_at", { ascending: false }).limit(50),
      // The fallback for a quiet day: the latest review whenever it arrived.
      sb.from("reviews").select(columns)
        .eq("app_id", app.id)
        .order("store_created_at", { ascending: false }).limit(3),
      // Distribution and rating are over everything we hold, not the last day —
      // one day of reviews makes a meaningless bar chart.
      sb.from("reviews").select("rating").eq("app_id", app.id).limit(5000),
      sb.from("reviews").select("id", { count: "exact", head: true })
        .eq("app_id", app.id).eq("reply_status", "needs_reply"),
    ]);

    const fresh  = (newRes.data ?? []) as unknown as ReviewRow[];
    const recent = (recentRes.data ?? []) as unknown as ReviewRow[];
    const quietDay = fresh.length === 0;
    const shown  = quietDay ? recent : fresh;

    // Nothing at all — not even an old review. A digest here would be an empty
    // frame, so we skip rather than send a hollow one.
    if (!shown.length) return;

    const allRatings   = ((allRes.data ?? []) as { rating: number }[]).map((r) => r.rating);
    const lifetime     = Number(app.lifetime_rating);
    const rating       = Number.isFinite(lifetime) && lifetime > 0 ? lifetime : averageOf(allRatings);
    const freshAverage = averageOf(fresh.map((r) => r.rating));
    // Today against the lifetime average: "what landed today vs what we usually
    // get". Null on a quiet day, when there is nothing to compare.
    const ratingDelta  = rating != null && freshAverage != null ? freshAverage - rating : null;

    const message = dailyDigestEmail({
      appName: app.name,
      iconUrl: app.icon_url,
      platform: app.platform === "app_store" ? "App Store" : "Google Play",
      distribution: distributionOf(allRatings),
      newReviews: fresh.length,
      needsReply: unrepliedRes.count ?? 0,
      rating,
      ratingDelta,
      reviews: shown.slice(0, 3).map((r) => ({
        id: r.id,
        author: r.author ?? "Anonymous",
        rating: r.rating,
        body: r.body ?? "",
        meta: reviewMeta(r),
      })),
      quietDay,
      unsubscribeUrl: `${EMAIL_APP_URL}/settings`,
    });

    const { error } = await resend!.emails.send({
      from: FROM, to, subject: message.subject, html: message.html, text: message.text,
    });
    if (error) {
      errors.push(`daily ${app.id}: ${error.message}`);
      return;
    }
    sentDaily += 1;

    if (!isFirstOfMonth) return;

    // ── Monthly retrospective ────────────────────────────────────────────────
    const [monthRes, publishedRes] = await Promise.all([
      sb.from("reviews").select(columns)
        .eq("app_id", app.id)
        .gte("store_created_at", monthStart.toISOString())
        .lt("store_created_at", monthEnd.toISOString())
        .limit(5000),
      sb.from("audit_log").select("id", { count: "exact", head: true })
        .eq("workspace_id", app.workspace_id).eq("action", "reply.publish")
        .gte("created_at", monthStart.toISOString())
        .lt("created_at", monthEnd.toISOString()),
    ]);

    const monthReviews = (monthRes.data ?? []) as unknown as ReviewRow[];
    if (!monthReviews.length) return;

    const monthAvg = averageOf(monthReviews.map((r) => r.rating));

    const monthly = monthlyDigestEmail({
      appName: app.name,
      iconUrl: app.icon_url,
      platform: app.platform === "app_store" ? "App Store" : "Google Play",
      distribution: distributionOf(monthReviews.map((r) => r.rating)),
      monthLabel,
      rating: monthAvg,
      // The month against the lifetime average, which is the only comparison we
      // can make without storing a rating history. Null when we lack either.
      ratingDelta: monthAvg != null && rating != null ? monthAvg - rating : null,
      totalReviews: monthReviews.length,
      repliesPublished: publishedRes.count ?? 0,
      replyRate: replyRateOf(monthReviews),
      topThemes: topThemes(monthReviews, 5, await readTagLabels(app.workspace_id)),
      unsubscribeUrl: `${EMAIL_APP_URL}/settings`,
    });

    const { error: monthlyError } = await resend!.emails.send({
      from: FROM, to, subject: monthly.subject, html: monthly.html, text: monthly.text,
    });
    if (monthlyError) errors.push(`monthly ${app.id}: ${monthlyError.message}`);
    else sentMonthly += 1;
  }

  // Batches of 5 rather than 10: each app is up to six queries plus two sends,
  // and the whole route has to finish inside the function time limit.
  const BATCH = 5;
  const rows = apps as unknown as AppRow[];
  for (let i = 0; i < rows.length; i += BATCH) {
    const results = await Promise.allSettled(rows.slice(i, i + BATCH).map(processApp));
    for (const r of results) {
      if (r.status === "rejected") errors.push(String(r.reason));
    }
  }

  if (errors.length) console.error("[daily-digest] errors:", errors);

  return NextResponse.json({
    sentDaily,
    sentMonthly,
    apps: rows.length,
    errors: errors.length,
  });
}

export const GET  = handler;
export const POST = handler;
