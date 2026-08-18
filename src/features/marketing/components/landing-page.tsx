"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Check,
  Inbox,
  Layers,
  MessageSquareOff,
  PenLine,
  Send,
  Star,
  Timer,
  Workflow,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { ProductFrame } from "@/features/marketing/components/product-frame";
import {
  Band,
  CtaBand,
  Eyebrow,
  PrimaryLink,
  Reveal,
  Section,
  SectionHeading,
  SecondaryLink,
  Stars,
} from "@/features/marketing/components/primitives";
import { RHYTHM } from "@/features/marketing/rhythm";
import {
  PAID_PLANS,
  PLAN_LIMITS,
  PLAN_PRICING,
  planPerMonthUsd,
} from "@/lib/plans";

/**
 * Homepage — conversion-focused SaaS in the Stripe/Linear register: a layered
 * hero with the product UI as the hero image, a factual stat strip, a
 * pain → product narrative, a bento feature grid whose cards show the product
 * instead of describing it, two deep-dives, pricing with per-plan CTAs, an
 * FAQ, and a closing band.
 *
 * Every claim on this page has to be something the product actually does
 * today. No customer logos, no counts of users we don't have, no invented
 * metrics or testimonials. If a capability below stops being true, the copy
 * comes out. The stat strip and bento visualizations are product facts and
 * illustrative product UI — never fabricated social proof.
 */

// ─── Content ──────────────────────────────────────────────────────────────────

const STATS = [
  { value: "2 stores", label: "App Store + Google Play, one login" },
  { value: "1 inbox", label: "Every review in a single queue" },
  { value: "4 tones", label: "Professional to casual, your voice" },
  { value: "1 click", label: "Replies posted back to the store" },
];

const PAINS = [
  {
    icon: Layers,
    title: "Scattered across consoles",
    body: "App Store Connect in one tab, Play Console in another, a spreadsheet tracking who answered what. Nobody sees the whole queue.",
  },
  {
    icon: Timer,
    title: "Bad releases found late",
    body: "A broken update ships, one-star reviews pile onto the new version, and you find out when the average has already dropped.",
  },
  {
    icon: MessageSquareOff,
    title: "Replies users can smell",
    body: "“Thanks for your feedback” pasted forty times. Generic replies read as no reply at all, and reviewers know it.",
  },
];

const STEPS = [
  {
    n: "1",
    title: "Connect your app",
    body: "Search for it like you would on the store, click it, done. Reviews start syncing on a schedule.",
  },
  {
    n: "2",
    title: "Triage the queue",
    body: "Reviews arrive tagged and ranked. Crashes and billing complaints float to the top, praise sorts itself.",
  },
  {
    n: "3",
    title: "Reply and move on",
    body: "Every review comes with a draft in your voice. Edit if you want, post, next. The whole queue in one sitting.",
  },
];

/**
 * Plans are DERIVED from lib/plans.ts, never retyped here.
 *
 * The hardcoded version of this list advertised Starter $49, Pro $99 and a
 * "Team" plan at $199. None of that was buyable: Pro is $129/month, Team was
 * removed, and $99 is Pro's *annual* per-month rate. /pricing had already been
 * moved onto lib/plans.ts for exactly this reason — but the homepage, which
 * gets far more traffic than /pricing, was left behind and kept quoting a
 * price nobody could pay and a tier that no longer existed.
 *
 * Deriving is the only durable fix: a marketing list maintained by hand next
 * to a PLAN_PRICING object maintained by code will always drift.
 */
