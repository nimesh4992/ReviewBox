import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError, captureAndError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";
import { audit } from "@/lib/audit";

const VALID_ACTIONS = ["mark_replied", "mark_pending"] as const;
type BulkAction = (typeof VALID_ACTIONS)[number];

const MAX_IDS = 100;

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return apiError("NO_WORKSPACE", 404);

    const rl = await rateLimit(req, workspaceId, {
      bucket: "bulk_action",
      limit: 30,
      window: "1 m",
    });
    if (!rl.allowed) return apiError("RATE_LIMITED", 429);

    const body = (await req.json()) as { ids?: unknown; action?: unknown };
    const { ids, action } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return apiError("INVALID_INPUT", 400, "ids must be a non-empty array");
    }
    if (ids.length > MAX_IDS) {
      return apiError("INVALID_INPUT", 400, `Max ${MAX_IDS} reviews per bulk action`);
    }
    if (!VALID_ACTIONS.includes(action as BulkAction)) {
      return apiError("INVALID_INPUT", 400, `action must be one of: ${VALID_ACTIONS.join(", ")}`);
    }

    const reviewIds = (ids as unknown[]).filter((id) => typeof id === "string") as string[];
    const newStatus = action === "mark_replied" ? "replied" : "needs_reply";

    const sb = getServiceClient();
    const { error } = await sb
      .from("reviews")
      .update({ reply_status: newStatus, updated_at: new Date().toISOString() })
      .in("id", reviewIds)
      .eq("workspace_id", workspaceId);

    if (error) return captureAndError(error, "POST /api/reviews/bulk-action");

    await audit({
      workspaceId,
      actorUserId: userId,
      action: "review.bulk_update",
      targetType: "review",
      payload: { bulkAction: action, count: reviewIds.length },
    });

    return NextResponse.json({ updated: reviewIds.length });
  } catch (err) {
    return captureAndError(err, "POST /api/reviews/bulk-action");
  }
}
