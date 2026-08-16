import Link from "next/link";
import { Check, X } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { PAID_PLANS, PLAN_LIMITS, PLAN_PRICING, type PlanName } from "@/lib/plans";

export const metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for every team. Start free, no credit card required.",
};

// Plans are DERIVED from lib/plans.ts, never retyped here.
//
// This page had drifted into advertising a product we don't sell: a $199
// "Team" tier that no longer exists, per-day AI limits that are now monthly,
// teammate and automation-rule counts that nothing enforces, and features
// that were never built. A marketing page maintained by hand next to a
// PLAN_LIMITS object maintained by code will always end up lying; the only
// durable fix is one source of truth.
interface PlanCard {
  name: string;
  key: PlanName;
  monthly: number;
  annual: number;
  inr: number;
  description: string;
  highlight: boolean;
  onRequest: boolean;
  features: Record<string, string>;
}

const PLANS: PlanCard[] = PAID_PLANS.map((name): PlanCard => ({
  name: PLAN_PRICING[name].label,
  key: name,
  monthly: PLAN_PRICING[name].monthlyUsd!,
  annual: PLAN_PRICING[name].annualUsd!,
  inr: PLAN_PRICING[name].monthlyInr!,
  description: PLAN_PRICING[name].tagline,
  highlight: name === "pro",
  onRequest: false,
  features: {
    apps: `${PLAN_LIMITS[name].appsMax} apps`,
    replies: `${PLAN_LIMITS[name].publishedRepliesPerMonth.toLocaleString()} published replies / month`,
    reviews: `${PLAN_LIMITS[name].reviewsPerMonth.toLocaleString()} reviews / month`,
    aiDrafts: `${PLAN_LIMITS[name].aiDraftsPerMonth.toLocaleString()} AI drafts / month`,
    seats: PLAN_LIMITS[name].seats === 1 ? "1 seat" : `${PLAN_LIMITS[name].seats} seats`,
    alerts: name === "starter" ? "Email alerts" : "Email + Slack alerts",
    support: name === "starter" ? "Email support" : "Priority email support",
  },
}));

PLANS.push(
  {
    name: PLAN_PRICING.enterprise.label,
    key: "enterprise",
    monthly: 0,
    annual: 0,
    inr: 0,
    description: PLAN_PRICING.enterprise.tagline,
    highlight: false,
    // Quote-only on purpose: we have no seat management, SSO or procurement
    // story, so a published number would promise what we can't deliver.
    onRequest: true,
    features: {
      apps: "Unlimited apps",
      replies: "Unlimited published replies",
      reviews: "Unlimited reviews",
      aiDrafts: "Custom AI allowance",
      seats: "Unlimited seats",
      alerts: "Email + Slack alerts",
      support: "Named contact",
    },
  },
);

const PRICING_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "ReviewBox",
  description: "AI-powered review management for Google Play and App Store.",
  offers: PLANS.filter((p) => !p.onRequest).map((plan) => ({
    "@type": "Offer",
    name: plan.name,
    price: plan.monthly,
    priceCurrency: "USD",
    priceSpecification: {
      "@type": "UnitPriceSpecification",
      price: plan.monthly,
      priceCurrency: "USD",
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MON" },
    },
    url: "https://tryreviewbox.com/pricing",
  })),
};

// Only things that work today.
//
// Removed, because they were advertised and do not exist:
//   "Real-time sync (every 4h)"   Vercel Hobby caps cron at once a day; the
//                                 schedule is 0 8 * * * and cannot be raised
//                                 without upgrading the plan (see CLAUDE.md).
//   "Full review history"         Google Play exposes roughly the last week.
//                                 We cannot deliver history we can't fetch.
//   "Crash cluster detection"     Incident auto-detection is unbuilt (M3).
//   "Auto-publish rules"          Automations draft; they never publish
//                                 without a human (M3, opt-in, unbuilt).
//   "Webhook output"              Unbuilt (S4.2).
//   "Zapier / Make integration"   Unbuilt (S4.2).
//   Automation-rule counts        Nothing enforces a per-plan rule limit.
//
// If you add a row here, it must be something a customer can do today. A
// pricing page is a contract, and every one of the above was a promise the
// product could not keep.
const FEATURE_MATRIX = [
  {
    category: "Reviews",
    rows: [
      { label: "Google Play sync", starter: true, pro: true, enterprise: true },
      { label: "App Store sync", starter: true, pro: true, enterprise: true },
      { label: "Daily automatic sync", starter: true, pro: true, enterprise: true },
      { label: "Sync on demand", starter: true, pro: true, enterprise: true },
    ],
  },
  {
    category: "Replies",
    rows: [
      { label: "Publish replies to the store in one click", starter: true, pro: true, enterprise: true },
      { label: "Starter reply templates", starter: true, pro: true, enterprise: true },
      { label: "Your own reply templates", starter: true, pro: true, enterprise: true },
      { label: "AI drafts in your brand voice", starter: true, pro: true, enterprise: true },
      { label: "Knowledge base context", starter: false, pro: true, enterprise: true },
      { label: "Bulk reply to many reviews at once", starter: false, pro: true, enterprise: true },
      { label: "Translate reviews written in any language", starter: true, pro: true, enterprise: true },
    ],
  },
  {
    category: "Intelligence",
    rows: [
      { label: "Automatic sentiment tagging", starter: true, pro: true, enterprise: true },
      { label: "Issue tags: crashes, billing, login, performance", starter: true, pro: true, enterprise: true },
      { label: "Topic clustering across your reviews", starter: false, pro: true, enterprise: true },
      { label: "Rating spike alerts", starter: true, pro: true, enterprise: true },
      { label: "Release health tracking", starter: false, pro: true, enterprise: true },
      // Deliberately "ideas", not "tracking". We mine keyword phrases out of
      // your own review text and suggest more with AI. We do NOT track store
      // rank — that needs either store search scraping (which Google refuses
      // us) or a paid rank API, so promising it would be a lie.
      { label: "ASO keyword ideas mined from your reviews", starter: false, pro: true, enterprise: true },
    ],
  },
  {
    category: "Working together",
    rows: [
      { label: "Automation rules", starter: true, pro: true, enterprise: true },
      { label: "Slack alerts", starter: false, pro: true, enterprise: true },
      { label: "Multiple teammates", starter: false, pro: true, enterprise: true },
      { label: "CSV export", starter: true, pro: true, enterprise: true },
    ],
  },
];

