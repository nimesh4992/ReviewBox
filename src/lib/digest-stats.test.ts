import { describe, it, expect } from "vitest";
import {
  distributionOf,
  averageOf,
  reviewMeta,
  topThemes,
  replyRateOf,
  type DigestReview,
} from "./digest-stats";

const review = (r: Partial<DigestReview> & { rating: number }): DigestReview => r;

describe("distributionOf", () => {
  it("bins ratings into five stars", () => {
    expect(distributionOf([5, 5, 4, 1])).toEqual([1, 0, 0, 1, 2]);
  });

  it("returns null for an empty set", () => {
    expect(distributionOf([])).toBeNull();
  });

  it("keeps the bars adding up to the review count even for bad input", () => {
    const bins = distributionOf([0, 9, Number.NaN, 3.4, 4.6])!;
    expect(bins.reduce((a, b) => a + b, 0)).toBe(5);
    expect(bins).toEqual([1, 0, 2, 0, 2]);
  });
});

describe("averageOf", () => {
  it("averages", () => {
    expect(averageOf([5, 4, 3])).toBe(4);
  });

  it("never returns NaN", () => {
    expect(averageOf([])).toBeNull();
    expect(averageOf([Number.NaN])).toBeNull();
    expect(averageOf([4, Number.NaN])).toBe(4);
  });
});

describe("reviewMeta", () => {
  it("joins the parts it has", () => {
    expect(reviewMeta(review({ rating: 5, app_version: "1.5", country: "IN" }))).toBe("v1.5 · IN");
    expect(reviewMeta(review({ rating: 5, app_version: "1.5" }))).toBe("v1.5");
    expect(reviewMeta(review({ rating: 5, country: "IN" }))).toBe("IN");
  });

  it("is undefined rather than an empty string when it knows nothing", () => {
    expect(reviewMeta(review({ rating: 5 }))).toBeUndefined();
  });
});

describe("topThemes", () => {
  it("ranks tags by how often they appear", () => {
    const themes = topThemes([
      review({ rating: 1, issue_tags: ["crash"], sentiment: "critical" }),
      review({ rating: 1, issue_tags: ["crash"], sentiment: "negative" }),
      review({ rating: 2, issue_tags: ["billing"], sentiment: "negative" }),
    ]);
    // humanizeToken only unhyphenates; the labels stay lower case because they
    // are read mid-sentence ("most complaints were about billing").
    expect(themes.map((t) => t.label)).toEqual(["crash", "billing"]);
    expect(themes[0].count).toBe(2);
  });

  it("unhyphenates compound tags", () => {
    const themes = topThemes([review({ rating: 1, issue_tags: ["release-regression"] })]);
    expect(themes[0].label).toBe("release regression");
  });

  it("calls a tag positive when the reviews carrying it are happy", () => {
    const themes = topThemes([
      review({ rating: 5, issue_tags: ["feature-request"], sentiment: "positive" }),
      review({ rating: 5, issue_tags: ["feature-request"], sentiment: "positive" }),
      review({ rating: 2, issue_tags: ["feature-request"], sentiment: "negative" }),
    ]);
    expect(themes[0].sentiment).toBe("positive");
  });

  it("calls an evenly split tag mixed", () => {
    const themes = topThemes([
      review({ rating: 5, issue_tags: ["login"], sentiment: "positive" }),
      review({ rating: 1, issue_tags: ["login"], sentiment: "negative" }),
    ]);
    expect(themes[0].sentiment).toBe("mixed");
  });

  it("orders ties deterministically instead of by insertion", () => {
    const first = topThemes([
      review({ rating: 3, issue_tags: ["performance"] }),
      review({ rating: 3, issue_tags: ["billing"] }),
    ]);
    const second = topThemes([
      review({ rating: 3, issue_tags: ["billing"] }),
      review({ rating: 3, issue_tags: ["performance"] }),
    ]);
    expect(first.map((t) => t.label)).toEqual(second.map((t) => t.label));
  });

  it("caps the list and handles reviews with no tags", () => {
    expect(topThemes([review({ rating: 4 }), review({ rating: 4, issue_tags: null })])).toEqual([]);
    const many = topThemes(
      ["crash", "billing", "login", "performance", "localization", "support-delay"].map((t) =>
        review({ rating: 2, issue_tags: [t] }),
      ),
    );
    expect(many).toHaveLength(5);
  });
});

describe("replyRateOf", () => {
  it("counts anything that is not needs_reply as handled", () => {
    expect(replyRateOf([
      review({ rating: 5, reply_status: "replied" }),
      review({ rating: 5, reply_status: "draft_ready" }),
      review({ rating: 5, reply_status: "needs_reply" }),
      review({ rating: 5, reply_status: "needs_reply" }),
    ])).toBe(50);
  });

  it("is 0, not NaN, for an empty month", () => {
    expect(replyRateOf([])).toBe(0);
  });
});
