import { describe, expect, it } from "vitest";

import { newIncident, ratingSpike, urgentReview } from "./slack";

describe("ratingSpike payload", () => {
  it("includes app name, version, count, and rating in the fallback text", () => {
    const p = ratingSpike({ appName: "Acme", avgRating: 1.5, reviewCount: 12, appVersion: "5.42" });
    expect(p.text).toContain("Acme");
    // Blocks should have rich text + a fields section
    expect(p.blocks?.length).toBeGreaterThanOrEqual(2);
    const allText = JSON.stringify(p.blocks);
    expect(allText).toContain("5.42");
    expect(allText).toContain("1.5");
    expect(allText).toContain("12");
  });
});

describe("newIncident payload", () => {
  it("uses 🚨 emoji for critical severity", () => {
    const p = newIncident({
      title: "Crash spike",
      severity: "critical",
      appName: "Acme",
      appUrl: "https://example.com/i/1",
    });
    expect(p.text).toContain("🚨");
  });

  it("uses 🔴 emoji for high severity", () => {
    const p = newIncident({
      title: "Login failures",
      severity: "high",
      appName: "Acme",
      appUrl: "https://example.com/i/2",
    });
    expect(p.text).toContain("🔴");
  });

  it("uses 🟡 emoji for medium severity (default)", () => {
    const p = newIncident({
      title: "Slow checkout",
      severity: "medium",
      appName: "Acme",
      appUrl: "https://example.com/i/3",
    });
    expect(p.text).toContain("🟡");
  });

  it("includes the incident URL in a block", () => {
    const url = "https://app.tryreviewbox.com/incidents/abc";
    const p = newIncident({ title: "Bug", severity: "high", appName: "Acme", appUrl: url });
    expect(JSON.stringify(p.blocks)).toContain(url);
  });
});

describe("urgentReview payload", () => {
  it("renders star rating visually", () => {
    const p = urgentReview({
      author: "Jane",
      rating: 2,
      text: "App keeps crashing",
      appName: "Acme",
      reviewUrl: "https://example.com",
    });
    // 2-star = ★★☆☆☆
    expect(JSON.stringify(p.blocks)).toContain("★★☆☆☆");
  });

  it("truncates long review text to 120 chars + ellipsis", () => {
    const longText = "a".repeat(200);
    const p = urgentReview({
      author: "Jane",
      rating: 1,
      text: longText,
      appName: "Acme",
      reviewUrl: "https://example.com",
    });
    const blockJson = JSON.stringify(p.blocks);
    expect(blockJson).toContain("…");
    expect(blockJson).not.toContain("a".repeat(200));
  });

  it("preserves short text verbatim", () => {
    const p = urgentReview({
      author: "Jane",
      rating: 1,
      text: "Short complaint",
      appName: "Acme",
      reviewUrl: "https://example.com",
    });
    expect(JSON.stringify(p.blocks)).toContain("Short complaint");
  });
});
