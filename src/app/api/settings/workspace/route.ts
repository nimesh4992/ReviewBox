/**
 * GET  /api/settings/workspace — fetch workspace settings (brand_voice, support_email)
 * PATCH /api/settings/workspace — update brand_voice and/or support_email
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { Redis } from "@upstash/redis";

// Invalidate persona cache on save so next draft picks up changes immediately
async function bustPersonaCache(workspaceId: string) {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    const redis = new Redis({ url, token });
    await redis.del(`persona:${workspaceId}`);
  } catch { /* best-effort */ }
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: "WORKSPACE_NOT_FOUND" }, { status: 404 });
  }

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("workspaces")
    .select("name, support_email, brand_voice")
    .eq("id", workspaceId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json({
    name:         data.name         ?? "",
    supportEmail: data.support_email ?? "",
    brandVoice:   data.brand_voice   ?? "",
  });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) {
    return NextResponse.json({ error: "WORKSPACE_NOT_FOUND" }, { status: 404 });
  }

  const body = (await req.json()) as {
    supportEmail?: string;
    brandVoice?:   string;
  };

  const updates: Record<string, string> = {};
  if (typeof body.supportEmail === "string") updates.support_email = body.supportEmail.trim();
  if (typeof body.brandVoice   === "string") updates.brand_voice   = body.brandVoice.slice(0, 500).trim();

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "NO_FIELDS" }, { status: 400 });
  }

  const sb = getServiceClient();
  const { error } = await sb
    .from("workspaces")
    .update(updates)
    .eq("id", workspaceId);

  if (error) {
    console.error("workspace update failed:", error);
    return NextResponse.json({ error: "UPDATE_FAILED" }, { status: 500 });
  }

  // Bust persona cache so next reply draft picks up changes immediately
  await bustPersonaCache(workspaceId);

  return NextResponse.json({ ok: true });
}
