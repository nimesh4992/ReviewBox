"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Loader2, ExternalLink, Zap } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { COMPANY } from "@/lib/legal/company";
import {
  PAID_PLANS,
  PLAN_LIMITS,
  PLAN_PRICING,
  annualSavingsPercent,
  annualSavingsUsd,
  minAnnualSavingsPercent,
  planChargeUsd,
  planPerMonthUsd,
  type BillingInterval,
  type PaidPlanName,
} from "@/lib/plans";
import { BillingIntervalToggle } from "@/features/billing/components/billing-interval-toggle";

// Cards are DERIVED from lib/plans.ts — the same source /pricing renders.
// This page used to carry its own hand-typed plan list; it drifted into
// selling a "Team" tier that no longer exists and showing Pro at the annual
// per-month price while checkout charged the monthly one. The point of sale
// must never disagree with the price list.
//
// The interval now travels with the purchase. `annualAvailable` is resolved on
// the SERVER (page.tsx reads the Stripe price IDs) rather than guessed here,
// because the whole class of bug this fixes is the UI offering a price that
// no Stripe price object backs.
interface PaidPlanCard {
  id: PaidPlanName;
  name: string;
  description: string;
  features: string[];
  highlight: boolean;
  badge?: string;
}

const PLANS: PaidPlanCard[] = PAID_PLANS.map((id): PaidPlanCard => ({
  id,
  name: PLAN_PRICING[id].label,
  description: PLAN_PRICING[id].tagline,
  features: [
    `${PLAN_LIMITS[id].appsMax} apps`,
    `${PLAN_LIMITS[id].publishedRepliesPerMonth.toLocaleString()} published replies / month`,
    `${PLAN_LIMITS[id].reviewsPerMonth.toLocaleString()} reviews / month`,
    `${PLAN_LIMITS[id].aiDraftsPerMonth.toLocaleString()} AI drafts / month`,
    PLAN_LIMITS[id].seats === 1 ? "1 seat" : `${PLAN_LIMITS[id].seats} seats`,
    id === "starter" ? "Email alerts" : "Email + Slack alerts",
    id === "starter" ? "Email support" : "Priority email support",
  ],
  highlight: id === "pro",
  badge: id === "pro" ? "Most popular" : undefined,
}));

// Quote-only on purpose, same as /pricing — no Stripe product exists for it.
const ENTERPRISE = {
  name: PLAN_PRICING.enterprise.label,
  description: PLAN_PRICING.enterprise.tagline,
  features: [
    "Unlimited apps",
    "Unlimited published replies",
    "Unlimited reviews",
    "Custom AI allowance",
    "Unlimited seats",
    "Email + Slack alerts",
    "Named contact",
  ],
};

