/**
 * GET /api/automations/logs
 *
 * Returns the last 50 automation execution log entries for the workspace.
 * Used by the Run history panel in AutomationHub.
 *
 * Query params:
 *   ruleId  — (optional) filter to a specific rule
 *   limit   — (optional) max rows, default 50, max 100
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import type { AutomationExecutionLog } from "@/types/review";

function mapRow(r: Record<string, unknown>): AutomationExecutionLog {
  return {
    id:            r.id            as string,
    workspaceId:   r.workspace_id  as string,
    ruleId:        r.rule_id       as string,
    ruleName:      r.rule_name     as string,
    reviewId:      r.review_id     as string,
    reviewRating:  (r.review_rating  ?? null) as number | null,
    reviewSnippet: (r.review_snippet ?? null) as string | null,
    action:        r.action        as AutomationExecutionLog["action"],
    status:        r.status        as "success" | "error",
    errorMessage:  (r.error_message ?? null) as string | null,
    executedAt:    r.executed_at   as string,
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const ruleId    = searchParams.get("ruleId") ?? undefined;
  const limitRaw  = Number(searchParams.get("limit") ?? "50");
  const limit     = Math.min(Math.max(1, limitRaw), 100);

  const sb = getServiceClient();
  let query = sb
    .from("automation_execution_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("executed_at", { ascending: false })
    .limit(limit);

  if (ruleId) {
    query = query.eq("rule_id", ruleId) as typeof query;
  }

  const { data, error } = await query;

  if (error) {
    console.error("automations/logs GET error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  return NextResponse.json({
    logs: (data ?? []).map((r) => mapRow(r as Record<string, unknown>)),
  });
}
