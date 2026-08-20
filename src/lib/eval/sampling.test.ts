import { describe, expect, it } from "vitest";

import {
  DEFAULT_TARGET_MIX,
  hashId,
  pickSpread,
  selectStratifiedSample,
  type SampleCandidate,
} from "./sampling";
import type { LanguageBucket } from "./language-bucket";

interface Row extends SampleCandidate {
  id: string;
  rating: number;
}

/** Deterministic fixture: `n` rows with ratings cycling 1..5. */
function rows(prefix: string, n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}`, rating: (i % 5) + 1 }));
}

/** A fixed, non-trivial reordering — no Math.random, so failures reproduce. */
function reorder<T>(items: readonly T[]): T[] {
  const odd = items.filter((_, i) => i % 2 === 1);
  const even = items.filter((_, i) => i % 2 === 0);
  return [...odd.reverse(), ...even];
}

function buckets(overrides: Partial<Record<LanguageBucket, Row[]>>): Record<LanguageBucket, Row[]> {
  return { english: [], "native-script": [], hinglish: [], ...overrides };
}

describe("hashId", () => {
  it("is stable for the same input", () => {
    expect(hashId("review-abc")).toBe(hashId("review-abc"));
  });

  it("pins known values so a refactor cannot silently change the sample", () => {
    // If these change, every previously exported sample changes with them —
    // and any labels already produced stop corresponding to the file.
    expect(hashId("")).toBe(2166136261);
    expect(hashId("a")).toBe(3826002220);
    expect(hashId("review-1")).toBe(hashId("review-1"));
    expect(hashId("review-1")).not.toBe(hashId("review-2"));
  });

  it("returns an unsigned 32-bit integer", () => {
    for (const id of ["", "a", "review-1", "ई-मेल", "😤"]) {
      const h = hashId(id);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("handles non-ASCII ids without collapsing them", () => {
    expect(hashId("पैसा")).not.toBe(hashId("paisa"));
  });
});

describe("pickSpread", () => {
  it("returns identical output across repeated runs", () => {
    const input = rows("r", 50);
    const first = pickSpread(input, 10).map((r) => r.id);
    for (let run = 0; run < 5; run++) {
      expect(pickSpread(input, 10).map((r) => r.id)).toEqual(first);
    }
  });

  it("is order-independent — reordering the source changes nothing", () => {
    const input = rows("r", 50);
    expect(pickSpread(reorder(input), 10).map((r) => r.id)).toEqual(
      pickSpread(input, 10).map((r) => r.id),
    );
    expect(pickSpread([...input].reverse(), 10).map((r) => r.id)).toEqual(
      pickSpread(input, 10).map((r) => r.id),
    );
  });

  it("never selects the same review twice", () => {
    const picked = pickSpread(rows("r", 40), 25);
    expect(new Set(picked.map((r) => r.id)).size).toBe(picked.length);
  });

  it("respects the requested count when enough rows exist", () => {
    expect(pickSpread(rows("r", 40), 25)).toHaveLength(25);
    expect(pickSpread(rows("r", 40), 1)).toHaveLength(1);
  });

  it("returns everything, once, when asked for more than exists", () => {
    const input = rows("r", 7);
    const picked = pickSpread(input, 99);
    expect(picked).toHaveLength(7);
    expect(new Set(picked.map((r) => r.id)).size).toBe(7);
  });

  it("spreads across ratings instead of draining the angriest first", () => {
    // 20 one-star and 5 five-star. A naive "sort and take" yields 10 × 1★.
    const input: Row[] = [
      ...Array.from({ length: 20 }, (_, i) => ({ id: `one-${i}`, rating: 1 })),
      ...Array.from({ length: 5 }, (_, i) => ({ id: `five-${i}`, rating: 5 })),
    ];
    const picked = pickSpread(input, 10);
    const fiveStars = picked.filter((r) => r.rating === 5).length;
    expect(fiveStars).toBe(5);
    expect(picked.filter((r) => r.rating === 1)).toHaveLength(5);
  });

  it("keeps drawing from the ratings that remain once one is exhausted", () => {
    const input: Row[] = [
      { id: "a", rating: 1 },
      ...Array.from({ length: 9 }, (_, i) => ({ id: `b-${i}`, rating: 5 })),
    ];
    expect(pickSpread(input, 8)).toHaveLength(8);
  });

  it("treats a missing rating as its own group rather than crashing", () => {
    const input = [{ id: "x" }, { id: "y", rating: null }, { id: "z", rating: 4 }];
    const picked = pickSpread(input, 3);
    expect(picked).toHaveLength(3);
    expect(new Set(picked.map((r) => r.id)).size).toBe(3);
  });

  it("returns nothing for a non-positive count or empty input", () => {
    expect(pickSpread(rows("r", 5), 0)).toEqual([]);
    expect(pickSpread(rows("r", 5), -3)).toEqual([]);
    expect(pickSpread([], 5)).toEqual([]);
  });

  it("does not mutate the caller's array", () => {
    const input = rows("r", 10);
    const before = input.map((r) => r.id);
    pickSpread(input, 5);
    expect(input.map((r) => r.id)).toEqual(before);
  });
});

describe("selectStratifiedSample", () => {
  const wide = () =>
    buckets({ english: rows("en", 100), "native-script": rows("nat", 100), hinglish: rows("hin", 100) });

  it("returns identical output across repeated runs", () => {
    const first = selectStratifiedSample({ byBucket: wide(), count: 20 }).selected.map((s) => s.item.id);
    for (let run = 0; run < 5; run++) {
      expect(selectStratifiedSample({ byBucket: wide(), count: 20 }).selected.map((s) => s.item.id)).toEqual(first);
    }
  });

  it("is order-independent within every bucket", () => {
    const base = wide();
    const shuffled = buckets({
      english: reorder(base.english),
      "native-script": reorder(base["native-script"]),
      hinglish: reorder(base.hinglish),
    });
    expect(selectStratifiedSample({ byBucket: shuffled, count: 20 }).selected.map((s) => s.item.id)).toEqual(
      selectStratifiedSample({ byBucket: base, count: 20 }).selected.map((s) => s.item.id),
    );
  });

  it("respects the requested count when enough reviews exist", () => {
    for (const count of [10, 20, 33, 200]) {
      expect(selectStratifiedSample({ byBucket: wide(), count }).selected).toHaveLength(count);
    }
  });

  it("respects the count even when the quotas round up past it", () => {
    // Regression: at count=10 the default mix rounds to 4 + 3 + 4 = 11, and the
    // exporter used to hand back 11 rows for a requested 10.
    const mix = DEFAULT_TARGET_MIX;
    const quotaSum =
      Math.round(10 * mix.hinglish) + Math.round(10 * mix["native-script"]) + Math.round(10 * mix.english);
    expect(quotaSum).toBe(11);
    expect(selectStratifiedSample({ byBucket: wide(), count: 10 }).selected).toHaveLength(10);
  });

  it("never selects the same review twice", () => {
    const { selected } = selectStratifiedSample({ byBucket: wide(), count: 60 });
    expect(new Set(selected.map((s) => s.item.id)).size).toBe(selected.length);
  });

  it("does not duplicate when the top-up path runs", () => {
    // english alone can fill the whole request, so the quotas fall short and
    // the top-up must pull more english rows without re-picking any.
    const byBucket = buckets({ english: rows("en", 100), "native-script": [], hinglish: [] });
    const { selected, shortfalls } = selectStratifiedSample({ byBucket, count: 40 });

    expect(selected).toHaveLength(40);
    expect(new Set(selected.map((s) => s.item.id)).size).toBe(40);
    expect(shortfalls.map((s) => s.bucket).sort()).toEqual(["hinglish", "native-script"]);
  });

  it("reports a shortfall with the numbers, rather than silently returning fewer", () => {
    const byBucket = buckets({ english: rows("en", 100), "native-script": rows("nat", 2), hinglish: [] });
    const { shortfalls } = selectStratifiedSample({ byBucket, count: 100 });

    expect(shortfalls).toEqual(
      expect.arrayContaining([
        { bucket: "hinglish", wanted: 35, got: 0 },
        { bucket: "native-script", wanted: 25, got: 2 },
      ]),
    );
  });

  it("honours the India-first mix when every bucket is deep enough", () => {
    const { selected } = selectStratifiedSample({ byBucket: wide(), count: 100 });
    const counts = selected.reduce<Record<string, number>>((acc, s) => {
      acc[s.bucket] = (acc[s.bucket] ?? 0) + 1;
      return acc;
    }, {});

    expect(counts.hinglish).toBe(35);
    expect(counts["native-script"]).toBe(25);
    expect(counts.english).toBe(40);
    // Hinglish outweighs native-script — the India-first weighting, asserted so
    // a future edit to the mix has to be deliberate (D025).
    expect(counts.hinglish).toBeGreaterThan(counts["native-script"]);
  });

  it("labels every selected review with the bucket it came from", () => {
    const prefix: Record<LanguageBucket, string> = {
      english: "en-",
      "native-script": "nat-",
      hinglish: "hin-",
    };
    const { selected } = selectStratifiedSample({ byBucket: wide(), count: 30 });

    expect(selected).toHaveLength(30);
    for (const { item, bucket } of selected) {
      expect(item.id.startsWith(prefix[bucket])).toBe(true);
    }
  });

  it("returns everything available, once, when the corpus is smaller than the request", () => {
    const byBucket = buckets({ english: rows("en", 3), "native-script": rows("nat", 2), hinglish: [] });
    const { selected } = selectStratifiedSample({ byBucket, count: 50 });

    expect(selected).toHaveLength(5);
    expect(new Set(selected.map((s) => s.item.id)).size).toBe(5);
  });

  it("accepts a custom mix without touching the default", () => {
    const { selected } = selectStratifiedSample({
      byBucket: wide(),
      count: 10,
      mix: { english: 1, "native-script": 0, hinglish: 0 },
    });
    expect(selected.every((s) => s.bucket === "english")).toBe(true);
    expect(DEFAULT_TARGET_MIX.hinglish).toBe(0.35);
  });

  it("returns nothing for an empty corpus", () => {
    expect(selectStratifiedSample({ byBucket: buckets({}), count: 20 }).selected).toEqual([]);
  });
});
