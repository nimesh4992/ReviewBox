/**
 * Which storefront is an app's home?
 *
 * Both Google Play and the App Store publish PER-COUNTRY ratings, so the
 * storefront isn't a label on the number — it decides which number we show.
 * Mumbai One reads 4.3 in the US and 3.1 in India, and we were showing 4.3 for
 * an India-first app because the probe took the first storefront that answered
 * and `us` is first in the list.
 *
 * Founder decision, 2026-08-17: most reviews wins.
 *
 * ── Read this before "fixing" the tie case ──────────────────────────────────
 *
 * Ties fall back to probe order. An earlier version of this comment said that
 * meant every Google Play app, "because the listing scrape doesn't extract a
 * count". **That was wrong** — generalised from one failed fetch, and from how
 * AppFollow renders the number rather than from Google's HTML. The India
 * listing for the same package returned 2,945 exactly.
 *
 * A storefront that genuinely returns no count still ties at zero and keeps
 * probe order, which is the right conservative behaviour. It is the exception,
 * not the rule.
 */

import { describe, expect, it } from "vitest";

import { pickHomeStorefront } from "./store-search";
import type { AppMetadata } from "./store-search";

function hit(country: string, reviewCount: number | null, rating = 4.0): AppMetadata {
  return {
    storeId: "com.mmrda",
    name: "Mumbai One",
    developer: "",
    icon: null,
    rating,
    reviewCount,
    country,
  };
}

describe("pickHomeStorefront", () => {
  it("returns null when no storefront carries the app", () => {
    expect(pickHomeStorefront([])).toBeNull();
  });

  it("returns the only hit", () => {
    expect(pickHomeStorefront([hit("in", 260)])?.country).toBe("in");
  });

  it("picks the storefront with the most reviews, not the first one probed", () => {
    // The whole point. `us` is first in searchStorefronts() and answers, so the
    // old first-match-wins rule pinned this app to the US permanently.
    const picked = pickHomeStorefront([hit("us", 12), hit("in", 260), hit("gb", 3)]);
    expect(picked?.country).toBe("in");
  });

  it("picks the largest regardless of probe position", () => {
    expect(pickHomeStorefront([hit("in", 260), hit("us", 12)])?.country).toBe("in");
    expect(pickHomeStorefront([hit("us", 12), hit("in", 260)])?.country).toBe("in");
  });

  it("treats a missing count as zero rather than as a win", () => {
    // A null count must never beat a real one — otherwise a storefront whose
    // page we failed to parse would outrank the one we read successfully.
    expect(pickHomeStorefront([hit("us", null), hit("in", 260)])?.country).toBe("in");
    expect(pickHomeStorefront([hit("in", 260), hit("us", null)])?.country).toBe("in");
  });

  it("keeps probe order when nothing can be compared", () => {
    // Every candidate ties at 0, so the caller's priority order decides.
    // Reached when a storefront is throttled mid-probe (BUG-021) and returns a
    // rating without a count — not, as I first claimed, on every Play app.
    const picked = pickHomeStorefront([hit("us", null), hit("in", null), hit("gb", null)]);
    expect(picked?.country).toBe("us");
  });

  it("keeps the earlier candidate on an exact tie", () => {
    expect(pickHomeStorefront([hit("us", 100), hit("in", 100)])?.country).toBe("us");
  });

  it("does not rank on rating", () => {
    // A 5.0 from a storefront with 3 ratings is not evidence of a home market.
    const picked = pickHomeStorefront([hit("us", 3, 5.0), hit("in", 260, 3.1)]);
    expect(picked?.country).toBe("in");
    expect(picked?.rating).toBe(3.1);
  });
});
