/**
 * GET  /api/incidents  — list incidents for workspace
 * POST /api/incidents  — create a new incident (fires Slack alert)
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { notifySlack, newIncident as slackIncident } from "@/lib/slack";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

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

  if (error) return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  return NextResponse.json({ incidents: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });

  const body = (await req.json()) as {
    title:        string;
    description?: string;
    severity:     string;
    appName?:     string;
  };

  const VALID_SEVERITIES = new Set(["critical", "high", "medium", "low"]);
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "MISSING_FIELDS", message: "title is required" }, { status: 400 });
  }
  if (!body.severity || !VALID_SEVERITIES.has(body.severity)) {
    return NextResponse.json({ error: "INVALID_SEVERITY", message: "severity must be critical|high|medium|low" }, { status: 400 });
  }

  const title       = body.title.trim().slice(0, 200);
  const description = body.description?.trim().slice(0, 2000) ?? null;

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("incidents")
    .insert({
      workspace_id: workspaceId,
      title,
      description,
      severity:     body.severity,
      status:       "active",
      detected_at:  new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("[incidents POST]", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }

  // Fire Slack alert (best-effort)
  void notifySlack(workspaceId, slackIncident({
    title:    body.title.trim(),
    severity: body.severity,
    appName:  body.appName ?? "your app",
    appUrl:   `${APP_URL}/incidents/${(data as { id: string }).id}`,
  }));

  return NextResponse.json({ incident: data }, { status: 201 });
}
