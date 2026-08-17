/**
 * buildEnrichedRow — the single place raw store data becomes a `reviews` row.
 *
 * Previously untested, and it carries the guard for audit finding H-6: a
 * review must never be written as `replied` without a reply to show.
 *
 * The bug it prevents: App Store Connect's `relationships.response` states
 * that a developer reply EXISTS but does not carry its body. The sync passed
 * that presence flag through with the text hardcoded to null, so every App
 * Store app with pre-existing replies — the normal case for any live app —
 * had them written as `reply_status: "replied", reply_text: null` on the first
 * sync. In the inbox that renders as a review marked replied, with no reply
 * visible and an empty edit box, for the one plan tier paying for one-click
 * reply posting. Known rows are never content-refreshed, so it never healed.
 */

import { describe, expect, it } from "vitest";

import { buildEnrichedRow } from "./review-mapper";

function build(hasDevReply: boolean, devReplyText: string | null) {
  return buildEnrichedRow(
    "app-1",
    "ws-1",
    "ext-1",
    "app_store",
    "Asha",
    1,
    "Crashes on launch every time since the update",
    "4.2.0",
    null,
    "IND",
    "2026-08-17T00:00:00.000Z",
    hasDevReply,
    devReplyText,
  );
}

describe("buildEnrichedRow — reply state", () => {
  it("marks a review replied when there is real reply text", () => {
    const row = build(true, "Sorry about that — fixed in 4.2.1.");
    expect(row.reply_status).toBe("replied");
    expect(row.reply_text).toBe("Sorry about that — fixed in 4.2.1.");
  });

  it("REGRESSION: refuses to mark replied when the reply text is missing", () => {
    // hasDevReply=true with no body is exactly what the App Store path used to
    // pass. Answering "needs_reply" is the recoverable direction: a later sync
    // can promote it once the text resolves, whereas "answered but blank" is a
    // dead end the customer cannot fix.
    const row = build(true, null);
    expect(row.reply_status).toBe("needs_reply");
    expect(row.reply_text).toBeNull();
  });

  it("treats a blank or whitespace-only reply as no reply", () => {
    for (const text of ["", "   ", "\n\t "]) {
      const row = build(true, text);
      expect(row.reply_status).toBe("needs_reply");
      expect(row.reply_text).toBeNull();
    }
  });

  it("never invents a reply when the store says there is none", () => {
    const row = build(false, null);
    expect(row.reply_status).toBe("needs_reply");
    expect(row.reply_text).toBeNull();
  });

  it("ignores stray text when the store says there is no reply", () => {
    // Guards the other direction of the same disagreement.
    const row = build(false, "leftover");
    expect(row.reply_status).toBe("needs_reply");
  });
});

describe("buildEnrichedRow — field mapping", () => {
  it("converts an alpha-3 territory to the char(2) the column accepts", () => {
    // App Store Connect sends "IND"; `reviews.country` is char(2), and an
    // over-long value raises 22001 which fails the ENTIRE insert batch —
    // one bad field would break sync for the whole app.
    expect(build(false, null).country).toBe("IN");
  });

  it("enriches every row at write time, with no network call", () => {
    const row = build(false, null);
    // A 1★ crash report should be scored without any AI involvement.
    expect(row.sentiment).toBe("critical");
    expect(row.priority).toBe("urgent");
    expect(row.issue_tags).toContain("crash");
  });

  it("clamps a non-finite rating to neutral rather than critical", () => {
    // Math.max(1, NaN) is NaN, which would write NaN into a numeric column.
    // Falling back to 3 avoids mis-scoring a missing rating as a 1★ crisis.
    const row = buildEnrichedRow(
      "app-1", "ws-1", "ext-2", "google_play", "Sam",
      Number.NaN as unknown as number,
      "no rating supplied", null, null, "IN",
      "2026-08-17T00:00:00.000Z", false, null,
    );
    expect(row.rating).toBe(3);
  });

  it("clamps an out-of-range rating into 1–5", () => {
    const high = buildEnrichedRow("a", "w", "e", "google_play", "S", 9, "x", null, null, "IN", "2026-08-17T00:00:00.000Z", false, null);
    const low  = buildEnrichedRow("a", "w", "e", "google_play", "S", 0, "x", null, null, "IN", "2026-08-17T00:00:00.000Z", false, null);
    expect(high.rating).toBe(5);
    expect(low.rating).toBe(1);
  });
});
