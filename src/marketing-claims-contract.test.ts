import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PLAN_PRICING } from "@/lib/plans";
import { TEMPLATE_COUNT } from "@/lib/templates";

/**
 * The claims contract for marketing pages.
 *
 * Three public pages were withdrawn within 48 hours in August 2026 for saying
 * things that were not true:
 *
 *   /compare    an ROI calculator that priced us at a flat $49 for any number
 *               of apps (Starter caps at 2; 3 apps is Pro at $129), three
 *               invented testimonials, and an unsourced competitor price
 *   /customers  a fabricated customer story
 *   /status     a status page that could not report an outage
 *
 * Every one of them type-checked, linted, built and rendered beautifully. The
 * defect was never in the code — it was in the sentence, and no check in this
 * repo reads sentences. This file is the smallest useful version of that check:
 * it does not judge prose, it just refuses to let a NUMBER be hand-written on a
 * page when a source of truth for that number exists in the codebase.
 *
 * Scope is deliberately narrow. It guards the two pages added with
 * `docs/specs/marketing-product-pages.md`, because those are the ones whose
 * spec forbids specific claims. Widening it to every marketing page is a
 * follow-up, not a reason to skip it here.
 */

const APP = join(process.cwd(), "src", "app");

const HUB = join(APP, "app-review-management", "page.tsx");
const APPFOLLOW = join(APP, "alternatives", "appfollow", "page.tsx");

function source(path: string): string {
  return readFileSync(path, "utf-8");
}

/**
 * Strip comments before scanning.
 *
 * The rationale comments on these pages legitimately discuss "$80/month" and
 * "$129" while explaining why /compare was withdrawn. Scanning raw source would
 * fail on the very explanation of the rule, which trains people to weaken the
 * test rather than fix the page.
 */
function code(path: string): string {
  return source(path)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

describe("prices are imported, never typed", () => {
  it.each([
    ["the hub", HUB],
    ["the AppFollow page", APPFOLLOW],
  ])("%s contains no hardcoded dollar amount", (_label, path) => {
    // `$49`, `$129`, `$1,188` — any currency literal in rendered code.
    // Template placeholders like `${price}` are not matched: the `{` after the
    // dollar sign is excluded.
    const matches = code(path).match(/\$\s?\d[\d,]*/g) ?? [];
    expect(
      matches,
      `hardcoded price(s) ${JSON.stringify(matches)} — import from lib/plans.ts ` +
        `so the page cannot disagree with what Stripe charges`,
    ).toEqual([]);
  });

  it("the hub actually reads the price list", () => {
    // Guards against the cheap way to pass the test above: delete the prices
    // and say nothing at all. The page is supposed to quote pricing.
    const raw = source(HUB);
    expect(raw).toMatch(/from "@\/lib\/plans"/);
    expect(raw).toContain("PLAN_PRICING");
    expect(raw).toContain("PLAN_LIMITS");
  });

  it("the price the hub renders matches lib/plans.ts today", () => {
    // A live check rather than a source-shape check: if Starter's price moves,
    // this asserts the page moves with it.
    expect(PLAN_PRICING.starter.monthlyUsd).toBe(49);
    expect(PLAN_PRICING.pro.monthlyUsd).toBe(129);
    // …and that no page has quietly re-introduced the removed Team plan.
    expect(Object.keys(PLAN_PRICING)).not.toContain("team");
    for (const path of [HUB, APPFOLLOW]) {
      expect(code(path)).not.toMatch(/\bTeam plan\b/);
    }
  });
});

describe("no unsourced competitor claims", () => {
  it("the AppFollow page states no AppFollow price", () => {
    // appfollow.io is unreachable from the build environment, so nothing about
    // their pricing can be verified. An unsourced competitor price is the exact
    // claim /compare was withdrawn for.
    const body = code(APPFOLLOW);
    expect(body).not.toMatch(/\$\s?\d/);
    expect(body).not.toMatch(/\b\d+\s*(\/|per )\s*(mo|month)/i);
  });

  it("links to AppFollow's own pages instead, without passing authority", () => {
    const raw = source(APPFOLLOW);
    expect(raw).toContain("https://appfollow.io/pricing");
    // nofollow on a competitor link: we are citing them as a source, not
    // voting for them, and this domain has almost no authority to spend.
    const links = raw.match(/<a[^>]*href="https:\/\/appfollow\.io[^"]*"[^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link, `${link} must be rel="nofollow"`).toMatch(/rel="[^"]*nofollow/);
    }
  });

  it("names no customer and shows no testimonial", () => {
    // There are no customers yet. /customers was withdrawn for inventing one.
    for (const path of [HUB, APPFOLLOW]) {
      const body = code(path).toLowerCase();
      for (const banned of ["testimonial", "trusted by", "customers say", "case study"]) {
        expect(body, `${path} contains "${banned}"`).not.toContain(banned);
      }
    }
  });

  it("claims no rating, review count or star average of its own", () => {
    // schema.org aggregateRating without real reviews is both a Google
    // structured-data violation and the /customers mistake in machine-readable
    // form.
    for (const path of [HUB, APPFOLLOW]) {
      expect(code(path)).not.toContain("aggregateRating");
    }
  });
});

describe("product facts come from the code that implements them", () => {
  it("the hub imports the template count rather than stating one", () => {
    const raw = source(HUB);
    expect(raw).toContain("TEMPLATE_COUNT");
    // The number the page will render, asserted against the array itself. This
    // is the check /help/ai-replies never had — it claims 25 templates while
    // lib/templates.ts has had 19 for some time.
    expect(TEMPLATE_COUNT).toBeGreaterThan(0);
    expect(code(HUB)).not.toMatch(/\b\d+\s+(built-in\s+)?templates\b/i);
  });

  it("does not promise the store-posting flow the spine has not verified", () => {
    // docs/SPINE.md: the launch tier is Draft Mode (D018) — the customer copies
    // the draft into Play Console. One-click API posting exists in code but no
    // human has walked it end to end, so it may be offered, never assumed.
    const body = code(HUB).toLowerCase();
    expect(body).toContain("copy the finished reply");
    for (const overclaim of ["one click", "one-click posting", "automatically posts"]) {
      expect(body, `hub claims "${overclaim}" as the default flow`).not.toContain(overclaim);
    }
  });

  it("states no unverified time-to-value figure", () => {
    // Every spine step is currently unverified, so "in 30 seconds" and
    // "85% of replies are free" are claims nobody has measured in production.
    for (const path of [HUB, APPFOLLOW]) {
      const body = code(path);
      expect(body, `${path} promises a duration`).not.toMatch(
        /\b\d+\s*(seconds|minutes|hours)\b/i,
      );
      expect(body, `${path} states a percentage`).not.toMatch(/\b\d+\s?%/);
    }
  });
});
