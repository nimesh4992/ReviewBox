import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import type { AlertPreference } from "@/types/review";

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

  // 3. Fetch alert preferences
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("alert_preferences")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("settings/alerts GET error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ preferences: data ?? [] }, { status: 200 });
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

  // 3. Parse + validate body
  const rawPrefs = (await req.json()) as unknown;
  if (!Array.isArray(rawPrefs) || rawPrefs.length > 20) {
    return NextResponse.json({ error: "INVALID_INPUT", message: "preferences must be an array of at most 20 items" }, { status: 400 });
  }
  const preferences = rawPrefs as AlertPreference[];

  // 4. Upsert each preference keyed by (workspace_id, type)
  const sb = getServiceClient();
  const rows = preferences.map((pref) => ({
    workspace_id: workspaceId,
    type: pref.type,
    label: pref.label,
    description: pref.description,
    enabled: pref.enabled,
    channels: pref.channels,
    schedule_time: pref.scheduleTime ?? null,
    schedule_day_of_week: pref.scheduleDayOfWeek ?? null,
    schedule_day_of_month: pref.scheduleDayOfMonth ?? null,
  }));

  const { error } = await sb
    .from("alert_preferences")
    .upsert(rows, { onConflict: "workspace_id,type" });

  if (error) {
    console.error("settings/alerts POST error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
