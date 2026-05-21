import { describe, expect, it } from "vitest";

import { compressReviewText } from "./prompt-utils";

describe("compressReviewText", () => {
  it("strips common filler phrases", () => {
    const compressed = compressReviewText(
      "To be honest the app keeps crashing on login.",
    );
    expect(compressed.toLowerCase()).not.toContain("to be honest");
    expect(compressed.toLowerCase()).toContain("the app keeps crashing");
  });

  it("collapses double spaces left by filler removal", () => {
    const out = compressReviewText("First off the UI is great. To be honest no complaints.");
    expect(out).not.toMatch(/ {2}/);
  });

  it("truncates long reviews at a word boundary with ellipsis", () => {
    const long = "The app is good ".repeat(50); // ~800 chars
    const compressed = compressReviewText(long, 280);
    expect(compressed.length).toBeLessThanOrEqual(281); // 280 + ellipsis
    expect(compressed.endsWith("…")).toBe(true);
  });

  it("respects custom maxChars", () => {
    const long = "x".repeat(500);
    const compressed = compressReviewText(long, 50);
    expect(compressed.length).toBeLessThanOrEqual(51);
  });

  it("handles empty input", () => {
    expect(compressReviewText("")).toBe("");
  });

  it("is case-insensitive on filler matching", () => {
    const out1 = compressReviewText("TO BE HONEST the app crashes");
    const out2 = compressReviewText("to be honest the app crashes");
    // Both should drop the filler regardless of case
    expect(out1.toLowerCase()).not.toContain("to be honest");
    expect(out2.toLowerCase()).not.toContain("to be honest");
  });

  it("leaves text without filler unchanged in substance", () => {
    const text = "The app crashes on launch.";
    expect(compressReviewText(text)).toBe(text);
  });
});
