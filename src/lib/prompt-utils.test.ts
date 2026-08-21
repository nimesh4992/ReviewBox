import { describe, expect, it } from "vitest";

import { buildSystemPrompt, compressReviewText, humanizePunctuation } from "./prompt-utils";

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

describe("humanizePunctuation", () => {
  it("removes the em dash that marks a reply as machine-written", () => {
    expect(humanizePunctuation("We're sorry — that's frustrating.")).toBe(
      "We're sorry, that's frustrating.",
    );
  });

  it("turns a sign-off dash into a plain hyphen", () => {
    // The deterministic composer emitted "\n\n— {teamName}", which is why em
    // dashes appeared even when no model ran.
    expect(humanizePunctuation("Thanks for writing in.\n\n— The Mumbai One Team")).toBe(
      "Thanks for writing in.\n\n- The Mumbai One Team",
    );
  });

  it("handles en dashes too", () => {
    expect(humanizePunctuation("Sorry – we're on it.")).toBe("Sorry, we're on it.");
  });

  it("catches a dash with no surrounding spaces", () => {
    expect(humanizePunctuation("crash—on launch")).toBe("crash-on launch");
  });

  it("does not create doubled punctuation", () => {
    expect(humanizePunctuation("Fixed, — and shipped.")).toBe("Fixed, and shipped.");
    expect(humanizePunctuation("Done — . Next.")).toBe("Done. Next.");
  });

  it("leaves ordinary hyphens and text alone", () => {
    const clean = "Re-open the app, then sign in again.\n\n- The Support Team";
    expect(humanizePunctuation(clean)).toBe(clean);
  });

  it("is safe on empty text", () => {
    expect(humanizePunctuation("")).toBe("");
  });
});

describe("buildSystemPrompt contact rule", () => {
  // A live 5-language smoke run had the model answer a payment complaint with
  // "bhejein support@reviewbox.com" -- an address that does not exist. The AI
  // tier was the only tier never given persona.supportEmail, so with room to
  // write a contact line it confabulated one. These replies publish publicly
  // under the customer's developer name.
  it("uses the real support address when one is supplied", () => {
    const prompt = buildSystemPrompt({
      tone: "professional",
      supportEmail: "hello@tryreviewbox.com",
    });
    expect(prompt).toContain("hello@tryreviewbox.com");
  });

  it("forbids inventing contact details even with an address supplied", () => {
    const prompt = buildSystemPrompt({
      tone: "professional",
      supportEmail: "hello@tryreviewbox.com",
    });
    expect(prompt).toMatch(/never invent an email address/i);
  });

  it("forbids inventing contact details when NO address is supplied", () => {
    // The important half: absence of an address must not license invention.
    const prompt = buildSystemPrompt({ tone: "professional" });
    expect(prompt).toMatch(/never invent an email address/i);
    expect(prompt).not.toMatch(/@/);
  });
});
