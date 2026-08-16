import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/api-rate-limit";
import { fetchAppMetadata } from "@/services/store-search";
import type { CompetitorBenchmarkRow, CompetitorsResponse } from "@/types/review";

/**
 * GET  /api/competitors — your app's real metrics + tracked competitor rows.
 * POST /api/competitors — track a new competitor (store-search result).
 *
 * Competitor metadata (rating, review count) is scraped on read through
 * fetchAppMetadata's 6-hour Redis cache — only identity is stored in the DB.
 * Metrics that need review history (reviews/week, reply rate, trend) are
 * null for competitors: we don't have their reviews, and showing invented
 * numbers is exactly what this feature replaces.
 *
 * Until migration 016 is applied the table doesn't exist (Postgres 42P01);
 * GET then falls back to the old clearly-flagged illustrative rows and the
 * UI keeps its "coming soon" state. Nothing breaks in either order.
 */

const MAX_COMPETITORS = 5;

const ILLUSTRATIVE: CompetitorBenchmarkRow[] = [
  { name: "Competitor A", rating: 4.7, reviewsPerWeek: 48, replyRate: 58, trend: [4.4, 4.5, 4.6, 4.7, 4.7, 4.7], you: false, illustrative: true },
  { name: "Competitor B", rating: 4.4, reviewsPerWeek: 31, replyRate: 43, trend: [4.5, 4.4, 4.4, 4.3, 4.4, 4.4], you: false, illustrative: true },
  { name: "Competitor C", rating: 4.2, reviewsPerWeek: 22, replyRate: 28, trend: [4.3, 4.2, 4.1, 4.2, 4.2, 4.2], you: false, illustrative: true },
];

interface CompetitorDbRow {
  id: string;
  platform: "google_play" | "app_store";
  store_id: string;
  name: string;
  icon_url: string | null;
}

function isTableMissing(error: { code?: string } | null): boolean {
  return error?.code === "42P01";
}

// DB stores snake_case platforms; the store-search service speaks kebab-case.
function toStorePlatform(platform: "google_play" | "app_store"): "google-play" | "app-store" {
  return platform === "google_play" ? "google-play" : "app-store";
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const sb = getServiceClient();

  // ── Your app: real metrics from our own review history ────────────────────
  //
  // Which app is "you"? Previously `.limit(1)` with NO `order`, so on a
  // multi-app workspace the benchmark's "You" row was a non-deterministic
  // app that could change between page loads. Now: the app the sidebar has
  // selected, else the oldest — a stable answer either way.
  const requestedAppId = req.nextUrl.searchParams.get("appId")?.trim() || undefined;

  let appQuery = sb
    .from("apps")
    .select("id, name, lifetime_rating, lifetime_review_count, platform")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  appQuery = requestedAppId
    ? appQuery.eq("id", requestedAppId)
    : appQuery.order("created_at", { ascending: true });

  const { data: app } = await appQuery.limit(1).maybeSingle();

  const appId: string | null = app?.id ?? null;
  let rating: number = typeof app?.lifetime_rating === "number" ? app.lifetime_rating : 0;
  let reviewsPerWeek = 0;
  let replyRate = 0;
  const trend: number[] = [];

  if (appId) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400_000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400_000).toISOString();
    const sixWeeksAgo = new Date(now.getTime() - 42 * 86400_000).toISOString();

    const { count: weekCount } = await sb
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("app_id", appId)
      .gte("store_created_at", sevenDaysAgo);
    reviewsPerWeek = weekCount ?? 0;

    const { data: replyRows } = await sb
      .from("reviews")
      .select("reply_status")
      .eq("workspace_id", workspaceId)
      .eq("app_id", appId)
      .gte("store_created_at", thirtyDaysAgo);
    if (replyRows?.length) {
      const replied = replyRows.filter((r) => r.reply_status === "replied").length;
      replyRate = Math.round((replied / replyRows.length) * 100);
    }

    if (!rating) {
      const { data: ratingRows } = await sb
        .from("reviews")
        .select("rating")
        .eq("workspace_id", workspaceId)
        .eq("app_id", appId);
      if (ratingRows?.length) {
        const sum = ratingRows.reduce((acc, r) => acc + (r.rating as number), 0);
        rating = Math.round((sum / ratingRows.length) * 10) / 10;
      }
    }

    const { data: trendRows } = await sb
      .from("reviews")
      .select("rating, store_created_at")
      .eq("workspace_id", workspaceId)
      .eq("app_id", appId)
      .gte("store_created_at", sixWeeksAgo)
      .order("store_created_at", { ascending: true });

    if (trendRows?.length) {
      const buckets: number[][] = Array.from({ length: 6 }, () => []);
      for (const r of trendRows) {
        const ageMs = now.getTime() - new Date(r.store_created_at as string).getTime();
        const weekIdx = Math.min(5, Math.floor(ageMs / (7 * 86400_000)));
        buckets[5 - weekIdx].push(r.rating as number);
      }
      for (const bucket of buckets) {
        trend.push(
          bucket.length
            ? Math.round((bucket.reduce((s, v) => s + v, 0) / bucket.length) * 10) / 10
            : rating || 4.0,
        );
      }
    } else {
      const fill = rating || 4.0;
      trend.push(fill, fill, fill, fill, fill, fill);
    }
  } else {
    trend.push(4.0, 4.0, 4.0, 4.0, 4.0, 4.0);
  }

  const yourApp: CompetitorBenchmarkRow = {
    name: app?.name ?? "Your app",
    rating: rating || null,
    ratingCount:
      typeof app?.lifetime_review_count === "number" ? app.lifetime_review_count : null,
    reviewsPerWeek,
    replyRate,
    trend,
    you: true,
    illustrative: false,
  };

  // ── Tracked competitors ───────────────────────────────────────────────────
  const { data: rows, error } = await sb
    .from("competitor_apps")
    .select("id, platform, store_id, name, icon_url")
    .eq("workspace_id", workspaceId)
    .order("added_at", { ascending: true });

  if (error) {
    if (isTableMissing(error)) {
      // Migration 016 not applied yet — old illustrative behaviour.
      const body: CompetitorsResponse = {
        yourApp,
        competitors: ILLUSTRATIVE,
        hasRealData: appId !== null,
        canAdd: false,
      };
      return NextResponse.json(body);
    }
    return apiError("INTERNAL_SERVER_ERROR", 500, "Couldn't load competitors.");
  }

  // Metadata for each competitor — cached 6h in Redis, so this is one scrape
  // per app per 6 hours across the whole workspace, not per page view.
  const competitors: CompetitorBenchmarkRow[] = await Promise.all(
    ((rows ?? []) as CompetitorDbRow[]).map(async (row) => {
      const meta = await fetchAppMetadata(toStorePlatform(row.platform), row.store_id).catch(() => null);
      return {
        id: row.id,
        name: meta?.name ?? row.name,
        platform: row.platform,
        storeId: row.store_id,
        iconUrl: meta?.icon ?? row.icon_url,
        rating: meta?.rating ?? null,
        ratingCount: meta?.reviewCount ?? null,
        reviewsPerWeek: null,
        replyRate: null,
        trend: null,
        you: false,
        illustrative: false,
      } satisfies CompetitorBenchmarkRow;
    }),
  );

  const body: CompetitorsResponse = {
    yourApp,
    competitors,
    hasRealData: appId !== null,
    canAdd: true,
  };
  return NextResponse.json(body);
}

