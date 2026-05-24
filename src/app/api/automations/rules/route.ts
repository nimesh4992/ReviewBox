import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";
import type { AutomationAction, AutomationCondition } from "@/types/review";

interface CreateRuleBody {
  name: string;
  description?: string;
  conditions: AutomationCondition[];
  action: AutomationAction;
  actionLabel: string;
  actionConfig?: string;
  appsScope: "all" | string[];
  priority?: number;
}

export async function GET(): Promise<NextResponse> {
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

  // 3. Fetch rules
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("automation_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("priority", { ascending: true });

  if (error) {
    console.error("automations/rules GET error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }

  return NextResponse.json({ rules: data }, { status: 200 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  // 3. Parse body
  const body = (await req.json()) as CreateRuleBody;
  const { name, description, conditions, action, actionLabel, actionConfig, appsScope, priority } = body;

  // 4. Insert
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("automation_rules")
    .insert({
      workspace_id:  workspaceId,
      name,
      description:   description ?? "",
      conditions,
      action,
      action_label:  actionLabel,
      action_config: actionConfig ?? null,
      apps_scope:    appsScope ?? "all",
      priority:      priority ?? 0,
      enabled:       true,
      times_run:     0,
      last_run_at:   null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("automations/rules POST error:", error);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }

  await audit({
    workspaceId,
    actorUserId: userId,
    action: "rule.create",
    targetType: "rule",
    targetId: data.id as string,
    payload: { name, action, appsScope },
    request: req,
  });

  return NextResponse.json({ rule: data }, { status: 201 });
}