function BillingContent({ annualAvailable }: { annualAvailable: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Annual is preselected when it is real: it is the better deal for the
  // customer and the one /pricing leads with, so landing on monthly here would
  // quietly re-anchor them upward between the two pages.
  const [interval, setInterval] = useState<BillingInterval>(
    annualAvailable ? "annual" : "monthly",
  );
  const reason = searchParams.get("reason");
  const required = searchParams.get("required") === "1";
  const trialExpired = reason === "trial-expired";
  const [loadingPlan, setLoadingPlan] = useState<PaidPlanName | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reasonProp = required
      ? ("required" as const)
      : reason === "trial-expired"
        ? ("trial-expired" as const)
        : reason === "payment-failed"
          ? ("payment-failed" as const)
          : ("direct" as const);
    track({ name: "billing_viewed", properties: { reason: reasonProp } });
  }, [reason, required]);

  async function handleChoosePlan(planId: PaidPlanName) {
    setLoadingPlan(planId);
    setError(null);
    track({ name: "upgrade_clicked", properties: { plan: planId, interval } });

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId, interval }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
        if (data.error?.code === "STRIPE_NOT_CONFIGURED") {
          throw new Error("Billing is not set up yet. Add Stripe test keys to enable checkout.");
        }
        if (data.error?.code === "RATE_LIMITED") {
          throw new Error("Too many attempts. Please wait a minute and try again.");
        }
        // Belt and braces. The toggle is hidden when annual has no price, so
        // reaching this means the server and the page disagree — most likely a
        // price removed in Stripe after this tab was opened. Say which half is
        // wrong rather than reporting a generic failure.
        if (data.error?.code === "INTERVAL_NOT_AVAILABLE") {
          setInterval("monthly");
          throw new Error(
            data.error.message ?? "Yearly billing isn't available yet — switched you to monthly.",
          );
        }
        throw new Error(data.error?.message ?? "Unable to start checkout. Please try again.");
      }

      const data = (await res.json()) as { url: string };
      router.push(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout. Please try again.");
      setLoadingPlan(null);
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });

      if (!res.ok) {
        const data = (await res.json()) as { error?: { code?: string; message?: string } };
        if (res.status === 404) {
          throw new Error("No active subscription found. Choose a plan below to get started.");
        }
        if (data.error?.code === "STRIPE_NOT_CONFIGURED") {
          throw new Error("Billing is not set up yet.");
        }
        throw new Error(data.error?.message ?? "Unable to open billing portal. Please try again.");
      }

      const { url } = (await res.json()) as { url: string };
      router.push(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing portal. Please try again.");
      setPortalLoading(false);
    }
  }

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Account"
        title="Billing & Plans"
        description="Choose the plan that fits your team. Upgrade or downgrade at any time."
      />

      <div className="p-4 md:p-6">
        {/* Trial expired banner */}
        {trialExpired && (
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-[var(--rb-amber-500)]/30 bg-[var(--rb-amber-500)]/10 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--rb-amber-500)]" strokeWidth={1.5} />
            <p className="text-sm text-fg-2">
              <span className="font-semibold text-fg-1">Your free trial has expired.</span>{" "}
              Choose a plan to continue using ReviewBox.
            </p>
          </div>
        )}

        {error ? (
          <div className="mb-6 rounded-lg border border-[var(--rb-red-500)]/25 bg-[var(--rb-red-500)]/10 px-4 py-3 text-sm text-[var(--rb-red-500)]">
            {error}
          </div>
        ) : null}

        {/* Interval toggle — Yearly renders disabled ("Coming soon") until every paid plan has an annual Stripe price. */}
        <div className="mb-6 flex justify-center">
          <BillingIntervalToggle
            value={interval}
            onChange={setInterval}
            savingsPercent={minAnnualSavingsPercent()}
            unavailableOptions={annualAvailable ? [] : ["annual"]}
          />
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              name={plan.name}
              description={plan.description}
              features={plan.features}
              highlight={plan.highlight}
              badge={plan.badge}
              perMonth={planPerMonthUsd(plan.id, interval)}
              interval={interval}
              billedTotal={interval === "annual" ? planChargeUsd(plan.id, interval) : null}
              savingsPercent={interval === "annual" ? annualSavingsPercent(plan.id) : null}
              savingsUsd={interval === "annual" ? annualSavingsUsd(plan.id) : null}
              cta={
                <Button
                  variant={plan.highlight ? "default" : "outline"}
                  className={cn(
                    "w-full",
                    plan.highlight
                      ? "bg-[#0A84FF] text-white hover:bg-[#006EE0]"
                      : "border-[var(--rb-border-3)] text-fg-1 hover:border-[#0A84FF]/50 hover:bg-[var(--rb-bg-hover)]",
                  )}
                  onClick={() => void handleChoosePlan(plan.id)}
                  disabled={loadingPlan !== null}
                >
                  {loadingPlan === plan.id ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Redirecting…
                    </>
                  ) : (
                    "Choose Plan"
                  )}
                </Button>
              }
            />
          ))}
          <PlanCard
            name={ENTERPRISE.name}
            description={ENTERPRISE.description}
            features={ENTERPRISE.features}
            highlight={false}
            perMonth={null}
            interval={interval}
            billedTotal={null}
            savingsPercent={null}
            savingsUsd={null}
            cta={
              <Button
                asChild
                variant="outline"
                className="w-full border-[var(--rb-border-3)] text-fg-1 hover:border-[#0A84FF]/50 hover:bg-[var(--rb-bg-hover)]"
              >
                <a href={`mailto:${COMPANY.emails.support}?subject=${encodeURIComponent("ReviewBox Enterprise")}`}>
                  Talk to us
                </a>
              </Button>
            }
          />
        </div>

        {/* Manage existing subscription */}
        <div className="mt-6 rounded-2xl bg-surface p-6 shadow-sm border border-[var(--rb-border-1)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-fg-1">Manage Subscription</h2>
              <p className="mt-0.5 text-sm text-fg-3">
                Update payment details, view invoices, or cancel your plan through the Stripe portal.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => void handleManageSubscription()}
              disabled={portalLoading}
              className="shrink-0 border-[var(--rb-border-3)] text-fg-1 hover:bg-[var(--rb-bg-hover)]"
            >
              {portalLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Opening…
                </>
              ) : (
                <>
                  <ExternalLink className="size-4" />
                  Manage Subscription
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Footer note */}
        {/* This used to read "billed monthly" unconditionally, which was the
            page's own version of the bug: a fixed sentence about a variable
            fact. */}
        <p className="mt-6 text-center text-sm text-fg-3">
          Prices in USD, billed {interval === "annual" ? "yearly" : "monthly"}. All plans
          include a 14-day free trial — no credit card required to start. Cancel anytime.
        </p>
      </div>
    </div>
  );
}

