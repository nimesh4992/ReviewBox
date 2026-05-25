import { NextRequest } from "next/server";

import { getServiceClient } from "@/lib/supabase-server";

export type AuditAction =
  // Reviews
  | "reply.publish"
  | "reply.draft.generate"
  // Automations
  | "rule.create"
  | "rule.update"
  | "rule.delete"
  | "rule.fire"
  // Templates
  | "template.create"
  | "template.update"
  | "template.delete"
  // Knowledge base
  | "kb.create"
  | "kb.update"
  | "kb.delete"
  // Apps
  | "app.connect"
  | "app.disconnect"
  | "app.create"
  | "app.update"
  | "app.delete"
  // Workspace lifecycle
  | "workspace.create"
  | "workspace.restore"
  | "workspace.delete"
  | "member.invite"
  | "member.accept_invite"
  | "member.remove"
  // Incidents
  | "incident.create"
  | "incident.update"
  // Reviews
  | "review.bulk_update"
  // Billing
  | "billing.upgrade"
  | "billing.cancel"
  | "billing.payment_failed"
  // GDPR
  | "gdpr.export"
  | "gdpr.delete"
  // Slack
  | "slack.connect"
  | "slack.disconnect";

export type AuditTargetType = "review" | "rule" | "template" | "kb" | "app" | "workspace" | "member" | "subscription";

export interface AuditEvent {
  workspaceId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  targetType?: AuditTargetType;
  targetId?: string;
  payload?: Record<string, unknown>;
  request?: NextRequest;
}

/**
 * Append a row to the audit log. Best-effort: never throws,
 * never blocks the caller. The audit log is critical-but-non-blocking.
 */
export async function audit(event: AuditEvent): Promise<void> {
  try {
    const sb = getServiceClient();
    const ip = event.request ? extractIp(event.request) : null;
    const userAgent = event.request?.headers.get("user-agent") ?? null;

    await sb.from("audit_log").insert({
      workspace_id:  event.workspaceId,
      actor_user_id: event.actorUserId,
      action:        event.action,
      target_type:   event.targetType,
      target_id:     event.targetId,
      payload:       event.payload ?? {},
      ip,
      user_agent:    userAgent,
    });
  } catch (err) {
    console.error("[audit] write failed:", err);
  }
}

function extractIp(req: NextRequest): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() ?? null;
  return req.headers.get("x-real-ip");
}
