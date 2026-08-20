import { describe, expect, it } from "vitest";

import { isLanguageBucket, LANGUAGE_BUCKETS } from "./language-bucket";
// The classifier moved to language-detect.ts so this file stays import-free
// for the CLIs (see its header). Every assertion below is unchanged.
import { classifyLanguageBucket } from "../language-detect";

describe("classifyLanguageBucket", () => {
  it("classifies plain English as english", () => {
    expect(classifyLanguageBucket("Payment failed and the ticket was never issued")).toBe("english");
  });

  it("classifies pure Devanagari as native-script", () => {
    expect(classifyLanguageBucket("पैसा कट गया लेकिन टिकट नहीं आया")).toBe("native-script");
  });

  it("classifies Devanagari mixed with Latin as hinglish", () => {
    // The exact sentence the epic turns on.
    expect(classifyLanguageBucket("payment कट गया but ticket nahi aaya")).toBe("hinglish");
  });

  it("classifies romanised Hindi in Latin script as hinglish", () => {
    expect(classifyLanguageBucket("paisa cut ho gaya lekin ticket nahi mila")).toBe("hinglish");
  });

  it("needs two ordinary markers, not one, before calling something hinglish", () => {
    // "hai" alone is weak evidence; a single weak marker must not flip an
    // otherwise English review, or the Hinglish bucket fills with English.
    expect(classifyLanguageBucket("the ui hai slow")).toBe("english");
    expect(classifyLanguageBucket("app hai bahut slow")).toBe("hinglish");
  });

  it("accepts one strong marker on its own", () => {
    expect(classifyLanguageBucket("refund nahi")).toBe("hinglish");
  });

  it("does not mistake English words that look like short Hindi particles", () => {
    // "se", "ka", "ki", "to", "me" are deliberately excluded from the markers.
    expect(classifyLanguageBucket("I want to see the me page")).toBe("english");
    expect(classifyLanguageBucket("Ka-ching, the app works")).toBe("english");
  });

  it("handles empty and emoji-only text without crashing", () => {
    expect(classifyLanguageBucket("")).toBe("english");
    expect(classifyLanguageBucket("😤😤😤")).toBe("english");
  });

  it("is case-insensitive for romanised markers", () => {
    expect(classifyLanguageBucket("PAISE NAHI MILE")).toBe("hinglish");
  });
});

describe("isLanguageBucket", () => {
  it("accepts every declared bucket and rejects anything else", () => {
    for (const bucket of LANGUAGE_BUCKETS) expect(isLanguageBucket(bucket)).toBe(true);
    expect(isLanguageBucket("marathi")).toBe(false);
    expect(isLanguageBucket("")).toBe(false);
  });
});
