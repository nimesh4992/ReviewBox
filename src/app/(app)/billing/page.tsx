"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Check, Loader2, ExternalLink, Zap } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlanId = "starter" | "pro" | "team";

interface Plan {
  id: PlanId;
  name: string;
  price: number;
  description: string;
  features: string[];
  highlight: boolean;
  badge?: string;
}

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 49,
    description: "Perfect for indie developers and small teams.",
    features: [
      "Up to 2 apps",
      "5,000 reviews / month",
      "Email alerts",
      "AI reply suggestions",
      "7-day review history",
    ],
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 99,
    description: "For growing teams that need deeper insights.",
    features: [
      "Up to 10 apps",
      "50,000 reviews / month",
      "Email + Slack alerts",
      "AI reply generation",
      "Release health tracking",
      "90-day review history",
    ],
    highlight: true,
    badge: "Most popular",
  },
  {
    id: "team",
    name: "Team",
    price: 199,
    description: "Unlimited scale with white-glove support.",
    features: [
      "Unlimited apps",
      "Unlimited reviews",
      "All Pro features",
      "Priority support",
      "Custom integrations",
      "Unlimited history",
    ],
    highlight: false,
  },
];

function BillingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const trialExpired = searchParams.get("reason") === "trial-expired";
  const [loadingPlan, setLoadingPlan] = useState<PlanId | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChoosePlan(planId: PlanId) {
    setLoadingPlan(planId);
    setError(null);

    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });

      if (!res.ok) {
        await res.json();
        throw new Error("Unable to start checkout. Please try again.");
      }

      const data = (await res.json()) as { url: string };
      router.push(data.url);
    } catch {
      setError("Unable to start checkout. Please try again.");
      setLoadingPlan(null);
    }
  }

  async function handleManageSubscription() {
    setPortalLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        if (data.error === "NO_SUBSCRIPTION") {
          throw new Error("No active subscription found. Choose a plan below to get started.");
        }
        throw new Error("Unable to open billing portal. Please try again.");
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
          <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" strokeWidth={1.5} />
            <p className="text-sm text-amber-800">
              <span className="font-semibold">Your free trial has expired.</span>{" "}
              Choose a plan to continue using ReviewBox.
            </p>
          </div>
        )}

        {error ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {/* Plan cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANS.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isLoading={loadingPlan === plan.id}
              isDisabled={loadingPlan !== null}
              onChoose={() => void handleChoosePlan(plan.id)}
            />
          ))}
        </div>

        {/* Manage existing subscription */}
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm border border-gray-200">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Manage Subscription</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Update payment details, view invoices, or cancel your plan through the Stripe portal.
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => void handleManageSubscription()}
              disabled={portalLoading}
              className="shrink-0 border-gray-200 text-gray-700 hover:bg-gray-50"
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
        <p className="mt-6 text-center text-sm text-gray-400">
          All plans include a 14-day free trial. Cancel anytime. No credit card
          required to start.
        </p>
      </div>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingContent />
    </Suspense>
  );
}

interface PlanCardProps {
  plan: Plan;
  isLoading: boolean;
  isDisabled: boolean;
  onChoose: () => void;
}

function PlanCard({ plan, isLoading, isDisabled, onChoose }: PlanCardProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-2xl bg-white p-6 shadow-sm transition-shadow hover:shadow-md",
        plan.highlight
          ? "ring-2 ring-[#0A84FF]"
          : "border border-gray-200",
      )}
    >
      {/* Badge */}
      {plan.badge ? (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[#0A84FF] px-3 py-0.5 text-xs font-semibold text-white shadow">
            <Zap className="size-3" strokeWidth={1.5} />
            {plan.badge}
          </span>
        </div>
      ) : null}

      {/* Header */}
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>
        <div className="mt-2 flex items-end gap-1">
          <span className="text-3xl font-bold tracking-tight text-gray-900">
            ${plan.price}
          </span>
          <span className="mb-1 text-sm text-gray-400">/mo</span>
        </div>
        <p className="mt-1.5 text-sm text-gray-500">{plan.description}</p>
      </div>

      {/* Features */}
      <ul className="mb-6 flex flex-1 flex-col gap-2.5">
        {plan.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm">
            <div
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                plan.highlight
                  ? "bg-[#0A84FF]/10 text-[#0A84FF]"
                  : "bg-gray-100 text-gray-500",
              )}
            >
              <Check className="size-2.5" strokeWidth={2.5} />
            </div>
            <span className="text-gray-600">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      <Button
        variant={plan.highlight ? "default" : "outline"}
        className={cn(
          "w-full",
          plan.highlight
            ? "bg-[#0A84FF] text-white hover:bg-[#006EE0]"
            : "border-gray-200 text-gray-700 hover:bg-gray-50",
        )}
        onClick={onChoose}
        disabled={isDisabled}
      >
        {isLoading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Redirecting…
          </>
        ) : (
          "Choose Plan"
        )}
      </Button>
    </div>
  );
}
