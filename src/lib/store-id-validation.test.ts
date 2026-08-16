import { describe, it, expect } from "vitest";

import { parseStoreUrl } from "./store-urls";
import { looksLikeStoreId } from "./storefronts";

/**
 * Guards for the Settings → "Add new app" form, which previously accepted any
 * string as `apps.store_id`.
 *
 * The reported failure: an App Store link pasted while the Platform dropdown
 * still said Google Play. The worst outcome there was never the 500 — it was
 * the near miss where the row gets created holding a URL, the UI reports
 * success, and every sync for that app fails silently forever.
 */
describe("add-app input guards", () => {
  it("rejects a pasted URL as a store id", () => {
    // The exact value from the bug report.
    const pasted = "https://apps.apple.com/in/app/mumbai-one/id6478221525";
    expect(looksLikeStoreId(pasted)).toBe(false);
  });

  it("detects the platform mismatch that caused the failure", () => {
    const parsed = parseStoreUrl("https://apps.apple.com/in/app/mumbai-one/id6478221525");
    expect(parsed?.platform).toBe("app-store");
    // Form said google_play → the route must reject rather than store it.
    expect(parsed?.platform).not.toBe("google-play");
  });

  it("keeps the storefront off the pasted link", () => {
    expect(parseStoreUrl("https://apps.apple.com/in/app/mumbai-one/id6478221525")?.country).toBe("in");
    expect(parseStoreUrl("https://play.google.com/store/apps/details?id=com.mmrda&gl=IN")?.country).toBe("in");
  });

  it("accepts real store ids", () => {
    for (const id of ["com.mmrda", "com.mmrda.mumbaione", "com.whatsapp", "com.burbn.instagram"]) {
      expect(looksLikeStoreId(id)).toBe(true);
    }
  });

  it("rejects free text that would break sync just as badly", () => {
    for (const junk of ["Mumbai One", "mumbai one ticket", "", "   ", "6478221525"]) {
      expect(looksLikeStoreId(junk)).toBe(false);
    }
  });
});