function Check2({ ok }: { ok: boolean }) {
  if (ok) return <Check className="mx-auto h-4 w-4 text-emerald-500" strokeWidth={2.5} />;
  return <X className="mx-auto h-4 w-4 text-gray-300" strokeWidth={2} />;
}

export default function PricingPage() {
  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PRICING_JSON_LD) }}
      />
      <MarketingNav />

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        {/* Hero */}
        <div className="pt-16 pb-12 text-center">
          <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            Pricing
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7] sm:text-5xl">
            Simple pricing. No surprises.
          </h1>
          <p className="mt-4 text-lg text-gray-500 dark:text-[#86868B]">
            14-day free trial on every plan. No credit card required.
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((plan) => (
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
                {plan.onRequest ? (
                  <span className="text-3xl font-bold text-gray-900 dark:text-[#F5F5F7]">Talk to us</span>
                ) : (
                  <>
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold text-gray-900 dark:text-[#F5F5F7]">${plan.annual}</span>
                      <span className="text-sm text-gray-400 dark:text-[#636366]">/month</span>
                      <span className="text-sm text-gray-400 line-through dark:text-[#636366]">${plan.monthly}</span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-[#86868B]">
                      billed yearly · ${plan.monthly}/month billed monthly
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
          ))}
        </div>

        {/* Feature matrix */}
        <div className="mt-20">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7]">
            Everything in the box
          </h2>
          <div className="mt-10 overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-white/6">
                  <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-[#636366]">
                    Feature
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.name}
                      className={`px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide ${
                        p.highlight ? "text-[#0A84FF]" : "text-gray-500"
                      }`}
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((group) => (
                  <>
                    <tr key={group.category} className="border-t border-gray-100 dark:border-white/6 bg-gray-50 dark:bg-[#0E0E11]">
                      <td
                        colSpan={4}
                        className="px-6 py-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#636366]"
                      >
                        {group.category}
                      </td>
                    </tr>
                    {group.rows.map((row) => (
                      <tr key={row.label} className="border-t border-gray-100 dark:border-white/6 hover:bg-gray-50/50 dark:hover:bg-white/5">
                        <td className="px-6 py-3 text-gray-700 dark:text-[#C7C7CC]">{row.label}</td>
                        <td className="px-6 py-3 text-center">
                          <Check2 ok={row.starter} />
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Check2 ok={row.pro} />
                        </td>
                        <td className="px-6 py-3 text-center">
                          <Check2 ok={row.enterprise} />
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-20 mx-auto max-w-2xl">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7]">
            Billing FAQ
          </h2>
          <dl className="mt-10 space-y-6">
            {[
              {
                q: "Do I need a credit card to start?",
                a: "No. Every plan includes a 14-day free trial with no card required. You only enter billing details when you decide to keep going.",
              },
              {
                q: "Can I switch plans later?",
                a: "Yes — upgrade or downgrade at any time from Billing settings. Upgrades take effect immediately; downgrades take effect at the next billing cycle.",
              },
              {
                q: "What happens if I go over my review limit?",
                a: "We'll notify you when you hit 80% of your quota. Your existing reviews stay safe — new reviews will pause syncing until you upgrade or the next cycle resets.",
              },
              {
                q: "Is there a refund policy?",
                a: "Subscription payments are non-refundable, and we do not prorate. That is exactly why every plan starts with a 14-day free trial that needs no card — evaluate the product fully before you pay. Cancel any time to stop future renewals; you keep access until the end of the period you paid for. Duplicate charges and billing errors on our side are always refunded. See our Refund & Cancellation Policy.",
              },
              {
                q: "Do you offer annual billing?",
                a: "Annual plans are available at 2 months free (equivalent to ~17% off). Contact hello@tryreviewbox.com to switch.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6">
                <dt className="font-semibold text-gray-900 dark:text-[#F5F5F7]">{q}</dt>
                <dd className="mt-2 text-gray-500 dark:text-[#86868B]">{a}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* CTA */}
        <div className="mt-20 rounded-2xl bg-gray-900 px-8 py-14 text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">
            Start free — upgrade when you&apos;re ready.
          </h2>
          <p className="mt-3 text-gray-400">
            No contracts. No lock-in. Cancel any time.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-xl bg-[#0A84FF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0070e0]"
            >
              Start free trial
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-gray-600 px-6 py-3 text-sm font-semibold text-white hover:border-gray-400"
            >
              Talk to sales
            </Link>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
