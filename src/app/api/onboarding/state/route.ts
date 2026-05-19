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

  const { data: member } = await sb
    .from("workspace_members")
    .select("workspace_id, workspaces(id, name, slug)")
    .eq("clerk_user_id", userId)
    .maybeSingle();

  const workspaceRow = member?.workspaces as
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[]
    | null
    | undefined;

  const workspace = Array.isArray(workspaceRow)
    ? workspaceRow[0] ?? null
    : workspaceRow ?? null;

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
