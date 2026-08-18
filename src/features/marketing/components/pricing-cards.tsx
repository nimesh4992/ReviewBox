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

import { cn } from "@/lib/utils";
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

      {/* Four plans (Starter, Pro, Enterprise + whatever ships next) in a
          3-column grid left the last card stranded alone on a second row.
          The column count now follows the number of plans. */}
      <div
        className={
          plans.length === 4
            ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
            : "grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        {plans.map((plan) => {
          const perMonth = planPerMonthUsd(plan.key, interval);
          const billedTotal = planChargeUsd(plan.key, "annual");
          const savedUsd = annualSavingsUsd(plan.key);
          const savedPct = annualSavingsPercent(plan.key);
          const showAnnualDetail = interval === "annual" && !plan.onRequest;

          return (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-2xl border bg-surface p-6",
                plan.highlight
                  ? "border-[var(--rb-blue-500)] shadow-[var(--rb-shadow-md)]"
                  : "border-[var(--rb-border-1)] shadow-[var(--rb-shadow-xs)]",
              )}
            >
              {plan.highlight && (
                <span className="rb-eyebrow absolute -top-2.5 left-6 rounded-full bg-[var(--rb-blue-500)] px-2.5 py-1 text-white">
                  Most popular
                </span>
              )}
              <h2 className="rb-h4 text-fg-1">{plan.name}</h2>
              <p className="rb-body-sm mt-1 text-fg-3">{plan.description}</p>

              <div className="mt-6 min-h-[74px]">
                {plan.onRequest || perMonth === null ? (
                  <span className="text-[30px] font-bold tracking-[-0.03em] text-fg-1">
                    Talk to us
                  </span>
                ) : (
                  <>
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-[40px] leading-none font-bold tracking-[-0.035em] text-fg-1">
                        ${perMonth}
                      </span>
                      {/* Stripe's site review asks for an explicit currency code, not a bare "$" */}
                      <span className="rb-meta text-fg-3">USD / month</span>
                      {/* The struck-through anchor is only honest while a
                          cheaper interval is genuinely selected. Showing it
                          next to the monthly price would strike through the
                          exact number being charged. */}
                      {showAnnualDetail && (
                        <span className="rb-meta text-fg-4 line-through">
                          ${planPerMonthUsd(plan.key, "monthly")}
                        </span>
                      )}
                    </div>
                    <p className="rb-meta mt-2 font-normal text-fg-3">
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
                className={cn(
                  "mt-6 flex h-11 w-full items-center justify-center rounded-full text-[15px] font-semibold transition-colors",
                  plan.highlight
                    ? "bg-[var(--rb-blue-500)] text-white hover:bg-[var(--rb-blue-600)]"
                    // --rb-border-3, not --rb-border-1: a divider-weight border
                    // on a button stops it reading as a button on a dark
                    // surface. This is the exact bug that made two of three
                    // plan CTAs look disabled (see CLAUDE.md, border weights).
                    : "border border-[var(--rb-border-3)] bg-surface text-fg-1 hover:bg-[var(--rb-bg-hover)]",
                )}
              >
                {plan.onRequest ? "Contact us" : "Start free trial"}
              </Link>

              <ul className="mt-7 flex-1 space-y-2.5 border-t border-[var(--rb-border-1)] pt-6">
                {Object.values(plan.features).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[14px] text-fg-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-[var(--rb-green-500)]"
                      strokeWidth={2.5}
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