const PLANS = [
  ...PAID_PLANS.map((key) => ({
    name: PLAN_PRICING[key].label,
    // The monthly rate, because the card says "/ month" and is not attached to
    // an interval toggle. /pricing owns the annual story.
    price: planPerMonthUsd(key, "monthly"),
    body: PLAN_PRICING[key].tagline,
    popular: key === "pro",
    features: [
      `${PLAN_LIMITS[key].appsMax} apps`,
      `${PLAN_LIMITS[key].reviewsPerMonth.toLocaleString()} reviews / month`,
      `${PLAN_LIMITS[key].aiDraftsPerMonth.toLocaleString()} AI drafts / month`,
      PLAN_LIMITS[key].seats === 1 ? "1 seat" : `${PLAN_LIMITS[key].seats} seats`,
      key === "starter" ? "Email alerts" : "Email + Slack alerts",
    ],
  })),
  {
    name: PLAN_PRICING.enterprise.label,
    // Quote-only on purpose — see the note in lib/plans.ts. A published number
    // here would promise a procurement story we do not have.
    price: null,
    body: PLAN_PRICING.enterprise.tagline,
    popular: false,
    features: [
      "Unlimited apps",
      "Unlimited reviews",
      "Custom AI allowance",
      "Unlimited seats",
      "Named contact",
    ],
  },
];

const FAQS = [
  {
    q: "Do I need a credit card to try it?",
    a: "No. Every plan starts with the same 14-day trial and none of them asks for a card up front. You pick a plan only if ReviewBox earns it.",
  },
  {
    q: "How do replies actually get posted?",
    a: "Through the official APIs: App Store Connect for iOS and the Play Console API for Android, using credentials you connect in Settings. No browser extensions, no copy-paste.",
  },
  {
    q: "Will AI post anything without my approval?",
    a: "No. Drafts wait for you, and nothing goes to the store until you click Post. Automations tag, prioritize, and pre-draft; they don't publish.",
  },
  {
    q: "What makes the drafts sound like us?",
    a: "They're grounded in your own reply templates and knowledge base (refund policy, known issues, tone) instead of a generic model guess. You choose from four tones and edit anything before it posts.",
  },
  {
    q: "Which platforms are supported?",
    a: "Both major stores: the Apple App Store and Google Play. Reviews from both sync into the same inbox with the same tagging, prioritization, and reply flow.",
  },
];

const DEMO_REVIEW = {
  title: "Crashes on iPad after 4.2.1",
  body: "Every time I open the budgets tab on iPad it freezes. Started after the last update. I use this daily for my small business.",
  meta: "App Store · iOS · v4.2.1",
};

