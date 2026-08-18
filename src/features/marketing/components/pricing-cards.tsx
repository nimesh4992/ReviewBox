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
 * confirmed is purchasable. When `annualAvailable` is false the toggle does
 * not appear and monthly is the only thing quoted.
 */

import Link from "next/link";
import { Check } from "lucide-react";
import { useState } from "react";

import { BillingIntervalToggle } from "@/features/billing/components/billing-interval-toggle";
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
  inr: number;
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
      {annualAvailable && (
        <div className="mb-8 flex justify-center">
          <BillingIntervalToggle
            value={interval}
            onChange={setInterval}
            savingsPercent={minAnnualSavingsPercent()}
          />
        </div>
      )}

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
              className={`rounded-2xl border p-8 ${
                plan.highlight
                  ? "border-[#0A84FF] bg-white dark:bg-[#161618] shadow-lg ring-2 ring-[#0A84FF]/20"
                  : "border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618]"
              }`}
            >
              {plan.highlight && (
                <span className="mb-4 inline-flex rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#0A84FF]">
                  Most popular
                </span>
              )}
              <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7]">{plan.name}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-[#86868B]">{plan.description}</p>
              <div className="mt-6">
                {plan.onRequest || perMonth === null ? (
                  <span className="text-3xl font-bold text-gray-900 dark:text-[#F5F5F7]">Talk to us</span>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-gray-900 dark:text-[#F5F5F7]">${perMonth}</span>
                      {/* Stripe's site review asks for an explicit currency code, not a bare "$" */}
                      <span className="text-sm text-gray-400 dark:text-[#636366]">USD / month</span>
                      {/* The struck-through anchor is only honest while a
                          cheaper interval is genuinely selected. Showing it
                          next to the monthly price would strike through the
                          exact number being charged. */}
                      {showAnnualDetail && (
                        <span className="text-sm text-gray-400 line-through dark:text-[#636366]">
                          ${planPerMonthUsd(plan.key, "monthly")}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-[#86868B]">
                      {showAnnualDetail && billedTotal !== null ? (
                        <>
                          ${billedTotal.toLocaleString("en-US")} billed once a year
                          {savedUsd !== null && savedPct !== null && (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              {" "}· save ${savedUsd.toLocaleString("en-US")} ({savedPct}%)
                            </span>
                          )}
                        </>
                      ) : (
                        <>billed monthly · cancel any time</>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-[#86868B]">
                      India: ₹{plan.inr.toLocaleString("en-IN")}/month
                    </p>
                  </>
                )}
              </div>
              <Link
                {...(plan.onRequest ? { href: "/contact" } : { href: "/sign-up" })}
                className={`mt-6 block w-full rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? "bg-[#0A84FF] text-white hover:bg-[#0070e0]"
                    : "border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] text-gray-900 dark:text-[#F5F5F7] hover:bg-gray-50 dark:hover:bg-white/5"
                }`}
              >
                {plan.onRequest ? "Contact us" : "Start free trial"}
              </Link>
              <ul className="mt-8 space-y-3 text-sm text-gray-600 dark:text-[#C7C7CC]">
                {Object.values(plan.features).map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 shrink-0 text-emerald-500" strokeWidth={2.5} />
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
