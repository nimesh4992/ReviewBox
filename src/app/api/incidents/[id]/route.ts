import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { notifySlack } from "@/lib/slack";
import type { IncidentStatus } from "@/types/review";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

const VALID_STATUSES: IncidentStatus[] = ["active", "investigating", "resolved"];
const OWNER_MAX_LEN = 120;

interface PatchIncidentBody {
  status?: IncidentStatus;
  owner?: string;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const { id } = await params;

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("incidents")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error || !data) return apiError("NOT_FOUND", 404);

  return NextResponse.json({ incident: data }, { status: 200 });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const { id } = await params;

  const body = (await req.json()) as PatchIncidentBody;

  const updates: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status)) {
      return apiError("INVALID_INPUT", 400, `status must be one of: ${VALID_STATUSES.join(", ")}`);
    }
    updates.status = body.status;
  }

  if (body.owner !== undefined) {
    const owner = String(body.owner).slice(0, OWNER_MAX_LEN).trim();
    if (owner) updates.owner = owner;
  }

  if (Object.keys(updates).length === 0) {
    return apiError("INVALID_INPUT", 400, "no valid fields to update");
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("incidents")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);
  if (!data)  return apiError("NOT_FOUND", 404);

  // Slack notification on status transitions
  if (body.status && body.status !== "active") {
    const row = data as { title: string; severity: string; status: string };
    const emoji = body.status === "resolved" ? "✅" : "🔍";
    const label = body.status === "resolved" ? "Incident resolved" : "Incident investigating";
    void notifySlack(workspaceId, {
      text: `${emoji} ${label}: ${row.title}`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${emoji} *${label}*\n*${row.title}*\nSeverity: ${row.severity} · Status: ${body.status}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `<${APP_URL}/incidents/${id}|View in ReviewBox →>`,
          },
        },
      ],
    });
  }

  await audit({
    workspaceId,
    actorUserId: session.userId,
    action: "incident.update",
    targetType: "workspace",
    targetId: id,
    payload: { fields: Object.keys(updates) },
    request: req,
  });

  return NextResponse.json({ incident: data }, { status: 200 });
}
