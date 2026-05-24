import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { notifySlack } from "@/lib/slack";
import type { IncidentStatus } from "@/types/review";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

interface PatchIncidentBody {
  status?: IncidentStatus;
  owner?: string;
}

export async function GET(
  _req: NextRequest,
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

  // 3. Fetch incident
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("incidents")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) {
    console.error("incidents GET error:", error);
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({ incident: data }, { status: 200 });
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
  const body = (await req.json()) as PatchIncidentBody;

  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) updates.status = body.status;
  if (body.owner !== undefined) updates.owner = body.owner;

  // 4. Update — scoped to workspace
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("incidents")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("*")
    .single();

  if (error) {
    console.error("incidents PATCH error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

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

  return NextResponse.json({ incident: data }, { status: 200 });
}
