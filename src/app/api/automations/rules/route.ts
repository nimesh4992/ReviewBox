import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import type { AutomationAction, AutomationCondition } from "@/types/review";

// Allowlist — must stay in sync with AutomationAction union in types/review.ts
const VALID_ACTIONS: AutomationAction[] = [
  "ai_reply",
  "template_reply",
  "apply_tag",
  "escalate",
  "report_spam",
];
const NAME_MAX_LEN = 120;
const CONDITIONS_MAX = 10;

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
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("automation_rules")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("priority", { ascending: true });

  if (error) {
    console.error("automations/rules GET error:", error);
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  return NextResponse.json({ rules: data }, { status: 200 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth
  const session = await auth();
  const userId = session?.userId;
  if (!userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  // 3. Parse body
  const body = (await req.json()) as CreateRuleBody;
  const { name, description, conditions, action, actionLabel, actionConfig, appsScope, priority } = body;

  // 3a. Validate
  if (!name?.trim()) {
    return apiError("INVALID_INPUT", 400, "name is required");
  }
  if (!VALID_ACTIONS.includes(action)) {
    return apiError("INVALID_INPUT", 400, `action must be one of: ${VALID_ACTIONS.join(", ")}`);
  }
  if (!Array.isArray(conditions) || conditions.length === 0 || conditions.length > CONDITIONS_MAX) {
    return apiError("INVALID_INPUT", 400, `conditions must be a non-empty array of max ${CONDITIONS_MAX}`);
  }

  // 4. Insert
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("automation_rules")
    .insert({
      workspace_id:  workspaceId,
      name:          name.trim().slice(0, NAME_MAX_LEN),
      description:   description ?? "",
      conditions,
      action,
      action_label:  actionLabel,
      // `action_config` is NOT NULL (001_initial_schema.sql). Writing null
      // here raised 23502 and returned a 500, so installing any preset without
      // a config value — "All new reviews", "Reply to positive reviews", every
      // ai_reply rule — failed outright. Empty string is falsy for the
      // executor's `if (!tagToAdd) throw` checks, so it reads the same as unset
      // without violating the constraint.
      action_config: actionConfig ?? "",
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
    return apiError("INTERNAL_SERVER_ERROR", 500);
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
