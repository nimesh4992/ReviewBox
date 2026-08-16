import { describe, it, expect } from "vitest";

import { parseStoreUrl } from "./store-urls";

describe("parseStoreUrl — Google Play", () => {
  it("extracts the package name from a store URL", () => {
    expect(parseStoreUrl("https://play.google.com/store/apps/details?id=com.mmrda.mumbaione"))
      .toEqual({ platform: "google-play", kind: "package", value: "com.mmrda.mumbaione", country: null });
  });

  it("keeps the storefront when the URL carries gl=", () => {
    const out = parseStoreUrl("https://play.google.com/store/apps/details?id=com.mmrda.mumbaione&hl=en&gl=IN");
    expect(out?.country).toBe("in");
    expect(out?.value).toBe("com.mmrda.mumbaione");
  });

  it("accepts a URL with no scheme (what a paste often looks like)", () => {
    expect(parseStoreUrl("play.google.com/store/apps/details?id=com.whatsapp")?.value)
      .toBe("com.whatsapp");
  });

  it("ignores a Play URL with no id parameter", () => {
    expect(parseStoreUrl("https://play.google.com/store/apps")).toBeNull();
  });
});

describe("parseStoreUrl — App Store", () => {
  it("extracts the track id and storefront from a localized URL", () => {
    expect(parseStoreUrl("https://apps.apple.com/in/app/mumbai-one/id6444123456"))
      .toEqual({ platform: "app-store", kind: "trackId", value: "6444123456", country: "in" });
  });

  it("handles a URL with no storefront segment", () => {
    const out = parseStoreUrl("https://apps.apple.com/app/instagram/id389801252");
    expect(out?.value).toBe("389801252");
    expect(out?.country).toBeNull();
  });

  it("tolerates trailing query strings", () => {
    expect(parseStoreUrl("https://apps.apple.com/gb/app/foo/id123456?mt=8")?.value).toBe("123456");
  });

  it("ignores an Apple URL with no numeric id", () => {
    expect(parseStoreUrl("https://apps.apple.com/in/app/mumbai-one")).toBeNull();
  });
});

describe("parseStoreUrl — non-URLs fall through to text search", () => {
  it("returns null for app names, package ids and junk", () => {
    for (const input of [
      "Mumbai One",
      "com.mmrda.mumbaione",   // handled by looksLikeStoreId, not here
      "",
      "   ",
      "https://example.com/store/apps/details?id=com.evil.app",
      "not a url at all",
    ]) {
      expect(parseStoreUrl(input)).toBeNull();
    }
  });

  it("does not treat a lookalike host as a store URL", () => {
    // play.google.com.evil.test must not be accepted as Google Play.
    expect(parseStoreUrl("https://play.google.com.evil.test/store/apps/details?id=com.x.y"))
      .toBeNull();
  });
});
