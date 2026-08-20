/**
 * The readiness gates added on 2026-08-20, after scoring the real 200-review
 * census (english 194 · hinglish 6 · native-script 0) exposed three ways this
 * module could certify English and be filed as if it had certified everything.
 *
 * Each test below is tied to one of those, and each was verified to FAIL when
 * its gate is removed — a gate nobody has watched break is not a gate.
 */

import { describe, expect, it } from "vitest";

import { LANGUAGE_BUCKETS, type LanguageBucket } from "./language-bucket";
import {
  compareEngines,
  expectedSliceKeys,
  formatScoreReport,
  scoreClustering,
  MIN_SLICE_PAIRS,
  MIN_SLICE_REVIEWS,
  type GoldReview,
  type PredictedReview,
} from "./cluster-metrics";

const gold = (id: string, issueId: string, bucket: LanguageBucket): GoldReview => ({
  id, issueId, bucket,
});
const pred = (id: string, issueId: string | null): PredictedReview => ({ id, issueId });

/** n reviews in one bucket, spread over `issues` gold issues. */
function corpus(prefix: string, bucket: LanguageBucket, n: number, issues: number): GoldReview[] {
  return Array.from({ length: n }, (_, i) => gold(`${prefix}${i}`, `${prefix.toUpperCase()}${i % issues}`, bucket));
}
const perfect = (g: readonly GoldReview[]): PredictedReview[] =>
  g.map((r) => pred(r.id, r.issueId));

describe("the six-slice matrix", () => {
  it("derives exactly six slices, one per unordered bucket pair", () => {
    const keys = expectedSliceKeys();
    const n = LANGUAGE_BUCKETS.length;
    expect(keys).toHaveLength((n * (n + 1)) / 2);
    expect(keys).toHaveLength(6);
  });

  it("covers every bucket in LANGUAGE_BUCKETS", () => {
    // The matrix must come from the vocabulary, not from the data. If a bucket
    // is ever added and this module is not updated, this fails.
    const keys = expectedSliceKeys().join(" ");
    for (const bucket of LANGUAGE_BUCKETS) expect(keys).toContain(bucket);
  });

  it("a fully populated benchmark still produces the expected six slices", () => {
    const g = [
      ...corpus("e", "english", 60, 6),
      ...corpus("h", "hinglish", 60, 6),
      ...corpus("n", "native-script", 60, 6),
    ];
    const report = scoreClustering(g, perfect(g));

    expect(Object.keys(report.bySlice).sort()).toEqual(expectedSliceKeys());
    for (const key of expectedSliceKeys()) {
      expect(report.bySlice[key].status).toBe("usable");
      expect(report.bySlice[key].eligible).toBe(true);
    }
    expect(report.recommendation.eligible).toEqual(expectedSliceKeys());
    expect(report.recommendation.insufficient).toBe(false);
    expect(report.recommendation.untestedBuckets).toEqual([]);
  });
});

describe("zero native-script rows", () => {
  const g = [...corpus("e", "english", 40, 4), ...corpus("h", "hinglish", 40, 4)];
  const report = scoreClustering(g, perfect(g));
  const nativeSlices = [
    "within:native-script",
    "cross:english×native-script",
    "cross:hinglish×native-script",
  ];

  it("still reports all three native-script slices rather than omitting them", () => {
    // The original defect: keys were created only when a pair existed, so a
    // corpus with no native-script reviews produced a three-row report that
    // read as complete.
    for (const key of nativeSlices) expect(report.bySlice[key]).toBeDefined();
  });

  it("marks them empty and never eligible", () => {
    for (const key of nativeSlices) {
      expect(report.bySlice[key].status).toBe("empty");
      expect(report.bySlice[key].eligible).toBe(false);
      expect(report.bySlice[key].pairs).toBe(0);
    }
  });

  it("renders them explicitly as N/A — 0 examples", () => {
    const text = formatScoreReport(report, "engine");
    for (const key of nativeSlices) {
      expect(text).toContain(key);
      const line = text.split("\n").find((l) => l.includes(key));
      expect(line).toContain("N/A — 0 examples");
    }
  });

  it("names the bucket as untested, and says untested is not passed", () => {
    expect(report.recommendation.untestedBuckets).toEqual(["native-script"]);
    expect(formatScoreReport(report, "engine")).toContain("untested is NOT passed");
  });
});

