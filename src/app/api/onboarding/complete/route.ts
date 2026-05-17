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

const TRIAL_DAYS = 14;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const userId  = session?.userId;

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = (await req.json()) as OnboardingBody;
  const { workspaceName, workspaceSlug, appName, platform, storeId = "" } = body;

  if (!workspaceName?.trim() || !workspaceSlug?.trim() || !appName?.trim()) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  const sb = getServiceClient();

  // Idempotency: if this user already has a workspace, reuse it
  const { data: existingMember } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  let workspaceId: string;

  if (existingMember?.workspace_id) {
    workspaceId = existingMember.workspace_id as string;
  } else {
    const { data: workspace, error: wsError } = await sb
      .from("workspaces")
      .insert({ name: workspaceName, slug: workspaceSlug, plan: "trial" })
      .select("id")
      .single();

    if (wsError) {
      if (wsError.code === "23505") {
        return NextResponse.json({ error: "SLUG_TAKEN" }, { status: 409 });
      }
      console.error("[onboarding] workspace insert:", wsError);
      return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
    }

    workspaceId = workspace.id as string;

    const { error: memberError } = await sb
      .from("workspace_members")
      .insert({ workspace_id: workspaceId, clerk_user_id: userId, role: "owner" });

    if (memberError) {
      console.error("[onboarding] member insert:", memberError);
      return NextResponse.json({ error: "INTERNAL_SERVER_ERROR" }, { status: 500 });
    }
  }

  // Idempotency: only insert app if none exists for this workspace
  const { data: existingApp } = await sb
    .from("apps")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1)
    .maybeSingle();

  let appId: string;

  if (existingApp?.id) {
    appId = existingApp.id as string;
  } else {
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
    appId = app.id as string;
  }

  // Mark user as onboarded + set trial window + fire welcome email
  try {
    const clerk = await clerkClient();
    const clerkUser = await clerk.users.getUser(userId);
    const alreadyOnboarded = clerkUser.publicMetadata?.onboarded === true;

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString();

    await clerk.users.updateUserMetadata(userId, {
      publicMetadata: {
        ...clerkUser.publicMetadata,
        onboarded: true,
        plan: clerkUser.publicMetadata?.plan ?? "trial",
        trialEndsAt: clerkUser.publicMetadata?.trialEndsAt ?? trialEndsAt,
      },
    });

    if (!alreadyOnboarded) {
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
    }
  } catch (err) {
    // Non-fatal — workspace created, just metadata/email failed
    console.error("[onboarding] post-create hooks:", err);
  }

  return NextResponse.json({ workspaceId, appId }, { status: 200 });
}
