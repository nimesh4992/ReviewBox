import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError, migrationPendingError } from "@/lib/api-response";
import { isNoRowsError } from "@/lib/db-errors";
import { audit } from "@/lib/audit";
import {
  SELECTABLE_ACTIONS_SENTENCE,
  isSelectableAutomationAction,
} from "@/lib/automation-actions";


const NAME_MAX_LEN = 120;
const CONDITIONS_MAX = 10;

interface PatchRuleBody {
  name?: string;
  description?: string;
  enabled?: boolean;
  conditions?: unknown[];
  action?: string;
  actionLabel?: string;
  actionConfig?: string | null;
  appsScope?: "all" | string[];
  priority?: number;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // 1. Auth
  const session = await auth();
  const userId = session?.userId;
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const { id } = await params;

  // 3. Parse body
  const body = (await req.json()) as PatchRuleBody;

  // Validate action if provided
  if (body.action !== undefined && !isSelectableAutomationAction(body.action)) {
    return apiError("INVALID_INPUT", 400, `action must be one of: ${SELECTABLE_ACTIONS_SENTENCE}`);
  }

  if (body.conditions !== undefined && Array.isArray(body.conditions) && body.conditions.length > CONDITIONS_MAX) {
    return apiError("INVALID_INPUT", 400, `max ${CONDITIONS_MAX} conditions allowed`);
  }

  // Build update payload — only include fields that were sent
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = String(body.name).slice(0, NAME_MAX_LEN);
  if (body.description !== undefined) updates.description = String(body.description).slice(0, 500);
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.conditions !== undefined) updates.conditions = body.conditions;
  if (body.action !== undefined) updates.action = body.action;
  if (body.actionLabel !== undefined) updates.action_label = body.actionLabel;
  // Never null — the column is NOT NULL. See the note in the create route.
  if (body.actionConfig !== undefined) updates.action_config = body.actionConfig ?? "";
  if (body.appsScope !== undefined) updates.apps_scope = body.appsScope;
  if (body.priority !== undefined) updates.priority = body.priority;

  // 4. Update — scoped to workspace for safety
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("automation_rules")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  // `.single()` reports "no rows matched" AS an error, so a rule already
  // deleted in another tab is a 404, not a server fault. This route had no
  // not-found branch at all — every stale edit answered 500.
  if (isNoRowsError(error) || !data) return apiError("NOT_FOUND", 404);

  if (error) {
    const pending = migrationPendingError(error, "Saving this automation rule");
    if (pending) return pending;
    console.error("automations/rules PATCH error:", error);
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  await audit({
    workspaceId,
    actorUserId: userId,
    action: "rule.update",
    targetType: "rule",
    targetId: id,
    payload: { changedFields: Object.keys(updates) },
    request: req,
  });

  return NextResponse.json({ rule: data }, { status: 200 });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  // 1. Auth
  const session = await auth();
  const userId = session?.userId;
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const { id } = await params;

  // 3. Delete — scoped to workspace for safety
  const sb = getServiceClient();
  const { error } = await sb
    .from("automation_rules")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("automations/rules DELETE error:", error);
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  await audit({
    workspaceId,
    actorUserId: userId,
    action: "rule.delete",
    targetType: "rule",
    targetId: id,
    request: req,
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
