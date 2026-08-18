/**
 * Two properties that, between them, are the whole bug.
 *
 * 1. An interval is only ever OFFERED when a Stripe price backs it.
 * 2. The advertised discount is DERIVED, never typed into a page.
 *
 * The failure this replaces: /pricing led with the annual per-month price
 * ($39 / $99) while checkout had no interval at all and charged the monthly
 * price ($49 / $129). Alongside it, "2 months free (~17% off)" was hardcoded
 * into three separate public pages while the real discounts were 20% and 23%.
 *
 * Both are invisible in review — each file reads fine on its own. What is
 * wrong is the relationship BETWEEN a page and the prices behind it, which is
 * exactly what a unit test of either half would miss.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PAID_PLANS } from "./plans";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

/** Comments describe the old bug on purpose — they are not the bug. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

const PRICE_ENV = [
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_STARTER_ANNUAL",
  "STRIPE_PRICE_PRO_ANNUAL",
] as const;

describe("an interval is only sellable when a price backs it", () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of PRICE_ENV) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    vi.resetModules();
  });

  afterEach(() => {
    for (const key of PRICE_ENV) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    vi.resetModules();
  });

  it("refuses to sell an interval whose price IDs are unset", async () => {
    const { isIntervalPurchasable, hasPrice } = await import("./stripe");
    expect(isIntervalPurchasable("annual")).toBe(false);
    expect(isIntervalPurchasable("monthly")).toBe(false);
    for (const plan of PAID_PLANS) {
      expect(hasPrice(plan, "annual")).toBe(false);
    }
  });

  it("sells an interval once every plan has a price for it", async () => {
    process.env.STRIPE_PRICE_STARTER_ANNUAL = "price_starter_year";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "price_pro_year";
    const { isIntervalPurchasable } = await import("./stripe");
    expect(isIntervalPurchasable("annual")).toBe(true);
    // Monthly is still unset — the two intervals are independent.
    expect(isIntervalPurchasable("monthly")).toBe(false);
  });

  it("refuses a PARTIALLY configured interval", async () => {
    // The case worth a test of its own: Starter has a yearly price, Pro does
    // not. Offering the toggle here would render a Yearly tab that works on
    // one card and dead-ends on the other.
    process.env.STRIPE_PRICE_STARTER_ANNUAL = "price_starter_year";
    const { isIntervalPurchasable, hasPrice } = await import("./stripe");
    expect(hasPrice("starter", "annual")).toBe(true);
    expect(hasPrice("pro", "annual")).toBe(false);
    expect(isIntervalPurchasable("annual")).toBe(false);
  });

  it("treats a blank or whitespace env var as unset", async () => {
    // `STRIPE_PRICE_PRO_ANNUAL=` in a .env file yields "" — and a stray space
    // yields " ", which is truthy. Both mean "not configured".
    process.env.STRIPE_PRICE_STARTER_ANNUAL = "price_starter_year";
    process.env.STRIPE_PRICE_PRO_ANNUAL = "   ";
    const { isIntervalPurchasable } = await import("./stripe");
    expect(isIntervalPurchasable("annual")).toBe(false);
  });
});

describe("public pages never hardcode the annual discount", () => {
  const PAGES = [
    { file: "src/app/pricing/page.tsx", label: "/pricing" },
    { file: "src/app/faq/page.tsx", label: "/faq" },
  ];

  it.each(PAGES)("$label derives its savings figure", ({ file }) => {
    const body = stripComments(read(file));
    expect(body).toMatch(/minAnnualSavingsPercent\(|annualSavingsPercent\(/);
  });

  it.each(PAGES)("$label carries no stale hand-typed discount", ({ file }) => {
    const body = stripComments(read(file));
    // The exact wrong claim that was live on all three at once.
    expect(body).not.toMatch(/17\s*%/);
    expect(body).not.toMatch(/2 months free/i);
  });

  it("no marketing page promises a refund window the policy denies", () => {
    // /compare advertised "30-day, no questions" while /refund-policy — a
    // legal document — says payments are non-refundable with no prorated
    // refunds. That page was withdrawn on 2026-08-18, so the assertion now
    // sweeps the pages that remain rather than dying with it; the claim must
    // not reappear anywhere, including on a restored /compare.
    for (const file of ["src/app/pricing/page.tsx", "src/app/faq/page.tsx"]) {
      expect(stripComments(read(file))).not.toMatch(/30-day, no questions/i);
    }
  });

  it.each([
    { file: "src/features/marketing/components/pricing-cards.tsx", label: "the pricing cards" },
    { file: "src/app/pricing/page.tsx", label: "/pricing" },
    { file: "src/features/billing/components/billing-screen.tsx", label: "/billing" },
  ])("$label quotes no currency we cannot charge", ({ file }) => {
    // INR prices (₹2,999 / ₹6,999) were rendered as "India: ₹2,999/month"
    // with no INR price in Stripe and a checkout that only ever created USD
    // sessions — an unpayable price, exactly like the annual ones beside it.
    // Removed by founder decision 2026-08-18. Re-adding a currency needs a
    // Stripe price per currency and currency selection at checkout, not a
    // second number on a card.
    const body = stripComments(read(file));
    expect(body).not.toMatch(/₹/);
    expect(body).not.toMatch(/\bINR\b/);
    expect(body).not.toMatch(/monthlyInr|annualInr/);
    expect(body).not.toMatch(/en-IN/);
  });

  it("/faq does not promise proration it also denies two answers earlier", () => {
    const body = stripComments(read("src/app/faq/page.tsx"));
    expect(body).not.toMatch(/we'll prorate|we will prorate/i);
  });
});

describe("checkout puts the interval on the Stripe line item", () => {
  const source = () => stripComments(read("src/app/api/stripe/checkout/route.ts"));

  it("selects the price by plan AND interval", () => {
    // `PRICE_IDS[plan]` alone was the bug: one price per plan, always monthly.
    expect(source()).toContain("PRICE_IDS[plan][interval]");
  });

  it("validates the interval instead of trusting the body", () => {
    expect(source()).toMatch(/isBillingInterval\(/);
  });

  it("fails loudly when the chosen interval has no price", () => {
    expect(source()).toMatch(/hasPrice\(/);
    expect(source()).toContain("INTERVAL_NOT_AVAILABLE");
  });
});
