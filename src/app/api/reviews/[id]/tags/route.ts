/**
 * PATCH /api/reviews/[id]/tags — correct the tags on one review.
 *
 * Written to `issue_tags_override`, not `issue_tags`. The rules engine's own
 * answer stays on the row, so a re-sync cannot quietly discard a human's
 * correction and we can still tell later how often the engine is wrong.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError, captureAndError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { isMissingColumnError } from "@/lib/db-errors";
import { normalizeTagSelection, effectiveTags } from "@/lib/tag-labels";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return apiError("NO_WORKSPACE", 404);

    const rl = await rateLimit(req, workspaceId, { bucket: "review-tags", limit: 300, window: "1 h" });
    if (!rl.allowed) return apiError("RATE_LIMITED", 429, "Too many changes. Try again shortly.");

    const { id: reviewId } = await params;
    const body = (await req.json().catch(() => null)) as { tags?: unknown } | null;
    if (!body || !Array.isArray(body.tags)) {
      return apiError("INVALID_INPUT", 400, "tags must be an array.");
    }

    const tags = normalizeTagSelection(body.tags);

    const sb = getServiceClient();

    // Scope the write by workspace_id in the same statement rather than reading
    // the row first: one round trip, and no window in which the review could
    // move between the check and the write.
    const { data, error } = await sb
      .from("reviews")
      .update({ issue_tags_override: tags })
      .eq("id", reviewId)
      .eq("workspace_id", workspaceId)
      .select("id, issue_tags, issue_tags_override")
      .maybeSingle();

    if (error) {
      if (isMissingColumnError(error)) {
        return apiError(
          "MIGRATION_PENDING",
          503,
          "Editing tags needs a database migration that has not been applied yet.",
        );
      }
      console.error("[reviews/tags PATCH]", error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    // No row: either the review does not exist or it belongs to someone else.
    // One answer for both, so this cannot be used to probe for review IDs.
    if (!data) return apiError("NOT_FOUND", 404);

    await audit({
      workspaceId,
      actorUserId: userId,
      action: "review.retag",
      targetType: "review",
      targetId: reviewId,
      payload: { tags, autoTags: data.issue_tags },
      request: req,
    });

    return NextResponse.json({
      id: data.id,
      tags: effectiveTags(
        data.issue_tags as string[] | null,
        data.issue_tags_override as string[] | null,
      ),
    });
  } catch (err) {
    return captureAndError(err, "PATCH /api/reviews/[id]/tags");
  }
}
