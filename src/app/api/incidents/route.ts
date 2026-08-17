/**
 * GET  /api/incidents  — list incidents for workspace
 * POST /api/incidents  — create a new incident (fires Slack alert)
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { getLiveAppIds } from "@/lib/live-apps";
import { isMissingColumnError, writeWithOptionalColumns } from "@/lib/db-errors";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { notifySlack, newIncident as slackIncident } from "@/lib/slack";
import { rateLimit } from "@/lib/api-rate-limit";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://tryreviewbox.com";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  // New user with no workspace yet — return empty so incidents page loads cleanly
  if (!workspaceId) return NextResponse.json({ incidents: [] });

  const sb = getServiceClient();

  // `incidents.app_id` is nullable and every row written before this was
  // workspace-level (null). So "scoped" means: this app's incidents PLUS the
  // workspace-level ones — filtering on app_id alone would hide every
  // existing incident. Rows belonging to a DELETED app are excluded either
  // way, which is the leak this shares with the review queries.
  const liveAppIds = await getLiveAppIds(sb, workspaceId);
  if (liveAppIds === null) return apiError("INTERNAL_SERVER_ERROR", 500);

  const requestedAppId = req.nextUrl.searchParams.get("appId")?.trim() || undefined;
  if (requestedAppId && !liveAppIds.includes(requestedAppId)) {
    return NextResponse.json({ incidents: [] });
  }
  const scopedAppIds = requestedAppId ? [requestedAppId] : liveAppIds;

  let query = sb
    .from("incidents")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("detected_at", { ascending: false })
    .limit(50);

  // These ids come from our own apps table; the guard keeps anything
  // unexpected out of the PostgREST filter string regardless.
  const safeIds = scopedAppIds.filter((id) => /^[0-9a-fA-F-]{36}$/.test(id));
  query = safeIds.length
    ? query.or(`app_id.is.null,app_id.in.(${safeIds.join(",")})`)
    : query.is("app_id", null);

  const { data, error } = await query;

  if (error) {
    // An older database may not have incidents.app_id at all — degrade to the
    // unscoped list rather than showing the user an error page.
    if (isMissingColumnError(error)) {
      const fallback = await sb
        .from("incidents")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("detected_at", { ascending: false })
        .limit(50);
      if (!fallback.error) return NextResponse.json({ incidents: fallback.data ?? [] });
    }
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }
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
    appId?:       string;
  };

  if (!body.title?.trim() || !body.severity) {
    return apiError("INVALID_INPUT", 400, "title and severity are required");
  }

  // Must match the DB check constraint in 001_initial_schema.sql. "low" was
  // accepted here and then rejected by Postgres (23514), so declaring a low
  // incident failed with a generic 500 and no explanation.
  const VALID_SEVERITIES = ["medium", "high", "critical"];
  if (!VALID_SEVERITIES.includes(body.severity)) {
    return apiError("INVALID_INPUT", 400, `severity must be one of: ${VALID_SEVERITIES.join(", ")}`);
  }

  const sb = getServiceClient();

  // Record WHICH app the incident is about when the client says so. The
  // column has existed since migration 001 and was never written, so every
  // incident was workspace-level and the list could not be scoped at all.
  // Validated against the workspace's live apps; anything else is dropped
  // rather than trusted.
  const liveAppIds = await getLiveAppIds(sb, workspaceId);
  const incidentAppId =
    body.appId && liveAppIds?.includes(body.appId) ? body.appId : null;

  const { data, error } = await writeWithOptionalColumns<{ id: string }>(
    (payload) => sb.from("incidents").insert(payload).select().single(),
    {
      workspace_id: workspaceId,
      title:        body.title.trim(),
      description:  body.description?.trim() ?? null,
      severity:     body.severity,
      status:       "active",
      detected_at:  new Date().toISOString(),
    },
    { app_id: incidentAppId },
  );

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
