import { describe, expect, it } from "vitest";

import {
  detectIssueTags,
  enrichReview,
  scorePriority,
  scoreSentiment,
} from "./rules-engine";
import type { AppReview } from "@/types/review";

// Helper to build a review with sane defaults so each test only specifies
// what it cares about.
function r(over: Partial<AppReview> = {}): AppReview {
  return {
    id: "test-1",
    author: "Test",
    rating: 3,
    text: "",
    appVersion: "1.0.0",
    device: "",
    country: "",
    issueTags: [],
    sentiment: "mixed",
    priority: "normal",
    replyStatus: "needs_reply",
    escalationState: "none",
    createdAt: new Date().toISOString(),
    source: "Google Play",
    hasAiSuggestion: false,
    ...over,
  };
}

describe("detectIssueTags", () => {
  it("detects crash from common phrasings", () => {
    expect(detectIssueTags("App crashes every time I open it")).toContain("crash");
    expect(detectIssueTags("It force-closes when I switch accounts")).toContain("crash");
    expect(detectIssueTags("The app keeps crashing on iPad")).toContain("crash");
  });

  it("detects billing complaints", () => {
    expect(detectIssueTags("I want a refund for this subscription")).toContain("billing");
    expect(detectIssueTags("You charged me twice for one purchase")).toContain("billing");
  });

  it("detects multiple tags in one review", () => {
    const tags = detectIssueTags(
      "Crashes since the update, and I can't log in anymore",
    );
    expect(tags).toContain("crash");
    expect(tags).toContain("login");
    expect(tags).toContain("release-regression");
  });

  it("returns empty array for tag-less text", () => {
    expect(detectIssueTags("Best app ever, love it")).toEqual([]);
  });
});

describe("scoreSentiment", () => {
  it("returns positive for high ratings", () => {
    expect(scoreSentiment(5, "Love this app")).toMatchObject({ sentiment: "positive" });
    expect(scoreSentiment(4, "Pretty good")).toMatchObject({ sentiment: "positive" });
  });

  it("returns critical for 1-star with negative keywords", () => {
    expect(scoreSentiment(1, "Terrible, crashes constantly")).toMatchObject({
      sentiment: "critical",
    });
  });

  it("returns negative for 2-star reviews with no positive words", () => {
    const result = scoreSentiment(2, "Two stars from me.");
    expect(["negative", "critical"]).toContain(result.sentiment);
  });

  it("returns mixed for 3-star ambiguous reviews", () => {
    expect(scoreSentiment(3, "It's okay")).toMatchObject({ sentiment: "mixed" });
  });
});

describe("scorePriority", () => {
  it("marks crash + 1-star as urgent", () => {
    const result = scorePriority({
      rating: 1,
      issueTags: ["crash"],
      sentiment: "critical",
      replyStatus: "needs_reply",
      createdAt: new Date().toISOString(),
    });
    expect(result.priority).toBe("urgent");
  });

  it("marks old replied 5-star reviews as low priority", () => {
    const result = scorePriority({
      rating: 5,
      issueTags: [],
      sentiment: "positive",
      replyStatus: "replied",
      createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
    });
    expect(result.priority).toBe("low");
  });

  it("scales up for recent + unreplied", () => {
    const recent = scorePriority({
      rating: 2,
      issueTags: ["billing"],
      sentiment: "negative",
      replyStatus: "needs_reply",
      createdAt: new Date().toISOString(),
    });
    const old = scorePriority({
      rating: 2,
      issueTags: ["billing"],
      sentiment: "negative",
      replyStatus: "replied",
      createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    });
    expect(recent.score).toBeGreaterThan(old.score);
  });
});

describe("enrichReview", () => {
  it("returns all four enrichment fields", () => {
    const enriched = enrichReview(
      r({ rating: 1, text: "App crashes when I open it. Refund please." }),
    );
    expect(enriched).toHaveProperty("issueTags");
    expect(enriched).toHaveProperty("sentiment");
    expect(enriched).toHaveProperty("priority");
    expect(enriched).toHaveProperty("escalationState");
  });

  it("escalates a crash 1-star to engineering", () => {
    const enriched = enrichReview(
      r({ rating: 1, text: "App keeps crashing on launch" }),
    );
    expect(enriched.issueTags).toContain("crash");
    expect(enriched.escalationState).toBe("engineering");
  });

  it("is idempotent for the same input", () => {
    const review = r({ rating: 2, text: "Slow and laggy" });
    const a = enrichReview(review);
    const b = enrichReview(review);
    expect(a).toEqual(b);
  });
});
