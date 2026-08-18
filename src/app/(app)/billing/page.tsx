/**
 * Server shell for Billing.
 *
 * It exists to answer ONE question the client cannot: is yearly billing
 * actually purchasable? That depends on `STRIPE_PRICE_*_ANNUAL`, which are
 * server-only env vars with no NEXT_PUBLIC counterpart — so a client component
 * could only ever guess, and guessing is precisely the failure being fixed
 * (the marketing page guessed that annual was for sale, and it was not).
 *
 * Resolving it here means the toggle is absent rather than broken when no
 * annual price exists, and it needs no second copy of the configuration.
 */

import { BillingScreen } from "@/features/billing/components/billing-screen";
import { isIntervalPurchasable } from "@/lib/stripe";

export default function BillingPage() {
  return <BillingScreen annualAvailable={isIntervalPurchasable("annual")} />;
}
