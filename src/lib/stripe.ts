import Stripe from "stripe";

import type { PaidPlanName } from "@/lib/plans";

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

// Keyed by PAID_PLANS (lib/plans.ts) so this cannot drift from what the
// pricing and billing pages advertise. These are the MONTHLY USD prices;
// annual and INR billing are shown on /pricing but not yet purchasable —
// creating those prices is a founder decision (RBI e-mandate rules make
// annual recurring charges on Indian cards fail unattended).
export const PRICE_IDS: Record<PaidPlanName, string> = {
  starter: process.env.STRIPE_PRICE_STARTER ?? "",
  pro:     process.env.STRIPE_PRICE_PRO     ?? "",
};
