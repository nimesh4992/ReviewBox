import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";

interface ReplyRequestBody {
  replyText: string;
  status: "sent" | "draft";
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  try {
    // 1. Auth
    const session = await auth();
    const userId = session?.userId;

    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // 2. Resolve workspace
    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) {
      return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 404 });
    }

    // 3. Parse params + body
    const { id: reviewId } = await params;
    const body = (await req.json()) as ReplyRequestBody;
    const { replyText, status } = body;

    if (!replyText || !status) {
      return NextResponse.json(
        { error: "MISSING_FIELDS" },
        { status: 400 },
      );
    }

    // 4. Verify review belongs to workspace before updating
    const sb = getServiceClient();
    const { data: existing, error: lookupError } = await sb
      .from("reviews")
      .select("id")
      .eq("id", reviewId)
      .eq("workspace_id", workspaceId)
      .single();

    if (lookupError || !existing) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // 5. Update the review row with reply info
    const { error: updateError } = await sb
      .from("reviews")
      .update({
        reply_text: replyText,
        reply_status: status === "sent" ? "replied" : "draft_ready",
        replied_at: status === "sent" ? new Date().toISOString() : null,
      })
      .eq("id", reviewId)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      console.error("[api/reviews/[id]/reply] Update error:", updateError);
      return NextResponse.json(
        { error: "INTERNAL_SERVER_ERROR" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("[api/reviews/[id]/reply] Unexpected error:", err);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR" },
      { status: 500 },
    );
  }
}
