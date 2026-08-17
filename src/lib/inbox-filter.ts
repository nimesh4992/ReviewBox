/**
 * inbox-filter.ts — what an Inbox chip means, in one place.
 *
 * The chips used to be applied client-side over whatever page had loaded:
 *
 *   filtered = reviews.filter(r => activeFilter === "unreplied" ? … : …)
 *
 * With 20 reviews loaded out of 260, "App Store" under All apps could match
 * none of them — and the screen fell through to the empty state, telling a
 * customer with 130 reviews to go connect an app. The filter has to run where
 * the data is.
 *
 * The chip → query mapping lives here rather than in the component because two
 * places now need it: the page, which drives the fetch, and the component,
 * which renders the chips. Two hand-written copies of "unreplied means
 * reply_status = needs_reply" is finding M-13's shape, and the failure would be
 * silent — a chip that highlights while the list ignores it.
 */

import type { ReviewFiltersQuery } from "@/hooks/use-review-queue";

export type InboxFilter = "all" | "unreplied" | "low_rating" | "app_store" | "play_store";

export const INBOX_FILTERS = [
  "all",
  "unreplied",
  "low_rating",
  "app_store",
  "play_store",
] as const satisfies readonly InboxFilter[];

/**
 * The server query a chip stands for.
 *
 * Values are the STORAGE vocabulary — `needs_reply`, `google_play` — because
 * that is what `/api/reviews` filters on. It used to accept the display string
 * "Google Play" and silently map everything else to App Store; it now validates
 * the storage enum, so sending the display name here would match nothing.
 */
export function inboxFilterToQuery(filter: InboxFilter): ReviewFiltersQuery {
  switch (filter) {
    case "all":        return {};
    case "unreplied":  return { status: "needs_reply" };
    case "low_rating": return { maxRating: 2 };
    case "app_store":  return { platform: "app_store" };
    case "play_store": return { platform: "google_play" };
  }
  // Exhaustive: a new chip added to InboxFilter without a query here is a tsc
  // error, not a chip that silently returns everything.
  const _exhaustive: never = filter;
  return _exhaustive;
}

/**
 * Does this chip narrow the list?
 *
 * Used by the empty state to tell "nothing matches your filter" from "you have
 * no reviews at all" — the distinction whose absence produced the "Connect an
 * app in Settings" message on a workspace with 130 reviews.
 */
export function isNarrowingFilter(filter: InboxFilter): boolean {
  return filter !== "all";
}
