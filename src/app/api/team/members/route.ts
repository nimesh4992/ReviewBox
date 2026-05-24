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
    const { data, error } = await sb
      .from("workspace_members")
      .select("clerk_user_id, role, joined_at")
      .eq("workspace_id", workspaceId)
      .order("joined_at", { ascending: true });

    if (error) {
      console.error("[team/members GET]", error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    return NextResponse.json({ members: data ?? [] });
  } catch (err) {
    return captureAndError(err, "GET /api/team/members");
  }
}
