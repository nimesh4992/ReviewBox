import { describe, it, expect } from "vitest";

import { buildMetadataUpdate, needsStorefrontReprobe } from "./app-metadata";
import type { AppMetadata } from "@/services/store-search";

function meta(overrides: Partial<AppMetadata> = {}): AppMetadata {
  return {
    storeId: "com.mmrda.mumbaione",
    name: "Mumbai One",
    developer: "MMRDA",
    icon: "https://play-lh.googleusercontent.com/icon=w480-h960",
    rating: 3.146,
    reviewCount: 2063,
    country: "in",
    ...overrides,
  };
}

describe("buildMetadataUpdate", () => {
  it("writes rating, count, icon and developer when the scrape has them", () => {
    expect(buildMetadataUpdate(meta())).toEqual({
      lifetime_rating: 3.146,
      lifetime_review_count: 2063,
      icon_url: "https://play-lh.googleusercontent.com/icon=w480-h960",
      developer: "MMRDA",
    });
  });

  it("omits null fields so a partial scrape never erases earlier data", () => {
    const update = buildMetadataUpdate(meta({ rating: null, icon: null, developer: "" }));

    expect(update).toEqual({ lifetime_review_count: 2063 });
    expect("lifetime_rating" in update).toBe(false);
  });

  it("keeps a genuine zero review count — a new app with no ratings yet", () => {
    expect(buildMetadataUpdate(meta({ rating: null, reviewCount: 0 }))).toMatchObject({
      lifetime_review_count: 0,
    });
  });

  it("returns an empty update for a scrape that found nothing usable", () => {
    expect(
      buildMetadataUpdate(meta({ rating: null, reviewCount: null, icon: null, developer: "" })),
    ).toEqual({});
  });
});

describe("needsStorefrontReprobe", () => {
  it("never re-probes when no storefront was persisted — the full probe already ran", () => {
    expect(needsStorefrontReprobe(null, null)).toBe(false);
    expect(needsStorefrontReprobe(null, meta())).toBe(false);
  });

  it("re-probes when the persisted storefront stops answering", () => {
    // The regression this exists for: store_country pinned to "us" for an
    // India-only app meant every sync fetched nothing and never looked again.
    expect(needsStorefrontReprobe("us", null)).toBe(true);
  });

  it("re-probes when the storefront serves a placeholder with no rating and no count", () => {
    expect(needsStorefrontReprobe("us", meta({ rating: null, reviewCount: null }))).toBe(true);
  });

  it("trusts the persisted storefront while it returns a real listing", () => {
    expect(needsStorefrontReprobe("in", meta())).toBe(false);
    // Rating-less but with a count: a brand-new app, not a placeholder.
    expect(needsStorefrontReprobe("in", meta({ rating: null, reviewCount: 0 }))).toBe(false);
    // Count-less but rated: some storefront parses miss the count only.
    expect(needsStorefrontReprobe("in", meta({ reviewCount: null }))).toBe(false);
  });
});
