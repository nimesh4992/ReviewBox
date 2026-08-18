import React from "react";
import { Check, X, Minus } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { RoiCalculator } from "@/components/marketing/roi-calculator";
import {
  Band,
  Breadcrumb,
  Card,
  CtaBand,
  PageHero,
  PrimaryLink,
  Reveal,
  Section,
  SectionHeading,
  SecondaryLink,
} from "@/features/marketing/components/primitives";
import { RHYTHM } from "@/features/marketing/rhythm";
import {
  PLAN_LIMITS,
  PLAN_PRICING,
  TRIAL_DAYS,
  annualSavingsPercent,
  minAnnualSavingsPercent,
} from "@/lib/plans";

export const metadata = {
  // `absolute` skips the root layout's "%s | ReviewBox" template — the brand
  // is already the first word of this title, and appending it again gave
  // "ReviewBox vs AppFollow – Feature Comparison | ReviewBox".
  title: { absolute: "ReviewBox vs AppFollow – Feature Comparison" },
  description:
    "ReviewBox vs AppFollow: same stores, better AI, at a fraction of the price. 14-day free trial, no card required.",
};

type CellValue = true | false | "partial" | string;

const ROWS: {
  category: string;
  features: { label: string; reviewbox: CellValue; appfollow: CellValue }[];
}[] = [
  {
    category: "Pricing",
    features: [
      // Our own column is DERIVED from lib/plans.ts. Every hardcoded number
      // here had drifted: "2 months free" was the same stale claim as /pricing
      // and /faq (the real discount is 20% on Starter, 23% on Pro), and the
      // price was a second copy of $49 that nothing kept in step.
      { label: "Starting price", reviewbox: `$${PLAN_PRICING.starter.monthlyUsd}/month`, appfollow: "$149/month" },
      { label: "Free trial", reviewbox: `${TRIAL_DAYS} days — no card`, appfollow: "7 days — card required" },
      { label: "Per-app pricing", reviewbox: false, appfollow: true },
      { label: "Annual discount", reviewbox: `${minAnnualSavingsPercent()}–${annualSavingsPercent("pro")}%`, appfollow: "10%" },
      { label: "Self-serve sign-up (≤5 min)", reviewbox: true, appfollow: false },
      // Was "30-day, no questions" — flatly untrue. /refund-policy is a legal
      // document and says subscription payments are non-refundable with no
      // prorated or partial refunds; the trial is what exists instead. A
      // comparison page inventing a refund guarantee we do not offer is the
      // most expensive kind of drift, because a customer could reasonably rely
      // on it.
      { label: "Refund policy", reviewbox: `${TRIAL_DAYS}-day free trial instead`, appfollow: "Case-by-case" },
    ],
  },
  {
    category: "Review management",
    features: [
      { label: "Google Play sync", reviewbox: true, appfollow: true },
      { label: "App Store sync", reviewbox: true, appfollow: true },
      { label: "Sync frequency", reviewbox: "Daily + on demand", appfollow: "Every 6h (paid add-on)" },
      { label: "Full reply history", reviewbox: "What the store exposes", appfollow: "What the store exposes" },
      { label: "Bulk operations", reviewbox: true, appfollow: true },
      { label: "Saved filters on the queue", reviewbox: true, appfollow: true },
    ],
  },
  {
    category: "AI replies",
    features: [
      { label: "Built-in AI reply pipeline", reviewbox: true, appfollow: "Add-on" },
      { label: "Custom AI persona / tone", reviewbox: true, appfollow: false },
      { label: "Template matching (zero tokens)", reviewbox: true, appfollow: false },
      { label: "Reply cache (instant re-use)", reviewbox: true, appfollow: false },
      { label: "Auto-translate review text", reviewbox: true, appfollow: "partial" },
      { label: "Auto-publish rules", reviewbox: false, appfollow: "partial" },
    ],
  },
  {
    category: "Intelligence",
    features: [
      { label: "Rating spike detection", reviewbox: true, appfollow: true },
      { label: "Crash cluster detection", reviewbox: false, appfollow: false },
      { label: "Release health tracking", reviewbox: true, appfollow: true },
      { label: "Sentiment analysis", reviewbox: true, appfollow: true },
      { label: "ASO keyword suggestions", reviewbox: true, appfollow: "partial" },
      { label: "Competitor monitoring", reviewbox: "partial", appfollow: true },
    ],
  },
  {
    category: "Automation",
    features: [
      { label: "Automation rule builder", reviewbox: true, appfollow: false },
      { label: "Auto-triage by tag / sentiment", reviewbox: true, appfollow: false },
      { label: "Slack alerts", reviewbox: "Pro plan", appfollow: true },
      { label: "Webhook output", reviewbox: false, appfollow: "Enterprise only" },
      { label: "Zapier / Make", reviewbox: false, appfollow: true },
      { label: "Audit log", reviewbox: true, appfollow: "partial" },
    ],
  },
  {
    category: "Data & privacy",
    features: [
      { label: "GDPR compliant", reviewbox: true, appfollow: true },
      { label: "Self-serve data export (GDPR)", reviewbox: true, appfollow: "partial" },
      { label: "AI zero-data-retention", reviewbox: true, appfollow: "Not published" },
      { label: "EU data residency", reviewbox: false, appfollow: "partial" },
      { label: "DPA available", reviewbox: true, appfollow: true },
      { label: "SOC 2 Type II", reviewbox: "In progress", appfollow: true },
    ],
  },
  {
    category: "Support",
    features: [
      { label: "Founder-led support", reviewbox: true, appfollow: false },
      { label: "Live chat", reviewbox: false, appfollow: true },
      { label: "Dedicated CSM", reviewbox: false, appfollow: "Enterprise only" },
      { label: "Founder answers your email", reviewbox: true, appfollow: false },
    ],
  },
];

