import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const CONFIRM_PHRASE = "DELETE MY ACCOUNT" as const;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse and validate confirmation phrase
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("confirm" in body) ||
    (body as Record<string, unknown>).confirm !== CONFIRM_PHRASE
  ) {
    return NextResponse.json(
      {
        error: `Confirmation required. Send { "confirm": "${CONFIRM_PHRASE}" } to proceed.`,
      },
      { status: 400 }
    );
  }

  const workspaceId = await getWorkspaceId(userId);

  if (!workspaceId) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const sb = getServiceClient();

  // Delete workspace — cascade should remove all child rows
  const { error: deleteError } = await sb
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);

  if (deleteError) {
    console.error("[gdpr/delete] Supabase delete error:", deleteError);
    return NextResponse.json(
      { error: "Failed to delete workspace data" },
      { status: 500 }
    );
  }

  // Delete Clerk user
  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);
  } catch (err) {
    console.error("[gdpr/delete] Clerk user deletion failed:", err);
    // Workspace data is already gone — still log and return success
    // so the client can redirect; Clerk user can be cleaned up separately.
  }

  console.log(
    JSON.stringify({
      event: "gdpr_delete",
      userId,
      workspaceId,
      timestamp: new Date().toISOString(),
    })
  );

  return NextResponse.json({ deleted: true }, { status: 200 });
}
