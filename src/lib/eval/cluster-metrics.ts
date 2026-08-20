/**
 * cluster-metrics.ts — scoring for the ADR 011 §9 bake-off.
 *
 * Scores a candidate clustering against the hand-labelled golden set
 * (`docs/GOLDEN_SET.md`). Pure functions, no I/O, no network.
 *
 * ── Two things here are policy, not preference ──────────────────────────────
 *
 * 1. **False merges are reported separately and weighted heaviest** (D025).
 *    A false split scatters one problem across two cards: annoying, visible,
 *    a human fixes it. A false merge fuses three unrelated engineering problems
 *    into one confident "Payment failures · 47 reviews · Critical": invisible,
 *    and it sends the customer to spend their week on the wrong thing. These
 *    are not two sides of one number and must never be traded off as if they
 *    were, which is why `precision`/`recall` alone are not enough.
 *
 * 2. **Nothing here produces a headline average across language buckets** (D025).
 *    `overall` exists because the slices have to sum to something, and it is
 *    explicitly labelled not-a-headline. Reporting "overall 86%" over a 42%
 *    Hinglish column is the specific failure the founder forbade: for an
 *    India-first product that column is not a detail of the result, it IS the
 *    result.
 */

import type { LanguageBucket } from "./language-bucket";

/** One labelled review from the golden set. `issueId` is the human's grouping key. */
export interface GoldReview {
  id: string;
  issueId: string;
  bucket: LanguageBucket;
}

/** One engine output. `issueId: null` means "the engine declined to attach it". */
export interface PredictedReview {
  id: string;
  issueId: string | null;
}

export interface PairCounts {
  /** Same issue in gold, same cluster in prediction. */
  truePositive: number;
  /** Different issues in gold, same cluster in prediction — THE DANGEROUS ONE. */
  falseMerge: number;
  /** Same issue in gold, different clusters in prediction. */
  falseSplit: number;
  /** Different in both — correctly kept apart. */
  trueNegative: number;
}

export interface SliceScore extends PairCounts {
  precision: number | null;
  recall: number | null;
  f1: number | null;
  pairs: number;
}

export interface ClusterShape {
  goldIssues: number;
  predictedClusters: number;
  /** Predicted clusters containing reviews from more than one gold issue. */
  contaminatedClusters: number;
  /** Gold issues whose reviews are spread across more than one predicted cluster. */
  fragmentedGoldIssues: number;
}

export interface DiscoveryScore {
  goldIssues: number;
  /** Gold issues matched by some predicted cluster at the given coverage + purity. */
  discovered: number;
  rate: number | null;
  coverageThreshold: number;
  purityThreshold: number;
}

export interface ClusterScoreReport {
  /** NOT a headline. See the module header. */
  overall: SliceScore;
  /** Keyed `within:english`, `within:hinglish`, `cross:english×hinglish`, … */
  bySlice: Record<string, SliceScore>;
  shape: ClusterShape;
  discovery: DiscoveryScore;
  /** Reviews the engine declined to attach. A gap, not a lie (ADR 011 §6). */
  unassigned: number;
  /** Gold reviews with no corresponding prediction — a harness problem, not a model one. */
  missingPredictions: number;
  safety: {
    falseMergeWeight: number;
    /** falseMerge × weight + falseSplit. Lower is better. */
    weightedErrors: number;
  };
}

/**
 * How much worse a false merge is than a false split, for the single
 * comparison number. Raw counts stay authoritative — this is a reporting aid.
 */
export const DEFAULT_FALSE_MERGE_WEIGHT = 3;

const EMPTY_COUNTS = (): PairCounts => ({
  truePositive: 0,
  falseMerge: 0,
  falseSplit: 0,
  trueNegative: 0,
});

function finalise(counts: PairCounts): SliceScore {
  const { truePositive: tp, falseMerge: fm, falseSplit: fs, trueNegative: tn } = counts;
  const precision = tp + fm > 0 ? tp / (tp + fm) : null;
  const recall = tp + fs > 0 ? tp / (tp + fs) : null;
  const f1 =
    precision !== null && recall !== null && precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
  return { ...counts, precision, recall, f1, pairs: tp + fm + fs + tn };
}

/** Slice key for a pair. Cross-bucket keys are sorted so a×b and b×a agree. */
function sliceKey(a: LanguageBucket, b: LanguageBucket): string {
  if (a === b) return `within:${a}`;
  return `cross:${[a, b].sort().join("×")}`;
}

/**
 * Score a predicted clustering against the golden set.
 *
 * Pairwise over every unordered pair of labelled reviews. A review the engine
 * declined to attach (`issueId: null`) is never "same cluster" as anything, so
 * declining costs recall and never costs precision — which is the incentive
 * ADR 011 §6 intends ("when uncertain, separate rather than merge").
 */
