import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError, captureAndError } from "@/lib/api-response";
import type { AsoKeyword } from "@/types/review";

function mapRow(row: Record<string, unknown>): AsoKeyword {
  return {
    id: row.id as string,
    keyword: row.keyword as string,
    appId: (row.app_id as string | null) ?? undefined,
    currentRank: (row.current_rank as number | null) ?? null,
    previousRank: (row.previous_rank as number | null) ?? null,
    volumeEstimate: (row.volume_estimate as number | null) ?? null,
    trendData: (row.trend_data as number[] | null) ?? [],
    addedAt: row.added_at as string,
  };
}

// ── PATCH — update rank or volume, building trend history ─────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return apiError("NO_WORKSPACE", 404);

    const { id } = await params;
    const body = await req.json() as {
      current_rank?: number | null;
      volume_estimate?: number | null;
    };

    const sb = getServiceClient();

    // Use maybeSingle() — .single() throws if the row doesn't exist
    const { data: existing } = await sb
      .from("aso_keywords")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!existing) return apiError("NOT_FOUND", 404);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if ("current_rank" in body) {
      const oldRank = existing.current_rank as number | null;
      const newRank = body.current_rank ?? null;

      // Shift current → previous, append old rank to trend history (keep last 6)
      if (oldRank !== null) {
        const history = ((existing.trend_data as number[] | null) ?? []);
        updates.trend_data = [...history, oldRank].slice(-6);
        updates.previous_rank = oldRank;
      }
      updates.current_rank = newRank;
    }

    if ("volume_estimate" in body) {
      updates.volume_estimate = body.volume_estimate ?? null;
    }

    const { data: updated, error } = await sb
      .from("aso_keywords")
      .update(updates)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    if (error) return apiError("INTERNAL_SERVER_ERROR", 500);
    return NextResponse.json(mapRow(updated as Record<string, unknown>));
  } catch (err) {
    return captureAndError(err, "PATCH /api/aso/keywords/[id]");
  }
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return apiError("NO_WORKSPACE", 404);

    const { id } = await params;
    const sb = getServiceClient();

    // Verify ownership before deleting — use maybeSingle() for safe no-row handling
    const { data: existing } = await sb
      .from("aso_keywords")
      .select("id")
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!existing) return apiError("NOT_FOUND", 404);

    const { error } = await sb
      .from("aso_keywords")
      .delete()
      .eq("id", id)
      .eq("workspace_id", workspaceId);

    if (error) return apiError("INTERNAL_SERVER_ERROR", 500);
    return NextResponse.json({ success: true });
  } catch (err) {
    return captureAndError(err, "DELETE /api/aso/keywords/[id]");
  }
}
