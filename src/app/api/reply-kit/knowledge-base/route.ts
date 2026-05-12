import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

interface CreateKbBody {
  title: string;
  content: string;
  category: string;
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

  // 3. Fetch entries
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("knowledge_base")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("reply-kit/knowledge-base GET error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ entries: data }, { status: 200 });
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
  const body = (await req.json()) as CreateKbBody;
  const { title, content, category } = body;

  // 4. Insert
  const sb = getServiceClient();
  const { data, error } = await sb
    .from("knowledge_base")
    .insert({ workspace_id: workspaceId, title, content, category })
    .select("*")
    .single();

  if (error) {
    console.error("reply-kit/knowledge-base POST error:", error);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ entry: data }, { status: 201 });
}
