/**
 * release-regression.ts — what did this release break?
 *
 * Compares per-tag complaint volume between one release and the release before
 * it, for the SAME app, and says which complaints grew enough to be worth a
 * founder's attention. This is II0 in `docs/backlog.md`: the Issue Intelligence
 * thesis proved on today's fixed tag vocabulary, without waiting for clustering.
 *
 * ── Four ways this could lie to a customer, and what stops each ──────────────
 *
 * 1. VOLUME. A release that got 3× the reviews gets ~3× the complaints of every
 *    kind. Comparing raw counts would flag a *successful* launch as a
 *    regression. Everything below is normalised to complaints per 100 reviews
 *    before any comparison happens.
 *
 * 2. SMALL NUMBERS. 1 → 4 reviews is "+300%" and means nothing. A tag must
 *    reach MIN_TAG_REVIEWS on one side before its percentage is allowed to
 *    decide anything; below that it is reported as `low-n`, shown, and barred
 *    from flagging. Same rule, and the same reason, as ADR 011 §10.1's
 *    admissibility floors: publishing weak evidence is fine, letting it decide
 *    is not.
 *
 * 3. DIVISION BY ZERO. A complaint absent from the older release is not an
 *    infinite percentage — it is NEW, which is a different and often more
 *    interesting statement. It gets its own direction and is ranked by how much
 *    of the new release it accounts for.
 *
 * 4. THE WRONG "PREVIOUS". Version numbers are unique only within an app —
 *    `release-versions.ts` exists because two apps that both shipped "2.1.0"
 *    were once fused into one row. `findPreviousVersion()` therefore chains
 *    strictly within one app id.
 *
 * A human's tag correction always wins over the engine's guess: callers pass
 * both columns and `effectiveTags()` decides (see `@/lib/tag-labels`).
 */

import { effectiveTags } from "@/lib/tag-labels";
import type { VersionRow } from "@/lib/release-versions";

// ── Thresholds ───────────────────────────────────────────────────────────────
//
// These are product-policy floors, not statistical significance tests. Nobody
// ran a power analysis; they are round numbers chosen so that a handful of
// reviews cannot put a red flag in front of a customer. Changing them changes
// what the product asserts, so change them deliberately.

/** A version with fewer reviews than this cannot anchor a comparison at all. */
export const MIN_VERSION_REVIEWS = 10;

/** A tag needs this many reviews on one side before its change may be flagged. */
export const MIN_TAG_REVIEWS = 3;

/** Rate increase (%) at which a complaint is called a probable regression. */
export const ELEVATED_INCREASE_PCT = 50;

/** Rate increase (%) at which it is called critical. */
export const CRITICAL_INCREASE_PCT = 150;

/** Rate decrease (%) at which a complaint is called improved. */
export const IMPROVED_DECREASE_PCT = 50;

/**
 * A complaint that did not exist before is critical once it reaches this share
 * of the new release's reviews (per 100). Below it, still flagged, not screamed.
 */
export const NEW_TAG_CRITICAL_RATE = 5;

// ── Types ────────────────────────────────────────────────────────────────────

/** The columns this module needs. Deliberately narrower than the reviews row. */
export interface TaggedReviewRow {
  issue_tags: string[] | null;
  issue_tags_override?: string[] | null;
}

export type MovementDirection = "up" | "down" | "flat" | "new" | "gone";

export type MovementSeverity = "critical" | "elevated" | "stable" | "improved" | "low-n";

export interface TagMovement {
  tag: string;
  /** Reviews carrying this tag, this release and the one before. */
  currentCount: number;
  previousCount: number;
  /** Complaints per 100 reviews, 1dp — the only figures that are comparable. */
  currentRate: number;
  previousRate: number;
  /** Rate change as a percentage. Null when the tag is new (no denominator). */
  changePct: number | null;
  direction: MovementDirection;
  severity: MovementSeverity;
  /** True only for a genuine, admissible worsening. Never true for `low-n`. */
  isRegression: boolean;
}

export type IncomparableReason = "no_previous_version" | "insufficient_reviews";

