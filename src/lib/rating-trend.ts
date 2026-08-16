/**
 * The rating trend line on the dashboard.
 *
 * The previous version averaged each calendar day on its own and then **dropped
 * days with no reviews**. Two things went wrong with that, and together they
 * produced a chart that looked invented:
 *
 *   1. Dropping empty days collapsed the x-axis. Six days of data out of ten
 *      were drawn as six evenly spaced, adjacent points — so a 1-star review on
 *      the 3rd and a 4-star review on the 9th were joined by a straight line
 *      implying a smooth climb that never happened.
 *   2. A day with one review carried the same weight as a day with fifty. For
 *      an app getting a handful of reviews a day, each point was a single
 *      person's opinion, so the line swung between 1.0 and 5.0 as noise.
 *
 * A trailing window fixes both. Every calendar day gets a point, so the x-axis
 * means what it appears to mean, and each point averages the preceding week, so
 * the line moves when the rating moves rather than when one person is annoyed.
 * Days with nothing in the window are `null` — a gap the chart must break on,
 * not a zero and not a silently missing day.
 */

export interface TrendRow {
  rating: number;
  store_created_at: string;
}

const DAY_MS = 86_400_000;

/** UTC calendar day key. UTC throughout so the buckets do not shift by server timezone. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * One point per calendar day from `start` to `end` inclusive, each the average
 * rating over the `windowDays` ending that day. `null` where that window holds
 * no reviews at all.
 */
export function buildRatingTrend(
  rows: readonly TrendRow[],
  start: Date,
  end: Date,
  windowDays = 7,
): (number | null)[] {
  // Bucket by day once, then sweep — avoids rescanning every review per day.
  const byDay = new Map<string, { sum: number; n: number }>();
  for (const r of rows) {
    const t = new Date(r.store_created_at);
    const rating = Number(r.rating);
    if (Number.isNaN(t.getTime()) || !Number.isFinite(rating)) continue;
    const key = dayKey(t);
    const b = byDay.get(key) ?? { sum: 0, n: 0 };
    b.sum += rating;
    b.n += 1;
    byDay.set(key, b);
  }

  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc   = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  if (endUtc < startUtc) return [];

  const points: (number | null)[] = [];

  for (let day = startUtc; day <= endUtc; day += DAY_MS) {
    let sum = 0;
    let n   = 0;
    // Inclusive of the day itself, hence windowDays - 1 days back.
    for (let back = 0; back < windowDays; back++) {
      const b = byDay.get(dayKey(new Date(day - back * DAY_MS)));
      if (b) { sum += b.sum; n += b.n; }
    }
    points.push(n > 0 ? Math.round((sum / n) * 100) / 100 : null);
  }

  return points;
}

/** How many points carry an actual value — the chart needs 2 to draw a line. */
export function countTrendPoints(trend: readonly (number | null)[]): number {
  return trend.reduce<number>((n, v) => (v === null ? n : n + 1), 0);
}
