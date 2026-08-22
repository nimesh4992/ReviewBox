/**
 * GET /api/billing/usage
 *
 * What the workspace has used against its plan's monthly allowances.
 *
 * Exists because of ADR 009's Option B. A soft cap only works if the customer
 * is actually told — "we never withhold anything" plus silence is just an
 * unenforced limit, which is where this started. This is the read the
 * dashboard banner is built on.
 *
 * Reports, never gates. Nothing downstream may refuse work on the strength of
 * this response.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

import { apiError } from "@/lib/api-response";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { getReviewUsage, REVIEW_USAGE_NOTICE_PERCENT } from "@/lib/plan-enforcement";

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const sb = getServiceClient();
  const { data } = await sb
    .from("workspaces")
    .select("plan")
    .eq("id", workspaceId)
    .maybeSingle();

  // Same fallback the sync used: an unknown plan resolves to `free` inside
  // getReviewUsage(), and a workspace mid-onboarding is on trial.
  const plan = (data?.plan as string | null) ?? "trial";
  const reviews = await getReviewUsage(workspaceId, plan);

  return NextResponse.json({
    plan,
    reviews,
    noticePercent: REVIEW_USAGE_NOTICE_PERCENT,
  });
}
