import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError, captureAndError } from "@/lib/api-response";
import type { AppReview } from "@/types/review";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// ── DB row shape (snake_case from Supabase) ────────────────────────────────────

interface DbReview {
  id: string;
  external_id: string;
  source: "google_play" | "app_store";
  author: string;
  rating: number;
  body: string;
  app_version: string | null;
  device: string | null;
  country: string | null;
  store_created_at: string;
  sentiment: string | null;
  priority: string | null;
  issue_tags: string[] | null;
  reply_status: string;
  escalation_state: string;
  has_ai_suggestion: boolean;
  reply_text: string | null;
}

function mapDbReview(row: DbReview): AppReview {
  return {
    id:              row.id,
    author:          row.author,
    rating:          Math.min(5, Math.max(1, row.rating)) as AppReview["rating"],
    text:            row.body,
    appVersion:      row.app_version ?? "",
    device:          row.device ?? "",
    country:         row.country ?? "",
    issueTags:       (row.issue_tags ?? []) as AppReview["issueTags"],
    sentiment:       (row.sentiment ?? "mixed") as AppReview["sentiment"],
    priority:        (row.priority ?? "normal") as AppReview["priority"],
    replyStatus:     (row.reply_status ?? "needs_reply") as AppReview["replyStatus"],
    escalationState: (row.escalation_state ?? "none") as AppReview["escalationState"],
    createdAt:       row.store_created_at,
    source:          row.source === "google_play" ? "Google Play" : "App Store",
    hasAiSuggestion: row.has_ai_suggestion,
    replyText:       row.reply_text ?? undefined,
  };
}

// ── GET /api/reviews ───────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const { searchParams } = req.nextUrl;
    const limitParam = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
    const limit      = Math.min(isNaN(limitParam) ? DEFAULT_LIMIT : limitParam, MAX_LIMIT);
    const cursor     = searchParams.get("cursor") ?? undefined;
    const status     = searchParams.get("status") ?? undefined;
    const sentiment  = searchParams.get("sentiment") ?? undefined;
    const rating     = searchParams.get("rating") ? parseInt(searchParams.get("rating")!, 10) : undefined;
    const platform   = searchParams.get("platform") ?? undefined;
    const search     = searchParams.get("search")?.trim() ?? undefined;
    const appId      = searchParams.get("appId")?.trim() || undefined;

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) {
      // New user — no workspace yet. Return empty so onboarding shows naturally.
      return NextResponse.json({ reviews: [], nextCursor: null, hasMore: false });
    }

    const sb = getServiceClient();

    // Reviews are scoped to the workspace's LIVE apps. Without this, reviews
    // belonging to a disconnected (soft-deleted) app keep showing in the inbox
    // forever, and the sidebar's app selector has nothing to filter on.
    const { data: liveApps, error: appsError } = await sb
      .from("apps")
      .select("id")
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null);

    if (appsError) return captureAndError(appsError, "GET /api/reviews (apps)");

    let liveAppIds = (liveApps ?? []).map((a) => a.id as string);

    // An appId from the client is only honoured if it is one of this
    // workspace's live apps — never trusted as a filter on its own.
    if (appId) {
      if (!liveAppIds.includes(appId)) {
        return NextResponse.json({ reviews: [], nextCursor: null, hasMore: false });
      }
      liveAppIds = [appId];
    }

    if (!liveAppIds.length) {
      return NextResponse.json({ reviews: [], nextCursor: null, hasMore: false });
    }

    let query = sb
      .from("reviews")
      .select("id,external_id,source,author,rating,body,app_version,device,country,store_created_at,sentiment,priority,issue_tags,reply_status,escalation_state,has_ai_suggestion,reply_text")
      .eq("workspace_id", workspaceId)
      .in("app_id", liveAppIds)
      // `id` is the tiebreaker for both ordering and the cursor below. Ordering
      // by timestamp alone is non-deterministic between reviews that share one,
      // which makes pagination drop rows.
      .order("store_created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      // Composite cursor "<timestamp>|<id>". Paging on the timestamp alone
      // skipped every review that shared the last row's timestamp — common,
      // since store feeds batch reviews to the same second and the scraper
      // falls back to now() for unparseable dates. Those reviews were then
      // unreachable in the inbox.
      const sep = cursor.lastIndexOf("|");
      const cursorTs = sep === -1 ? cursor : cursor.slice(0, sep);
      const cursorId = sep === -1 ? null   : cursor.slice(sep + 1);

      if (cursorId && /^[0-9a-f-]{36}$/i.test(cursorId)) {
        query = query.or(
          `store_created_at.lt.${cursorTs},and(store_created_at.eq.${cursorTs},id.lt.${cursorId})`,
        );
      } else {
        // Legacy timestamp-only cursor from an in-flight session.
        query = query.lt("store_created_at", cursorTs);
      }
    }
    if (status)    query = query.eq("reply_status", status);
    if (sentiment) query = query.eq("sentiment", sentiment);
    if (rating !== undefined && !isNaN(rating)) query = query.eq("rating", rating);
    if (platform)  query = query.eq("source", platform === "Google Play" ? "google_play" : "app_store");
    // Full-text search: ilike on body + author (case-insensitive pattern match)
    // A GIN index on body can be added later for performance at scale.
    // Strip PostgREST filter-string special characters (,().'") before
    // interpolating into .or() — the workspace_id .eq() AND guard already
    // prevents cross-tenant leakage, but this removes the injection surface entirely.
    if (search) {
      const safe    = search.replace(/[,().'"\\\s]/g, " ").trim().slice(0, 100);
      const pattern = `%${safe.replace(/[%_]/g, "\\$&")}%`;
      query = query.or(`body.ilike.${pattern},author.ilike.${pattern}`);
    }

    const { data, error } = await query;

    if (error) return captureAndError(error, "GET /api/reviews");

    const rows = (data ?? []) as DbReview[];
    const hasMore = rows.length > limit;
    const page    = hasMore ? rows.slice(0, limit) : rows;
    const reviews = page.map(mapDbReview);
    const last    = page[page.length - 1];
    const nextCursor = hasMore && last ? `${last.store_created_at}|${last.id}` : null;

    return NextResponse.json({ reviews, nextCursor, hasMore });
  } catch (err) {
    return captureAndError(err, "GET /api/reviews");
  }
}
