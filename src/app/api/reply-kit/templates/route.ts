import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { audit } from "@/lib/audit";

interface CreateTemplateBody {
  name: string;
  content: string;
  tags: string[];
  ratingMin: number;
  ratingMax: number;
  language: string;
}

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

  // 3. Fetch templates
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("reply_templates")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("reply-kit/templates GET error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ templates: data }, { status: 200 });
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

  // 3. Parse body
  const body = (await req.json()) as CreateTemplateBody;
  const { name, content, tags, ratingMin, ratingMax, language } = body;

  // 4. Insert
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

  if (error) {
    console.error("reply-kit/templates POST error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  await audit({
    workspaceId,
    actorUserId: userId,
    action: "template.create",
    targetType: "template",
    targetId: data.id as string,
    payload: { name, language },
    request: req,
  });

  return NextResponse.json({ template: data }, { status: 201 });
}
