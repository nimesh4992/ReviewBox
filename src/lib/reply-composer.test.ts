import { describe, expect, it } from "vitest";

import { composeReply } from "./reply-composer";
import { DEFAULT_PERSONA, type WorkspacePersona } from "./workspace-persona";
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

const persona: WorkspacePersona = {
  ...DEFAULT_PERSONA,
  teamName: "Acme",
  appName: "Acme App",
  supportEmail: "hello@acme.com",
};

describe("composeReply", () => {
  it("produces a non-empty reply for any review", () => {
    const reply = composeReply(r({ rating: 1, text: "Bad" }), "professional", persona);
    expect(reply.length).toBeGreaterThan(20);
  });

  it("personalises placeholders", () => {
    const reply = composeReply(
      r({ rating: 1, text: "Crash", issueTags: ["crash"] }),
      "professional",
      persona,
    );
    expect(reply).toContain("hello@acme.com");
    expect(reply).toContain("Acme");
    expect(reply).not.toContain("{appName}");
    expect(reply).not.toContain("{supportEmail}");
    expect(reply).not.toContain("{teamName}");
  });

  it("is deterministic — same input produces same output", () => {
    const review = r({ rating: 2, text: "Slow", issueTags: ["performance"] });
    const a = composeReply(review, "empathetic", persona);
    const b = composeReply(review, "empathetic", persona);
    expect(a).toBe(b);
  });

  it("acknowledges the primary issue tag", () => {
    const billing = composeReply(
      r({ rating: 1, text: "Refund please", issueTags: ["billing"] }),
      "professional",
      persona,
    );
    expect(billing.toLowerCase()).toMatch(/billing/);
  });

  it("uses a lighter CTA for positive reviews", () => {
    const positive = composeReply(
      r({ rating: 5, text: "Love it" }),
      "professional",
      persona,
    );
    // Positive replies should NOT include the "we'll resolve this" language
    expect(positive.toLowerCase()).not.toMatch(/we['']?ll follow up/);
  });

  it("uses a KB hint as the resolution sentence when provided", () => {
    const reply = composeReply(
      r({ rating: 1, text: "Crash", issueTags: ["crash"] }),
      "professional",
      persona,
      { kbHint: "Update to version 5.42 to get the crash fix." },
    );
    expect(reply).toContain("Update to version 5.42 to get the crash fix.");
  });

  it("handles all four tones without throwing", () => {
    const review = r({ rating: 2, text: "Disappointing", issueTags: ["performance"] });
    expect(() => composeReply(review, "professional", persona)).not.toThrow();
    expect(() => composeReply(review, "empathetic", persona)).not.toThrow();
    expect(() => composeReply(review, "casual", persona)).not.toThrow();
    expect(() => composeReply(review, "direct", persona)).not.toThrow();
  });

  it("includes the team sign-off", () => {
    const reply = composeReply(r({ rating: 3 }), "professional", persona);
    expect(reply).toContain("— Acme");
  });
});