// ── POST ──────────────────────────────────────────────────────────────────────

interface AddCompetitorBody {
  platform?: string;
  storeId?: string;
  name?: string;
  iconUrl?: string | null;
  developer?: string | null;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  // Adding a competitor triggers a store scrape — keep it un-hammerable.
  const rl = await rateLimit(req, session.userId, {
    bucket: "competitor-add",
    limit: 10,
    window: "1 m",
  });
  if (!rl.allowed) return apiError("RATE_LIMITED", 429);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  let body: AddCompetitorBody;
  try {
    body = (await req.json()) as AddCompetitorBody;
  } catch {
    return apiError("INVALID_INPUT", 400, "Body must be JSON.");
  }

  const platform = body.platform;
  const storeId = (body.storeId ?? "").trim();
  if ((platform !== "google_play" && platform !== "app_store") || !storeId || storeId.length > 200) {
    return apiError("INVALID_INPUT", 400, "platform and storeId are required.");
  }

  const sb = getServiceClient();

  const { count, error: countError } = await sb
    .from("competitor_apps")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);
  if (countError) {
    return isTableMissing(countError)
      ? apiError("SERVICE_UNAVAILABLE", 409, "Competitor tracking isn't enabled yet — it ships with the next database update.")
      : apiError("INTERNAL_SERVER_ERROR", 500, "Couldn't load competitors.");
  }
  if ((count ?? 0) >= MAX_COMPETITORS) {
    return apiError("QUOTA_EXCEEDED", 422, "You can track up to 5 competitors.");
  }

  // Verify against the live store — also warms the metadata cache the GET
  // will read from, and gives us the canonical name/icon.
  const meta = await fetchAppMetadata(toStorePlatform(platform), storeId).catch(() => null);
  const name = meta?.name ?? (body.name ?? "").trim();
  if (!name) return apiError("NOT_FOUND", 404, "Couldn't find that app on the store.");

  const { data: inserted, error: insertError } = await sb
    .from("competitor_apps")
    .insert({
      workspace_id: workspaceId,
      platform,
      store_id: storeId,
      name,
      icon_url: meta?.icon ?? body.iconUrl ?? null,
      developer: meta?.developer ?? body.developer ?? null,
      added_by: session.userId,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") return apiError("ALREADY_EXISTS", 409, "Already tracking this app.");
    return apiError("INTERNAL_SERVER_ERROR", 500, "Couldn't add competitor.");
  }

  await audit({
    workspaceId,
    actorUserId: session.userId,
    action: "competitor.add",
    targetType: "competitor",
    targetId: inserted.id,
    payload: { platform, storeId, name },
    request: req,
  });

  return NextResponse.json({ id: inserted.id, name }, { status: 201 });
}
