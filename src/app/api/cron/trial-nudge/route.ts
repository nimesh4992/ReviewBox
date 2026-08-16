/**
 * GET /api/cron/trial-nudge
 *
 * Vercel Cron: daily at 11:30 UTC
 * Manual trigger: GET with Authorization: Bearer CRON_SECRET
 *
 * For each active workspace on a free trial:
 *   - Day 5  (trial_ends_at in ~9 days): engagement nudge with live review counts
 *   - Day 12 (trial_ends_at in ~2 days): conversion push ("2 days left")
 *
 * Redis dedup key: trial_nudge:{workspaceId}:{day5|day12}
 * TTL: 30 days — prevents double-send if cron fires twice in one day.
 */

import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/supabase-server";
import { getLiveAppIds } from "@/lib/live-apps";
import { Redis } from "@upstash/redis";
import { sendTrialDay5Nudge } from "@/lib/email/send-trial-nudge";
import { sendTrialExpiringEmail } from "@/lib/email/send-trial-expiring";

function getRedis() {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed — sending trial emails to all users without auth is higher
  // risk than missing a sync. Same pattern as weekly-digest/unreplied-alert.
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

interface WorkspaceRow {
  id: string;
  name: string;
  trial_ends_at: string;
}

interface MemberRow {
  clerk_user_id: string;
  role: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const sb    = getServiceClient();
  const redis = getRedis();
  const now   = new Date();

  // ── Find workspaces in the day-5 and day-12 windows ──────────────────────────
  // Day 5:  trial started 4.5–5.5 days ago  →  trial_ends_at in 8.5–9.5 days
  // Day 12: trial started 11.5–12.5 days ago →  trial_ends_at in 1.5–2.5 days

  const day5WindowStart  = new Date(now.getTime() + 8.5  * 24 * 3600_000).toISOString();
  const day5WindowEnd    = new Date(now.getTime() + 9.5  * 24 * 3600_000).toISOString();
  const day12WindowStart = new Date(now.getTime() + 1.5  * 24 * 3600_000).toISOString();
  const day12WindowEnd   = new Date(now.getTime() + 2.5  * 24 * 3600_000).toISOString();

  const [day5Result, day12Result] = await Promise.all([
    sb
      .from("workspaces")
      .select("id, name, trial_ends_at")
      .is("deleted_at", null)
      .gte("trial_ends_at", day5WindowStart)
      .lte("trial_ends_at", day5WindowEnd),
    sb
      .from("workspaces")
      .select("id, name, trial_ends_at")
      .is("deleted_at", null)
      .gte("trial_ends_at", day12WindowStart)
      .lte("trial_ends_at", day12WindowEnd),
  ]);

  const day5Workspaces  = (day5Result.data  ?? []) as WorkspaceRow[];
  const day12Workspaces = (day12Result.data ?? []) as WorkspaceRow[];

  const clerk = await clerkClient();
  let sent = 0;
  let skipped = 0;

  // ── Helper: get owner email from Clerk ───────────────────────────────────────
  async function getOwnerEmail(workspaceId: string): Promise<{ email: string; name: string } | null> {
    const { data: members } = await sb
      .from("workspace_members")
      .select("clerk_user_id, role")
      .eq("workspace_id", workspaceId);

    const members_ = (members ?? []) as MemberRow[];
    const owner = members_.find((m) => m.role === "owner") ?? members_[0];
    if (!owner) return null;

    try {
      const user = await clerk.users.getUser(owner.clerk_user_id);
      const email = user.emailAddresses[0]?.emailAddress;
      if (!email) return null;
      const name =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.username ||
        email.split("@")[0] ||
        "there";
      return { email, name };
    } catch {
      return null;
    }
  }

  // ── Day-5: engagement nudge ──────────────────────────────────────────────────
  for (const ws of day5Workspaces) {
    const dedupKey = `trial_nudge:${ws.id}:day5`;
    if (redis) {
      const alreadySent = await redis.get(dedupKey);
      if (alreadySent) { skipped++; continue; }
    }

    const ownerInfo = await getOwnerEmail(ws.id);
    if (!ownerInfo) { skipped++; continue; }

    // Fetch real review counts for this workspace — live apps only. A
    // trialist who connected the wrong app, removed it, and connected the
    // right one was told "340 reviews, 118 unreplied" and then opened an
    // inbox showing 12. This email's entire value is that the number is
    // checkable, so it fails closed rather than quoting a workspace-wide
    // figure the product contradicts everywhere else.
    const liveAppIds = await getLiveAppIds(sb, ws.id);
    if (liveAppIds === null || liveAppIds.length === 0) { skipped++; continue; }

    const { count: totalCount } = await sb
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws.id)
      .in("app_id", liveAppIds);

    const { count: unrepliedCount } = await sb
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", ws.id)
      .in("app_id", liveAppIds)
      .eq("reply_status", "needs_reply");

    // Write dedup key BEFORE sending — prevents double-send if Redis write
    // fails after email fires (the safer failure mode is "not sent" not "sent twice").
    if (redis) {
      await redis.set(dedupKey, "1", { ex: 30 * 24 * 3600 });
    }

    await sendTrialDay5Nudge({
      to:             ownerInfo.email,
      name:           ownerInfo.name,
      unrepliedCount: unrepliedCount ?? 0,
      totalReviews:   totalCount ?? 0,
      workspaceName:  ws.name,
    });

    sent++;
  }

  // ── Day-12: conversion push ──────────────────────────────────────────────────
  for (const ws of day12Workspaces) {
    const dedupKey = `trial_nudge:${ws.id}:day12`;
    if (redis) {
      const alreadySent = await redis.get(dedupKey);
      if (alreadySent) { skipped++; continue; }
    }

    const ownerInfo = await getOwnerEmail(ws.id);
    if (!ownerInfo) { skipped++; continue; }

    // Write dedup key BEFORE sending — same reasoning as day-5 loop above.
    if (redis) {
      await redis.set(dedupKey, "1", { ex: 30 * 24 * 3600 });
    }

    await sendTrialExpiringEmail({ to: ownerInfo.email, workspaceId: ws.id, daysLeft: 2 });

    sent++;
  }

  return NextResponse.json({
    ok:      true,
    sent,
    skipped,
    day5:    day5Workspaces.length,
    day12:   day12Workspaces.length,
  });
}
