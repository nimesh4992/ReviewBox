import Link from "next/link";
import { Check, X } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import {
  PAID_PLANS,
  PLAN_LIMITS,
  PLAN_PRICING,
  annualFreeMonths,
  annualSavingsPercent,
  minAnnualSavingsPercent,
  planChargeUsd,
} from "@/lib/plans";
import { isIntervalPurchasable } from "@/lib/stripe";
import { PricingCards, type PricingCard } from "@/features/marketing/components/pricing-cards";

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
const PLANS: PricingCard[] = PAID_PLANS.map((name): PricingCard => ({
  name: PLAN_PRICING[name].label,
  key: name,
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
  // One Offer per plan PER INTERVAL. Listing only the monthly price while the
  // page's headline showed the annual one meant the structured data and the
  // rendered page disagreed — and search results quote the structured data.
  //
  // `unitCode` is the billing period (MON / ANN) and `price` is what is
  // actually charged for that period, not the per-month figure the card shows.
  // Publishing $99 against ANN would advertise a year of Pro for $99.
  offers: PLANS.filter((p) => !p.onRequest).flatMap((plan) =>
    (["monthly", "annual"] as const)
      .map((interval) => ({ interval, charge: planChargeUsd(plan.key, interval) }))
      .filter((o): o is { interval: "monthly" | "annual"; charge: number } => o.charge !== null)
      .map(({ interval, charge }) => ({
        "@type": "Offer",
        name: `${plan.name} (${interval === "annual" ? "billed yearly" : "billed monthly"})`,
        price: charge,
        priceCurrency: "USD",
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: charge,
          priceCurrency: "USD",
          referenceQuantity: {
            "@type": "QuantitativeValue",
            value: 1,
            unitCode: interval === "annual" ? "ANN" : "MON",
          },
        },
        url: "https://tryreviewbox.com/pricing",
      })),
  ),
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
            Every plan starts with a 14-day trial at full Pro access — no
            credit card, no sales call. Upgrade, downgrade, or cancel
            whenever you want.
          </p>
        </div>

        {/* Plan cards + interval toggle (client — needs state) */}
        <PricingCards plans={PLANS} annualAvailable={isIntervalPurchasable("annual")} />

        {/* Feature matrix */}
        <div className="mt-20">
          <h2 className="text-center text-2xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7]">
            Everything in the box
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-gray-500 dark:text-[#86868B]">
            Every plan syncs both stores, drafts AI replies in your brand
            voice, and publishes with one click. Pro adds the intelligence
            and collaboration layer — topic clustering, release health,
            Slack alerts, and multiple teammates.
          </p>
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
          <p className="mt-3 text-center text-sm text-gray-500 dark:text-[#86868B]">
            The questions people ask before they enter a card. More setup and
            product questions live on the{" "}
            <Link href="/faq" className="text-[#0A84FF] hover:underline">
              full FAQ
            </Link>
            .
          </p>
          <dl className="mt-10 space-y-6">
            {[
              {
                q: "Do I need a credit card to start?",
                a: "No. Every plan includes a 14-day free trial with no card required. You only enter billing details when you decide to keep going.",
              },
              {
                q: "What happens when my trial ends?",
                a: `If you haven't added a card, your workspace drops to the Free plan automatically — nothing is charged without your say-so. Free stays usable indefinitely: ${PLAN_LIMITS.free.appsMax} app, ${PLAN_LIMITS.free.publishedRepliesPerMonth} published replies and ${PLAN_LIMITS.free.aiDraftsPerMonth} AI drafts a month. Upgrade whenever you're ready and everything you set up during the trial is still there.`,
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
                // Derived, never typed. The hardcoded version of this sentence
                // said "~17% off" while the real discount was 20% on Starter
                // and 23% on Pro — and the same wrong number was copied onto
                // /faq and /compare. `minAnnualSavingsPercent()` is the
                // strongest claim true of BOTH plans, so it stays honest even
                // if a price changes.
                a: isIntervalPurchasable("annual")
                  ? `Yes — switch to yearly billing on this page or in Billing and save at least ${minAnnualSavingsPercent()}% (${annualSavingsPercent("starter")}% on Starter, ${annualSavingsPercent("pro")}% on Pro), which works out at roughly ${annualFreeMonths("pro")} months free. You are charged once a year.`
                  : `Yearly billing is coming shortly — it will save at least ${minAnnualSavingsPercent()}% (${annualSavingsPercent("starter")}% on Starter, ${annualSavingsPercent("pro")}% on Pro). Today every plan is billed monthly and you can cancel any time. Email hello@tryreviewbox.com if you want yearly now and we will arrange it.`,
              },
              {
                q: "Which currencies do you support?",
                a: "Every plan is billed in USD today, wherever you're signing up from — your card issuer converts it automatically at checkout. More currencies are on the roadmap; the currency selector above the plan cards is where you'll pick one once it ships.",
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
