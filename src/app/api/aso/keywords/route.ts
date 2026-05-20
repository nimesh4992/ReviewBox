import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
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

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return NextResponse.json({ keywords: [], metrics: { total: 0, avgRank: null, top10Count: 0 } });

    const url = new URL(req.url);
    const appId = url.searchParams.get("appId");

    const sb = getServiceClient();
    let q = sb
      .from("aso_keywords")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("added_at", { ascending: false });

    if (appId) q = q.eq("app_id", appId);

    const { data, error } = await q;
    if (error) throw error;

    const keywords = (data ?? []).map(mapRow);
    const ranked = keywords.filter((k) => k.currentRank !== null);
    const avgRank =
      ranked.length > 0
        ? Math.round(
            (ranked.reduce((s, k) => s + k.currentRank!, 0) / ranked.length) * 10,
          ) / 10
        : null;

    return NextResponse.json({
      keywords,
      metrics: {
        total: keywords.length,
        avgRank,
        top10Count: ranked.filter((k) => k.currentRank! <= 10).length,
      },
    });
  } catch (err) {
    console.error("[GET /api/aso/keywords]", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return NextResponse.json({ error: "NO_WORKSPACE" }, { status: 403 });

    const body = await req.json() as {
      keyword?: string;
      appId?: string;
      volumeEstimate?: number;
    };
    const keyword = body.keyword?.trim();
    if (!keyword) return NextResponse.json({ error: "MISSING_KEYWORD" }, { status: 400 });

    const sb = getServiceClient();
    const { data, error } = await sb
      .from("aso_keywords")
      .upsert(
        {
          workspace_id: workspaceId,
          app_id: body.appId ?? null,
          keyword,
          volume_estimate: body.volumeEstimate ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,app_id,keyword" },
      )
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(mapRow(data as Record<string, unknown>), { status: 201 });
  } catch (err) {
    console.error("[POST /api/aso/keywords]", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
