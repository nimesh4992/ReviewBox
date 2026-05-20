import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 403 });

    const { id } = await params;
    const sb = getServiceClient();

    // Verify ownership before deleting
    const { data: existing } = await sb
      .from("aso_keywords")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .single();

    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const { error } = await sb
      .from("aso_keywords")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/aso/keywords/[id]]", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
