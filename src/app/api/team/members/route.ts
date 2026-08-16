import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError, captureAndError } from "@/lib/api-response";

export async function GET(): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.userId) {
      return apiError("UNAUTHORIZED", 401);
    }
    const workspaceId = await getWorkspaceId(session.userId);
    if (!workspaceId) {
      return apiError("NO_WORKSPACE", 404);
    }

    const sb = getServiceClient();
    // The column is `created_at` (001_initial_schema.sql) — `joined_at` has
    // never existed in any migration, so this select 42703'd and Settings →
    // Team returned 500 every single time it was opened. Aliased so the
    // client's `joined_at` field keeps working.
    const { data, error } = await sb
      .from("workspace_members")
      .select("clerk_user_id, role, joined_at:created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[team/members GET]", error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    return NextResponse.json({ members: data ?? [] });
  } catch (err) {
    return captureAndError(err, "GET /api/team/members");
  }
}