const SWITCH_STEPS = [
  {
    step: "01",
    title: "Sign up",
    body: "Create your account in under 2 minutes. No credit card. No sales call.",
    time: "~2 min",
  },
  {
    step: "02",
    title: "Connect your stores",
    body: "Add your Google Play and App Store apps with one OAuth flow. Reviews start syncing immediately.",
    time: "~3 min",
  },
  {
    step: "03",
    title: "Import from AppFollow",
    body: "Upload an AppFollow CSV export to keep your reply history. Optional — ReviewBox works without it.",
    time: "~5 min",
  },
  {
    step: "04",
    title: "You're live",
    body: "Invite your team, configure alerts, and let the AI start drafting replies.",
    time: "Done",
  },
];

// The three "customer quotes" that used to live here were invented — the
// comment beside them said so ("Placeholder quotes — replace once we have real
// customers") while the page presented them as real people with real job
// titles. They are deleted rather than restyled: the homepage states the rule
// this site holds itself to ("no customer logos, no counts of users we don't
// have, no invented metrics or testimonials"), and a comparison page is the
// worst possible place to break it. When there are real customers willing to
// be quoted, a quote block can come back with their names on it.
//
// The "Most teams save $1,000–$2,500/year" line under the ROI calculator went
// with them, for the same reason: we have no cohort to average.

function Cell({ value }: { value: CellValue }) {
  // Status is never carried by colour alone — each mark has a screen-reader
  // label, so the table is readable without seeing green/amber/grey at all.
  if (value === true)
    return (
      <>
        <Check
          className="mx-auto size-4 text-[var(--rb-green-500)]"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span className="sr-only">Yes</span>
      </>
    );
  if (value === false)
    return (
      <>
        <X className="mx-auto size-4 text-fg-4" strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">No</span>
      </>
    );
  if (value === "partial")
    return (
      <>
        <Minus
          className="mx-auto size-4 text-[var(--rb-amber-500)]"
          strokeWidth={2.5}
          aria-hidden="true"
        />
        <span className="sr-only">Partial</span>
      </>
    );
  return <span className="rb-meta font-normal text-fg-3">{value}</span>;
}

