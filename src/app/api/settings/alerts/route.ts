import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import type { AlertPreference, AlertType } from "@/types/review";

const VALID_ALERT_TYPES: AlertType[] = [
  "urgent_review",
  "critical_spike",
  "daily_digest",
  "weekly_digest",
  "monthly_report",
];
const LABEL_MAX = 100;
const DESC_MAX  = 300;

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("alert_preferences")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("settings/alerts GET error:", error);
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  return NextResponse.json({ preferences: data ?? [] }, { status: 200 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return apiError("INVALID_INPUT", 400, "Invalid JSON body");
  }

  if (!Array.isArray(raw)) {
    return apiError("INVALID_INPUT", 400, "Body must be an array of alert preferences");
  }

  // Validate and sanitize each preference
  const rows: Record<string, unknown>[] = [];
  for (const item of raw as AlertPreference[]) {
    if (!VALID_ALERT_TYPES.includes(item.type)) {
      return apiError("INVALID_INPUT", 400, `invalid alert type: ${item.type}`);
    }
    if (typeof item.enabled !== "boolean") {
      return apiError("INVALID_INPUT", 400, "enabled must be a boolean");
    }
    const channels = item.channels;
    if (typeof channels !== "object" || channels === null ||
        typeof channels.email !== "boolean" || typeof channels.slack !== "boolean") {
      return apiError("INVALID_INPUT", 400, "channels must be { email: boolean, slack: boolean }");
    }

    rows.push({
      workspace_id: workspaceId,
      type:         item.type,
      label:        typeof item.label === "string" ? item.label.slice(0, LABEL_MAX) : "",
      description:  typeof item.description === "string" ? item.description.slice(0, DESC_MAX) : "",
      enabled:      item.enabled,
      // slackWebhookUrl was dropped here while the UI collected it in a
      // dedicated field and reported "Preferences saved" — the URL went
      // nowhere and the box was empty again on reload. Only https://hooks.slack
      // URLs are stored, so a typo can't turn this into an open redirect for
      // alert payloads.
      channels: {
        email: channels.email,
        slack: channels.slack,
        ...(typeof channels.slackWebhookUrl === "string" &&
        channels.slackWebhookUrl.startsWith("https://hooks.slack.com/")
          ? { slackWebhookUrl: channels.slackWebhookUrl.slice(0, 500) }
          : {}),
      },
      schedule_time: typeof item.scheduleTime === "string" ? item.scheduleTime.slice(0, 10) : null,
      schedule_day_of_week:  typeof item.scheduleDayOfWeek === "number" ? Math.max(0, Math.min(6, item.scheduleDayOfWeek)) : null,
      schedule_day_of_month: typeof item.scheduleDayOfMonth === "number" ? Math.max(1, Math.min(31, item.scheduleDayOfMonth)) : null,
    });
  }

  const sb = getServiceClient();
  const { error } = await sb
    .from("alert_preferences")
    .upsert(rows, { onConflict: "workspace_id,type" });

  if (error) {
    console.error("settings/alerts POST error:", error);
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  await audit({
    workspaceId,
    actorUserId: session.userId,
    action: "alerts.update",
    targetType: "workspace",
    targetId: workspaceId,
    payload: { updatedTypes: rows.map((r) => r.type) },
    request: req,
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
