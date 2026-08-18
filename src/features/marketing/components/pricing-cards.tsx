"use client";

/**
 * The plan cards on /pricing, with the monthly / yearly switch.
 *
 * Split out of the page because the toggle needs client state, and pulled into
 * a component rather than inlined because the page is a Server Component that
 * has to resolve `annualAvailable` from server-only env vars and hand it down.
 *
 * ── The bug this shape prevents ─────────────────────────────────────────────
 *
 * The page used to print the ANNUAL per-month price as the headline ($39 /
 * $99) with the monthly struck through beside it, while checkout had no
 * concept of an interval and could only charge monthly ($49 / $129). The
 * customer read one number and was charged another, 26% higher.
 *
 * So the rule here is: never render a price for an interval the caller has not
 * confirmed is purchasable. When `annualAvailable` is false the Yearly option
 * still renders (disabled, "Coming soon") so the control isn't mistaken for
 * missing, but it shows no price and cannot be selected — monthly is the only
 * thing quoted or chargeable.
 */

import Link from "next/link";
import { Check } from "lucide-react";
import { useState } from "react";

import { BillingIntervalToggle } from "@/features/billing/components/billing-interval-toggle";
import { CurrencySelector } from "@/features/marketing/components/currency-selector";
import {
  annualSavingsPercent,
  annualSavingsUsd,
  minAnnualSavingsPercent,
  planChargeUsd,
  planPerMonthUsd,
  type BillingInterval,
  type PlanName,
} from "@/lib/plans";

export interface PricingCard {
  name: string;
  key: PlanName;
  description: string;
  highlight: boolean;
  onRequest: boolean;
  features: Record<string, string>;
}

export function PricingCards({
  plans,
  annualAvailable,
}: {
  plans: PricingCard[];
  annualAvailable: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>(
    annualAvailable ? "annual" : "monthly",
  );

  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
        <BillingIntervalToggle
          value={interval}
          onChange={setInterval}
          savingsPercent={minAnnualSavingsPercent()}
          unavailableOptions={annualAvailable ? [] : ["annual"]}
        />
        <CurrencySelector />
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const perMonth = planPerMonthUsd(plan.key, interval);
          const billedTotal = planChargeUsd(plan.key, "annual");
          const savedUsd = annualSavingsUsd(plan.key);
          const savedPct = annualSavingsPercent(plan.key);
          const showAnnualDetail = interval === "annual" && !plan.onRequest;

          return (
            <div
              key={plan.name}
              className={`relative rounded-[var(--rb-mk-r-card)] border bg-white p-8 ${
                plan.highlight
                  ? "border-[var(--rb-mk-ink)]"
                  : "border-[var(--rb-mk-line)]"
              }`}
            >
              {plan.highlight && (
                <span className="mb-4 inline-flex rounded-full bg-[var(--rb-mk-amber-500)] px-3 py-1 text-[11px] font-bold tracking-[0.09em] text-[var(--rb-mk-ink)] uppercase">
                  Most popular
                </span>
              )}
              <h2 className="text-[12.5px] font-bold tracking-[0.13em] text-[var(--rb-mk-orange-text)] uppercase">
                {plan.name}
              </h2>
              <p className="mt-3 min-h-[46px] text-[14.5px] leading-[1.5] text-[var(--rb-fg-3)]">
                {plan.description}
              </p>
              <div className="mt-6">
                {plan.onRequest || perMonth === null ? (
                  <span className="text-[42px] font-bold tracking-[-0.045em] text-[var(--rb-fg-1)]">
                    Talk to us
                  </span>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-[42px] font-bold tracking-[-0.045em] text-[var(--rb-fg-1)]">
                        ${perMonth}
                      </span>
                      {/* Stripe's site review asks for an explicit currency code, not a bare "$" */}
                      <span className="text-[15px] font-medium text-[var(--rb-fg-3)]">USD / month</span>
                      {/* The struck-through anchor is only honest while a
                          cheaper interval is genuinely selected. Showing it
                          next to the monthly price would strike through the
                          exact number being charged. */}
                      {showAnnualDetail && (
                        <span className="text-[15px] text-[var(--rb-fg-3)] line-through">
                          ${planPerMonthUsd(plan.key, "monthly")}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[13px] text-[var(--rb-fg-3)]">
                      {showAnnualDetail && billedTotal !== null ? (
                        <>
                          ${billedTotal.toLocaleString("en-US")} billed once a year
                          {savedUsd !== null && savedPct !== null && (
                            <span className="font-semibold text-[var(--rb-green-600)]">
                              {" "}· save ${savedUsd.toLocaleString("en-US")} ({savedPct}%)
                            </span>
                          )}
                        </>
                      ) : (
                        <>billed monthly · cancel any time</>
                      )}
                    </p>
                  </>
                )}
              </div>
              <Link
                {...(plan.onRequest ? { href: "/contact" } : { href: "/sign-up" })}
                className={`mt-7 block w-full rounded-full py-3 text-center text-[15px] font-bold tracking-[-0.01em] transition-colors ${
                  plan.highlight
                    ? "bg-[var(--rb-mk-amber-500)] text-[var(--rb-mk-ink)] hover:bg-[var(--rb-mk-amber-600)]"
                    : "border-[1.5px] border-[var(--rb-mk-line-2)] text-[var(--rb-fg-1)] hover:border-[var(--rb-mk-ink)]"
                }`}
              >
                {plan.onRequest ? "Contact us" : "Start free trial"}
              </Link>
              <ul className="mt-7 grid gap-2.5 border-t border-[var(--rb-mk-line)] pt-6 text-[14.5px] text-[var(--rb-fg-2)]">
                {Object.values(plan.features).map((f) => (
                  <li key={f} className="flex items-start gap-3">
                    <Check
                      className="mt-0.5 size-[17px] shrink-0 text-[var(--rb-mk-ink-4)]"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </>
  );
}
