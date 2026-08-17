import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { syncWorkspace } from "@/services/review-sync";
import { rateLimit } from "@/lib/api-rate-limit";

// A workspace sync scrapes the public store, hits the Publisher/Connect APIs,
// and runs enrichment — comfortably more than the default function budget.
export const maxDuration = 60;

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  // If CRON_SECRET is not configured:
  //   - In production: FAIL CLOSED. A missing secret must never grant
  //     coordinator mode (sync ALL workspaces) or arbitrary ?workspaceId=
  //     syncs to an unauthenticated caller. Callers fall back to the Clerk
  //     session path, which pins them to their own workspace.
  //   - In dev / preview: allow through so local onboarding-triggered syncs
  //     aren't blocked before the env var is set.
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

// ── Main handler: coordinator | worker ─────────────────────────────────────────
//
// Worker mode  (?workspaceId=X) → sync that one workspace inline.
// Coordinator mode (no param)   → list active workspaces, fire one
//   worker request per workspace via fetch fanout, return immediately.
//   Each worker runs in its own Vercel invocation with its own 60s budget,
//   so we scale to ~500 workspaces per daily cron run without timeouts.

async function handler(req: NextRequest): Promise<NextResponse> {
  // Two ways to authenticate:
  // 1. Bearer CRON_SECRET — used by Vercel Cron. Grants access to coordinator
  //    mode (all workspaces) AND worker mode for any workspace.
  // 2. Signed-in Clerk user — used by "Sync now" buttons in the UI and the
  //    dashboard's self-heal kick. Only allowed to sync their OWN workspace;
  //    the workspaceId param is overridden with the workspace they're a
  //    member of.
  const cronAuthed = isAuthorized(req);
  let workspaceId = req.nextUrl.searchParams.get("workspaceId");

  if (!cronAuthed) {
    const session = await auth();
    if (!session?.userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    // Resolve the user's own workspace — ignore any workspaceId in the URL
    // to prevent one user from syncing another workspace's reviews.
    workspaceId = await getWorkspaceId(session.userId);
    if (!workspaceId) {
      return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });
    }

    // Session callers only — the cron branch above stays unmetered.
    //
    // Each call runs syncWorkspace() inline with maxDuration = 60: a Play HTML
    // scrape and an iTunes fetch per app, then AI enrichment. Unthrottled, a
    // signed-in user could loop it and spend Vercel compute, the Upstash
    // command budget and — worst — get our shared egress IP rate-limited or
    // blocked by Google, which breaks syncing for every customer at once, not
    // just the abuser. 4/hour is generous for the Settings "Sync now" button.
    const rl = await rateLimit(req, workspaceId, { bucket: "sync-manual", limit: 4, window: "1 h" });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "RATE_LIMITED", message: "Sync was run recently. Try again shortly." },
        { status: 429 },
      );
    }
  }

  // ── Worker mode ────────────────────────────────────────────────────────────
  if (workspaceId) {
    try {
      const summary = await syncWorkspace(workspaceId);
      return NextResponse.json({ ...summary, workspaceId });
    } catch (err) {
      // Logged in full below, but NOT returned. Every other route funnels
      // failures through captureAndError() for this reason: an internal
      // exception string can name tables, columns and upstream services.
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[sync/reviews] worker failed:", workspaceId, msg);
      return NextResponse.json(
        { error: "WORKER_FAILED", workspaceId },
        { status: 500 },
      );
    }
  }

  // ── Coordinator mode ──────────────────────────────────────────────────────
  // Only the cron can reach here (signed-in users get pinned to their own
  // workspace above and end up in worker mode).
  const sb = getServiceClient();
  const { data: workspaces } = await sb
    .from("workspaces")
    .select("id")
    .is("deleted_at", null);

  if (!workspaces?.length) {
    return NextResponse.json({ message: "No active workspaces to sync", workspacesQueued: 0 });
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_APP_URL
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000";

  const secret = process.env.CRON_SECRET;
  const headers: HeadersInit = secret ? { authorization: `Bearer ${secret}` } : {};

  // Fanout inside after(): a bare fire-and-forget fetch dies when Vercel
  // freezes the lambda on response — which silently skipped the daily sync.
  // after() keeps the invocation alive; each worker still runs in its own
  // invocation with its own budget, and once a worker request has been
  // RECEIVED it completes even if the coordinator is later reclaimed.
  after(async () => {
    await Promise.allSettled(
      workspaces.map((ws) =>
        fetch(`${baseUrl}/api/sync/reviews?workspaceId=${ws.id}`, {
          method: "GET",
          headers,
        }).catch((err) => {
          console.error(`[sync coordinator] failed to fanout ${ws.id}:`, err);
        }),
      ),
    );
  });

  return NextResponse.json({
    workspacesQueued: workspaces.length,
    coordinatedAt: new Date().toISOString(),
  });
}

// Vercel Cron uses GET. We also accept POST for manual triggers (curl/admin).
export const GET = handler;
export const POST = handler;
