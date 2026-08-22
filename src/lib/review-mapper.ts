import { enrichReview } from "@/lib/rules-engine";
import { toAlpha2 } from "@/lib/country-codes";
import type { AppReview } from "@/types/review";

/**
 * Maps raw review fields to an enriched DB row ready to upsert into `reviews`.
 * Shared between the Publisher API sync and the public-scrape bootstrap.
 */
export function buildEnrichedRow(
  appId: string,
  workspaceId: string,
  externalId: string,
  source: "google_play" | "app_store",
  author: string,
  rating: number,
  body: string,
  appVersion: string | null,
  device: string | null,
  country: string | null,
  storeCreatedAt: string,
  hasDevReply: boolean,
  devReplyText: string | null,
  /**
   * Google Play's integer `appVersionCode` — the BUILD the reviewer was running.
   *
   * Appended rather than placed beside `appVersion`, where it belongs
   * logically, because inserting a parameter into a thirteen-argument
   * positional signature silently shifts six call-site arguments. Optional so
   * the two callers that can never have one — App Store Connect, and the public
   * Play scrape, which exposes only a version *name* — need no change.
   *
   * Why it matters: version NAMES are reused and non-monotonic. Mumbai One
   * shipped three separate builds called "1.4.1" over six weeks, and "1.5"
   * twice three months apart — with 1.5 landing BEFORE 1.4.1. Grouping releases
   * by name therefore merges distinct builds (backlog RV1).
   *
   * `appVersionCode` is documented "may be absent", so null is ordinary, not a
   * failure — see the column comment in migration 031.
   */
  versionCode: number | null = null,
) {
  // Guard against NaN/undefined/0: Math.max(1, NaN) === NaN, which would write
  // a NaN rating into the DB. A non-finite or out-of-range rating falls back to
  // 3 (neutral) rather than 1, so a missing rating isn't mis-scored as critical.
  const numericRating = Number(rating);
  const clampedRating = (
    Number.isFinite(numericRating)
      ? Math.min(5, Math.max(1, Math.round(numericRating)))
      : 3
  ) as 1 | 2 | 3 | 4 | 5;
  // "Replied" requires an actual reply.
  //
  // Callers pass a presence flag and the text separately, and the two can
  // disagree: App Store Connect's `relationships.response` says a reply EXISTS
  // without carrying its body, so a caller that doesn't resolve the text ends
  // up asserting hasDevReply=true, devReplyText=null. That combination renders
  // as a review marked replied with no reply visible and an empty edit box —
  // and because known rows are never re-promoted or content-refreshed, it never
  // self-heals.
  //
  // Rather than trust the flag, require both. A review whose reply text we
  // could not obtain stays `needs_reply`: showing it as still needing an answer
  // is recoverable, showing it as answered with nothing there is not.
  const replyText = devReplyText?.trim() ? devReplyText : null;
  const isReplied = hasDevReply && replyText !== null;

  const partial = {
    rating: clampedRating,
    text: body,
    createdAt: storeCreatedAt,
    replyStatus: (isReplied ? "replied" : "needs_reply") as AppReview["replyStatus"],
  } as AppReview;
  const enriched = enrichReview(partial);

  return {
    app_id:            appId,
    workspace_id:      workspaceId,
    external_id:       externalId,
    source,
    author,
    rating:            clampedRating,
    body,
    app_version:       appVersion,
    // Non-integers cannot reach an `integer` column: a NaN or a float would
    // fail the whole batch insert, taking every other review in it down too.
    version_code:      Number.isInteger(versionCode) ? versionCode : null,
    device,
    // `country` is char(2). App Store Connect sends alpha-3 territories
    // ("IND"), which raise 22001 and fail the entire insert batch — one
    // bad field would otherwise break sync for the whole app.
    country:           toAlpha2(country),
    store_created_at:  storeCreatedAt,
    sentiment:         enriched.sentiment,
    priority:          enriched.priority,
    issue_tags:        enriched.issueTags,
    escalation_state:  enriched.escalationState,
    reply_status:      isReplied ? "replied" : "needs_reply",
    reply_text:        replyText,
    has_ai_suggestion: false,
  };
}
