/**
 * GET /api/onboarding/progress
 *
 * Polled every 3s by the onboarding ready screen (Step 5).
 * Returns live counts so the user can see their workspace populating
 * in real-time as bootstrap + enrichment complete in the background.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { getLiveAppIds } from "@/lib/live-apps";

export interface OnboardingProgress {
  reviewCount:   number;
  templateCount: number;
  keywordCount:  number;
  rating:        number | null;
  reviewTotal:   number | null;  // lifetime count from store
  syncDone:      boolean;        // last_synced_at is set
}

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  const userId  = session?.userId;
  if (!userId) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const workspaceId = await getWorkspaceId(userId);
  if (!workspaceId) {
    return NextResponse.json<OnboardingProgress>({
      reviewCount: 0, templateCount: 0, keywordCount: 0,
      rating: null, reviewTotal: null, syncDone: false,
    });
  }

  const sb = getServiceClient();

  // Live apps only. This endpoint is polled every 3s during onboarding, and
  // the app query below already excludes deleted apps — so a re-onboarding
  // user watched reviewCount start at a phantom non-zero number while the
  // rating beside it was still null.
  const liveAppIds = (await getLiveAppIds(sb, workspaceId)) ?? [];

  const [reviewRes, templateRes, keywordRes, appRes] = await Promise.all([
    liveAppIds.length
      ? sb.from("reviews")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId)
          .in("app_id", liveAppIds)
      : Promise.resolve({ count: 0 }),

    sb.from("reply_templates")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),

    sb.from("aso_keywords")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),

    sb.from("apps")
      .select("lifetime_rating, lifetime_review_count, last_synced_at")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle(),
  ]);

  const app = appRes.data;

  return NextResponse.json<OnboardingProgress>({
    reviewCount:   reviewRes.count   ?? 0,
    templateCount: templateRes.count ?? 0,
    keywordCount:  keywordRes.count  ?? 0,
    rating:        app?.lifetime_rating        ?? null,
    reviewTotal:   app?.lifetime_review_count  ?? null,
    syncDone:      !!app?.last_synced_at,
  });
}
