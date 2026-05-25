import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reply_templates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);

  return NextResponse.json({ templates: data }, { status: 200 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const rl = await rateLimit(req, session.userId, { bucket: "template-create", limit: 20, window: "1 h" });
  if (!rl.allowed) return apiError("RATE_LIMITED", 429);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const body = (await req.json()) as Record<string, unknown>;

  // Validate required fields
  const name    = typeof body.name    === "string" ? body.name.trim()    : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const tags    = Array.isArray(body.tags) ? (body.tags as unknown[]).filter((t) => typeof t === "string") as string[] : [];
  const ratingMin = typeof body.ratingMin === "number" ? Math.max(1, Math.min(5, Math.floor(body.ratingMin))) : 1;
  const ratingMax = typeof body.ratingMax === "number" ? Math.max(1, Math.min(5, Math.floor(body.ratingMax))) : 5;
  const language  = typeof body.language === "string" ? body.language.slice(0, 10) : "en";

  if (!name || name.length > 120)           return apiError("INVALID_INPUT", 400, "name required, max 120 chars");
  if (!content || content.length > 5950)    return apiError("INVALID_INPUT", 400, "content required, max 5950 chars");
  if (ratingMin > ratingMax)                return apiError("INVALID_INPUT", 400, "ratingMin must be ≤ ratingMax");

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reply_templates")
    .insert({
      workspace_id: workspaceId,
      name,
      content,
      tags,
      rating_min: ratingMin,
      rating_max: ratingMax,
      language,
    })
    .select("*")
    .single();

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);

  await audit({
    workspaceId,
    actorUserId: session.userId,
    action: "template.create",
    targetType: "template",
    targetId: data.id as string,
    payload: { name, language },
    request: req,
  });

  return NextResponse.json({ template: data }, { status: 201 });
}
