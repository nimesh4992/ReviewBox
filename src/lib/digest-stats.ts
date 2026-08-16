/**
 * Pure shaping for the daily and monthly digests.
 *
 * Kept out of the route so the arithmetic that decides what a customer reads
 * every morning is testable without a database or a mail provider.
 */

import { humanizeToken } from "@/utils/format";

export interface DigestReview {
  rating: number;
  reply_status?: string | null;
  issue_tags?: string[] | null;
  sentiment?: string | null;
  app_version?: string | null;
  country?: string | null;
}

export type StarDistribution = [number, number, number, number, number];

export interface DigestTheme {
  label: string;
  count: number;
  sentiment: "positive" | "negative" | "mixed";
}

/**
 * Star counts 1-5. Out-of-range and non-finite ratings are clamped into the
 * nearest bin rather than dropped, so the bars always total the review count —
 * a chart whose segments do not add up to the headline number reads as a bug.
 */
export function distributionOf(ratings: number[]): StarDistribution | null {
  if (!ratings.length) return null;
  const bins: StarDistribution = [0, 0, 0, 0, 0];
  for (const raw of ratings) {
    const n = Number(raw);
    const star = Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 3;
    bins[star - 1] += 1;
  }
  return bins;
}

/** Mean rating, or null for an empty set. Never NaN. */
export function averageOf(ratings: number[]): number | null {
  const usable = ratings.map(Number).filter((n) => Number.isFinite(n));
  if (!usable.length) return null;
  return usable.reduce((a, b) => a + b, 0) / usable.length;
}

/** "v1.5 · IN" for the review card, or undefined when we know neither. */
export function reviewMeta(review: DigestReview): string | undefined {
  const parts = [review.app_version ? `v${review.app_version}` : null, review.country]
    .filter((p): p is string => !!p);
  return parts.length ? parts.join(" · ") : undefined;
}

/**
 * The recurring subjects in a set of reviews, from the tags the rules engine
 * already assigned.
 *
 * Sentiment is the majority sentiment of the reviews carrying the tag, not the
 * tag's name. "feature-request" appearing forty times in five-star reviews is
 * not a problem to flag, and calling it one would send the reader chasing
 * something that is not there.
 */
export function topThemes(reviews: DigestReview[], limit = 5): DigestTheme[] {
  const byTag = new Map<string, { count: number; negative: number; positive: number }>();

  for (const r of reviews) {
    for (const tag of r.issue_tags ?? []) {
      const entry = byTag.get(tag) ?? { count: 0, negative: 0, positive: 0 };
      entry.count += 1;
      if (r.sentiment === "critical" || r.sentiment === "negative") entry.negative += 1;
      if (r.sentiment === "positive") entry.positive += 1;
      byTag.set(tag, entry);
    }
  }

  return [...byTag.entries()]
    // Count first, then tag name, so equal counts order the same way every run
    // rather than following Map insertion order.
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag, e]) => ({
      label: humanizeToken(tag),
      count: e.count,
      sentiment:
        e.negative > e.positive ? ("negative" as const)
        : e.positive > e.negative ? ("positive" as const)
        : ("mixed" as const),
    }));
}

/** Percentage of reviews that have any reply, rounded. 0 for an empty set. */
export function replyRateOf(reviews: DigestReview[]): number {
  if (!reviews.length) return 0;
  const replied = reviews.filter((r) => r.reply_status !== "needs_reply").length;
  return Math.round((replied / reviews.length) * 100);
}
