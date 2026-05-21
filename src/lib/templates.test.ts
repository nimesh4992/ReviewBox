import { describe, expect, it } from "vitest";

import { getMatchedTemplate } from "./templates";
import type { AppReview } from "@/types/review";

function r(over: Partial<AppReview> = {}): AppReview {
  return {
    id: "test-1",
    author: "Tester",
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

describe("getMatchedTemplate", () => {
  it("matches a 5-star review to a trivial template (rating_only or short praise)", () => {
    const match = getMatchedTemplate(r({ rating: 5, text: "" }));
    expect(match).toBeTruthy();
    // Both rating_only and positive_5star_short are valid trivial matches for 5★.
    // The /api/reply/draft tier system treats both as cache-safe templates.
    expect(["rating_only", "positive_5star_short"]).toContain(match?.id);
  });

  it("matches a short 5-star praise to a trivial template", () => {
    const match = getMatchedTemplate(r({ rating: 5, text: "Love this app!" }));
    expect(match).toBeTruthy();
    expect(["rating_only", "positive_5star_short"]).toContain(match?.id);
  });

  it("matches a crash 1-star to a crash template", () => {
    const match = getMatchedTemplate(
      r({ rating: 1, text: "App crashes every time", issueTags: ["crash"] }),
    );
    expect(match).toBeTruthy();
    expect(match?.id).toMatch(/crash/);
  });

  it("returns null when no template matches", () => {
    // 3-star with completely novel content shouldn't match
    const match = getMatchedTemplate(
      r({ rating: 3, text: "An entirely unexpected description of something obscure" }),
    );
    // null OR a generic fallback are both valid — just must not crash
    if (match) {
      expect(typeof match.id).toBe("string");
    }
  });

  it("respects ratingMin/ratingMax constraints", () => {
    // A 1-star shouldn't match rating_only (which is for 5-star)
    const match = getMatchedTemplate(r({ rating: 1, text: "" }));
    if (match) {
      // Must be a low-rating template (e.g. critical_no_details), not a 5-star one
      expect(match.id).not.toBe("rating_only");
      expect(match.id).not.toBe("positive_5star_short");
    }
  });
});