export interface ReleaseComparison {
  version: string;
  previousVersion: string | null;
  reviewCount: number;
  previousReviewCount: number;
  /** Every tag seen on either side, ranked worst-first. */
  movements: TagMovement[];
  /** The subset a customer should act on, same order. */
  regressions: TagMovement[];
  /** False when the numbers would not mean anything; `reason` says why. */
  comparable: boolean;
  reason: IncomparableReason | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Count reviews per tag, honouring human overrides. */
function countTags(rows: readonly TaggedReviewRow[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    // A tag repeated on one review must not count twice.
    const tags = new Set(effectiveTags(row.issue_tags, row.issue_tags_override ?? null));
    for (const tag of tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return counts;
}

function classify(
  currentCount: number,
  previousCount: number,
  currentRate: number,
  previousRate: number,
): { direction: MovementDirection; severity: MovementSeverity; changePct: number | null } {
  const admissible = currentCount >= MIN_TAG_REVIEWS || previousCount >= MIN_TAG_REVIEWS;

  if (previousRate === 0) {
    const direction: MovementDirection = "new";
    if (!admissible) return { direction, severity: "low-n", changePct: null };
    return {
      direction,
      severity: currentRate >= NEW_TAG_CRITICAL_RATE ? "critical" : "elevated",
      changePct: null,
    };
  }

  if (currentRate === 0) {
    return {
      direction: "gone",
      severity: admissible ? "improved" : "low-n",
      changePct: -100,
    };
  }

  const changePct = round1(((currentRate - previousRate) / previousRate) * 100);
  const direction: MovementDirection = changePct > 0 ? "up" : changePct < 0 ? "down" : "flat";

  if (!admissible) return { direction, severity: "low-n", changePct };

  const severity: MovementSeverity =
    changePct >= CRITICAL_INCREASE_PCT ? "critical"
    : changePct >= ELEVATED_INCREASE_PCT ? "elevated"
    : changePct <= -IMPROVED_DECREASE_PCT ? "improved"
    : "stable";

  return { direction, severity, changePct };
}

const SEVERITY_RANK: Record<MovementSeverity, number> = {
  critical: 0,
  elevated: 1,
  stable: 2,
  improved: 3,
  "low-n": 4,
};

// ── The comparison ───────────────────────────────────────────────────────────

/**
 * Compare one release's reviews against the previous release's.
 *
 * Both arrays must belong to the same app — this function cannot check that,
 * which is why `findPreviousVersion()` below is the intended way to pick the
 * second argument.
 */
export function compareReleases(
  version: string,
  currentRows: readonly TaggedReviewRow[],
  previousVersion: string | null,
  previousRows: readonly TaggedReviewRow[],
): ReleaseComparison {
  const reviewCount = currentRows.length;
  const previousReviewCount = previousRows.length;

  const empty: ReleaseComparison = {
    version,
    previousVersion,
    reviewCount,
    previousReviewCount,
    movements: [],
    regressions: [],
    comparable: false,
    reason: "no_previous_version",
  };

  if (!previousVersion) return empty;

  // Below the floor the rates swing wildly on one or two reviews. Saying so is
  // the honest output; inventing a percentage is not.
  if (reviewCount < MIN_VERSION_REVIEWS || previousReviewCount < MIN_VERSION_REVIEWS) {
    return { ...empty, reason: "insufficient_reviews" };
  }

  const currentCounts = countTags(currentRows);
  const previousCounts = countTags(previousRows);

  const movements: TagMovement[] = [];
  for (const tag of new Set([...currentCounts.keys(), ...previousCounts.keys()])) {
    const currentCount = currentCounts.get(tag) ?? 0;
    const previousCount = previousCounts.get(tag) ?? 0;
    const currentRate = round1((currentCount / reviewCount) * 100);
    const previousRate = round1((previousCount / previousReviewCount) * 100);

    const { direction, severity, changePct } = classify(
      currentCount,
      previousCount,
      currentRate,
      previousRate,
    );

    movements.push({
      tag,
      currentCount,
      previousCount,
      currentRate,
      previousRate,
      changePct,
      direction,
      severity,
      isRegression:
        (severity === "critical" || severity === "elevated") &&
        (direction === "up" || direction === "new"),
    });
  }

  movements.sort((a, b) => {
    const rank = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rank !== 0) return rank;
    // Within a severity, the complaint affecting more of this release comes
    // first — a founder reads the top of the list and stops.
    if (b.currentRate !== a.currentRate) return b.currentRate - a.currentRate;
    return a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0;
  });

  return {
    version,
    previousVersion,
    reviewCount,
    previousReviewCount,
    movements,
    regressions: movements.filter((m) => m.isRegression),
    comparable: true,
    reason: null,
  };
}

/**
 * The most recent release before `version` that can actually anchor a
 * comparison, within the same app.
 *
 * `deriveVersions()` returns newest-first across the whole workspace, so this
 * filters to one app before stepping — never trusting array adjacency, which is
 * exactly the bug that fused two products' releases together.
 *
 * ── Why it skips, instead of taking the immediately-preceding row ────────────
 *
 * Releases are ordered by **first review seen**, not by version number, and a
 * straggler breaks that assumption. Mumbai One's real data has v1.3.1 first
 * appearing on 31 Mar 2026 — eleven days AFTER v1.4 — because one user on an old
 * build reviewed late. Taking the immediately-preceding row would make a
 * one-review phantom the baseline for v1.4.1, and the whole comparison would
 * then refuse itself as "not enough reviews" while the real answer (v1.4, 75
 * reviews) sat one row further back.
 *
 * So: step back to the nearest release that clears `minReviews`. The card names
 * the version it settled on, so a skipped straggler is visible rather than
 * silently folded in.
 *
 * @param minReviews Reviews the baseline must have. Pass 0 for raw adjacency.
 */
export function findPreviousVersion(
  versions: readonly VersionRow[],
  appId: string,
  version: string,
  minReviews: number = MIN_VERSION_REVIEWS,
): VersionRow | null {
  const ownVersions = versions.filter((v) => v.appId === appId);
  const index = ownVersions.findIndex((v) => v.version === version);
  if (index === -1) return null;
  // newest-first, so walk forward = walk back in time
  for (let i = index + 1; i < ownVersions.length; i++) {
    if (ownVersions[i].reviewCount >= minReviews) return ownVersions[i];
  }
  return null;
}
