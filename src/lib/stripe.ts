import Stripe from "stripe";

import { PAID_PLANS, type BillingInterval, type PaidPlanName } from "@/lib/plans";

// Lazy singleton — avoids build-time crash when env vars aren't set
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" });
  }
  return _stripe;
}

/** Convenience re-export for files that call stripe.* directly */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Keyed by PAID_PLANS × BILLING_INTERVALS (lib/plans.ts) so this cannot drift
// from what the pricing and billing pages advertise.
//
// It used to be one price per plan — the monthly one — while /pricing led with
// the ANNUAL per-month figure. There was no interval anywhere in the checkout
// path, so the yearly price was quoted and the monthly price was charged.
//
// An unset env var leaves "" here, which `isIntervalPurchasable()` reads as
// "not for sale". The UI asks that question BEFORE offering an interval,
// because the failure it prevents is advertising a price nobody can pay.
//
// ⚠️ Reading process.env at module scope means these are fixed for the life of
// the process. That is fine on Vercel (a new deployment per env change) but it
// does mean adding a price in the Stripe dashboard is not enough on its own —
// the value has to reach the environment and the app has to be redeployed.
export const PRICE_IDS: Record<PaidPlanName, Record<BillingInterval, string>> = {
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER          ?? "",
    annual:  process.env.STRIPE_PRICE_STARTER_ANNUAL   ?? "",
  },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO              ?? "",
    annual:  process.env.STRIPE_PRICE_PRO_ANNUAL       ?? "",
  },
};

/** Is there a Stripe price behind this exact plan + interval? */
export function hasPrice(plan: PaidPlanName, interval: BillingInterval): boolean {
  return PRICE_IDS[plan][interval].trim().length > 0;
}

/**
 * Can this interval be offered at all?
 *
 * Deliberately ALL rather than SOME: a toggle that silently sells one plan and
 * dead-ends on the other is worse than no toggle. If annual is offered, every
 * plan on the page has to honour it.
 */
export function isIntervalPurchasable(interval: BillingInterval): boolean {
  return PAID_PLANS.every((plan) => hasPrice(plan, interval));
}
