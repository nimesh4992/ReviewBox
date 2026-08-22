import { describe, expect, it } from "vitest";

import {
  compareReleases,
  findPreviousVersion,
  MIN_TAG_REVIEWS,
  MIN_VERSION_REVIEWS,
  type TaggedReviewRow,
} from "./release-regression";
import type { VersionRow } from "./release-versions";

/** `n` reviews, `tagged` of which carry `tag`. */
function rows(n: number, tagged: number, tag: string): TaggedReviewRow[] {
  return Array.from({ length: n }, (_, i) => ({
    issue_tags: i < tagged ? [tag] : [],
  }));
}

function movement(comparison: ReturnType<typeof compareReleases>, tag: string) {
  const found = comparison.movements.find((m) => m.tag === tag);
  if (!found) throw new Error(`no movement for ${tag}`);
  return found;
}

describe("compareReleases — normalisation", () => {
  it("does not call a bigger release a regression when the complaint RATE is flat", () => {
    // v1.4: 10 of 50 complained about billing. v1.5: 30 of 150 — three times the
    // raw count, identical rate. Counting instead of rating flags a successful
    // launch as a disaster, which is the whole reason this module exists.
    const result = compareReleases("1.5", rows(150, 30, "billing"), "1.4", rows(50, 10, "billing"));

    const billing = movement(result, "billing");
    expect(billing.currentCount).toBe(30);
    expect(billing.previousCount).toBe(10);
    expect(billing.currentRate).toBe(20);
    expect(billing.previousRate).toBe(20);
    expect(billing.changePct).toBe(0);
    expect(billing.severity).toBe("stable");
    expect(result.regressions).toHaveLength(0);
  });

  it("flags a real rate increase as critical and reports the percentage", () => {
    // 8 per 100 → 38 per 100 is the "+375%" in the plan.
    const result = compareReleases("1.5", rows(100, 38, "billing"), "1.4", rows(100, 8, "billing"));

    const billing = movement(result, "billing");
    expect(billing.direction).toBe("up");
    expect(billing.changePct).toBe(375);
    expect(billing.severity).toBe("critical");
    expect(billing.isRegression).toBe(true);
    expect(result.regressions.map((m) => m.tag)).toEqual(["billing"]);
  });

  it("separates elevated from critical at the documented boundary", () => {
    const elevated = compareReleases("1.5", rows(100, 15, "crash"), "1.4", rows(100, 10, "crash"));
    expect(movement(elevated, "crash").severity).toBe("elevated"); // +50%

    const stable = compareReleases("1.5", rows(100, 14, "crash"), "1.4", rows(100, 10, "crash"));
    expect(movement(stable, "crash").severity).toBe("stable"); // +40%
  });

  it("calls a halved complaint rate improved, and never a regression", () => {
    const result = compareReleases("1.5", rows(100, 5, "login"), "1.4", rows(100, 20, "login"));

    const login = movement(result, "login");
    expect(login.direction).toBe("down");
    expect(login.severity).toBe("improved");
    expect(login.isRegression).toBe(false);
  });
});

describe("compareReleases — small numbers", () => {
  it("refuses to turn one extra review into a percentage", () => {
    // 1 → 2 reviews is +100% and would otherwise read `elevated`.
    const result = compareReleases("1.5", rows(60, 2, "crash"), "1.4", rows(60, 1, "crash"));

    const crash = movement(result, "crash");
    expect(crash.severity).toBe("low-n");
    expect(crash.isRegression).toBe(false);
    expect(result.regressions).toHaveLength(0);
  });

  it("still SHOWS the low-n movement rather than hiding it", () => {
    // Publishing weak evidence is fine. Letting it decide is not — ADR 011 §10.1.
    const result = compareReleases("1.5", rows(60, 2, "crash"), "1.4", rows(60, 1, "crash"));
    expect(result.movements.map((m) => m.tag)).toContain("crash");
  });

  it("admits a tag the moment either side reaches the floor", () => {
    const result = compareReleases(
      "1.5",
      rows(60, MIN_TAG_REVIEWS, "crash"),
      "1.4",
      rows(60, 1, "crash"),
    );
    expect(movement(result, "crash").severity).not.toBe("low-n");
  });

  it("refuses the whole comparison when a version is below the review floor", () => {
    const result = compareReleases(
      "1.5",
      rows(MIN_VERSION_REVIEWS - 1, 5, "billing"),
      "1.4",
      rows(100, 1, "billing"),
    );

    expect(result.comparable).toBe(false);
    expect(result.reason).toBe("insufficient_reviews");
    expect(result.movements).toHaveLength(0);
    expect(result.regressions).toHaveLength(0);
  });

  it("says so plainly when there is no previous release", () => {
    const result = compareReleases("1.0", rows(100, 40, "billing"), null, []);

    expect(result.comparable).toBe(false);
    expect(result.reason).toBe("no_previous_version");
    expect(result.previousVersion).toBeNull();
  });
});

describe("compareReleases — complaints that did not exist before", () => {
  it("reports a new complaint as `new`, not as an infinite percentage", () => {
    const result = compareReleases(
      "1.5",
      rows(100, 12, "release-regression"),
      "1.4",
      rows(100, 0, "release-regression"),
    );

    const tag = movement(result, "release-regression");
    expect(tag.direction).toBe("new");
    expect(tag.changePct).toBeNull();
    expect(Number.isFinite(tag.currentRate)).toBe(true);
    expect(tag.severity).toBe("critical"); // 12 per 100 clears NEW_TAG_CRITICAL_RATE
    expect(tag.isRegression).toBe(true);
  });

  it("does not scream about a new complaint that is barely there", () => {
    const result = compareReleases("1.5", rows(100, 3, "localization"), "1.4", rows(100, 0, "localization"));

    const tag = movement(result, "localization");
    expect(tag.direction).toBe("new");
    expect(tag.severity).toBe("elevated");
  });

  it("reports a complaint that disappeared as improved", () => {
    const result = compareReleases("1.5", rows(100, 0, "crash"), "1.4", rows(100, 20, "crash"));

    const crash = movement(result, "crash");
    expect(crash.direction).toBe("gone");
    expect(crash.severity).toBe("improved");
    expect(crash.isRegression).toBe(false);
  });
});

