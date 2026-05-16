import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient } from "@/lib/supabase-server";
import { sendWelcomeEmail } from "@/lib/email/send-welcome";

interface OnboardingBody {
  workspaceName: string;
  workspaceSlug: string;
  appName:       string;
  platform:      "google-play" | "app-store";
  storeId?:      string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const userId  = session?.userId;

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json()) as OnboardingBody;
  const { workspaceName, workspaceSlug, appName, platform, storeId = "" } = body;

  const sb = getServiceClient();

  // Insert workspace
  const { data: workspace, error: wsError } = await sb
    .from("workspaces")
    .insert({ name: workspaceName, slug: workspaceSlug, plan: "free" })
    .select("id")
    .single();

  if (wsError) {
    if (wsError.code === "23505") {
      return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
    }
    console.error("[onboarding] workspace insert:", wsError);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  const workspaceId = workspace.id as string;

  // Insert workspace member (owner)
  const { error: memberError } = await sb
    .from("workspace_members")
    .insert({ workspace_id: workspaceId, clerk_user_id: userId, role: "owner" });

  if (memberError) {
    console.error("[onboarding] member insert:", memberError);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  // Insert app
  const dbPlatform = platform.replace("-", "_");
  const { data: app, error: appError } = await sb
    .from("apps")
    .insert({
      workspace_id: workspaceId,
      name:         appName,
      platform:     dbPlatform,
      store_id:     storeId,
    })
    .select("id")
    .single();

  if (appError) {
    console.error("[onboarding] app insert:", appError);
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
  }

  // Mark user as onboarded in Clerk metadata + fire welcome email
  try {
    const clerk = await clerkClient();
    const [, clerkUser] = await Promise.all([
      clerk.users.updateUserMetadata(userId, {
        publicMetadata: { onboarded: true },
      }),
      clerk.users.getUser(userId),
    ]);

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    const name =
      clerkUser.firstName ??
      email?.split("@")[0] ??
      "there";

    if (email) {
      // Non-blocking — don't await so the response isn't delayed
      sendWelcomeEmail(email, name).catch((err) =>
        console.error("[onboarding] welcome email:", err),
      );
    }
  } catch (err) {
    // Non-fatal — workspace created, just metadata/email failed
    console.error("[onboarding] post-create hooks:", err);
  }

  return NextResponse.json({ workspaceId, appId: app.id }, { status: 200 });
}
