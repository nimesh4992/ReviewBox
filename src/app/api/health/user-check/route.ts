/**
 * GET/POST /api/health/user-check
 *
 * Vercel Cron: daily at 11:00 UTC
 *
 * Proactive support — detects users who are silently stuck and sends a
 * targeted, actionable email before they give up.
 *
 * Three signals checked per app:
 *
 *   1. NEVER_SYNCED   — app added 48h+ ago, last_sync_attempted_at IS NULL
 *   2. SYNC_FAILING   — last sync attempt was 48h+ ago with a non-success status
 *   3. SPIKE_UNREPLIED — 5+ reviews rated ≤2★ in 24h, all unreplied, oldest > 6h
 *
 * Redis keys gate re-sends so the same user isn't emailed every day for the
 * same issue.
 */

import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import { Redis } from "@upstash/redis";

import { getServiceClient } from "@/lib/supabase-server";
import {
  sendNeverSyncedNudge,
  sendSyncFailingNudge,
  sendSpikeUnrepliedNudge,
} from "@/lib/email/send-health-nudge";

// Re-send guard TTLs
const TTL_NEVER_SYNCED    = 60 * 60 * 24 * 3;  // 3 days
const TTL_SYNC_FAILING    = 60 * 60 * 24 * 3;  // 3 days
const TTL_SPIKE_UNREPLIED = 60 * 60 * 24 * 1;  // 1 day

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function getRedis(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

/** Returns true if the nudge was already sent recently (dedup guard). */
async function alreadySent(redis: Redis | null, key: string): Promise<boolean> {
  if (!redis) return false;
  const val = await redis.get(key);
  return val !== null;
}

async function markSent(redis: Redis | null, key: string, ttl: number): Promise<void> {
  if (!redis) return;
  await redis.set(key, "1", { ex: ttl });
}

/**
 * Batch-resolve owner emails for all given workspace IDs.
 * One DB query + one Clerk batch call — no N+1.
 */
async function resolveOwnerEmails(
  workspaceIds: string[],
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!workspaceIds.length) return result;

  try {
    const sb = getServiceClient();
    const { data: members } = await sb
      .from("workspace_members")
      .select("workspace_id, clerk_user_id")
      .in("workspace_id", workspaceIds)
      .eq("role", "owner");

    if (!members?.length) return result;

    // Map workspaceId → clerkUserId
    const wsToClerk = new Map(
      members.map((m) => [m.workspace_id as string, m.clerk_user_id as string]),
    );
    const clerkIds = [...new Set(members.map((m) => m.clerk_user_id as string))];

    const clerk = await clerkClient();
    const { data: users } = await clerk.users.getUserList({
      userId: clerkIds,
      limit: clerkIds.length,
    });

    const clerkEmailMap = new Map(
      users.map((u) => [u.id, u.emailAddresses[0]?.emailAddress ?? null]),
    );

    for (const [wsId, clerkId] of wsToClerk) {
      const email = clerkEmailMap.get(clerkId);
      if (email) result.set(wsId, email);
    }
  } catch (err) {
    console.error("[health/user-check] resolveOwnerEmails:", err);
  }

  return result;
}

interface NudgeSummary {
  neverSynced:    number;
  syncFailing:    number;
  spikeUnreplied: number;
  skipped:        number;
  errors:         string[];
}