describe("compareReleases — inputs", () => {
  it("honours a human's tag correction over the engine's guess", () => {
    // The engine said billing; a person said it is a crash. The person wins,
    // and an empty override means "none of these apply" — not "no opinion".
    const current: TaggedReviewRow[] = [
      ...Array.from({ length: 20 }, () => ({
        issue_tags: ["billing"],
        issue_tags_override: ["crash"],
      })),
      ...Array.from({ length: 80 }, () => ({ issue_tags: [], issue_tags_override: null })),
    ];
    const previous: TaggedReviewRow[] = Array.from({ length: 100 }, (_, i) => ({
      issue_tags: i < 20 ? ["billing"] : [],
      issue_tags_override: i < 20 ? [] : null,
    }));

    const result = compareReleases("1.5", current, "1.4", previous);

    expect(movement(result, "crash").currentCount).toBe(20);
    expect(result.movements.some((m) => m.tag === "billing" && m.currentCount > 0)).toBe(false);
  });

  it("counts a review once even if a tag is repeated on it", () => {
    const current: TaggedReviewRow[] = [
      { issue_tags: ["crash", "crash"] },
      ...rows(99, 0, "crash"),
    ];
    const result = compareReleases("1.5", current, "1.4", rows(100, 5, "crash"));
    expect(movement(result, "crash").currentCount).toBe(1);
  });

  it("ranks the worst, biggest complaint first so a founder can stop reading", () => {
    const current: TaggedReviewRow[] = [
      ...Array.from({ length: 40 }, () => ({ issue_tags: ["billing"] })),
      ...Array.from({ length: 20 }, () => ({ issue_tags: ["crash"] })),
      ...Array.from({ length: 40 }, () => ({ issue_tags: ["login"] })),
    ];
    const previous: TaggedReviewRow[] = [
      ...Array.from({ length: 8 }, () => ({ issue_tags: ["billing"] })),
      ...Array.from({ length: 4 }, () => ({ issue_tags: ["crash"] })),
      ...Array.from({ length: 40 }, () => ({ issue_tags: ["login"] })),
    ];

    const result = compareReleases("1.5", current, "1.4", previous);

    expect(result.movements[0].tag).toBe("billing"); // critical, 40 per 100
    expect(result.movements[1].tag).toBe("crash"); // critical, 20 per 100
    expect(result.movements[result.movements.length - 1].tag).toBe("login"); // stable
  });
});

describe("findPreviousVersion", () => {
  const row = (appId: string, version: string, reviewCount: number, firstSeen: string): VersionRow => ({
    appId, appName: appId.toUpperCase(), version, reviewCount,
    avgRating: 3, ratingDelta: null, firstSeen,
  });

  const versions: VersionRow[] = [
    // newest-first, exactly as deriveVersions() returns
    row("a", "1.5", 40, "2026-08-10"),
    row("b", "2.1.0", 40, "2026-08-09"),
    row("a", "1.4", 40, "2026-08-01"),
  ];

  it("steps to the previous release of the SAME app, not the previous row", () => {
    // The row between them belongs to another app. Trusting adjacency here is
    // the bug release-versions.ts was written to kill.
    expect(findPreviousVersion(versions, "a", "1.5")?.version).toBe("1.4");
  });

  it("returns null for an app's oldest release", () => {
    expect(findPreviousVersion(versions, "a", "1.4")).toBeNull();
  });

  it("returns null when the version does not belong to the app", () => {
    expect(findPreviousVersion(versions, "b", "1.5")).toBeNull();
  });

  it("skips a straggler release too small to be a baseline", () => {
    // Mumbai One's real shape: v1.3.1 first appears ELEVEN DAYS AFTER v1.4,
    // because one user on an old build reviewed late. Taking the immediately
    // preceding row makes a 1-review phantom the baseline for v1.4.1 and the
    // comparison then refuses itself, while v1.4's 75 reviews sit one row back.
    const real: VersionRow[] = [
      row("a", "1.4.1", 49, "2026-05-07"),
      row("a", "1.3.1", 1, "2026-03-31"),
      row("a", "1.4", 75, "2026-03-20"),
    ];

    expect(findPreviousVersion(real, "a", "1.4.1")?.version).toBe("1.4");
  });

  it("still returns the straggler when the caller asks for raw adjacency", () => {
    const real: VersionRow[] = [
      row("a", "1.4.1", 49, "2026-05-07"),
      row("a", "1.3.1", 1, "2026-03-31"),
      row("a", "1.4", 75, "2026-03-20"),
    ];

    expect(findPreviousVersion(real, "a", "1.4.1", 0)?.version).toBe("1.3.1");
  });

  it("returns null when every earlier release is too small", () => {
    const thin: VersionRow[] = [
      row("a", "1.5", 40, "2026-07-02"),
      row("a", "1.4", 2, "2026-05-01"),
      row("a", "1.3", 1, "2026-03-01"),
    ];

    expect(findPreviousVersion(thin, "a", "1.5")).toBeNull();
  });
});
