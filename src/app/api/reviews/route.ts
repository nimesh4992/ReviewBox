import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
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
    if (!userId) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const limitParam = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);
    const limit      = Math.min(isNaN(limitParam) ? DEFAULT_LIMIT : limitParam, MAX_LIMIT);
    const cursor     = searchParams.get("cursor") ?? undefined;
    const status     = searchParams.get("status") ?? undefined;
    const sentiment  = searchParams.get("sentiment") ?? undefined;
    const rating     = searchParams.get("rating") ? parseInt(searchParams.get("rating")!, 10) : undefined;
    const platform   = searchParams.get("platform") ?? undefined;
    const search     = searchParams.get("search")?.trim() ?? undefined;

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) {
      // New user — no workspace yet. Return empty so onboarding shows naturally.
      return NextResponse.json({ reviews: [], nextCursor: null, hasMore: false });
    }

    const sb = getServiceClient();
    let query = sb
      .from("reviews")
      .select("id,external_id,source,author,rating,body,app_version,device,country,store_created_at,sentiment,priority,issue_tags,reply_status,escalation_state,has_ai_suggestion,reply_text")
      .eq("workspace_id", workspaceId)
      .order("store_created_at", { ascending: false })
      .limit(limit + 1);

    if (cursor)    query = query.lt("store_created_at", cursor);
    if (status)    query = query.eq("reply_status", status);
    if (sentiment) query = query.eq("sentiment", sentiment);
    if (rating !== undefined && !isNaN(rating)) query = query.eq("rating", rating);
    if (platform)  query = query.eq("source", platform === "Google Play" ? "google_play" : "app_store");
    // Full-text search: ilike on body + author (case-insensitive pattern match)
    // A GIN index on body can be added later for performance at scale.
    if (search) {
      const pattern = `%${search.replace(/[%_]/g, "\\$&")}%`;
      query = query.or(`body.ilike.${pattern},author.ilike.${pattern}`);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[GET /api/reviews]", error);
      return NextResponse.json({ error: "QUERY_FAILED" }, { status: 500 });
    }

    const rows = (data ?? []) as DbReview[];
    const hasMore = rows.length > limit;
    const page    = hasMore ? rows.slice(0, limit) : rows;
    const reviews = page.map(mapDbReview);
    const nextCursor = hasMore ? page[page.length - 1]?.store_created_at ?? null : null;

    return NextResponse.json({ reviews, nextCursor, hasMore });
  } catch (err) {
    console.error("[GET /api/reviews] unexpected:", err);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
