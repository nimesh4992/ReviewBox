/**
 * GET/POST /api/cron/trial-expiry
 *
 * Vercel Cron: daily.
 *
 * Ends trials that have run out. Until this existed, `trial_ends_at` was
 * stamped at signup and read by nobody: no trial ever ended, every trial user
 * kept Pro allowances indefinitely, and the product could not convert a single
 * one. That is the whole revenue loop, and it was open at both ends.
 *
 * Downgrades to `free` rather than suspending. A customer who lapses still
 * owns their reviews and their replies; locking them out of data they put in
 * is how you turn a slow decision into a refund request and a bad review of
 * our own. Free is deliberately usable: 1 app, 10 AI drafts, 25 published
 * replies a month.
 */

import { NextRequest, NextResponse } from "next/server";
import { clerkClient } from "@clerk/nextjs/server";
import * as Sentry from "@sentry/nextjs";

import { getServiceClient } from "@/lib/supabase-server";
import { isMissingColumnError } from "@/lib/db-errors";
import { planAfterTrial } from "@/lib/trial";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

interface ExpirySummary {
  scanned: number;
  downgraded: number;
  errors: string[];
}

async function handler(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const sb = getServiceClient();
  const now = new Date().toISOString();
  const summary: ExpirySummary = { scanned: 0, downgraded: 0, errors: [] };

  // Only rows that are BOTH on the trial plan AND past their end date. A
  // paying customer whose old trial date is long past must never be caught by
  // this, which is why plan is part of the filter and not just the date.
  const { data: expired, error } = await sb
    .from("workspaces")
    .select("id, name, trial_ends_at")
    .eq("plan", "trial")
    .not("trial_ends_at", "is", null)
    .lt("trial_ends_at", now)
    .is("deleted_at", null)
    .limit(500);

  if (error) {
    console.error("[trial-expiry] scan failed:", error);
    return NextResponse.json({ error: "SCAN_FAILED", detail: error.message }, { status: 500 });
  }

  summary.scanned = expired?.length ?? 0;
  if (!summary.scanned) {
    return NextResponse.json({ message: "No trials to end", ...summary });
  }

  const nextPlan = planAfterTrial();

  for (const ws of expired ?? []) {
    const workspaceId = ws.id as string;
    try {
      let update = await sb
        .from("workspaces")
        .update({ plan: nextPlan, trial_ended_at: now })
        .eq("id", workspaceId)
        // Re-assert the plan in the WHERE clause: if the customer paid between
        // the scan and this write, `plan` is no longer 'trial' and this matches
        // nothing. Without it we would downgrade someone who just gave us money.
        .eq("plan", "trial");

      // Migration 023 pending — retry without the timestamp column.
      if (isMissingColumnError(update.error)) {
        update = await sb
          .from("workspaces")
          .update({ plan: nextPlan })
          .eq("id", workspaceId)
          .eq("plan", "trial");
      }

      if (update.error) {
        summary.errors.push(`${workspaceId}: ${update.error.message}`);
        continue;
      }

      // Mirror onto Clerk metadata. Middleware and the AI rate limiter read the
      // plan from the session claim, so a workspace downgraded only in Postgres
      // would keep Pro allowances until the user next signed in.
      const { data: members } = await sb
        .from("workspace_members")
        .select("clerk_user_id")
        .eq("workspace_id", workspaceId);

      if (members?.length) {
        const clerk = await clerkClient();
        await Promise.allSettled(
          members.map((m) =>
            clerk.users.updateUserMetadata(m.clerk_user_id as string, {
              publicMetadata: { plan: nextPlan },
            }),
          ),
        );
      }

      summary.downgraded++;
      console.log(`[trial-expiry] ${workspaceId} (${ws.name}) trial ended -> ${nextPlan}`);
    } catch (err) {
      summary.errors.push(`${workspaceId}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Failures must be loud.
  //
  // Every downgrade in this loop was rejected by Postgres (23514) for months —
  // `free` was not in the workspaces_plan_check constraint (fixed by migration
  // 025) — and nobody noticed, because the only record of it was this array,
  // returned in a cron response body that nothing reads. A cron that reports
  // "complete" while having changed nothing is the same silent-success failure
  // this codebase has now been bitten by three times.
  if (summary.errors.length) {
    console.error(
      `[trial-expiry] ${summary.errors.length}/${summary.scanned} downgrades FAILED:`,
      summary.errors,
    );
    Sentry.captureException(
      new Error(`trial-expiry: ${summary.errors.length} of ${summary.scanned} downgrades failed`),
      {
        level: "error",
        tags: { route: "cron/trial-expiry" },
        extra: { errors: summary.errors.slice(0, 20), scanned: summary.scanned, downgraded: summary.downgraded },
      },
    );
  }

  return NextResponse.json({ message: "Trial expiry complete", ...summary });
}

export const GET = handler;
export const POST = handler;
