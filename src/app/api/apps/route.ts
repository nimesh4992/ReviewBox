import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { canAddApp } from "@/lib/plan-enforcement";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) return NextResponse.json({ apps: [] });

  const sb = getServiceClient();
  const { data: apps } = await sb
    .from("apps")
    .select("id, name, platform, store_id")
    .eq("workspace_id", workspaceId)
    .order("created_at");

  return NextResponse.json({ apps: apps ?? [] });
}

interface CreateAppBody {
  name: string;
  platform: "google_play" | "app_store";
  packageName?: string;
  bundleId?: string;
}

export async function POST(request: Request) {
  // 1. Auth
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Workspace lookup
  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace found" }, { status: 404 });
  }

  // 3. Get plan from session claims (set via Clerk metadata)
  const plan = (sessionClaims?.metadata as { plan?: string } | undefined)?.plan ?? "free";

  // 4. Plan gate — check if workspace can add another app
  const allowed = await canAddApp(workspaceId, plan);
  if (!allowed) {
    return NextResponse.json(
      { error: "PLAN_LIMIT", message: "Upgrade to add more apps" },
      { status: 403 },
    );
  }

  // 5. Parse body
  let body: CreateAppBody;
  try {
    body = (await request.json()) as CreateAppBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.name || !body.platform) {
    return NextResponse.json(
      { error: "Missing required fields: name, platform" },
      { status: 400 },
    );
  }

  // 6. Insert into apps table
  const sb = getServiceClient();
  const storeId = body.platform === "google_play" ? body.packageName : body.bundleId;

  if (!storeId) {
    return NextResponse.json(
      { error: "Missing store identifier (packageName or bundleId)" },
      { status: 400 }
    );
  }

  const { data: app, error } = await sb
    .from("apps")
    .insert({
      workspace_id: workspaceId,
      name: body.name,
      platform: body.platform,
      store_id: storeId,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 7. Return new app
  return NextResponse.json({ app }, { status: 201 });
}
