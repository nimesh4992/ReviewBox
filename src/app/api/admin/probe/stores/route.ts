/**
 * GET /api/admin/probe/stores
 *
 * Runs the real store pipeline against the fixture apps in
 * docs/PRODUCT_CONTEXT.md and reports what actually came back — from THIS
 * server's IP, which is the only IP whose behaviour matters.
 *
 * Auth: platform admin session, or Bearer CRON_SECRET so the weekly audit
 * can run it unattended.
 *
 * This is deliberately a production-facing diagnostic. Local runs and CI
 * runs prove nothing about whether Google will serve our Vercel functions.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/admin-auth";
import { runStoreProbe } from "@/lib/store-probe";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";
// Seven live upstream calls; the default budget is not enough.
export const maxDuration = 60;

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed — never open this to the internet
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const isAdmin = await requireAdminUser();
  if (!isAdmin && !cronAuthorized(req)) {
    return apiError("FORBIDDEN", 403);
  }

  const report = await runStoreProbe();

  // A failing probe is a real product outage, not a 500 — return 200 with the
  // verdict so the caller (and the founder's browser) always sees the detail.
  return NextResponse.json(report);
}
