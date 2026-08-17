import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { estimateKeywordVolume } from "@/lib/gemini";
import type { AsoKeyword } from "@/types/review";
import { rateLimit } from "@/lib/api-rate-limit";

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
    if (!userId) return apiError("UNAUTHORIZED", 401);

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
    if (error) return apiError("INTERNAL_SERVER_ERROR", 500);

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
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return apiError("NO_WORKSPACE", 404);

    const body = await req.json() as {
      keyword?: string;
      appId?: string;
      volumeEstimate?: number;
    };
    const keyword = body.keyword?.trim();
    if (!keyword) return apiError("INVALID_INPUT", 400, "keyword is required");
    // An app-store keyword is a short phrase. Capping it bounds the prompt we
    // hand Gemini, so a caller cannot turn this endpoint into a way to bill us
    // for arbitrary-length model input.
    if (keyword.length > 80) {
      return apiError("INVALID_INPUT", 400, "Keyword must be 80 characters or fewer.");
    }

    // This route had NO limit while its sibling /api/aso/suggest has one — an
    // omission, not a policy. Every request can reach estimateKeywordVolume(),
    // which calls Gemini, and Gemini's free tier is 1,500 requests/day shared
    // by the whole platform. One loop here drains it for every customer.
    const rl = await rateLimit(req, workspaceId, { bucket: "aso-keyword-add", limit: 20, window: "1 h" });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429, "Too many keywords added. Try again shortly.");
    }

    const sb = getServiceClient();

    // Auto-estimate volume via Gemini if caller didn't supply one (best-effort, 3s cap)
    let volumeEstimate = body.volumeEstimate ?? null;
    if (volumeEstimate === null || volumeEstimate === undefined) {
      const estimate = await Promise.race([
        estimateKeywordVolume(keyword),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
      ]);
      volumeEstimate = estimate;
    }

    const { data, error } = await sb
      .from("aso_keywords")
      .upsert(
        {
          workspace_id: workspaceId,
          app_id: body.appId ?? null,
          keyword,
          volume_estimate: volumeEstimate,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,app_id,keyword" },
      )
      .select()
      .single();

    if (error) return apiError("INTERNAL_SERVER_ERROR", 500);
    return NextResponse.json(mapRow(data as Record<string, unknown>), { status: 201 });
  } catch (err) {
    console.error("[POST /api/aso/keywords]", err);
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }
}
