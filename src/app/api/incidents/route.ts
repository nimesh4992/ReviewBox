/**
 * GET  /api/incidents  — list incidents for workspace
 * POST /api/incidents  — create a new incident (fires Slack alert)
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { notifySlack, newIncident as slackIncident } from "@/lib/slack";
import { rateLimit } from "@/lib/api-rate-limit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  // New user with no workspace yet — return empty so incidents page loads cleanly
  if (!workspaceId) return NextResponse.json({ incidents: [] });

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("incidents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("detected_at", { ascending: false })
    .limit(50);

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);
  return NextResponse.json({ incidents: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const rl = await rateLimit(req, workspaceId, { bucket: "incidents_create", limit: 10, window: "1 m" });
  if (!rl.allowed) return apiError("RATE_LIMITED", 429);

  const body = (await req.json()) as {
    title:        string;
    description?: string;
    severity:     string;
    appName?:     string;
  };

  if (!body.title?.trim() || !body.severity) {
    return apiError("INVALID_INPUT", 400, "title and severity are required");
  }

  const VALID_SEVERITIES = ["low", "medium", "high", "critical"];
  if (!VALID_SEVERITIES.includes(body.severity)) {
    return apiError("INVALID_INPUT", 400, `severity must be one of: ${VALID_SEVERITIES.join(", ")}`);
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("incidents")
    .insert({
      workspace_id: workspaceId,
      title:        body.title.trim(),
      description:  body.description?.trim() ?? null,
      severity:     body.severity,
      status:       "active",
      detected_at:  new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[incidents POST]", error);
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  // Fire Slack alert (best-effort)
  void notifySlack(workspaceId, slackIncident({
    title:    body.title.trim(),
    severity: body.severity,
    appName:  body.appName ?? "your app",
    appUrl:   `${APP_URL}/incidents/${(data as { id: string }).id}`,
  }));

  await audit({
    workspaceId,
    actorUserId: session.userId,
    action: "incident.create",
    targetType: "workspace",
    targetId: (data as { id: string }).id,
    payload: { title: body.title.trim(), severity: body.severity },
    request: req,
  });

  return NextResponse.json({ incident: data }, { status: 201 });
}
