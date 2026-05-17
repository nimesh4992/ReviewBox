import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";

interface PatchRuleBody {
  name?: string;
  description?: string;
  enabled?: boolean;
  conditions?: unknown[];
  action?: string;
  actionLabel?: string;
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
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // 2. Resolve workspace
  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) {
    return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });
  }

  const { id } = await params;

  // 3. Parse body
  const body = (await req.json()) as PatchRuleBody;

  // Build update payload — only include fields that were sent
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.enabled !== undefined) updates.enabled = body.enabled;
  if (body.conditions !== undefined) updates.conditions = body.conditions;
  if (body.action !== undefined) updates.action = body.action;
  if (body.actionLabel !== undefined) updates.action_label = body.actionLabel;
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

  if (error) {
    console.error("automations/rules PATCH error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
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
  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // 2. Resolve workspace
  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) {
    return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });
  }

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
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
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
