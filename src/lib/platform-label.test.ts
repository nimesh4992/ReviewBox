/**
 * The storage enum → what a human reads.
 *
 * Two apps in the founder's workspace are both called "Mumbai One" — one on
 * Google Play, one on the App Store. With the selector showing only the name,
 * every number on the dashboard and in the inbox was unattributable: you could
 * not tell which app a count belonged to, which made the other fixes in this
 * change unverifiable.
 */

import { describe, expect, it } from "vitest";

import { isStorePlatform, platformLabel } from "./platform-label";

describe("platformLabel", () => {
  it("labels the two stored platforms", () => {
    expect(platformLabel("google_play")).toBe("Google Play");
    expect(platformLabel("app_store")).toBe("App Store");
  });

  it("returns null for anything else rather than guessing", () => {
    // The bug this replaces did the opposite: `x === "Google Play" ? … : "app_store"`
    // mapped every unrecognised value to App Store, so a caller passing the
    // storage enum got the other store's data and no error. A missing label is
    // recoverable; a confidently wrong one is what made two same-named apps
    // indistinguishable in the first place.
    expect(platformLabel("appstore")).toBeNull();
    expect(platformLabel("Google Play")).toBeNull();
    expect(platformLabel("")).toBeNull();
    expect(platformLabel(null)).toBeNull();
    expect(platformLabel(undefined)).toBeNull();
  });

  it("does not accept the kebab-case store-search vocabulary", () => {
    // `google-play` / `app-store` are what services/store-search speaks. They
    // are a DIFFERENT mapping; conflating them is how a value ends up in a
    // query that silently matches nothing.
    expect(platformLabel("google-play")).toBeNull();
    expect(platformLabel("app-store")).toBeNull();
  });
});

describe("isStorePlatform", () => {
  it("accepts exactly the two stored values", () => {
    expect(isStorePlatform("google_play")).toBe(true);
    expect(isStorePlatform("app_store")).toBe(true);
  });

  it("rejects everything else, including near-misses", () => {
    for (const value of ["google-play", "App Store", "ios", "", null, undefined, 1, {}]) {
      expect(isStorePlatform(value), String(value)).toBe(false);
    }
  });
});
