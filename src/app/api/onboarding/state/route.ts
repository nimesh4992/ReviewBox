import { auth, clerkClient } from "@clerk/nextjs/server";
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

  // Read the JWT claim — but treat it as a HINT, not source of truth.
  // Clerk JWTs are cached up to 60s, so right after onboarding completes
  // we'll still see onboarded=false here. The DB is authoritative below.
  const metadata = (session.sessionClaims?.metadata ?? {}) as { onboarded?: boolean };
  const claimOnboarded = metadata.onboarded === true;

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
      .is("deleted_at", null)
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

  // DB is authoritative. If user has a workspace + app, they're onboarded —
  // regardless of what the stale JWT says. Prevents the post-completion
  // loop where Clerk metadata hasn't propagated yet.
  const dbOnboarded = !!workspace && !!app;
  const onboarded = claimOnboarded || dbOnboarded;

  const body: OnboardingState = {
    onboarded,
    hasWorkspace: !!workspace,
    hasApp: !!app,
    workspace,
    app,
  };

  const res = NextResponse.json(body);

  // When the DB confirms onboarded but the JWT claim doesn't (returning user
  // whose Clerk metadata is stale or missing), repair the Clerk metadata in the
  // background so future requests carry the correct claim.
  //
  // NOTE: we deliberately do NOT set an `rb_onboarded` cookie here. Middleware
  // has no onboarding gate and never reads such a cookie (see middleware.ts —
  // the gate was removed because reading a stale JWT/cookie caused redirect
  // loops). Onboarding routing is page-level off this DB-authoritative endpoint.
  if (dbOnboarded && !claimOnboarded) {
    // Fire-and-forget Clerk repair so we don't block the response on it.
    void (async () => {
      try {
        const clerk = await clerkClient();
        const clerkUser = await clerk.users.getUser(userId);
        await clerk.users.updateUserMetadata(userId, {
          publicMetadata: {
            ...clerkUser.publicMetadata,
            onboarded: true,
          },
        });
      } catch (err) {
        console.error("[onboarding/state] Clerk metadata repair failed:", err);
      }
    })();
  }

  return res;
}