const DEMO_DRAFT =
  "Thanks for flagging the iPad freeze on 4.2.1. We reproduced it this morning and a fix is rolling out this week. I'll follow up here the moment it lands.";

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <header className="relative overflow-hidden">
      {/* Soft brand-blue wash + faint dot grid — the page's one flourish */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[640px]"
        style={{
          background:
            "radial-gradient(58% 100% at 50% 0%, rgba(10,132,255,0.12) 0%, rgba(10,132,255,0.04) 45%, transparent 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-[0.5]"
        style={{
          backgroundImage:
            "radial-gradient(color-mix(in oklab, var(--rb-fg-4) 55%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "linear-gradient(to bottom, black 0%, transparent 85%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 85%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-16 pb-10 text-center sm:px-6 sm:pt-24">
        {/* Factual capability badge, not fake social proof */}
        <p className="mx-auto flex w-fit items-center gap-2 rounded-full border border-[var(--rb-border-1)] bg-surface px-3.5 py-1.5 text-[12px] font-medium text-fg-2 shadow-[var(--rb-shadow-xs)]">
          <span className="size-2 rounded-full bg-[var(--rb-green-500)]" />
          Syncing the App Store and Google Play
        </p>

        <h1 className="rb-display mx-auto mt-7 max-w-[22ch] text-fg-1">
          Every app review answered.{" "}
          <span className="text-[var(--rb-blue-500)]">In your voice.</span>
        </h1>

        <p className="rb-lead mx-auto mt-6 max-w-[54ch] text-fg-2">
          ReviewBox pulls your App Store and Google Play reviews into one inbox,
          drafts replies you&apos;d actually send, and posts them back to the
          store before a bad week becomes a bad rating.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <PrimaryLink href="/sign-up">Start free trial</PrimaryLink>
          <SecondaryLink href="#see-it-work">See it work</SecondaryLink>
        </div>

        {/* `text-balance`, not a max-width: on a phone this needs to wrap into
            two even lines rather than run to the edge, and on a laptop it
            should stay on one. A fixed ch cap forced the wrap at every size. */}
        <p className="rb-meta mt-5 text-fg-3 text-balance">
          14-day free trial · no credit card required · cancel anytime
        </p>

        {/* The product is the hero image, with floating product moments around it */}
        <div className="relative mt-16 text-left">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 -top-6 bottom-8 rounded-[32px]"
            style={{
              background:
                "radial-gradient(50% 60% at 50% 30%, rgba(10,132,255,0.18) 0%, transparent 100%)",
              filter: "blur(32px)",
            }}
          />
          {/* No absolutely-positioned overlays. The rating-trend, spike-alert
              and reply-posted cards used to float in the page gutter at
              `2xl:block`: invisible on every screen below 1536px, and at
              1920px they sat ON the frame and covered the "Urgent" badge.
              They are now a squared row inside ProductFrame, so the hero
              composes the same way at every width. */}
          <div className="relative">
            <ProductFrame id="see-it-work" />
          </div>
        </div>
      </div>
    </header>
  );
}

// ─── Stat strip — product facts, not vanity metrics ───────────────────────────

function StatStrip() {
  return (
    <Section className="pb-4">
      <Reveal>
        <dl className="grid grid-cols-2 divide-[var(--rb-border-1)] overflow-hidden rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)] sm:grid-cols-4 sm:divide-x">
          {STATS.map((s) => (
            <div key={s.value} className="px-6 py-5 text-center">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="block text-[26px] font-bold tracking-[-0.025em] text-fg-1">
                  {s.value}
                </span>
                <span className="rb-body-sm mt-1.5 block text-fg-3">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </Section>
  );
}

// ─── Problem → product narrative ──────────────────────────────────────────────

function Problem() {
  return (
    <Section className={RHYTHM.md}>
      <Reveal>
        <SectionHeading
          eyebrow="The problem"
          title="Reviews are a product signal. Most teams treat them like a chore."
          lede="Your users are already telling you what's broken, what's confusing, and what to build next. It's just buried in two consoles nobody wants to open."
        />
      </Reveal>

      <div className="mt-12 grid gap-4 sm:grid-cols-3">
        {PAINS.map((p, i) => (
          <Reveal key={p.title} delay={i * 90}>
            <div className="h-full rounded-2xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-6">
              <div className="flex size-10 items-center justify-center rounded-xl border border-[var(--rb-border-1)] bg-surface">
                <p.icon className="size-5 text-fg-3" strokeWidth={1.75} />
              </div>
              <h3 className="rb-h3 mt-4 text-fg-1">{p.title}</h3>
              <p className="rb-body mt-2 text-fg-2">{p.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={200}>
        <p className="rb-lead mx-auto mt-12 max-w-[46ch] text-center font-medium text-fg-1">
          ReviewBox turns that pile into a queue you can actually finish:{" "}
          <span className="text-[var(--rb-blue-500)]">tagged, prioritized, and pre-drafted.</span>
        </p>
      </Reveal>
    </Section>
  );
}

// ─── Bento feature grid — show the product, don't describe it ─────────────────

function BentoCard({
  className = "",
  icon: Icon,
  title,
  body,
  children,
}: {
  className?: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--rb-border-1)] bg-surface p-6 shadow-[var(--rb-shadow-xs)] transition-shadow hover:shadow-[var(--rb-shadow-md)]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--rb-blue-50)] dark:bg-[var(--rb-bg-accent-soft)]">
          <Icon className="size-4.5 text-[var(--rb-blue-500)]" strokeWidth={1.75} />
        </div>
        <h3 className="rb-h3 text-fg-1">{title}</h3>
      </div>
      <p className="rb-body mt-3 text-fg-2">{body}</p>
      {children && <div className="mt-5 flex-1">{children}</div>}
    </div>
  );
}

/** Mini inbox rows — tags, priority dots, both store badges. */
function VizInbox() {
  const rows = [
    { store: "App Store", title: "Crashes on iPad after 4.2.1", rating: 1, tag: "crash", dot: "var(--rb-red-500)" },
    { store: "Google Play", title: "Charged twice for annual plan", rating: 2, tag: "billing", dot: "var(--rb-amber-500)" },
    { store: "App Store", title: "Great app, but needs dark mode", rating: 4, tag: "feature-request", dot: "var(--rb-green-500)" },
  ];
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-xl border border-[var(--rb-border-1)]">
      {rows.map((r) => (
        <div
          key={r.title}
          className="flex items-center gap-2.5 border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3.5 py-2.5 last:border-b-0"
        >
          <span className="size-1.5 shrink-0 rounded-full" style={{ background: r.dot }} />
          <span className="min-w-0 truncate text-[12px] font-medium text-fg-1">{r.title}</span>
          <span className="ml-auto hidden shrink-0 rounded bg-surface px-1.5 py-px text-[10px] font-medium text-fg-3 sm:block">
            {r.tag}
          </span>
          <span className="shrink-0">
            <Stars rating={r.rating} size={10} />
          </span>
          <span className="hidden shrink-0 text-[10px] font-medium text-fg-4 md:block">
            {r.store}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Mini release-spike bars — status carried by the labeled chip, not color alone. */
function VizSpike() {
  const days = [
    { h: 62, flag: false },
    { h: 58, flag: false },
    { h: 64, flag: false },
    { h: 60, flag: false },
    { h: 56, flag: false },
    { h: 30, flag: true },
    { h: 22, flag: true },
  ];
  return (
    <div aria-hidden="true">
      <div className="flex h-20 items-end gap-1.5">
        {days.map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-[4px]"
            style={{
              height: `${d.h}%`,
              background: d.flag ? "var(--rb-red-400)" : "var(--rb-blue-300)",
            }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5 rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-2.5 py-1.5">
        <AlertTriangle className="size-3.5 shrink-0 text-[var(--rb-red-600)]" strokeWidth={2} />
        <span className="truncate text-[12px] font-medium text-fg-1">
          Rating spike · v4.2.1 · alert sent
        </span>
      </div>
    </div>
  );
}

/** Mini topic bars — magnitudes in a single hue per the dataviz rules. */
function VizTopics() {
  const topics = [
    { label: "Crashes", pct: 34 },
    { label: "Billing", pct: 22 },
    { label: "Feature requests", pct: 18 },
    { label: "Login", pct: 11 },
  ];
  return (
    <div aria-hidden="true" className="space-y-2.5">
      {topics.map((t) => (
        <div key={t.label} className="flex items-center gap-3">
          <span className="w-[110px] shrink-0 truncate text-[12px] text-fg-2">{t.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
            <div
              className="h-full rounded-full bg-[var(--rb-blue-500)]"
              style={{ width: `${t.pct * 2.4}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right text-[11px] tabular-nums text-fg-3">
            {t.pct}%
          </span>
        </div>
      ))}
    </div>
  );
}

/** Mini automation rule — reads like the real rule builder. */
function VizRule() {
  const chip =
    "rounded-md border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-2 py-1 text-[11px] font-medium text-fg-2";
  return (
    <div aria-hidden="true" className="flex flex-wrap items-center gap-1.5 text-[11px] text-fg-3">
      <span className="font-medium text-fg-2">When</span>
      <span className={chip}>rating ≤ 2</span>
      <span>and</span>
      <span className={chip}>tag: billing</span>
      <ArrowRight className="size-3 text-fg-4" strokeWidth={2} />
      <span className={chip}>priority: urgent</span>
      <span className={chip}>draft reply</span>
    </div>
  );
}

/** Mini posting flow. */
function VizPost() {
  return (
    <div aria-hidden="true" className="rounded-xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-3.5">
      <p className="text-[12px] leading-relaxed text-fg-2">
        Thanks for flagging this! A fix ships this week…
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex h-6.5 items-center rounded-md bg-[var(--rb-blue-500)] px-2.5 text-[11px] font-semibold text-white">
          Post reply
        </span>
        <span className="text-[11px] text-fg-4">→ App Store Connect</span>
      </div>
    </div>
  );
}

/** Tone chips. */
function VizTones() {
  return (
    <div aria-hidden="true" className="flex flex-wrap gap-1.5">
      {["Professional", "Empathetic", "Casual", "Direct"].map((t, i) => (
        <span
          key={t}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium",
            i === 1
              ? "bg-[var(--rb-blue-500)] text-white"
              : "border border-[var(--rb-border-2)] bg-surface text-fg-2",
          )}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Features() {
  return (
    <Band>
      <Section className={RHYTHM.md}>
        <Reveal>
          <SectionHeading
            eyebrow="Everything reviews touch"
            title="Built for the team that answers"
            lede="From the 1-star crash report to the feature request you'll ship next quarter: one place to see it, understand it, and respond."
          />
        </Reveal>

        <div className="mt-12 grid gap-4 md:grid-cols-6">
          <Reveal className="md:col-span-4">
            <BentoCard
              icon={Inbox}
              title="One inbox, both stores"
              body="App Store and Google Play reviews in a single queue that's tagged, prioritized, and searchable."
            >
              <VizInbox />
            </BentoCard>
          </Reveal>
          <Reveal className="md:col-span-2" delay={80}>
            <BentoCard
              icon={AlertTriangle}
              title="Catch bad releases early"
              body="A cluster of 1-star reviews on one version raises an alert while a fix can still ship."
            >
              <VizSpike />
            </BentoCard>
          </Reveal>
          <Reveal className="md:col-span-2" delay={0}>
            <BentoCard
              icon={PenLine}
              title="Replies in your voice"
              body="Four tones, grounded in your templates and knowledge base. You edit, you approve."
            >
              <VizTones />
            </BentoCard>
          </Reveal>
          <Reveal className="md:col-span-2" delay={80}>
            <BentoCard
              icon={Send}
              title="Post straight to the store"
              body="One click sends the reply through the official store APIs. No tab-switching."
            >
              <VizPost />
            </BentoCard>
          </Reveal>
          <Reveal className="md:col-span-2" delay={160}>
            <BentoCard
              icon={BarChart2}
              title="Sentiment & topics"
              body="Recurring complaints tracked over time, tied to the release they arrived on."
            >
              <VizTopics />
            </BentoCard>
          </Reveal>
          <Reveal className="md:col-span-6" delay={0}>
            <BentoCard
              icon={Workflow}
              title="Automations that do the boring half"
              body="Rules that tag, prioritize, and pre-draft replies for new reviews as they sync, so the queue is half-done before you open it."
            >
              <VizRule />
            </BentoCard>
          </Reveal>
        </div>
      </Section>
    </Band>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <Section className={RHYTHM.md}>
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          title="From signup to first reply in about a minute"
        />
      </Reveal>

      <div className="relative mt-14 grid gap-10 sm:grid-cols-3 sm:gap-8">
        {/* Connector line behind the step numbers on desktop */}
        <div
          aria-hidden="true"
          className="absolute top-[18px] right-[16%] left-[16%] hidden border-t border-dashed border-[var(--rb-border-2)] sm:block"
        />
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 110}>
            <div className="relative text-center">
              <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-[var(--rb-blue-500)] text-[15px] font-bold text-white shadow-[0_2px_8px_rgba(10,132,255,0.35)] ring-4 ring-[var(--rb-bg-canvas)]">
                {s.n}
              </div>
              <h3 className="rb-h3 mt-4 text-fg-1">{s.title}</h3>
              <p className="rb-body mx-auto mt-2 max-w-[34ch] text-fg-2">{s.body}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

// ─── AI reply deep-dive ───────────────────────────────────────────────────────

function ReplyDemoCard() {
  const [typed, setTyped] = useState(DEMO_DRAFT);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setTyped(DEMO_DRAFT.slice(0, i));
      if (i >= DEMO_DRAFT.length) clearInterval(id);
    }, 18);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-md)]">
      <div className="border-b border-[var(--rb-border-1)] p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="rb-eyebrow text-fg-3">
            {DEMO_REVIEW.meta}
          </span>
          <Stars rating={1} size={12} />
        </div>
        <p className="mt-2.5 text-[14px] font-semibold text-fg-1">{DEMO_REVIEW.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{DEMO_REVIEW.body}</p>
      </div>
      <div className="bg-[var(--rb-bg-sunken)] p-5">
        <span className="rb-eyebrow text-fg-3">
          Suggested reply · your voice
        </span>
        <p className="mt-2 min-h-[4.2rem] text-[13px] leading-relaxed text-fg-1">
          {typed}
          {typed.length < DEMO_DRAFT.length && (
            <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-[var(--rb-blue-500)] align-baseline" />
          )}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="inline-flex h-7 items-center rounded-md bg-[var(--rb-blue-500)] px-3 text-[12px] font-semibold text-white">
            Post reply
          </span>
          <span className="inline-flex h-7 items-center rounded-md border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-medium text-fg-2">
            Edit
          </span>
        </div>
      </div>
    </div>
  );
}

function ReplyDeepDive() {
  return (
    <Band>
      <Section className={RHYTHM.md}>
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <Eyebrow>AI replies</Eyebrow>
              <h2 className="rb-h2 mt-3 max-w-[18ch] text-fg-1">
                Drafts that sound like you wrote them
              </h2>
              <p className="rb-lead mt-5 max-w-[50ch] text-fg-2">
                Every draft is grounded in your own reply templates and knowledge
                base: refund policy, known issues, tone. It answers the actual
                complaint instead of apologizing generically, and you always
                review before anything posts.
              </p>
              <ul className="mt-6 space-y-3">
                {[
                  "Four tones: professional, empathetic, casual, direct",
                  "Grounded in your templates and knowledge base",
                  "Translate and reply across languages",
                  "Nothing posts without your click",
                ].map((li) => (
                  <li key={li} className="rb-body-sm flex items-start gap-2.5 text-fg-2">
                    <Check
                      className="mt-0.5 size-4 shrink-0 text-[var(--rb-blue-500)]"
                      strokeWidth={2.25}
                    />
                    {li}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <ReplyDemoCard />
          </Reveal>
        </div>
      </Section>
    </Band>
  );
}

// ─── Release-health deep-dive ─────────────────────────────────────────────────

function ReleaseHealthCard() {
  const releases = [
    { v: "4.2.1", status: "Regressing", delta: "−0.8", rollout: 46, alert: true },
    { v: "4.2.0", status: "Healthy", delta: "+0.1", rollout: 100, alert: false },
    { v: "4.1.9", status: "Healthy", delta: "+0.2", rollout: 100, alert: false },
  ];
  return (
    <div
      aria-label="Release health: version 4.2.1 flagged as regressing with an alert sent"
      className="overflow-hidden rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-md)]"
    >
      <div className="flex items-center justify-between border-b border-[var(--rb-border-1)] px-5 py-3.5">
        <span className="text-[13px] font-semibold text-fg-1">Release health</span>
        <span className="text-[11px] font-medium text-fg-3">
          last 3 versions
        </span>
      </div>
      <div>
        {releases.map((r) => (
          <div
            key={r.v}
            className="flex items-center gap-3 border-b border-[var(--rb-border-1)] px-5 py-3.5 last:border-b-0"
          >
            <span className="w-12 shrink-0 text-[12px] font-semibold tabular-nums text-fg-1">
              {r.v}
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                r.alert
                  ? "bg-[var(--rb-red-100)] text-[var(--rb-red-600)]"
                  : "bg-[var(--rb-green-100)] text-[var(--rb-green-600)]",
              )}
            >
              {r.alert ? (
                <AlertTriangle className="size-3" strokeWidth={2} />
              ) : (
                <Check className="size-3" strokeWidth={2.5} />
              )}
              {r.status}
            </span>
            <span className="ml-1 flex shrink-0 items-center gap-0.5 text-[12px] font-medium tabular-nums text-fg-2">
              {r.delta}
              <Star className="size-2.5 text-fg-3" fill="currentColor" strokeWidth={0} />
            </span>
            <div className="ml-auto hidden h-1.5 w-20 overflow-hidden rounded-full bg-[var(--rb-bg-sunken)] sm:block">
              <div
                className="h-full rounded-full bg-[var(--rb-blue-500)]"
                style={{ width: `${r.rollout}%` }}
              />
            </div>
            <span className="hidden w-9 shrink-0 text-right text-[11px] tabular-nums text-fg-3 sm:block">
              {r.rollout}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 bg-[var(--rb-bg-sunken)] px-5 py-3">
        <AlertTriangle className="size-3.5 shrink-0 text-[var(--rb-red-600)]" strokeWidth={2} />
        <span className="text-[12px] text-fg-2">
          Alert emailed: 6 one-star reviews on 4.2.1 in 24 hours
        </span>
      </div>
    </div>
  );
}

function ReleaseDeepDive() {
  return (
    <Section className={RHYTHM.md}>
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="lg:order-2">
          <div>
            <Eyebrow>Release monitoring</Eyebrow>
            <h2 className="rb-h2 mt-3 max-w-[20ch] text-fg-1">
              Know a bad release before your rating does
            </h2>
            <p className="rb-lead mt-5 max-w-[50ch] text-fg-2">
              Every review is tied to the app version it arrived on. When
              one-star reviews cluster on a new release, ReviewBox raises an
              alert while the rollout is still small enough to pause, not after
              the store average has taken the hit.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Rating-spike detection on every sync",
                "Complaints grouped by the version that caused them",
                "Email alerts the moment a release starts regressing",
                "Release health at a glance: rating and complaint deltas",
              ].map((li) => (
                <li key={li} className="rb-body-sm flex items-start gap-2.5 text-fg-2">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-[var(--rb-blue-500)]"
                    strokeWidth={2.25}
                  />
                  {li}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={120} className="lg:order-1">
          <ReleaseHealthCard />
        </Reveal>
      </div>
    </Section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <Band>
      <Section className={RHYTHM.md}>
        <Reveal>
          <SectionHeading
            eyebrow="Pricing"
            title="Simple pricing, no surprises"
            lede="Every plan starts with the same 14-day trial, and no plan asks for a card up front."
          />
        </Reveal>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 90}>
              <div
                className={cn(
                  "relative flex h-full flex-col rounded-2xl border bg-surface p-6",
                  plan.popular
                    ? "border-[var(--rb-blue-500)] shadow-[var(--rb-shadow-md)] lg:-my-2 lg:py-8"
                    : "border-[var(--rb-border-1)] shadow-[var(--rb-shadow-xs)]",
                )}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--rb-blue-500)] px-3 py-0.5 text-[11px] font-bold tracking-wide text-white uppercase">
                    Most popular
                  </span>
                )}
                <h3 className="rb-h4 text-fg-1">{plan.name}</h3>
                {/* A quote-only tier has no number to show. Rendering "$null"
                    or inventing one is how the old hardcoded list ended up
                    advertising a $199 plan that could not be bought. */}
                <p className="mt-3 flex min-h-[46px] items-baseline">
                  {plan.price === null ? (
                    <span className="text-[30px] font-bold tracking-[-0.03em] text-fg-1">
                      Talk to us
                    </span>
                  ) : (
                    <>
                      <span className="text-[38px] font-bold tracking-[-0.03em] text-fg-1">
                        ${plan.price}
                      </span>
                      <span className="ml-1.5 text-[15px] text-fg-3">/ month</span>
                    </>
                  )}
                </p>
                <p className="rb-body-sm mt-2 text-fg-2">{plan.body}</p>
                <ul className="mt-5 flex-1 space-y-2.5 border-t border-[var(--rb-border-1)] pt-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[14px] text-fg-2">
                      <Check
                        className="size-4 shrink-0 text-[var(--rb-green-500)]"
                        strokeWidth={2.5}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.price === null ? "/contact" : "/sign-up"}
                  className={cn(
                    "mt-6 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-full text-[15px] font-semibold transition-colors",
                    plan.popular
                      ? "bg-[var(--rb-blue-500)] text-white hover:bg-[var(--rb-blue-600)]"
                      : "border border-[var(--rb-border-3)] text-fg-1 hover:bg-[var(--rb-bg-hover)]",
                  )}
                >
                  {plan.price === null ? "Contact us" : "Start free trial"}
                  <ArrowRight className="size-3.5" strokeWidth={2.25} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="rb-body mt-10 text-center text-fg-3">
            <Link
              href="/pricing"
              className="font-medium text-[var(--rb-blue-500)] hover:underline"
            >
              Full plan comparison →
            </Link>
          </p>
        </Reveal>
      </Section>
    </Band>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function Faq() {
  return (
    <Section className={RHYTHM.md}>
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <Reveal>
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="rb-h2 mt-3 max-w-[14ch] text-fg-1">
              Questions, answered straight
            </h2>
            <p className="rb-body mt-5 max-w-[38ch] text-fg-2">
              More in the{" "}
              <Link href="/faq" className="font-medium text-[var(--rb-blue-500)] hover:underline">
                full FAQ
              </Link>
              , or email{" "}
              <a
                href="mailto:hello@tryreviewbox.com"
                className="font-medium text-[var(--rb-blue-500)] hover:underline"
              >
                hello@tryreviewbox.com
              </a>{" "}
              and a human answers.
            </p>
          </div>
        </Reveal>

        <Reveal delay={100}>
          <div className="divide-y divide-[var(--rb-border-1)] rounded-2xl border border-[var(--rb-border-1)] bg-surface px-6 shadow-[var(--rb-shadow-xs)]">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-5">
                <summary className="rb-h4 flex cursor-pointer list-none items-center justify-between gap-4 text-fg-1 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--rb-border-2)] text-fg-3 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="rb-body-sm mt-3 max-w-[62ch] text-fg-2">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ─── Closing CTA band ─────────────────────────────────────────────────────────

// Uses the shared CtaBand so /pricing and /compare close the same way this
// page does — those two each had their own hand-rolled `bg-gray-900` slab,
// which rendered as a black rectangle on a dark canvas in dark mode.
function Closing() {
  return (
    <CtaBand
      title="Your reviews are already waiting. Answer them today."
      lede="Connect an app and see your real reviews in about a minute. Free for 14 days on every plan. No credit card, no sales call."
      primary={{ href: "/sign-up", label: "Start free trial" }}
      secondary={{ href: "/help", label: "Read the docs" }}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <MarketingShell>
      <MarketingNav />
      <main>
        <Hero />
        <StatStrip />
        <Problem />
        <Features />
        <HowItWorks />
        <ReplyDeepDive />
        <ReleaseDeepDive />
        <Pricing />
        <Faq />
        <Closing />
      </main>
      <MarketingFooter />
    </MarketingShell>
  );
}
