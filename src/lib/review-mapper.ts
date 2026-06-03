import { enrichReview } from "@/lib/rules-engine";
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
  const partial = {
    rating: clampedRating,
    text: body,
    createdAt: storeCreatedAt,
    replyStatus: (hasDevReply ? "replied" : "needs_reply") as AppReview["replyStatus"],
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
    device,
    country,
    store_created_at:  storeCreatedAt,
    sentiment:         enriched.sentiment,
    priority:          enriched.priority,
    issue_tags:        enriched.issueTags,
    escalation_state:  enriched.escalationState,
    reply_status:      hasDevReply ? "replied" : "needs_reply",
    reply_text:        devReplyText,
    has_ai_suggestion: false,
  };
}
