import { describe, it, expect } from "vitest";

import { planSyncWrites, mergeReviewRows, type KnownReview } from "./sync-writes";

function row(external_id: string, reply_status = "needs_reply", reply_text: string | null = null) {
  return { external_id, reply_status, reply_text };
}

function known(id: string, reply_status: string): KnownReview {
  return { id, reply_status };
}

describe("planSyncWrites", () => {
  it("inserts reviews we have never seen", () => {
    const plan = planSyncWrites([row("a"), row("b")], new Map());

    expect(plan.inserts.map((r) => r.external_id)).toEqual(["a", "b"]);
    expect(plan.promotions).toEqual([]);
  });

  it("never re-inserts a review we already hold", () => {
    const existing = new Map([["a", known("row-a", "needs_reply")]]);

    const plan = planSyncWrites([row("a"), row("b")], existing);

    expect(plan.inserts.map((r) => r.external_id)).toEqual(["b"]);
  });

  // ── The data-loss regressions this module exists to prevent ────────────────

  it("does not touch a saved AI draft when the store still shows no reply", () => {
    // User generated and saved a draft. The store listing knows nothing about
    // it, so the fetched row says needs_reply. That must not overwrite.
    const existing = new Map([["a", known("row-a", "draft_ready")]]);

    const plan = planSyncWrites([row("a", "needs_reply", null)], existing);

    expect(plan.inserts).toEqual([]);
    expect(plan.promotions).toEqual([]);
  });

  it("does not reset a Draft Mode 'mark as replied' back to needs_reply", () => {
    // D018: the user pasted the reply into the store console themselves and
    // marked it replied here. The public feed may not surface that reply —
    // notably the iTunes RSS feed never reports developer replies at all.
    const existing = new Map([["a", known("row-a", "replied")]]);

    const plan = planSyncWrites([row("a", "needs_reply", null)], existing);

    expect(plan.inserts).toEqual([]);
    expect(plan.promotions).toEqual([]);
  });

  it("does not downgrade a replied review when a second source omits the reply", () => {
    const existing = new Map([["a", known("row-a", "replied")]]);

    const plan = planSyncWrites([row("a", "draft_ready", null)], existing);

    expect(plan.promotions).toEqual([]);
  });

  // ── The one legitimate upgrade ────────────────────────────────────────────

  it("promotes needs_reply to replied when the store shows a developer reply", () => {
    const existing = new Map([["a", known("row-a", "needs_reply")]]);

    const plan = planSyncWrites([row("a", "replied", "Thanks for the feedback!")], existing);

    expect(plan.inserts).toEqual([]);
    expect(plan.promotions).toEqual([{ id: "row-a", replyText: "Thanks for the feedback!" }]);
  });

  it("does not promote when we already consider the review replied", () => {
    const existing = new Map([["a", known("row-a", "replied")]]);

    const plan = planSyncWrites([row("a", "replied", "store text")], existing);

    expect(plan.promotions).toEqual([]);
  });

  it("does not promote over a local draft the user has not posted yet", () => {
    // Only needs_reply is promotable — a draft_ready row is mid-edit.
    const existing = new Map([["a", known("row-a", "draft_ready")]]);

    const plan = planSyncWrites([row("a", "replied", "store text")], existing);

    expect(plan.promotions).toEqual([]);
  });

  it("handles a mixed batch in one pass", () => {
    const existing = new Map([
      ["known-needs", known("r1", "needs_reply")],
      ["known-draft", known("r2", "draft_ready")],
      ["known-replied", known("r3", "replied")],
    ]);

    const plan = planSyncWrites(
      [
        row("brand-new"),
        row("known-needs", "replied", "reply!"),
        row("known-draft", "needs_reply"),
        row("known-replied", "needs_reply"),
      ],
      existing,
    );

    expect(plan.inserts.map((r) => r.external_id)).toEqual(["brand-new"]);
    expect(plan.promotions).toEqual([{ id: "r1", replyText: "reply!" }]);
  });
});

describe("mergeReviewRows", () => {
  it("returns one row per external_id", () => {
    const merged = mergeReviewRows([row("a"), row("b")], [row("b"), row("c")]);

    expect(merged.map((r) => r.external_id).sort()).toEqual(["a", "b", "c"]);
  });

  it("lets a later source win on conflict", () => {
    // Scrape first, official API second — the API carries the developer reply.
    const scraped = [row("a", "needs_reply", null)];
    const api = [row("a", "replied", "official reply")];

    const merged = mergeReviewRows(scraped, api);

    expect(merged).toHaveLength(1);
    expect(merged[0].reply_status).toBe("replied");
    expect(merged[0].reply_text).toBe("official reply");
  });

  it("tolerates a null source so one failed fetch doesn't lose the other", () => {
    // The Publisher API is optional in Draft Mode — its absence must not
    // discard the scraped rows.
    expect(mergeReviewRows([row("a")], null).map((r) => r.external_id)).toEqual(["a"]);
    expect(mergeReviewRows(null, [row("b")]).map((r) => r.external_id)).toEqual(["b"]);
    expect(mergeReviewRows(null, undefined)).toEqual([]);
  });
});
