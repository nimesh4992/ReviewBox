import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient } from "@/lib/supabase-server";

interface OnboardingBody {
  workspaceName: string;
  workspaceSlug: string;
  appName: string;
  platform: "google-play" | "app-store";
  storeId: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Auth check
  const session = await auth();
  const userId = session?.userId;

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // 2. Parse body
  const body = (await req.json()) as OnboardingBody;
  const { workspaceName, workspaceSlug, appName, platform, storeId } = body;

  const sb = getServiceClient();

  // 3. Insert workspace
  const { data: workspace, error: wsError } = await sb
    .from("workspaces")
    .insert({ name: workspaceName, slug: workspaceSlug, plan: "free" })
    .select("id")
    .single();

  if (wsError) {
    // Postgres unique violation code
    if (wsError.code === "23505") {
      return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    }
    console.error("onboarding/workspace insert error:", wsError);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  const workspaceId = workspace.id as string;

  // 4. Insert workspace member (owner)
  const { error: memberError } = await sb
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, clerk_user_id: userId, role: "owner" });

  if (memberError) {
    console.error("onboarding/member insert error:", memberError);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  // 5. Insert app
  const dbPlatform = platform.replace("-", "_");
  const { data: app, error: appError } = await sb
    .from("apps")
    .insert({ workspace_id: workspaceId, name: appName, platform: dbPlatform, store_id: storeId })
    .select("id")
    .single();

  if (appError) {
    console.error("onboarding/app insert error:", appError);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  return NextResponse.json({ workspaceId, appId: app.id }, { status: 200 });
}
