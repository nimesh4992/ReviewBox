/**
 * sampling.ts — deterministic selection for the golden-set exporter.
 *
 * Moved out of `scripts/eval/export-golden-set.mjs` so it can be tested. The
 * behaviour is the script's, unchanged except where a test proved it wrong
 * (see `selectStratifiedSample`'s count clamp, and the hash tie-breaks).
 *
 * ── Why determinism is a requirement, not a nicety ──────────────────────────
 *
 * The founder labels this sample by hand, once, for about two hours. If a
 * re-export returned a different set of reviews, those labels would silently
 * stop corresponding to the file — and the bake-off would be scoring one
 * sample against another sample's ground truth. Nothing would error; the
 * numbers would just be wrong, which is this repository's most expensive
 * recurring failure shape.
 *
 * So: no `Math.random`, no `Date`, no dependence on the order rows arrive in.
 * Same database, same sample, forever.
 */

import type { LanguageBucket } from "./language-bucket";

/** The minimum a row needs for sampling. Real review rows carry much more. */
export interface SampleCandidate {
  id: string;
  rating?: number | null;
}

/** India-first on purpose: Hinglish is the largest slice (D025, ADR 011 §9). */
export const DEFAULT_TARGET_MIX: Readonly<Record<LanguageBucket, number>> = {
  hinglish: 0.35,
  "native-script": 0.25,
  english: 0.4,
};

/**
 * Stable 32-bit FNV-1a hash — the deterministic stand-in for shuffling.
 *
 * Not cryptographic and does not need to be: it only has to spread ids evenly
 * and give the same answer every run, on every machine.
 */
export function hashId(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Order rows deterministically: by hash, then by id.
 *
 * The id tie-break matters. Sorting by hash alone leaves colliding ids in
 * whatever order the database returned them, so two exports could differ on a
 * collision. Rare, silent, and exactly the class of bug this module exists to
 * rule out — so it is ruled out rather than assumed away.
 */
function byHashThenId<T extends SampleCandidate>(a: T, b: T): number {
  return hashId(a.id) - hashId(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/**
 * Pick `count` rows, spread across ratings so a sample is not all 1★.
 *
 * Round-robins the rating groups — each internally ordered by hash — so a
 * bucket dominated by angry reviews still yields some 4★ and 5★ ones. Stops
 * early, and returns fewer than `count`, when the input runs out; the caller
 * decides whether that shortfall matters.
 */
export function pickSpread<T extends SampleCandidate>(rows: readonly T[], count: number): T[] {
  if (count <= 0) return [];

  const byRating = new Map<number, T[]>();
  for (const row of rows) {
    const rating = typeof row.rating === "number" ? row.rating : 0;
    const list = byRating.get(rating);
    if (list) list.push(row);
    else byRating.set(rating, [row]);
  }
  for (const list of byRating.values()) list.sort(byHashThenId);

  const ratings = [...byRating.keys()].sort((a, b) => a - b);
  const picked: T[] = [];
  let exhausted = false;
  while (picked.length < count && !exhausted) {
    exhausted = true;
    for (const rating of ratings) {
      const list = byRating.get(rating);
      if (!list || list.length === 0) continue;
      picked.push(list.shift() as T);
      exhausted = false;
      if (picked.length === count) break;
    }
  }
  return picked;
}

export interface Shortfall {
  bucket: LanguageBucket;
  wanted: number;
  got: number;
}

export interface StratifiedSample<T> {
  selected: Array<{ item: T; bucket: LanguageBucket }>;
  shortfalls: Shortfall[];
}

/**
 * Fill each language quota, then top up from whatever is left.
 *
 * The top-up exists so a short quota still yields `count` rows rather than a
 * small sample nobody notices is small — but it must never re-select a review
 * already chosen, which is what the `used` set guards.
 *
 * The result is clamped to `count`. Quotas are rounded independently, so they
 * can sum to more than `count` (at count=10 the default mix rounds to 4+3+4=11).
 * Before the clamp the exporter would quietly hand back 11 rows for a requested
 * 10 — found by the test that asserts the requested count is respected.
 */
export function selectStratifiedSample<T extends SampleCandidate>(params: {
  byBucket: Readonly<Record<LanguageBucket, readonly T[]>>;
  count: number;
  mix?: Readonly<Record<LanguageBucket, number>>;
}): StratifiedSample<T> {
  const { byBucket, count } = params;
  const mix = params.mix ?? DEFAULT_TARGET_MIX;

  const selected: Array<{ item: T; bucket: LanguageBucket }> = [];
  const shortfalls: Shortfall[] = [];

  for (const [bucket, share] of Object.entries(mix) as Array<[LanguageBucket, number]>) {
    const wanted = Math.round(count * share);
    const picked = pickSpread(byBucket[bucket] ?? [], wanted);
    if (picked.length < wanted) shortfalls.push({ bucket, wanted, got: picked.length });
    for (const item of picked) selected.push({ item, bucket });
  }

  if (selected.length < count) {
    const used = new Set(selected.map((s) => s.item.id));
    const rest = (Object.entries(byBucket) as Array<[LanguageBucket, readonly T[]]>)
      .flatMap(([bucket, rows]) => rows.map((item) => ({ item, bucket })))
      .filter((candidate) => !used.has(candidate.item.id))
      .sort((a, b) => byHashThenId(a.item, b.item));
    selected.push(...rest.slice(0, count - selected.length));
  }

  return { selected: selected.slice(0, count), shortfalls };
}
