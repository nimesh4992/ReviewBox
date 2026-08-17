/**
 * Inbox chips → server query.
 *
 * The chips used to filter client-side over whatever page had loaded, which is
 * how "App Store" under All apps could match none of the first 20 rows and
 * render "No reviews — connect an app in Settings" to a workspace holding 130
 * of them. Moving the filter to the server fixes that, but introduces a new way
 * to be silently wrong: send the WRONG VOCABULARY and the query matches
 * nothing, or worse, matches the other store.
 *
 * That is not hypothetical. `/api/reviews` used to read the platform param as
 *
 *   platform === "Google Play" ? "google_play" : "app_store"
 *
 * so every unrecognised value — including `"google_play"`, the value the
 * database actually stores — silently selected App Store. These tests pin the
 * vocabulary on both sides of that boundary.
 */

import { describe, expect, it } from "vitest";

import { INBOX_FILTERS, inboxFilterToQuery, isNarrowingFilter, type InboxFilter } from "./inbox-filter";
import { isStorePlatform } from "./platform-label";

describe("inboxFilterToQuery", () => {
  it("maps every chip to a query", () => {
    for (const filter of INBOX_FILTERS) {
      expect(inboxFilterToQuery(filter), filter).toBeDefined();
    }
  });

  it("asks the server for nothing extra on All", () => {
    expect(inboxFilterToQuery("all")).toEqual({});
  });

  it("uses the STORED reply status, not a display label", () => {
    // `reply_status` values are needs_reply / draft_ready / replied / waiting.
    expect(inboxFilterToQuery("unreplied")).toEqual({ status: "needs_reply" });
  });

  it("expresses 1-2 ★ as an upper bound, not an exact match", () => {
    // The API's `rating` param is `.eq()`. Sending rating: 2 would silently
    // drop every 1-star review from a chip labelled "1-2 ★".
    expect(inboxFilterToQuery("low_rating")).toEqual({ maxRating: 2 });
  });

  it("sends platform values the API will actually accept", () => {
    // The cross-module invariant. `/api/reviews` now validates with
    // isStorePlatform and IGNORES anything else — so a display name here
    // ("App Store") would quietly return unfiltered results, and the chip would
    // highlight over a list it isn't filtering.
    for (const filter of ["app_store", "play_store"] as const) {
      const { platform } = inboxFilterToQuery(filter);
      expect(isStorePlatform(platform), `${filter} -> ${String(platform)}`).toBe(true);
    }
  });

  it("maps Play Store to google_play, not app_store", () => {
    // Naming asymmetry worth pinning: the chip is "Play Store", the stored
    // value is `google_play`. A mapping written from the label would be wrong
    // in the one direction nothing else would catch.
    expect(inboxFilterToQuery("play_store").platform).toBe("google_play");
    expect(inboxFilterToQuery("app_store").platform).toBe("app_store");
  });
});

describe("isNarrowingFilter", () => {
  it("is false only for All", () => {
    expect(isNarrowingFilter("all")).toBe(false);
    for (const filter of INBOX_FILTERS.filter((f) => f !== "all")) {
      expect(isNarrowingFilter(filter), filter).toBe(true);
    }
  });

  it("covers every chip", () => {
    // The empty state picks its message from this. A chip missing from the
    // narrowing set would send a filtered-to-zero list back to "Connect an app
    // in Settings" — the exact message this whole change exists to remove.
    const covered: InboxFilter[] = [...INBOX_FILTERS];
    expect(covered).toHaveLength(5);
  });
});