export function scoreClustering(
  gold: readonly GoldReview[],
  predicted: readonly PredictedReview[],
  options: { falseMergeWeight?: number; coverageThreshold?: number; purityThreshold?: number } = {},
): ClusterScoreReport {
  const falseMergeWeight = options.falseMergeWeight ?? DEFAULT_FALSE_MERGE_WEIGHT;
  const coverageThreshold = options.coverageThreshold ?? 0.6;
  const purityThreshold = options.purityThreshold ?? 0.8;

  const predictionById = new Map(predicted.map((p) => [p.id, p.issueId]));
  const scored = gold.filter((g) => predictionById.has(g.id));
  const missingPredictions = gold.length - scored.length;

  const overall = EMPTY_COUNTS();
  const bySliceCounts: Record<string, PairCounts> = {};

  for (let i = 0; i < scored.length; i++) {
    for (let j = i + 1; j < scored.length; j++) {
      const a = scored[i];
      const b = scored[j];
      const goldSame = a.issueId === b.issueId;
      const predA = predictionById.get(a.id) ?? null;
      const predB = predictionById.get(b.id) ?? null;
      const predSame = predA !== null && predA === predB;

      const key = sliceKey(a.bucket, b.bucket);
      bySliceCounts[key] ??= EMPTY_COUNTS();
      const bucketCounts = bySliceCounts[key];

      let field: keyof PairCounts;
      if (goldSame && predSame) field = "truePositive";
      else if (!goldSame && predSame) field = "falseMerge";
      else if (goldSame && !predSame) field = "falseSplit";
      else field = "trueNegative";

      overall[field]++;
      bucketCounts[field]++;
    }
  }

  const bySlice: Record<string, SliceScore> = {};
  for (const [key, counts] of Object.entries(bySliceCounts)) {
    bySlice[key] = finalise(counts);
  }

  return {
    overall: finalise(overall),
    bySlice,
    shape: describeShape(scored, predictionById),
    discovery: scoreDiscovery(scored, predictionById, coverageThreshold, purityThreshold),
    unassigned: scored.filter((g) => predictionById.get(g.id) === null).length,
    missingPredictions,
    safety: {
      falseMergeWeight,
      weightedErrors: overall.falseMerge * falseMergeWeight + overall.falseSplit,
    },
  };
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const existing = map.get(k);
    if (existing) existing.push(item);
    else map.set(k, [item]);
  }
  return map;
}

function describeShape(
  gold: readonly GoldReview[],
  predictionById: ReadonlyMap<string, string | null>,
): ClusterShape {
  const goldGroups = groupBy(gold, (g) => g.issueId);
  const attached = gold.filter((g) => predictionById.get(g.id) !== null);
  const predictedGroups = groupBy(attached, (g) => predictionById.get(g.id) as string);

  let contaminatedClusters = 0;
  for (const members of predictedGroups.values()) {
    if (new Set(members.map((m) => m.issueId)).size > 1) contaminatedClusters++;
  }

  let fragmentedGoldIssues = 0;
  for (const members of goldGroups.values()) {
    const clusters = new Set(members.map((m) => predictionById.get(m.id)));
    if (clusters.size > 1) fragmentedGoldIssues++;
  }

  return {
    goldIssues: goldGroups.size,
    predictedClusters: predictedGroups.size,
    contaminatedClusters,
    fragmentedGoldIssues,
  };
}

/**
 * "Did it discover the right Issues?" — a different question from "did it
 * classify this review?", and the one the product claim rests on.
 *
 * A gold issue counts as discovered when some predicted cluster both covers
 * enough of it (coverage) and is not mostly other things (purity).
 */
function scoreDiscovery(
  gold: readonly GoldReview[],
  predictionById: ReadonlyMap<string, string | null>,
  coverageThreshold: number,
  purityThreshold: number,
): DiscoveryScore {
  const goldGroups = groupBy(gold, (g) => g.issueId);
  const attached = gold.filter((g) => predictionById.get(g.id) !== null);
  const predictedGroups = groupBy(attached, (g) => predictionById.get(g.id) as string);

  let discovered = 0;
  for (const [issueId, members] of goldGroups) {
    for (const clusterMembers of predictedGroups.values()) {
      const overlap = clusterMembers.filter((m) => m.issueId === issueId).length;
      const coverage = overlap / members.length;
      const purity = overlap / clusterMembers.length;
      if (coverage >= coverageThreshold && purity >= purityThreshold) {
        discovered++;
        break;
      }
    }
  }

  return {
    goldIssues: goldGroups.size,
    discovered,
    rate: goldGroups.size > 0 ? discovered / goldGroups.size : null,
    coverageThreshold,
    purityThreshold,
  };
}

function pct(value: number | null): string {
  return value === null ? "  n/a" : `${(value * 100).toFixed(1)}%`;
}

/** Render a report for the terminal. Slices first; `overall` last and labelled. */
export function formatScoreReport(report: ClusterScoreReport, label: string): string {
  const lines: string[] = [];
  lines.push(`\n═══ ${label} ═══`);
  lines.push("");
  lines.push("  slice                           precision   recall      F1   merges  splits");
  lines.push("  " + "─".repeat(76));

  const order = Object.keys(report.bySlice).sort();
  for (const key of order) {
    const s = report.bySlice[key];
    lines.push(
      "  " +
        key.padEnd(30) +
        pct(s.precision).padStart(9) +
        pct(s.recall).padStart(9) +
        pct(s.f1).padStart(8) +
        String(s.falseMerge).padStart(9) +
        String(s.falseSplit).padStart(8),
    );
  }

  lines.push("");
  lines.push(`  Issue discovery:  ${report.discovery.discovered}/${report.discovery.goldIssues} ` +
    `(coverage ≥${report.discovery.coverageThreshold}, purity ≥${report.discovery.purityThreshold})`);
  lines.push(`  Clusters:         ${report.shape.predictedClusters} predicted vs ${report.shape.goldIssues} real · ` +
    `${report.shape.contaminatedClusters} contaminated · ${report.shape.fragmentedGoldIssues} fragmented`);
  lines.push(`  Unassigned:       ${report.unassigned} reviews (a gap, not a lie — ADR 011 §6)`);
  lines.push(`  Weighted errors:  ${report.safety.weightedErrors} ` +
    `(false merges ×${report.safety.falseMergeWeight} + false splits) — lower is better`);
  if (report.missingPredictions > 0) {
    lines.push(`  ⚠ ${report.missingPredictions} labelled reviews had no prediction — harness problem, not a model one`);
  }
  lines.push("");
  lines.push(
    `  overall ${pct(report.overall.f1)} F1 — NOT a headline. Read the Hinglish row. (D025)`,
  );
  return lines.join("\n");
}
