import { auth, clerkClient } from "@clerk/nextjs/server";
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

    const rows = data ?? [];

    // Names live in Clerk, not in our database — `workspace_members` only holds
    // the ID. Without this the team list rendered "user_2abc123def456ghi789…",
    // which tells an owner nothing about who is in their workspace.
    //
    // One bulk call for the whole list, and best-effort: if Clerk is
    // unreachable the list still renders with whatever we have, because a team
    // page that 500s is worse than one showing IDs.
    const profiles = new Map<string, { name: string | null; email: string | null; imageUrl: string | null }>();
    if (rows.length) {
      try {
        const clerk = await clerkClient();
        const { data: users } = await clerk.users.getUserList({
          userId: rows.map((m) => m.clerk_user_id as string),
          limit: Math.min(rows.length, 100),
        });
        for (const u of users) {
          const full = [u.firstName, u.lastName].filter(Boolean).join(" ").trim();
          profiles.set(u.id, {
            name: full || null,
            email: u.emailAddresses[0]?.emailAddress ?? null,
            imageUrl: u.hasImage ? u.imageUrl : null,
          });
        }
      } catch (err) {
        console.error("[team/members] Clerk lookup failed:", err);
      }
    }

    const members = rows.map((m) => {
      const id = m.clerk_user_id as string;
      const p  = profiles.get(id);
      return {
        ...m,
        name: p?.name ?? null,
        email: p?.email ?? null,
        image_url: p?.imageUrl ?? null,
        // So the client can mark "You" without a second identity round trip.
        is_self: id === session.userId,
      };
    });

    return NextResponse.json({ members });
  } catch (err) {
    return captureAndError(err, "GET /api/team/members");
  }
}
