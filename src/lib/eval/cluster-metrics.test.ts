import { describe, expect, it } from "vitest";

import {
  DEFAULT_FALSE_MERGE_WEIGHT,
  formatScoreReport,
  scoreClustering,
  type GoldReview,
  type PredictedReview,
} from "./cluster-metrics";

const gold = (id: string, issueId: string, bucket: GoldReview["bucket"] = "english"): GoldReview => ({
  id,
  issueId,
  bucket,
});
const pred = (id: string, issueId: string | null): PredictedReview => ({ id, issueId });

describe("scoreClustering", () => {
  it("scores a perfect clustering as 100% with zero errors", () => {
    const g = [gold("1", "A"), gold("2", "A"), gold("3", "B")];
    const p = [pred("1", "x"), pred("2", "x"), pred("3", "y")];

    const report = scoreClustering(g, p);

    expect(report.overall.precision).toBe(1);
    expect(report.overall.recall).toBe(1);
    expect(report.overall.f1).toBe(1);
    expect(report.overall.falseMerge).toBe(0);
    expect(report.overall.falseSplit).toBe(0);
    // Cluster ids need not match the gold ids — only the partition matters.
    expect(report.shape.contaminatedClusters).toBe(0);
    expect(report.shape.fragmentedGoldIssues).toBe(0);
  });

  it("counts a false merge when two different problems land in one cluster", () => {
    const g = [gold("1", "payment"), gold("2", "crash")];
    const p = [pred("1", "x"), pred("2", "x")];

    const report = scoreClustering(g, p);

    expect(report.overall.falseMerge).toBe(1);
    expect(report.overall.falseSplit).toBe(0);
    expect(report.overall.precision).toBe(0);
    expect(report.shape.contaminatedClusters).toBe(1);
  });

  it("counts a false split when one problem is scattered across clusters", () => {
    const g = [gold("1", "payment"), gold("2", "payment")];
    const p = [pred("1", "x"), pred("2", "y")];

    const report = scoreClustering(g, p);

    expect(report.overall.falseSplit).toBe(1);
    expect(report.overall.falseMerge).toBe(0);
    expect(report.overall.recall).toBe(0);
    expect(report.shape.fragmentedGoldIssues).toBe(1);
  });

  it("penalises a false merge more heavily than a false split (D025)", () => {
    const g = [gold("1", "payment"), gold("2", "crash")];

    const merged = scoreClustering(g, [pred("1", "x"), pred("2", "x")]);
    const split = scoreClustering(
      [gold("1", "payment"), gold("2", "payment")],
      [pred("1", "x"), pred("2", "y")],
    );

    expect(merged.safety.weightedErrors).toBe(DEFAULT_FALSE_MERGE_WEIGHT);
    expect(split.safety.weightedErrors).toBe(1);
    expect(merged.safety.weightedErrors).toBeGreaterThan(split.safety.weightedErrors);
  });

  it("treats declining to attach as a split, never as a merge — the ADR 011 §6 incentive", () => {
    const g = [gold("1", "payment"), gold("2", "payment"), gold("3", "crash")];
    const p = [pred("1", "x"), pred("2", null), pred("3", null)];

    const report = scoreClustering(g, p);

    expect(report.unassigned).toBe(2);
    // Unassigned reviews are never "same cluster", so precision is untouched...
    expect(report.overall.precision).toBe(null); // no positive predictions at all
    expect(report.overall.falseMerge).toBe(0);
    // ...and the cost lands on recall.
    expect(report.overall.falseSplit).toBe(1);
  });

  it("never lets two nulls count as the same cluster", () => {
    const g = [gold("1", "payment"), gold("2", "crash")];
    const p = [pred("1", null), pred("2", null)];

    const report = scoreClustering(g, p);

    expect(report.overall.falseMerge).toBe(0);
    expect(report.overall.trueNegative).toBe(1);
  });

  it("slices by language and keeps cross-bucket pairs separate", () => {
    // The capability that matters: a Hinglish review grouped with its English
    // equivalent. That pair is cross-bucket, so it must not hide inside a
    // within-english average.
    const g = [
      gold("1", "payment", "english"),
      gold("2", "payment", "hinglish"),
      gold("3", "payment", "english"),
    ];
    const p = [pred("1", "x"), pred("3", "x"), pred("2", "y")];

    const report = scoreClustering(g, p);

    expect(report.bySlice["within:english"].truePositive).toBe(1);
    expect(report.bySlice["within:english"].falseSplit).toBe(0);
    expect(report.bySlice["cross:english×hinglish"].falseSplit).toBe(2);
    // The English column looks perfect while the engine is failing at the job.
    expect(report.bySlice["within:english"].f1).toBe(1);
    expect(report.bySlice["cross:english×hinglish"].recall).toBe(0);
  });

  it("gives the same cross-bucket slice key regardless of pair order", () => {
    const forward = scoreClustering(
      [gold("1", "a", "english"), gold("2", "a", "hinglish")],
      [pred("1", "x"), pred("2", "x")],
    );
    const reverse = scoreClustering(
      [gold("1", "a", "hinglish"), gold("2", "a", "english")],
      [pred("1", "x"), pred("2", "x")],
    );

    // Every expected slice is always present now, so compare the one that has
    // pairs rather than the key list.
    expect(forward.bySlice["cross:english×hinglish"].pairs).toBe(1);
    expect(Object.keys(forward.bySlice)).toEqual(Object.keys(reverse.bySlice));
  });

  it("measures discovery separately from classification", () => {
    // Four reviews of one real issue; the engine finds three of them cleanly
    // and drops one into a cluster of its own.
    const g = [
      gold("1", "payment"),
      gold("2", "payment"),
      gold("3", "payment"),
      gold("4", "payment"),
    ];
    const p = [pred("1", "x"), pred("2", "x"), pred("3", "x"), pred("4", "y")];

    const report = scoreClustering(g, p);

    // 3/4 coverage, 100% purity → the issue was discovered even though one
    // review was misfiled. Classification and discovery are different questions.
    expect(report.discovery.discovered).toBe(1);
    expect(report.discovery.rate).toBe(1);
    expect(report.overall.falseSplit).toBe(3);
  });

  it("does not count a discovered issue when the cluster is mostly something else", () => {
    const g = [gold("1", "payment"), gold("2", "crash"), gold("3", "crash"), gold("4", "crash")];
    const p = [pred("1", "x"), pred("2", "x"), pred("3", "x"), pred("4", "x")];

    const report = scoreClustering(g, p);

    // "payment" is fully covered by cluster x, but x is 75% crash — impure.
    expect(report.discovery.discovered).toBe(0);
  });

  it("reports labelled reviews the engine never returned, as a harness problem", () => {
    const g = [gold("1", "a"), gold("2", "a")];
    const p = [pred("1", "x")];

    const report = scoreClustering(g, p);

    expect(report.missingPredictions).toBe(1);
    expect(report.overall.pairs).toBe(0);
  });

  it("honours a custom false-merge weight", () => {
    const g = [gold("1", "payment"), gold("2", "crash")];
    const p = [pred("1", "x"), pred("2", "x")];

    expect(scoreClustering(g, p, { falseMergeWeight: 10 }).safety.weightedErrors).toBe(10);
  });
});

describe("formatScoreReport", () => {
  it("prints the slices and marks the overall figure as not a headline", () => {
    const report = scoreClustering(
      [gold("1", "a", "english"), gold("2", "a", "hinglish")],
      [pred("1", "x"), pred("2", "x")],
    );

    const text = formatScoreReport(report, "Groq / LLM assignment");

    expect(text).toContain("Groq / LLM assignment");
    expect(text).toContain("cross:english×hinglish");
    expect(text).toContain("NOT a headline");
    expect(text).toContain("Diagnostic only");
  });

  it("surfaces missing predictions in the output rather than silently scoring fewer pairs", () => {
    const report = scoreClustering([gold("1", "a"), gold("2", "a")], [pred("1", "x")]);
    expect(formatScoreReport(report, "x")).toContain("harness problem");
  });
});
