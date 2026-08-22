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
      rating: 2,
      appName: "Acme",
      reviewUrl: "https://example.com",
    });
    // 2-star = ★★☆☆☆
    expect(JSON.stringify(p.blocks)).toContain("★★☆☆☆");
  });

  it("carries the issue tags, version and posting day when they are known", () => {
    const p = urgentReview({
      rating: 1,
      appName: "Acme",
      issueTags: ["billing"],
      appVersion: "1.4.1",
      createdAt: "2026-08-22T09:15:00.000Z",
      reviewUrl: "https://example.com",
    });
    const blockJson = JSON.stringify(p.blocks);
    expect(blockJson).toContain("billing");
    expect(blockJson).toContain("1.4.1");
    expect(blockJson).toContain("2026-08-22");
  });

  it("omits the fields it has no value for rather than printing blanks", () => {
    const p = urgentReview({
      rating: 1,
      appName: "Acme",
      reviewUrl: "https://example.com",
    });
    const blockJson = JSON.stringify(p.blocks);
    expect(blockJson).not.toContain("Version");
    expect(blockJson).not.toContain("Tagged");
    expect(blockJson).not.toContain("Posted");
    expect(blockJson).toContain("Rating");
  });

  it("survives an unparseable timestamp without emitting Invalid Date", () => {
    const p = urgentReview({
      rating: 1,
      appName: "Acme",
      createdAt: "not-a-date",
      reviewUrl: "https://example.com",
    });
    expect(JSON.stringify(p.blocks)).not.toContain("Invalid Date");
  });

  it("always links back to ReviewBox, since the text is deliberately not here", () => {
    const url = "https://app.tryreviewbox.com/reviews";
    const p = urgentReview({ rating: 1, appName: "Acme", reviewUrl: url });
    expect(JSON.stringify(p.blocks)).toContain(url);
  });
});
