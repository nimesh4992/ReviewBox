import { describe, expect, it } from "vitest";

import { verdictFor, type ProbeCheck } from "./store-probe";

function check(id: string, upstream: "google" | "apple", ok: boolean): ProbeCheck {
  return { id, claim: id, upstream, ok, detail: "", ms: 1 };
}

describe("verdictFor", () => {
  it("reports healthy when every check passes", () => {
    const { verdict } = verdictFor([
      check("google-search-regional", "google", true),
      check("apple-search-global", "apple", true),
    ]);
    expect(verdict).toBe("healthy");
  });

  it("names Google blocking when all Google checks fail but Apple works", () => {
    // The distinguishing question behind finding A8: is our code wrong, or is
    // Google refusing this server? Apple succeeding proves egress is fine.
    const { verdict, summary } = verdictFor([
      check("google-search-regional", "google", false),
      check("google-search-global", "google", false),
      check("apple-search-global", "apple", true),
    ]);
    expect(verdict).toBe("google_blocked");
    expect(summary).toMatch(/Play Console/);
  });

  it("blames our own egress when both upstreams fail", () => {
    const { verdict } = verdictFor([
      check("google-search-global", "google", false),
      check("apple-search-global", "apple", false),
    ]);
    expect(verdict).toBe("all_upstreams_unreachable");
  });

  it("identifies a storefront regression when only the regional app fails", () => {
    // This is the exact Mumbai One signature — the check that would have
    // caught the original bug on day one.
    const { verdict, summary } = verdictFor([
      check("google-search-regional", "google", false),
      check("google-search-global", "google", true),
      check("apple-search-global", "apple", true),
    ]);
    expect(verdict).toBe("regional_handling_broken");
    expect(summary).toMatch(/Mumbai One/);
  });

  it("treats ANY regional-only failure as the storefront signature", () => {
    // Metadata failing for the regional app while everything else works is
    // still a region-specific defect — the verdict should say so rather than
    // hide it in a generic "degraded".
    const { verdict } = verdictFor([
      check("google-metadata-regional", "google", false),
      check("google-search-regional", "google", true),
      check("google-search-global", "google", true),
      check("apple-search-global", "apple", true),
    ]);
    expect(verdict).toBe("regional_handling_broken");
  });

  it("falls back to degraded when the failure fits no pattern", () => {
    // Global path flaky, regional path fine — no storefront story, no block.
    const { verdict } = verdictFor([
      check("google-search-global", "google", false),
      check("google-search-regional", "google", true),
      check("apple-search-global", "apple", true),
    ]);
    expect(verdict).toBe("degraded");
  });
});
