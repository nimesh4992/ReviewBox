/**
 * `resolveAppMetadata` — the path that decides an app's storefront for life.
 *
 * Onboarding calls this once, when the customer connects an app, and whatever
 * it returns is persisted as `apps.store_country`. Every rating and review
 * count afterwards is read from that storefront.
 *
 * It used to fetch the search's hint and return the moment it answered, so
 * `findAppAcrossStorefronts` — and therefore the most-reviews-wins ranking —
 * never ran here at all. Onboarding ALWAYS supplies a hint (the storefront its
 * search happened to match, and search tries `us` first), which made the
 * ranking unreachable on the only path that decides the answer.
 *
 * That is how Mumbai One was pinned to `us`: the app IS listed in the US, the
 * US listing answered, and nobody looked at India — where the same package has
 * 2,945 ratings against a handful.
 *
 * ── Why these tests are shaped this way ─────────────────────────────────────
 *
 * The first version of this file stubbed `fetchAppMetadata` with `vi.spyOn` and
 * drove the whole function. It did not work: `findAppAcrossStorefronts` calls
 * `fetchAppMetadata` as a module-internal reference, and an ESM internal call
 * doesn't go through the exported binding, so the spy never fired and five
 * tests failed for a reason that had nothing to do with the code under test.
 *
 * Rather than mock the network, the ordering is now a pure exported function.
 * The bug WAS the ordering — "probe only the hint" versus "probe the hint
 * first, then the rest" — so testing it directly tests the defect, and the
 * ranking it feeds is covered in store-search.pick-home.test.ts.
 *
 * The last case guards the seam between them: that `resolveAppMetadata` still
 * delegates rather than growing a new early return.
 */

import { beforeEach, afterEach, describe, expect, it } from "vitest";

import { storefrontProbeOrder } from "./store-search";

const ORIGINAL = process.env.STORE_SEARCH_COUNTRIES;

beforeEach(() => {
  process.env.STORE_SEARCH_COUNTRIES = "us,in,gb";
});

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.STORE_SEARCH_COUNTRIES;
  else process.env.STORE_SEARCH_COUNTRIES = ORIGINAL;
});

describe("storefrontProbeOrder", () => {
  it("probes every configured storefront when there is no hint", () => {
    expect(storefrontProbeOrder()).toEqual(["us", "in", "gb"]);
    expect(storefrontProbeOrder(null)).toEqual(["us", "in", "gb"]);
  });

  it("keeps the hint FIRST but does not stop there", () => {
    // The regression, expressed as a list. The old code probed ["in"] and
    // returned; `in` alone would mean the ranking never sees `us` or `gb`.
    expect(storefrontProbeOrder("in")).toEqual(["in", "us", "gb"]);
  });

  it("still returns the others when the hint is already first", () => {
    // Mumbai One's exact case: search matched `us`, so `us` is the hint — and
    // `in` must still be probed, or nothing can outrank it.
    expect(storefrontProbeOrder("us")).toEqual(["us", "in", "gb"]);
  });

  it("does not probe the hint twice", () => {
    // The hint is prepended, so leaving it in the rest of the list costs an
    // extra request per onboarding against a store that rate-limits us.
    const order = storefrontProbeOrder("gb");
    expect(order).toEqual(["gb", "us", "in"]);
    expect(order.filter((c) => c === "gb")).toHaveLength(1);
    expect(new Set(order).size).toBe(order.length);
  });

  it("includes a hint that isn't in the configured list", () => {
    // A customer whose app lives in Brazil set it by hand in Settings. The
    // probe list is deliberately short (each entry is an upstream request), so
    // the hint has to widen it rather than be discarded.
    expect(storefrontProbeOrder("br")).toEqual(["br", "us", "in", "gb"]);
  });

  it("normalises a malformed hint rather than requesting it", () => {
    // normalizeStorefront falls back to the default for anything unusable, so
    // a junk value costs a probe of "us", not a request for a nonsense code.
    const order = storefrontProbeOrder("NOT-A-COUNTRY");
    expect(order).not.toContain("NOT-A-COUNTRY");
    expect(order).toEqual(["us", "in", "gb"]);
  });

  it("lower-cases a hint that arrived in caps", () => {
    expect(storefrontProbeOrder("IN")).toEqual(["in", "us", "gb"]);
  });

  it("honours a reconfigured storefront list", () => {
    process.env.STORE_SEARCH_COUNTRIES = "in,ae";
    expect(storefrontProbeOrder("ae")).toEqual(["ae", "in"]);
  });
});

describe("resolveAppMetadata delegates rather than short-circuiting", () => {
  it("has no early return that bypasses the ranking", async () => {
    // The defect was structural: an `if (preferred) { … return meta }` before
    // the probe. Every unit test of the ranking passed while it was there,
    // because the ranking was never reached. This reads the function body so
    // that shape cannot come back unnoticed.
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), "src/services/store-search.ts"), "utf8");

    const start = source.indexOf("export async function resolveAppMetadata");
    expect(start).toBeGreaterThan(-1);
    const raw = source.slice(start, source.indexOf("\n}", start));

    // Comments stripped before counting. Two reasons, both learned the hard
    // way while mutation-testing this very assertion:
    //   - the explanatory comment above the return contains the word "return",
    //   - and an earlier version anchored the match to the start of a line, so
    //     `if (meta) return meta;` — the exact shape of the regression — slid
    //     straight past it and the mutation passed.
    const body = raw
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/\/\/[^\n]*/g, " ");

    const returns = body.match(/\breturn\b/g) ?? [];
    expect(returns, `expected one return, found: ${returns.join(", ")}`).toHaveLength(1);
    expect(body).toContain("findAppAcrossStorefronts(");
    expect(body).toContain("storefrontProbeOrder(");
  });
});
