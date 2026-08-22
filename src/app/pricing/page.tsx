import React from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import {
  Actions,
  AmberLink,
  Disclosure,
  LineLink,
  PageHero,
  Section,
  SectionHead,
} from "@/features/marketing/components/primitives";
import { Breadcrumb } from "@/features/marketing/components/breadcrumb";
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
  alternates: { canonical: "/pricing" },
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
      { label: "Topic breakdown across your reviews", starter: false, pro: true, enterprise: true },
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

/**
 * The cell's meaning is carried by the screen-reader text, not the glyph —
 * a tick alone is colour-and-shape only, and the cross previously sat in
 * `text-gray-300` (1.4:1) which is invisible rather than merely quiet.
 */
function Check2({ ok }: { ok: boolean }) {
  return (
    <>
      {ok ? (
        <Check
          className="mx-auto size-4 text-[var(--rb-green-600)]"
          strokeWidth={2.5}
          aria-hidden="true"
        />
      ) : (
        <X
          className="mx-auto size-4 text-[var(--rb-mk-ink-4)]"
          strokeWidth={2}
          aria-hidden="true"
        />
      )}
      <span className="sr-only">{ok ? "Included" : "Not included"}</span>
    </>
  );
}

export default function PricingPage() {
  const annual = isIntervalPurchasable("annual");

  const BILLING_FAQS = [
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
      // Derived, never typed. The hardcoded version of this sentence said
      // "~17% off" while the real discount was 20% on Starter and 23% on Pro —
      // and the same wrong number was copied onto /faq and /compare.
      // `minAnnualSavingsPercent()` is the strongest claim true of BOTH plans,
      // so it stays honest even if a price changes.
      a: annual
        ? `Yes — switch to yearly billing on this page or in Billing and save at least ${minAnnualSavingsPercent()}% (${annualSavingsPercent("starter")}% on Starter, ${annualSavingsPercent("pro")}% on Pro), which works out at roughly ${annualFreeMonths("pro")} months free. You are charged once a year.`
        : `Yearly billing is coming shortly — it will save at least ${minAnnualSavingsPercent()}% (${annualSavingsPercent("starter")}% on Starter, ${annualSavingsPercent("pro")}% on Pro). Today every plan is billed monthly and you can cancel any time. Email hello@tryreviewbox.com if you want yearly now and we will arrange it.`,
    },
    {
      q: "Which currencies do you support?",
      a: "Every plan is billed in USD today, wherever you're signing up from — your card issuer converts it automatically at checkout. More currencies are on the roadmap; the currency selector above the plan cards is where you'll pick one once it ships.",
    },
  ];

  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(PRICING_JSON_LD) }}
      />
      <MarketingNav />

      <PageHero
        eyebrow="Pricing"
        title="Simple pricing. No surprises."
        lede="Every plan starts with a 14-day trial at full Pro access — no credit card, no sales call. Upgrade, downgrade, or cancel whenever you want."
      />

      <main>
        <Breadcrumb trail={[{ label: "Pricing" }]} />

        <Section tight>
          {/* Client component — owns the monthly/yearly toggle state. */}
          <PricingCards plans={PLANS} annualAvailable={annual} />
        </Section>

        <Section band>
          <SectionHead
            center
            eyebrow="Compare plans"
            title="Everything in the box"
            body="Every plan syncs both stores, drafts AI replies in your brand voice, and publishes with one click. Pro adds the intelligence and collaboration layer — topic breakdown, release health, Slack alerts, and multiple teammates."
          />

          {/* The table scrolls inside its own container so the page body never
              scrolls sideways on a phone. */}
          <div className="mt-12 overflow-x-auto rounded-[var(--rb-mk-r-frame)] border border-[var(--rb-mk-line)] bg-white">
            <table className="w-full min-w-[640px] text-[14.5px]">
              <caption className="sr-only">
                Feature availability by plan: Starter, Pro and Enterprise
              </caption>
              <thead>
                <tr className="border-b border-[var(--rb-mk-line)]">
                  <th
                    scope="col"
                    className="px-6 py-4 text-left text-[12px] font-bold tracking-[0.1em] text-[var(--rb-fg-3)] uppercase"
                  >
                    Feature
                  </th>
                  {PLANS.map((p) => (
                    <th
                      key={p.name}
                      scope="col"
                      className={
                        "px-6 py-4 text-center text-[12px] font-bold tracking-[0.1em] uppercase " +
                        (p.highlight
                          ? "text-[var(--rb-mk-orange-text)]"
                          : "text-[var(--rb-fg-3)]")
                      }
                    >
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* React.Fragment, not <>: a bare fragment cannot carry a key,
                    and the key was previously on the inner <tr>, which left
                    the group without one. */}
                {FEATURE_MATRIX.map((group) => (
                  <React.Fragment key={group.category}>
                    <tr className="border-t border-[var(--rb-mk-line)] bg-[var(--rb-mk-sunken)]">
                      <th
                        scope="colgroup"
                        colSpan={4}
                        className="px-6 py-2.5 text-left text-[11px] font-bold tracking-[0.12em] text-[var(--rb-fg-3)] uppercase"
                      >
                        {group.category}
                      </th>
                    </tr>
                    {group.rows.map((row) => (
                      <tr
                        key={row.label}
                        className="border-t border-[var(--rb-mk-line)] transition-colors hover:bg-[var(--rb-mk-sunken)]"
                      >
                        <th
                          scope="row"
                          className="px-6 py-3 text-left font-normal text-[var(--rb-fg-2)]"
                        >
                          {row.label}
                        </th>
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
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section>
          <div className="mx-auto max-w-[760px]">
            <SectionHead
              center
              eyebrow="Billing"
              title="Billing FAQ"
              body={
                <>
                  The questions people ask before they enter a card. More setup and product
                  questions live on the{" "}
                  <Link
                    href="/faq"
                    className="font-semibold text-[var(--rb-mk-orange-text)] hover:underline"
                  >
                    full FAQ
                  </Link>
                  .
                </>
              }
            />
            <div className="mt-10 border-t border-[var(--rb-mk-line)]">
              {BILLING_FAQS.map(({ q, a }, i) => (
                <Disclosure key={q} q={q} open={i === 0}>
                  {a}
                </Disclosure>
              ))}
            </div>
          </div>
        </Section>

        <section className="bg-[var(--rb-mk-night)] py-[clamp(56px,7vw,96px)] text-center">
          <div className="mx-auto w-full max-w-[1160px] px-5 sm:px-6">
            <h2 className="text-[length:var(--rb-mk-h2)] leading-[1.1] font-bold tracking-[-0.028em] text-balance text-white">
              Start free — upgrade when you&apos;re ready.
            </h2>
            <p className="mx-auto mt-[18px] max-w-[46ch] text-[18px] text-[#B9B3CC]">
              No contracts. No lock-in. Cancel any time.
            </p>
            <div className="mt-[34px]">
              <Actions>
                <AmberLink href="/sign-up">Start free trial</AmberLink>
                <LineLink
                  href="/contact"
                  className="border-white/25 text-white hover:border-white/60"
                >
                  Talk to sales
                </LineLink>
              </Actions>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