describe("six Hinglish reviews — the real census shape", () => {
  const g = [...corpus("e", "english", 194, 20), ...corpus("h", "hinglish", 6, 2)];
  const report = scoreClustering(g, perfect(g));

  it("marks both Hinglish slices low-n", () => {
    expect(report.bySlice["within:hinglish"].status).toBe("low-n");
    expect(report.bySlice["cross:english×hinglish"].status).toBe("low-n");
  });

  it("labels them low-n / exploratory in the rendered report", () => {
    const text = formatScoreReport(report, "engine");
    expect(text).toContain("low-n / exploratory");
  });

  it("keeps them out of the ADR §10 recommendation", () => {
    expect(report.recommendation.eligible).toEqual(["within:english"]);
    expect(report.recommendation.excluded.map((e) => e.slice)).toContain("within:hinglish");
    expect(report.recommendation.excluded.map((e) => e.slice)).toContain("cross:english×hinglish");
  });

  it("leaves English eligible — the gate narrows the claim, it does not void the run", () => {
    expect(report.bySlice["within:english"].eligible).toBe(true);
    expect(report.recommendation.insufficient).toBe(false);
  });
});

describe("a large pair count cannot override the distinct-review floor", () => {
  // 194 × 6 = 1,164 cross pairs, far above MIN_SLICE_PAIRS, generated by six
  // Hinglish reviews. Pairs are not independent observations; the limiting arm is.
  const g = [...corpus("e", "english", 194, 20), ...corpus("h", "hinglish", 6, 2)];
  const report = scoreClustering(g, perfect(g));
  const cross = report.bySlice["cross:english×hinglish"];

  it("has far more pairs than the pair floor", () => {
    expect(cross.pairs).toBe(194 * 6);
    expect(cross.pairs).toBeGreaterThan(MIN_SLICE_PAIRS);
  });

  it("is still low-n, because the smaller arm is below the review floor", () => {
    expect(cross.limitingReviews).toBe(6);
    expect(cross.limitingReviews).toBeLessThan(MIN_SLICE_REVIEWS);
    expect(cross.status).toBe("low-n");
    expect(cross.eligible).toBe(false);
    expect(cross.ineligibleReason).toContain("smaller side");
  });

  it("becomes eligible once the smaller arm clears the floor", () => {
    const bigger = [...corpus("e", "english", 194, 20), ...corpus("h", "hinglish", 10, 2)];
    const r = scoreClustering(bigger, perfect(bigger));
    expect(r.bySlice["cross:english×hinglish"].eligible).toBe(true);
  });
});

describe("weightedErrors cannot determine the recommendation", () => {
  // Both buckets clear the floors, so both slices are eligible and the
  // disagreement is real rather than an artefact of low n. The proportions
  // matter: English has to be large enough that a modest English error
  // outweighs a total Hinglish failure in the UNSLICED total, which is exactly
  // the condition the real 194/6 census creates.
  const g = [...corpus("e", "english", 300, 20), ...corpus("h", "hinglish", 12, 4)];

  // A: English perfect, Hinglish destroyed — every Hinglish review fused into one cluster.
  const A = g.map((r) => (r.bucket === "hinglish" ? pred(r.id, "FUSED") : pred(r.id, r.issueId)));
  // B: Hinglish perfect, English sloppy — two English issues fused.
  const B = g.map((r) =>
    r.bucket === "english" && (r.issueId === "E0" || r.issueId === "E1")
      ? pred(r.id, "E0+E1")
      : pred(r.id, r.issueId));

  const reportA = scoreClustering(g, A);
  const reportB = scoreClustering(g, B);

  it("sets up the conflict: the unsliced number prefers the Hinglish failure", () => {
    expect(reportA.safety.weightedErrors).toBeLessThan(reportB.safety.weightedErrors);
    expect(reportA.bySlice["within:hinglish"].weightedErrors)
      .toBeGreaterThan(reportB.bySlice["within:hinglish"].weightedErrors);
  });

  it("does not crown A, whose only advantage is the unsliced number", () => {
    const verdict = compareEngines([
      { name: "A", report: reportA },
      { name: "B", report: reportB },
    ]);
    expect(verdict.winner).not.toBe("A");
    expect(verdict.conflicted).toBe(true);
    expect(verdict.winner).toBeNull();
    expect(verdict.reason).toContain("disagree");
  });

  it("credits each engine in the slice it actually wins", () => {
    const verdict = compareEngines([
      { name: "A", report: reportA },
      { name: "B", report: reportB },
    ]);
    const byKey = Object.fromEntries(verdict.perSlice.map((v) => [v.slice, v.best]));
    expect(byKey["within:english"]).toEqual(["A"]);
    expect(byKey["within:hinglish"]).toEqual(["B"]);
  });

  it("names the leader of the eligible slices, but withholds the winner", () => {
    // `g` has no native-script reviews, so two buckets have no eligible slice.
    // Leading what is measurable is not the same as being the right choice.
    const verdict = compareEngines([
      { name: "perfect", report: scoreClustering(g, perfect(g)) },
      { name: "A", report: reportA },
    ]);
    expect(verdict.leader).toBe("perfect");
    expect(verdict.winner).toBeNull();
    expect(verdict.bucketsMissing).toContain("native-script");
  });

  it("declines entirely when no slice has evidence in every engine", () => {
    const tiny = corpus("h", "hinglish", 4, 2);
    const verdict = compareEngines([
      { name: "A", report: scoreClustering(tiny, perfect(tiny)) },
      { name: "B", report: scoreClustering(tiny, tiny.map((r) => pred(r.id, "X"))) },
    ]);
    expect(verdict.winner).toBeNull();
    expect(verdict.perSlice).toEqual([]);
    expect(verdict.reason).toContain("cannot decide");
  });
});

