/**
 * GET  /api/tags  — the tag vocabulary with this workspace's names for it
 * PUT  /api/tags  — rename one tag, or reset it to the default
 *
 * Renaming is display-only. The stored token never changes, so every automation
 * rule, every historical review row and the rules engine itself keep matching.
 * See migration 024 for why that separation is not negotiable.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError, captureAndError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { isMissingTableError } from "@/lib/db-errors";
import { readTagLabels } from "@/services/tag-label-service";
import { ISSUE_TAGS, isIssueTag, tagLabel, validateTagLabel } from "@/lib/tag-labels";

export async function GET(): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return NextResponse.json({ tags: [] });

    const labels = await readTagLabels(workspaceId);

    return NextResponse.json({
      tags: ISSUE_TAGS.map((tag) => ({
        tag,
        label: tagLabel(tag, labels),
        customized: typeof labels[tag] === "string",
      })),
    });
  } catch (err) {
    return captureAndError(err, "GET /api/tags");
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const { userId } = await auth();
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return apiError("NO_WORKSPACE", 404);

    const rl = await rateLimit(req, workspaceId, { bucket: "tag-rename", limit: 60, window: "1 h" });
    if (!rl.allowed) return apiError("RATE_LIMITED", 429, "Too many changes. Try again shortly.");

    const body = (await req.json().catch(() => null)) as { tag?: unknown; label?: unknown } | null;
    if (!body || !isIssueTag(body.tag)) {
      return apiError("INVALID_INPUT", 400, "Unknown tag.");
    }

    const validated = validateTagLabel(body.label);
    if ("error" in validated) return apiError("INVALID_INPUT", 400, validated.error);

    const sb  = getServiceClient();
    const tag = body.tag;

    // An empty label is a reset, not a rename: delete the row so the default
    // comes back. Storing "" instead would make the tag render blank.
    const result = validated.label === null
      ? await sb.from("tag_labels").delete().eq("workspace_id", workspaceId).eq("tag", tag)
      : await sb.from("tag_labels").upsert(
          { workspace_id: workspaceId, tag, label: validated.label, updated_at: new Date().toISOString() },
          { onConflict: "workspace_id,tag" },
        );

    if (result.error) {
      if (isMissingTableError(result.error)) {
        return apiError("MIGRATION_PENDING", 503, "Tag renaming needs a database migration that has not been applied yet.");
      }
      console.error("[tags] rename failed:", result.error);
      return apiError("INTERNAL_SERVER_ERROR", 500);
    }

    await audit({
      workspaceId,
      actorUserId: userId,
      action: "tag.rename",
      targetType: "tag",
      targetId: tag,
      payload: { label: validated.label },
      request: req,
    });

    return NextResponse.json({ tag, label: tagLabel(tag, { [tag]: validated.label ?? "" }) });
  } catch (err) {
    return captureAndError(err, "PUT /api/tags");
  }
}