export function BillingScreen({ annualAvailable }: { annualAvailable: boolean }) {
  return (
    <Suspense fallback={null}>
      <BillingContent annualAvailable={annualAvailable} />
    </Suspense>
  );
}

interface PlanCardProps {
  name: string;
  description: string;
  features: string[];
  highlight: boolean;
  badge?: string;
  /**
   * Price PER MONTH for the selected interval; null renders the quote-only
   * "Talk to us" state. Annual plans are quoted per month here and the real
   * charge is spelled out underneath — quoting a per-month figure without
   * saying what actually leaves the account is how a $99 headline becomes an
   * unexpected $1,188 on a statement.
   */
  perMonth: number | null;
  interval: BillingInterval;
  /** What is actually charged per cycle. Only shown for annual. */
  billedTotal: number | null;
  savingsPercent: number | null;
  savingsUsd: number | null;
  cta: ReactNode;
}

function PlanCard({
  name,
  description,
  features,
  highlight,
  badge,
  perMonth,
  interval,
  billedTotal,
  savingsPercent,
  savingsUsd,
  cta,
}: PlanCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl bg-surface p-6 shadow-sm transition-shadow hover:shadow-md",
        highlight
          ? "ring-2 ring-[#0A84FF]"
          : "border border-[var(--rb-border-1)]",
      )}
    >
      {/* Badge */}
      {badge ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#0A84FF] px-3 py-0.5 text-xs font-semibold text-white shadow">
            <Zap className="size-3" strokeWidth={1.5} />
            {badge}
          </span>
        </div>
      ) : null}

      {/* Header */}
      <div className="mb-5">
        <h3 className="text-base font-semibold text-fg-1">{name}</h3>
        <div className="mt-2 flex items-end gap-1.5">
          {perMonth === null ? (
            <span className="text-3xl font-bold tracking-tight text-fg-1">Talk to us</span>
          ) : (
            <>
              <span className="text-3xl font-bold tracking-tight text-fg-1">${perMonth}</span>
              <span className="mb-1 text-sm text-fg-3">USD / month</span>
            </>
          )}
        </div>
        {perMonth !== null && interval === "annual" && billedTotal !== null && (
          <p className="mt-1 text-xs text-fg-3">
            ${billedTotal.toLocaleString("en-US")} billed once a year
            {savingsPercent !== null && savingsUsd !== null && (
              <span className="font-medium text-[#1F8A5B]">
                {" "}· save ${savingsUsd.toLocaleString("en-US")} ({savingsPercent}%)
              </span>
            )}
          </p>
        )}
        <p className="mt-1.5 text-sm text-fg-3">{description}</p>
      </div>

      {/* Features */}
      <ul className="mb-6 flex flex-1 flex-col gap-2.5">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm">
            <div
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                highlight
                  ? "bg-[#0A84FF]/10 text-[#0A84FF]"
                  : "bg-[var(--rb-bg-sunken)] text-fg-3",
              )}
            >
              <Check className="size-2.5" />
            </div>
            <span className="text-fg-2">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {cta}
    </div>
  );
}