describe("overall stays labelled and stays out of the decision", () => {
  const g = [...corpus("e", "english", 100, 10), ...corpus("h", "hinglish", 40, 4)];
  const report = scoreClustering(g, perfect(g));

  it("is never eligible, however good its numbers", () => {
    expect(report.overall.f1).toBe(1);
    expect(report.overall.eligible).toBe(false);
    expect(report.overall.status).toBe("aggregate");
  });

  it("is never listed among the slices that may decide", () => {
    expect(report.recommendation.eligible).not.toContain("aggregate:overall");
    expect(report.recommendation.eligible.every((k) => k.startsWith("within:") || k.startsWith("cross:"))).toBe(true);
  });

  it("keeps the D025 wording, and marks the unsliced figure diagnostic-only", () => {
    const text = formatScoreReport(report, "engine");
    expect(text).toContain("NOT a headline");
    expect(text).toContain("Diagnostic only");
    expect(report.safety.diagnosticOnly).toBe(true);
  });
});

describe("excluding a weak slice must not make the choice easier", () => {
  // Found by running the CLI on the real census shape: once Hinglish and
  // native-script were excluded for low n, English was the ONLY eligible slice
  // — so the engine that is perfect in English and catastrophic in Hinglish
  // led everything allowed to count and was declared the winner. The low-n
  // gate had made the decision easier instead of harder, which is the same
  // failure ADR 011 §9 forbids, wearing the gate's own clothes.
  const g = [...corpus("e", "english", 194, 20), ...corpus("h", "hinglish", 6, 2)];
  const A = g.map((r) => (r.bucket === "hinglish" ? pred(r.id, "FUSED") : pred(r.id, r.issueId)));
  const B = g.map((r) =>
    r.bucket === "english" && (r.issueId === "E0" || r.issueId === "E1")
      ? pred(r.id, "E0+E1")
      : pred(r.id, r.issueId));

  const verdict = compareEngines([
    { name: "A", report: scoreClustering(g, A) },
    { name: "B", report: scoreClustering(g, B) },
  ]);

  it("names who leads the one eligible slice", () => {
    expect(verdict.leader).toBe("A");
  });

  it("still refuses to call that a winner", () => {
    expect(verdict.winner).toBeNull();
  });

  it("says which buckets had no eligible slice at all", () => {
    expect(verdict.bucketsCovered).toEqual(["english"]);
    expect(verdict.bucketsMissing).toEqual(["native-script", "hinglish"]);
    expect(verdict.reason).toContain("not a recommendation");
  });

  it("does declare a winner once every bucket has an eligible slice", () => {
    const full = [
      ...corpus("e", "english", 100, 10),
      ...corpus("h", "hinglish", 40, 4),
      ...corpus("n", "native-script", 40, 4),
    ];
    // Fuse TWO issues. Renaming one is still a perfect partition and would tie.
    const sloppy = full.map((r) =>
      r.issueId === "E0" || r.issueId === "E1" ? pred(r.id, "E0+E1") : pred(r.id, r.issueId));
    const v = compareEngines([
      { name: "perfect", report: scoreClustering(full, perfect(full)) },
      { name: "sloppy", report: scoreClustering(full, sloppy) },
    ]);
    expect(v.bucketsMissing).toEqual([]);
    expect(v.winner).toBe("perfect");
  });
});
