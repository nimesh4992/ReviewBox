import { describe, it, expect } from "vitest";
import { buildRatingTrend, countTrendPoints, type TrendRow } from "./rating-trend";

const at = (day: string, rating: number): TrendRow => ({
  rating,
  store_created_at: `${day}T12:00:00.000Z`,
});

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

describe("buildRatingTrend", () => {
  it("emits one point per calendar day, gaps included", () => {
    const trend = buildRatingTrend([at("2026-08-10", 5)], D("2026-08-10"), D("2026-08-14"));
    // 5 days in the range: 5 slots, not 1.
    expect(trend).toHaveLength(5);
  });

  it("keeps a day with no reviews in its window as null, not zero", () => {
    // One review on the 1st; by the 10th it has fallen out of a 7-day window.
    const trend = buildRatingTrend([at("2026-08-01", 5)], D("2026-08-08"), D("2026-08-10"), 7);
    expect(trend).toEqual([null, null, null]);
  });

  it("averages the trailing window rather than the single day", () => {
    const rows = [at("2026-08-10", 1), at("2026-08-11", 5)];
    const trend = buildRatingTrend(rows, D("2026-08-10"), D("2026-08-11"), 7);
    // Day 1: just the 1-star. Day 2: both, so the mean — not a jump to 5.
    expect(trend).toEqual([1, 3]);
  });

  it("does not let one review swing the line the way a per-day average did", () => {
    const rows = [
      ...Array.from({ length: 20 }, () => at("2026-08-10", 4)),
      at("2026-08-11", 1),
    ];
    const trend = buildRatingTrend(rows, D("2026-08-11"), D("2026-08-11"), 7);
    // 20 fours and a single one → ~3.86, not 1.0.
    expect(trend[0]).toBeGreaterThan(3.5);
  });

  it("drops the window as reviews age out", () => {
    const trend = buildRatingTrend([at("2026-08-01", 2)], D("2026-08-01"), D("2026-08-09"), 3);
    expect(trend[0]).toBe(2);
    expect(trend[2]).toBe(2);   // still inside a 3-day window
    expect(trend[3]).toBeNull(); // aged out
  });

  it("ignores unparseable dates and non-finite ratings instead of poisoning the average", () => {
    const rows: TrendRow[] = [
      at("2026-08-10", 4),
      { rating: Number.NaN, store_created_at: "2026-08-10T12:00:00.000Z" },
      { rating: 5, store_created_at: "not-a-date" },
    ];
    const trend = buildRatingTrend(rows, D("2026-08-10"), D("2026-08-10"));
    expect(trend).toEqual([4]);
  });

  it("returns an empty array when the range is inverted", () => {
    expect(buildRatingTrend([], D("2026-08-10"), D("2026-08-01"))).toEqual([]);
  });

  it("is unaffected by reviews outside the range", () => {
    const rows = [at("2026-07-01", 1), at("2026-08-10", 5)];
    const trend = buildRatingTrend(rows, D("2026-08-10"), D("2026-08-10"), 7);
    expect(trend).toEqual([5]);
  });
});

describe("countTrendPoints", () => {
  it("counts only the days that carry a value", () => {
    expect(countTrendPoints([null, 3.2, null, 4.1])).toBe(2);
    expect(countTrendPoints([null, null])).toBe(0);
    expect(countTrendPoints([])).toBe(0);
  });
});