async function handler(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const sb    = getServiceClient();
  const redis = getRedis();
  const now   = new Date();
  const summary: NudgeSummary = { neverSynced: 0, syncFailing: 0, spikeUnreplied: 0, skipped: 0, errors: [] };

  // ── Load all active apps ──────────────────────────────────────────────────

  // deleted_at IS NULL is essential: a soft-deleted app is never picked up by
  // the sync worker (which filters it out), so its last_sync_attempted_at is
  // frozen forever. Without this filter it permanently satisfies the
  // "failing for 48h+" test and re-nags the owner every 3 days, indefinitely,
  // about an app they already disconnected.
  const { data: apps } = await sb
    .from("apps")
    .select(
      "id, workspace_id, name, platform, store_id, last_sync_attempted_at, last_sync_status",
    )
    .is("deleted_at", null)
    .not("store_id", "is", null)
    .not("store_id", "eq", "");

  if (!apps?.length) {
    return NextResponse.json({ message: "No apps to check", ...summary });
  }

  // Load workspace created_at for the "never synced" threshold check.
  // This query filters soft-deleted workspaces, so membership in the resulting
  // map doubles as the liveness check applied to all three signals below.
  const workspaceIds = [...new Set(apps.map((a) => a.workspace_id as string))];
  const { data: workspaces } = await sb
    .from("workspaces")
    .select("id, created_at")
    .in("id", workspaceIds)
    .is("deleted_at", null);

  const wsCreatedAt = new Map(
    (workspaces ?? []).map((w) => [w.id as string, w.created_at as string]),
  );

  /** Owners of soft-deleted workspaces must never be emailed. */
  const isLiveWorkspace = (workspaceId: string): boolean => wsCreatedAt.has(workspaceId);

  // Batch-resolve all owner emails upfront — one DB query + one Clerk call.
  // Only for live workspaces; deleted ones are dropped above.
  const ownerEmails = await resolveOwnerEmails([...wsCreatedAt.keys()]);

  // ── Signal 1: Never synced ────────────────────────────────────────────────

  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  for (const app of apps) {
    if (app.last_sync_attempted_at !== null) continue;

    const wsCreated = wsCreatedAt.get(app.workspace_id as string);
    if (!wsCreated || wsCreated > fortyEightHoursAgo) continue; // workspace too new

    const key = `health_nudge:never_synced:${app.id}`;
    if (await alreadySent(redis, key)) { summary.skipped++; continue; }

    try {
      const email = ownerEmails.get(app.workspace_id as string) ?? null;
      if (!email) continue;

      await sendNeverSyncedNudge(email, app.name as string, app.platform as "google_play" | "app_store");
      await markSent(redis, key, TTL_NEVER_SYNCED);
      summary.neverSynced++;
    } catch (err) {
      summary.errors.push(`never_synced app ${app.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── Signal 2: Sync failing 2+ days ───────────────────────────────────────

  const successStatuses = new Set(["success", "credentials_verified", null]);

  for (const app of apps) {
    if (!isLiveWorkspace(app.workspace_id as string)) continue;
    if (successStatuses.has(app.last_sync_status as string | null)) continue;
    if (!app.last_sync_attempted_at) continue;
    if ((app.last_sync_attempted_at as string) > fortyEightHoursAgo) continue; // only if failing for 48h+

    const key = `health_nudge:sync_failing:${app.id}`;
    if (await alreadySent(redis, key)) { summary.skipped++; continue; }

    try {
      const email = ownerEmails.get(app.workspace_id as string) ?? null;
      if (!email) continue;

      await sendSyncFailingNudge(
        email,
        app.name as string,
        app.platform as "google_play" | "app_store",
        app.last_sync_status as string,
      );
      await markSent(redis, key, TTL_SYNC_FAILING);
      summary.syncFailing++;
    } catch (err) {
      summary.errors.push(`sync_failing app ${app.id}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // ── Signal 3: Spike unreplied 6h+ ────────────────────────────────────────

  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sixHoursAgo        = new Date(now.getTime() -  6 * 60 * 60 * 1000).toISOString();

  // One query for all apps — count negative unreplied reviews in the window
  const { data: spikeRows } = await sb
    .from("reviews")
    .select("app_id")
    .lte("rating", 2)
    .eq("reply_status", "needs_reply")
    .gte("store_created_at", twentyFourHoursAgo) // within last 24h
    .lte("store_created_at", sixHoursAgo);       // but older than 6h (not brand new)

  if (spikeRows?.length) {
    // Group by app_id
    const countByApp = spikeRows.reduce<Record<string, number>>((acc, r) => {
      const id = r.app_id as string;
      acc[id] = (acc[id] ?? 0) + 1;
      return acc;
    }, {});

    for (const [appId, count] of Object.entries(countByApp)) {
      if (count < 5) continue; // threshold: 5+ negative reviews

      const app = apps.find((a) => a.id === appId);
      if (!app) continue;
      if (!isLiveWorkspace(app.workspace_id as string)) continue;

      const key = `health_nudge:spike_unreplied:${appId}`;
      if (await alreadySent(redis, key)) { summary.skipped++; continue; }

      try {
        const email = ownerEmails.get(app.workspace_id as string) ?? null;
        if (!email) continue;

        await sendSpikeUnrepliedNudge(email, app.name as string, count);
        await markSent(redis, key, TTL_SPIKE_UNREPLIED);
        summary.spikeUnreplied++;
      } catch (err) {
        summary.errors.push(`spike_unreplied app ${appId}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log("[health/user-check]", summary);
  return NextResponse.json({ ...summary, checkedApps: apps.length });
}

export const GET  = handler;
export const POST = handler;
