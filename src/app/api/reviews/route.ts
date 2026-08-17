import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError, captureAndError } from "@/lib/api-response";
import { isMissingColumnError } from "@/lib/db-errors";
import { isStorePlatform } from "@/lib/platform-label";
import { effectiveTags } from "@/lib/tag-labels";
import type { AppReview } from "@/types/review";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// ── DB row shape (snake_case from Supabase) ────────────────────────────────────

interface DbReview {
  id: string;
  external_id: string;
  app_id: string;
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
  /** Human correction (migration 024). Null = untouched; empty = tags deliberately cleared. */
  issue_tags_override?: string[] | null;
  reply_status: string;
  escalation_state: string;
  has_ai_suggestion: boolean;
  reply_text: string | null;
}

const REVIEW_COLUMNS =
  "id,external_id,app_id,source,author,rating,body,app_version,device,country," +
  "store_created_at,sentiment,priority,issue_tags,reply_status,escalation_state," +
  "has_ai_suggestion,reply_text";

function mapDbReview(row: DbReview): AppReview {
  return {
    id:              row.id,
    // Lets the composer look up the app's credential state and pick the right
    // primary action (post via API vs. copy-and-paste draft mode).
    appId:           row.app_id,
    author:          row.author,
    rating:          Math.min(5, Math.max(1, row.rating)) as AppReview["rating"],
    text:            row.body,
    appVersion:      row.app_version ?? "",
    device:          row.device ?? "",
    country:         row.country ?? "",
    issueTags:       effectiveTags(row.issue_tags, row.issue_tags_override) as AppReview["issueTags"],
    // The engine's own answer, kept alongside so the editor can show what was
    // changed and offer a reset without a second request.
    autoIssueTags:   (row.issue_tags ?? []) as AppReview["issueTags"],
    tagsEdited:      row.issue_tags_override != null,
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

    // The id half of the composite cursor is UUID-validated before it is
    // interpolated into the .or() filter; the timestamp half was not, and it
    // goes into that same expression twice. A comma or parenthesis there is not
    // a syntax error to PostgREST — it is more filter grammar. The workspace_id
    // .eq() guard bounds the blast radius, but a filter expression is not a
    // place to put unvalidated input.
    if (cursor !== undefined) {
      const sep = cursor.lastIndexOf("|");
      const ts  = sep === -1 ? cursor : cursor.slice(0, sep);
      const valid = /^[0-9T:.+-]{10,35}Z?$/.test(ts) && !Number.isNaN(Date.parse(ts));
      if (!valid) {
        // A cursor we did not mint. Answer empty rather than guessing at intent.
        return NextResponse.json({ reviews: [], nextCursor: null, hasMore: false });
      }
    }
    const status     = searchParams.get("status") ?? undefined;
    const sentiment  = searchParams.get("sentiment") ?? undefined;
    const rating     = searchParams.get("rating") ? parseInt(searchParams.get("rating")!, 10) : undefined;
    // Upper bound, for the inbox's "1-2 ★" chip. `rating` is an exact match
    // and cannot express it.
    const maxRating  = searchParams.get("maxRating") ? parseInt(searchParams.get("maxRating")!, 10) : undefined;
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

    const buildQuery = (columns: string) => {
    let query = sb
      .from("reviews")
      .select(columns)
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

      // The id half was already UUID-validated before being interpolated into
      // the .or() expression; the timestamp half was not, and it is
      // interpolated twice into that same expression. A comma or a parenthesis
      // in it is not a syntax error to PostgREST — it is more filter grammar.
      // The workspace_id .eq() guard still bounds the blast radius, but a
      // filter expression is not a place to put unvalidated input.
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
    if (maxRating !== undefined && !isNaN(maxRating)) query = query.lte("rating", maxRating);
    // Storage enum, validated. This was
    //   platform === "Google Play" ? "google_play" : "app_store"
    // which silently mapped EVERY unrecognised value — including the storage
    // enum "google_play" itself — to app_store. A caller passing the value the
    // database actually holds would have been answered with the other store's
    // reviews and no error. Unknown values are now ignored, like `rating`'s
    // NaN guard, rather than guessed at.
    if (isStorePlatform(platform)) query = query.eq("source", platform);
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

    return query;
    };

    // `issue_tags_override` arrives with migration 024. Naming a column that
    // does not exist fails the whole select with 42703, which would empty the
    // inbox for every customer until the migration ran — so the optional column
    // is asked for once and dropped if the database has not caught up.
    let { data, error } = await buildQuery(`${REVIEW_COLUMNS},issue_tags_override`);
    if (isMissingColumnError(error)) {
      ({ data, error } = await buildQuery(REVIEW_COLUMNS));
    }

    if (error) return captureAndError(error, "GET /api/reviews");

    const rows = (data ?? []) as unknown as DbReview[];
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
