import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getServiceClient } from "@/lib/supabase-server";

export interface OnboardingState {
  onboarded: boolean;
  hasWorkspace: boolean;
  hasApp: boolean;
  workspace: { id: string; name: string; slug: string } | null;
  app: { id: string; name: string; platform: string; storeId: string } | null;
}

export async function GET(): Promise<NextResponse<OnboardingState | { error: string }>> {
  const session = await auth();
  const userId = session?.userId;

  if (!userId) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const metadata = (session.sessionClaims?.metadata ?? {}) as { onboarded?: boolean };
  const onboarded = metadata.onboarded === true;

  const sb = getServiceClient();

  // Two separate queries — avoids PostgREST embedded-join ambiguity
  const { data: member } = await sb
    .from("workspace_members")
    .select("workspace_id")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  let workspace: { id: string; name: string; slug: string } | null = null;
  if (member?.workspace_id) {
    const { data: wsRow } = await sb
      .from("workspaces")
      .select("id, name, slug")
      .eq("id", member.workspace_id as string)
      .maybeSingle();
    if (wsRow) {
      workspace = {
        id: wsRow.id as string,
        name: wsRow.name as string,
        slug: (wsRow.slug as string) ?? "",
      };
    }
  }

  let app: OnboardingState["app"] = null;
  if (workspace?.id) {
    const { data: appRow } = await sb
      .from("apps")
      .select("id, name, platform, store_id")
      .eq("workspace_id", workspace.id)
      .limit(1)
      .maybeSingle();

    if (appRow) {
      app = {
        id: appRow.id as string,
        name: appRow.name as string,
        platform: appRow.platform as string,
        storeId: (appRow.store_id as string) ?? "",
      };
    }
  }

  return NextResponse.json({
    onboarded,
    hasWorkspace: !!workspace,
    hasApp: !!app,
    workspace,
    app,
  });
}
