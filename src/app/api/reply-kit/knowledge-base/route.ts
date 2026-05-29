import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";

const VALID_CATEGORIES = ["bug", "feature", "praise", "billing", "general"] as const;

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("knowledge_base")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);

  return NextResponse.json({ entries: data }, { status: 200 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const rl = await rateLimit(req, session.userId, { bucket: "kb-create", limit: 30, window: "1 h" });
  if (!rl.allowed) return apiError("RATE_LIMITED", 429);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const body = (await req.json()) as { title?: unknown; content?: unknown; category?: unknown };

  // Validate
  const title    = typeof body.title   === "string" ? body.title.trim()   : "";
  const content  = typeof body.content === "string" ? body.content.trim() : "";
  const category = typeof body.category === "string" && VALID_CATEGORIES.includes(body.category as typeof VALID_CATEGORIES[number])
    ? body.category
    : "general";

  if (!title || title.length > 200)    return apiError("INVALID_INPUT", 400, "title required, max 200 chars");
  if (!content || content.length > 5000) return apiError("INVALID_INPUT", 400, "content required, max 5000 chars");

  const sb = getServiceClient();
  const { data, error } = await sb
    .from("knowledge_base")
    .insert({ workspace_id: workspaceId, title, content, category })
    .select("*")
    .single();

  if (error) return apiError("INTERNAL_SERVER_ERROR", 500);

  await audit({
    workspaceId,
    actorUserId: session.userId,
    action: "kb.create",
    targetType: "kb",
    targetId: data.id as string,
    payload: { title, category },
    request: req,
  });

  return NextResponse.json({ entry: data }, { status: 201 });
}