export default function ComparePage() {
  return (
    <MarketingShell>
      <MarketingNav />
      <Breadcrumb label="vs AppFollow" />

      <main>
        <PageHero
          eyebrow="ReviewBox vs AppFollow"
          title={
            // Explicit break: as one balanced run, "Better" and "AI." split
            // across lines and the blue clause started mid-line. Hidden below
            // sm so a phone doesn't get a one-word orphan line.
            <>
              Same reviews. Better AI.
              <br className="hidden sm:inline" />{" "}
              <span className="text-[var(--rb-blue-500)]">A third of the price.</span>
            </>
          }
          lede={`AppFollow starts at $149/month. ReviewBox starts at $${PLAN_PRICING.starter.monthlyUsd} with the AI reply pipeline, automation rules and both stores included — not sold as add-ons.`}
        >
          <div className="flex flex-wrap items-center justify-center gap-3">
            <PrimaryLink href="/sign-up">Start {TRIAL_DAYS}-day trial</PrimaryLink>
            <SecondaryLink href="/contact">Talk to a founder</SecondaryLink>
          </div>
          <p className="rb-meta mt-5 text-fg-3 text-balance">
            No credit card · cancel any time · self-serve in about five minutes
          </p>
        </PageHero>

        {/* ── Price callout ── */}
        <Section className="pb-4">
          <Reveal>
            <div className="mx-auto grid max-w-md grid-cols-2 gap-4 text-center">
              <div className="rounded-2xl border border-[var(--rb-border-1)] bg-surface p-5 shadow-[var(--rb-shadow-xs)]">
                <p className="rb-eyebrow text-fg-3">AppFollow</p>
                <p className="mt-2 text-[34px] font-bold tracking-[-0.03em] text-fg-3 line-through">
                  $149
                </p>
                <p className="rb-meta mt-1 font-normal text-fg-3">/ month</p>
              </div>
              <div className="rounded-2xl border-2 border-[var(--rb-blue-500)] bg-surface p-5 shadow-[var(--rb-shadow-md)]">
                <p className="rb-eyebrow text-[var(--rb-blue-500)]">ReviewBox</p>
                <p className="mt-2 text-[34px] font-bold tracking-[-0.03em] text-[var(--rb-blue-500)]">
                  ${PLAN_PRICING.starter.monthlyUsd}
                </p>
                {/* Was "unlimited apps" — Starter covers 2. The app count is
                    read from PLAN_LIMITS so it cannot drift again. */}
                <p className="rb-meta mt-1 font-normal text-fg-3">
                  / month · {PLAN_LIMITS.starter.appsMax} apps
                </p>
              </div>
            </div>
          </Reveal>
        </Section>

        {/* ── Feature table ── */}
        <Section className={RHYTHM.md}>
          <Reveal>
            <SectionHeading
              eyebrow="Side by side"
              title="Every row, checked against what ships today"
              lede="Where we don't have something, the row says so. A comparison table that only flatters the author is worth nothing to the person reading it."
            />
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2">
              <span className="rb-meta flex items-center gap-1.5 font-normal text-fg-3">
                <Check
                  className="size-4 text-[var(--rb-green-500)]"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                Included
              </span>
              <span className="rb-meta flex items-center gap-1.5 font-normal text-fg-3">
                <X className="size-4 text-fg-4" strokeWidth={2} aria-hidden="true" />
                Not available
              </span>
              <span className="rb-meta flex items-center gap-1.5 font-normal text-fg-3">
                <Minus
                  className="size-4 text-[var(--rb-amber-500)]"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                Partial or limited
              </span>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="mt-6 overflow-hidden rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
              {/* `[contain:paint]` is load-bearing, not decoration.

                  A table wider than the viewport inside a plain
                  `overflow-x-auto` box scrolled internally AND still expanded
                  the document's scroll area — the whole page gained 208px of
                  horizontal scroll on a 390px phone, so dragging the table
                  slid the nav, hero and footer sideways with it. Ancestor
                  `overflow-hidden` did not stop it, and moving the min-width
                  from the <table> onto a block wrapper did not either; paint
                  containment is what actually confines the overflow to this
                  box. Verified at 390/414/768/1024/1280/1440/1920.

                  The usual global escape hatch — `overflow-x: hidden` on a
                  page wrapper — is not available here: MarketingShell is an
                  ancestor of the `sticky` nav, and an overflow-hidden ancestor
                  silently kills position:sticky. */}
              <div className="overflow-x-auto [contain:paint]">
              <table className="w-full min-w-[560px] border-collapse">
                <caption className="sr-only">
                  ReviewBox compared with AppFollow, feature by feature
                </caption>
                <thead>
                  <tr className="border-b border-[var(--rb-border-1)]">
                    <th scope="col" className="rb-eyebrow w-1/2 px-6 py-4 text-left text-fg-3">
                      Feature
                    </th>
                    <th
                      scope="col"
                      className="rb-eyebrow w-1/4 px-6 py-4 text-center text-[var(--rb-blue-500)]"
                    >
                      ReviewBox
                    </th>
                    <th scope="col" className="rb-eyebrow w-1/4 px-6 py-4 text-center text-fg-3">
                      AppFollow
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((group) => (
                    // React.Fragment, not <>: the shorthand cannot take a key,
                    // so this map logged a React key warning on every render.
                    <React.Fragment key={group.category}>
                      <tr className="border-t border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)]">
                        <th
                          scope="colgroup"
                          colSpan={3}
                          className="rb-eyebrow px-6 py-2.5 text-left text-fg-3"
                        >
                          {group.category}
                        </th>
                      </tr>
                      {group.features.map((row) => (
                        <tr
                          key={row.label}
                          className="border-t border-[var(--rb-border-1)] transition-colors hover:bg-[var(--rb-bg-hover)]"
                        >
                          <th
                            scope="row"
                            className="px-6 py-3.5 text-left text-[15px] font-normal text-fg-2"
                          >
                            {row.label}
                          </th>
                          <td className="px-6 py-3.5 text-center">
                            <Cell value={row.reviewbox} />
                          </td>
                          <td className="px-6 py-3.5 text-center">
                            <Cell value={row.appfollow} />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          </Reveal>
        </Section>

        {/* ── ROI Calculator ── */}
        <Band>
          <Section className={RHYTHM.md}>
            <Reveal>
              <SectionHeading
                eyebrow="Your numbers"
                title="Work out your own saving"
                // The line here used to read "Most teams save $1,000-$2,500/year
                // switching from AppFollow." We have no cohort to average, so
                // the calculator does the arithmetic on the reader's inputs
                // instead of asserting a result on their behalf.
                lede="Set the sliders to your setup. The figure below is arithmetic on published list prices, not a claim about anyone else."
              />
            </Reveal>
            <Reveal delay={100}>
              <div className="mx-auto mt-12 max-w-lg">
                <RoiCalculator />
              </div>
            </Reveal>
          </Section>
        </Band>

        {/* ── How a switch works ── */}
        <Section className={RHYTHM.md}>
          <Reveal>
            <SectionHeading
              eyebrow="Migration"
              title="Switch in an afternoon"
              lede="No migration project and no onboarding call. Four steps, done in about fifteen minutes."
            />
          </Reveal>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SWITCH_STEPS.map((step, i) => (
              <Reveal key={step.step} delay={i * 80}>
                <Card className="h-full">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[28px] leading-none font-bold tracking-[-0.03em] text-[var(--rb-blue-200)] dark:text-[var(--rb-blue-800)]">
                      {step.step}
                    </span>
                    <span className="rb-eyebrow shrink-0 rounded-full bg-[var(--rb-bg-sunken)] px-2 py-1 text-fg-3">
                      {step.time}
                    </span>
                  </div>
                  <h3 className="rb-h3 mt-4 text-fg-1">{step.title}</h3>
                  <p className="rb-body-sm mt-2 text-fg-2">{step.body}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        <CtaBand
          title="Ready to switch?"
          lede={`${TRIAL_DAYS}-day free trial, no credit card. If you have questions, the founder replies personally.`}
          primary={{ href: "/sign-up", label: "Start your free trial" }}
          secondary={{ href: "/contact", label: "Talk to a founder" }}
        />
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
