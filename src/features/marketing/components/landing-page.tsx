import React from "react";
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart2,
  Check,
  Inbox,
  Layers,
  MessageSquareOff,
  PenLine,
  Timer,
  Workflow,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { PLAN_PRICING } from "@/lib/plans";
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
 * Homepage, in the design language adapted from the SassTech index-4 ("CRM")
 * demo: a pastel mesh hero, a floating pill nav, gold pill CTAs, deep-indigo
 * ink, hairline card surfaces and one dark band as a contrast beat.
 *
 * Every claim on this page has to be something the product actually does
 * today. No customer logos, no counts of users we don't have, no invented
 * metrics or testimonials. If a capability below stops being true, the copy
 * comes out. The stat strip and the product frame are product facts and
 * illustrative product UI — never fabricated social proof.
 *
 * Two things load-bearing enough to state outright:
 *
 * 1. PRICES COME FROM `PLAN_PRICING`, NEVER FROM A LITERAL HERE. Until this
 *    rewrite the page carried its own hardcoded list — Starter $49, Pro $99,
 *    Team $199 — against a real table of Starter $49, Pro $129 and a
 *    quote-only Enterprise. So the homepage advertised Pro $30/month below
 *    what checkout charges (the $99 is Pro's *annual per-month* rate) and
 *    sold a Team plan that exists in neither `plans.ts` nor Stripe. The same
 *    class of bug was fixed on /pricing and missed here. Feature bullets
 *    below are marketing copy and stay local; anything with a currency
 *    symbol is read from the module.
 *
 * 2. This is a SERVER component. It has no state — the FAQ and deep-dive
 *    disclosures are native <details>, not React — so none of it needs to
 *    ship to the browser. The old version was "use client" only to drive
 *    scroll-reveal animations, which this design does not use.
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

const FEATURES = [
  {
    icon: Inbox,
    title: "One inbox, both stores",
    body: "Reviews sync from App Store Connect and the Play Console on a schedule, land in a single queue, and arrive already tagged by issue, sentiment and priority.",
  },
  {
    icon: PenLine,
    title: "Drafts in your voice",
    body: "Every review comes with a reply grounded in your own templates and knowledge base — refund policy, known issues, tone — not a generic model guess.",
  },
  {
    icon: BarChart2,
    title: "Release health",
    body: "Ratings and complaint volume tracked per version, so a regression shows up as a spike on 4.2.1 rather than a slow drift in the average.",
  },
  {
    icon: Workflow,
    title: "Automations that don't publish",
    body: "Rules tag, prioritise and pre-draft as reviews arrive. Nothing reaches the store until a human clicks Post.",
  },
];

const REPLY_POINTS = [
  {
    q: "Grounded in your knowledge base",
    a: "Refund policy, known issues and tone live in ReviewBox. Drafts quote them rather than inventing an answer, so what ships matches what support would say.",
  },
  {
    q: "Four tones, your pick",
    a: "Professional, warm, concise or casual. Set a default per app and override on any single reply.",
  },
  {
    q: "Posted through the official APIs",
    a: "App Store Connect for iOS, the Play Console API for Android, using credentials you connect in Settings. No browser extensions, no copy-paste.",
  },
];

const RELEASE_POINTS = [
  "Rating and complaint volume broken out by app version",
  "Alert when five or more low ratings hit one version in 24 hours",
  "Issue tags rolled up per release, so the cause is named",
];

/**
 * Illustrative, not measured — the shape of a regression landing on 4.2.1.
 *
 * `step` indexes a SEQUENTIAL one-hue ramp, not a status colour. Bar length
 * already encodes magnitude; lightness reinforces the same measure. The
 * earlier version painted these red / amber / green, which is a rainbow for
 * a single magnitude and spent three reserved status hues on it.
 *
 * `rising` is separate and genuinely bipolar: the rating delta moved up or
 * down, so it earns the diverging rose/green pair.
 */
const RELEASE_ROWS = [
  { version: "4.2.1", share: 72, delta: "−0.8", step: 4, rising: false },
  { version: "4.2.0", share: 31, delta: "−0.2", step: 3, rising: false },
  { version: "4.1.4", share: 12, delta: "+0.1", step: 2, rising: true },
  { version: "4.1.3", share: 9, delta: "+0.3", step: 1, rising: true },
];

const STEPS = [
  {
    n: "STEP 01",
    title: "Connect your app",
    body: "Search for it like you would on the store, click it, done. Reviews start syncing on a schedule.",
  },
  {
    n: "STEP 02",
    title: "Triage the queue",
    body: "Reviews arrive tagged and ranked. Crashes and billing complaints float to the top, praise sorts itself.",
  },
  {
    n: "STEP 03",
    title: "Reply and move on",
    body: "Every review comes with a draft in your voice. Edit if you want, post, next. The whole queue in one sitting.",
  },
];

/**
 * The dark band carries verifiable mechanics, not social proof. It replaced a
 * placeholder testimonial and two review-site badges: we have no customer
 * quote to run yet, and a placeholder that reads as a testimonial is worse
 * than no testimonial. Swap this for a real quote when one exists.
 */
const MECHANICS = [
  { label: "Stores", body: "App Store Connect · Google Play Developer API" },
  { label: "Posting", body: "Official APIs only — no scraping, no extensions" },
  { label: "Approval", body: "Nothing publishes without a human click" },
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

/** Marketing copy. Prices and names come from PLAN_PRICING — see the header. */
const PLAN_FEATURES: Record<"starter" | "pro" | "enterprise", string[]> = {
  starter: ["1 app", "5,000 reviews / month", "50 AI drafts / day", "Email alerts"],
  pro: [
    "10 apps",
    "50,000 reviews / month",
    "200 AI drafts / day",
    "Incident detection",
    "Release health",
  ],
  enterprise: ["Unlimited apps", "Custom review volume", "Audit log", "Unlimited seats"],
};

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

const TRIAL_NOTE = "14-day free trial · no credit card required · cancel anytime";

// ─── Shared bits ──────────────────────────────────────────────────────────────

function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("py-[clamp(66px,8vw,112px)]", className)}>
      <div className="mx-auto w-full max-w-[1160px] px-5 sm:px-6">{children}</div>
    </section>
  );
}

/**
 * Uppercase, letterspaced, and set in --rb-mk-orange-text rather than the
 * theme's own --orange. The source theme used its #FF5E1A for exactly this
 * label, where it measures 3.06:1 on white — over the large-text floor but
 * under AA for text this size. The decorative token stays for the underline.
 */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-4 block text-[12.5px] font-bold tracking-[0.13em] text-[var(--rb-mk-orange-text)] uppercase">
      {children}
    </span>
  );
}

function SectionHead({
  eyebrow,
  title,
  body,
  center = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  body?: string;
  center?: boolean;
}) {
  return (
    <div className={cn("max-w-[660px]", center && "mx-auto text-center")}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-[length:var(--rb-mk-h2)] leading-[1.1] font-bold tracking-[-0.028em] text-balance text-[var(--rb-fg-1)]">
        {title}
      </h2>
      {body && <p className="mt-[18px] text-[17.5px] text-[var(--rb-fg-3)]">{body}</p>}
    </div>
  );
}

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-transparent px-7 py-3.5 text-[15px] font-bold tracking-[-0.01em] transition-colors";

/** Ink on amber, never white — white on #FFB114 measures 1.9:1. */
function AmberLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        BTN_BASE,
        "bg-[var(--rb-mk-amber-500)] text-[var(--rb-mk-ink)] hover:bg-[var(--rb-mk-amber-600)]",
      )}
    >
      {children}
    </Link>
  );
}

function InkLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn(BTN_BASE, "bg-[var(--rb-mk-ink)] text-white hover:bg-[#241a5c]")}>
      {children}
    </Link>
  );
}

function LineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        BTN_BASE,
        "border-[var(--rb-mk-line-2)] text-[var(--rb-fg-1)] hover:border-[var(--rb-mk-ink)]",
      )}
    >
      {children}
    </Link>
  );
}

/** Hairline surface. No lift on hover — the border does the work. */
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[var(--rb-mk-r-card)] border border-[var(--rb-mk-line)] bg-white p-[30px] transition-colors hover:border-[var(--rb-mk-line-2)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Native disclosure — no JS, keyboard-accessible for free. */
function Disclosure({ q, a, open = false }: { q: string; a: string; open?: boolean }) {
  return (
    <details
      open={open}
      className="group border-b border-[var(--rb-mk-line)] [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-[17px] text-[16px] font-semibold tracking-[-0.012em] text-[var(--rb-fg-1)]">
        {q}
        <span
          aria-hidden="true"
          className="size-[11px] shrink-0 rotate-45 border-r-[1.5px] border-b-[1.5px] border-[var(--rb-mk-ink-4)] transition-transform group-open:-rotate-135"
        />
      </summary>
      <p className="max-w-[52ch] pb-5 text-[15.5px] text-[var(--rb-fg-3)]">{a}</p>
    </details>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

/**
 * The mesh is painted ON the <header>, not in a negatively-stacked child.
 * A child at -z-20 paints behind MarketingShell's own opaque background:
 * body backgrounds propagate to the canvas and stay beneath everything, but a
 * regular element background does not, so the gradient rendered invisible.
 * Everything here stacks positively instead.
 */
// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <header className="rb-mesh-hero relative -mt-[82px] pt-[clamp(138px,15vw,200px)] pb-[clamp(56px,7vw,92px)] text-center">
      {/* Faint engineering grid, masked to a soft oval as in the source hero. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(21,14,62,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(21,14,62,.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(72% 62% at 50% 34%, #000 0%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(72% 62% at 50% 34%, #000 0%, transparent 80%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-[1160px] px-5 sm:px-6">
        <p className="mb-[22px] text-[16px] font-semibold text-[var(--rb-fg-2)]">
          Syncing the App Store and Google Play
        </p>

        <h1 className="mx-auto max-w-[18ch] text-[length:var(--rb-mk-h1)] leading-[1.1] font-extrabold tracking-[-0.038em] text-balance text-[var(--rb-fg-1)]">
        <h1 className="rb-display mx-auto mt-7 max-w-[22ch] text-fg-1">
          Every app review answered.{" "}
          <span className="relative whitespace-nowrap">
            In your voice.
            <svg
              aria-hidden="true"
              viewBox="0 0 300 12"
              preserveAspectRatio="none"
              className="absolute -bottom-[0.2em] left-0 h-[0.28em] w-full overflow-visible"
            >
              <path
                d="M3 8.5C58 3.2 143 1.8 297 5.4"
                fill="none"
                stroke="var(--rb-mk-orange-deco)"
                strokeWidth={3}
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        <p className="mx-auto mt-[26px] max-w-[56ch] text-[18.5px] text-[var(--rb-fg-2)]">
        <p className="rb-lead mx-auto mt-6 max-w-[54ch] text-fg-2">
          ReviewBox pulls your App Store and Google Play reviews into one inbox,
          drafts replies you&apos;d actually send, and posts them back to the
          store before a bad week becomes a bad rating.
        </p>

        <div className="mt-[34px] flex flex-wrap justify-center gap-3">
          <InkLink href="/sign-up">Start free trial</InkLink>
          <LineLink href="#see-it-work">See it work</LineLink>
        </div>

        <p className="mt-[18px] text-[14px] text-[var(--rb-fg-3)]">{TRIAL_NOTE}</p>

        <div className="mx-auto mt-[46px] max-w-[980px] text-left">
          <ProductFrame id="see-it-work" />
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

function StatStrip() {
  return (
    <div className="border-y border-[var(--rb-mk-line)] bg-white py-[46px]">
      <div className="mx-auto w-full max-w-[1160px] px-5 sm:px-6">
        <p className="mb-[34px] text-center text-[13px] font-semibold text-[var(--rb-mk-ink-4)]">
          Two stores, one queue, no spreadsheet
        </p>
        <div className="grid grid-cols-2 gap-x-5 gap-y-[30px] sm:grid-cols-4 sm:gap-7">
          {STATS.map((s) => (
            <div key={s.value} className="text-center">
              <b className="mb-1 block text-[27px] font-bold tracking-[-0.035em] text-[var(--rb-fg-1)]">
                {s.value}
              </b>
              <span className="block text-[14px] leading-[1.45] text-[var(--rb-fg-3)]">
                {s.label}
              </span>
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
        </div>
      </div>
    </div>
  );
}

/**
 * Icons are Lucide at strokeWidth 1.5 — the same weight the authenticated app
 * sets globally — sitting bare on the card. An earlier pass had emoji in
 * tinted rounded tiles, seven pastel fills cycling; that read as generated
 * and gave marketing a second icon language the product doesn't share.
 */
function IconMark({ icon: Icon }: { icon: React.ElementType }) {
  return <Icon className="mb-5 size-[26px] text-[var(--rb-fg-1)]" strokeWidth={1.5} />;
}

function Problem() {
  return (
    <Section>
      <SectionHead
        center
        eyebrow="The way it works today"
        title="Three tabs, two consoles, and a spreadsheet"
        body="Review management breaks in the same three places at almost every team we talk to."
      />
      <div className="mt-[50px] grid gap-5 md:grid-cols-3">
        {PAINS.map((p) => (
          <Card key={p.title}>
            <IconMark icon={p.icon} />
            <h3 className="mb-2.5 text-[19px] leading-[1.3] font-bold tracking-[-0.015em] text-[var(--rb-fg-1)]">
              {p.title}
            </h3>
            <p className="text-[15.5px] leading-[1.55] text-[var(--rb-fg-3)]">{p.body}</p>
          </Card>
        ))}
      </div>
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

function Features() {
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
    <Section className="bg-[var(--rb-mk-sunken)]">
      <SectionHead
        eyebrow="What you get"
        title={
          <>
            Four things,
            <br />
            done properly
          </>
        }
      />
      <div className="mt-[50px] grid gap-5 md:grid-cols-2">
        {FEATURES.map((f) => (
          <Card key={f.title}>
            <IconMark icon={f.icon} />
            <h3 className="mb-2.5 text-[19px] leading-[1.3] font-bold tracking-[-0.015em] text-[var(--rb-fg-1)]">
              {f.title}
            </h3>
            <p className="text-[15.5px] leading-[1.55] text-[var(--rb-fg-3)]">{f.body}</p>
          </Card>
        ))}
      </div>
    </Section>
  );
}

function ReplyDeepDive() {
  return (
    <Section>
      <div className="grid items-center gap-[60px] lg:grid-cols-2">
        <div>
          <Eyebrow>Replies</Eyebrow>
          <h2 className="text-[length:var(--rb-mk-h2)] leading-[1.1] font-bold tracking-[-0.028em] text-balance text-[var(--rb-fg-1)]">
            Drafts you&apos;d actually send
          </h2>
          <p className="mt-[18px] max-w-[52ch] text-[18px] text-[var(--rb-fg-3)]">
            The draft is grounded in what your team has already written, so it
            answers the specific complaint instead of thanking someone for their
            feedback.
          </p>
          <div className="mt-7 border-t border-[var(--rb-mk-line)]">
            {REPLY_POINTS.map((p, i) => (
              <Disclosure key={p.q} q={p.q} a={p.a} open={i === 0} />
            ))}
          </div>
        </div>

        <ul className="grid gap-3.5 rounded-[var(--rb-mk-r-frame)] border border-[var(--rb-mk-line)] bg-white p-8">
          {[
            ["Reviewer wrote", "“Crashes on iPad after 4.2.1 — the budgets tab freezes.”"],
            [
              "Draft came back",
              "“Thanks for flagging the iPad freeze on 4.2.1. We reproduced it this morning and a fix is rolling out this week.”",
            ],
            ["You did", "Read it, changed one word, clicked Post."],
          ].map(([label, body]) => (
            <li key={label}>
              <p className="mb-1.5 text-[11.5px] font-bold tracking-[0.12em] text-[var(--rb-mk-orange-text)] uppercase">
                {label}
              </p>
              <p className="text-[15.5px] leading-[1.55] text-[var(--rb-fg-1)]">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

function ReleaseDeepDive() {
  return (
    <Section className="bg-[var(--rb-mk-sunken)]">
      <div className="grid items-center gap-[60px] lg:grid-cols-2">
        {/* Visual first on desktop, second on mobile — the copy should lead
            when the two stack, or the reader meets a chart with no framing. */}
        <div className="order-2 lg:order-1">
          <figure className="rounded-[var(--rb-mk-r-frame)] border border-[var(--rb-mk-line)] bg-white px-7 py-6">
            {RELEASE_ROWS.map((r) => (
              <div
                key={r.version}
                className="flex items-center gap-[18px] border-b border-[var(--rb-mk-line)] py-[15px] last:border-b-0"
              >
                <span className="min-w-[54px] font-[family-name:var(--rb-font-mono)] text-[13px] font-semibold text-[var(--rb-fg-1)]">
                  {r.version}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--rb-mk-sunken)]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${r.share}%`,
                      background: `var(--rb-mk-sev-${r.step})`,
                    }}
                  />
                </span>
                <span
                  className={cn(
                    "min-w-[52px] text-right font-[family-name:var(--rb-font-mono)] text-[13px] font-semibold tabular-nums",
                    r.rising
                      ? "text-[var(--rb-green-600)]"
                      : "text-[var(--rb-red-600)]",
                  )}
                >
                  {r.delta}
                </span>
              </div>
            ))}
            <figcaption className="mt-4 text-[12px] text-[var(--rb-mk-ink-4)]">
              Share of reviews rated ≤2, by version · illustrative
            </figcaption>
          </figure>
        </div>
    <Band>
      <Section className={RHYTHM.md}>
        <Reveal>
          <SectionHeading
            eyebrow="Everything reviews touch"
            title="Built for the team that answers"
            lede="From the 1-star crash report to the feature request you'll ship next quarter: one place to see it, understand it, and respond."
          />
        </Reveal>

        <div className="order-1 lg:order-2">
          <Eyebrow>Release health</Eyebrow>
          <h2 className="text-[length:var(--rb-mk-h2)] leading-[1.1] font-bold tracking-[-0.028em] text-balance text-[var(--rb-fg-1)]">
            Catch the bad build on day one
          </h2>
          <p className="mt-[18px] max-w-[52ch] text-[18px] text-[var(--rb-fg-3)]">
            Ratings tracked per version, not per app. A regression shows up
            against the version that caused it, while you can still roll back.
          </p>
          <ul className="mt-[26px] grid gap-3.5">
            {RELEASE_POINTS.map((p) => (
              <li key={p} className="flex items-start gap-3 text-[16px] text-[var(--rb-fg-2)]">
                <Check
                  className="mt-1 size-[17px] shrink-0 text-[var(--rb-mk-orange-text)]"
                  strokeWidth={2}
                />
                {p}
              </li>
            ))}
          </ul>
          <div className="mt-7">
            <AmberLink href="/sign-up">Start your free trial</AmberLink>
          </div>
        </div>
      </div>
    </Section>
      </Section>
    </Band>
  );
}

function HowItWorks() {
  return (
    <Section>
      <SectionHead center eyebrow="How it works" title="Connected in a morning" />
      <div className="mt-[50px] grid gap-5 md:grid-cols-3">
        {STEPS.map((s) => (
          <Card key={s.n}>
            {/* Numbered because connect → triage → reply is a real sequence,
                not because three cards wanted decorating. */}
            <span className="mb-4 block border-b border-[var(--rb-mk-line)] pb-3.5 font-[family-name:var(--rb-font-mono)] text-[13px] font-semibold tracking-[0.08em] text-[var(--rb-fg-3)]">
              {s.n}
            </span>
            <h3 className="mb-2.5 text-[19px] leading-[1.3] font-bold tracking-[-0.015em] text-[var(--rb-fg-1)]">
              {s.title}
            </h3>
            <p className="text-[15.5px] leading-[1.55] text-[var(--rb-fg-3)]">{s.body}</p>
          </Card>
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

function Mechanics() {
  return (
    <section className="bg-[var(--rb-mk-night)] py-[clamp(66px,8vw,112px)] text-[#B9B3CC]">
      <div className="mx-auto w-full max-w-[1160px] px-5 sm:px-6">
        <div className="grid items-center gap-[60px] lg:grid-cols-2">
          <div>
            <span className="mb-4 block text-[12.5px] font-bold tracking-[0.13em] text-[#FFC344] uppercase">
              Why it exists
            </span>
            <h2 className="text-[length:var(--rb-mk-h2)] leading-[1.1] font-bold tracking-[-0.028em] text-balance text-white">
              Built by people who
              <br />
              answered the queue
            </h2>
            <p className="mt-[18px] max-w-[46ch] text-[17.5px]">
              ReviewBox exists because replying to store reviews properly used
              to mean two consoles, a spreadsheet and an afternoon.
            </p>
          </div>

          <dl className="border-t border-white/[0.13]">
            {MECHANICS.map((m) => (
              <div
                key={m.label}
                className="flex flex-wrap items-baseline gap-x-3 border-b border-white/[0.13] py-3.5 text-[14.5px]"
              >
                <dt className="min-w-[92px] font-semibold text-white">{m.label}</dt>
                <dd>{m.body}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
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

function Pricing() {
  const plans = [
    { key: "starter" as const, cta: "Start free trial", href: "/sign-up", highlight: false },
    { key: "pro" as const, cta: "Start free trial", href: "/sign-up", highlight: true },
    { key: "enterprise" as const, cta: "Contact sales", href: "/contact", highlight: false },
  ];

  return (
    <Section>
      <SectionHead
        center
        eyebrow="Pricing"
        title="Start free, pay when it earns it"
        body="Every plan begins with the same 14-day trial and none of them asks for a card up front."
      />
      <div className="mt-[50px] grid gap-5 md:grid-cols-3">
        {plans.map(({ key, cta, href, highlight }) => {
          const plan = PLAN_PRICING[key];
          return (
            <Card
              key={key}
              className={cn(
                "relative flex flex-col",
                highlight && "border-[var(--rb-mk-ink)] hover:border-[var(--rb-mk-ink)]",
              )}
            >
              {highlight && (
                <span className="absolute -top-[11px] left-[30px] rounded-full bg-[var(--rb-mk-amber-500)] px-3.5 py-1 text-[11px] font-bold tracking-[0.09em] text-[var(--rb-mk-ink)] uppercase">
                  Most popular
                </span>
              )}
              <span className="text-[12.5px] font-bold tracking-[0.13em] text-[var(--rb-mk-orange-text)] uppercase">
                {plan.label}
              </span>

              <p className="mt-4 mb-2 flex items-baseline gap-1.5">
                <span className="text-[42px] font-bold tracking-[-0.045em] text-[var(--rb-fg-1)]">
                  {plan.onRequest ? "Talk to us" : `$${plan.monthlyUsd}`}
                </span>
                {!plan.onRequest && (
                  <span className="text-[15px] font-medium text-[var(--rb-fg-3)]">/month</span>
                )}
              </p>
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

              <p className="min-h-[46px] text-[14.5px] leading-[1.5] text-[var(--rb-fg-3)]">
                {plan.tagline}
              </p>

              <ul className="mt-[22px] mb-7 grid gap-2.5 border-t border-[var(--rb-mk-line)] pt-[22px]">
                {PLAN_FEATURES[key].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-3 text-[14.5px] text-[var(--rb-fg-2)]"
                  >
                    <Check
                      className="mt-1 size-[17px] shrink-0 text-[var(--rb-mk-ink-4)]"
                      strokeWidth={1.8}
                    />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-auto [&>a]:w-full">
                {highlight ? (
                  <AmberLink href={href}>{cta}</AmberLink>
                ) : (
                  <LineLink href={href}>{cta}</LineLink>
                )}
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
            </Card>
          );
        })}
      </div>

      <p className="mt-[26px] text-center text-[14.5px] text-[var(--rb-fg-3)]">
        Annual billing brings {PLAN_PRICING.starter.label} to ${PLAN_PRICING.starter.annualUsd}
        /month and {PLAN_PRICING.pro.label} to ${PLAN_PRICING.pro.annualUsd}/month.
      </p>
    </Section>
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

function Faq() {
  return (
    <Section className="bg-[var(--rb-mk-sunken)]">
      <SectionHead center eyebrow="Questions" title="Before you start" />
      <div className="mx-auto mt-10 max-w-[760px] border-t border-[var(--rb-mk-line)]">
        {FAQS.map((f, i) => (
          <Disclosure key={f.q} q={f.q} a={f.a} open={i === 0} />
        ))}
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

function Closing() {
  return (
    <Section>
      <div className="rounded-[28px] border border-[var(--rb-mk-line)] rb-mesh-panel px-8 py-[clamp(48px,6vw,78px)] text-center">
        <h2 className="text-[length:var(--rb-mk-h2)] leading-[1.1] font-bold tracking-[-0.028em] text-balance text-[var(--rb-fg-1)]">
          Clear the queue this week
        </h2>
        <p className="mx-auto mt-[18px] max-w-[56ch] text-[18px] text-[var(--rb-fg-3)]">
          Connect an app in about two minutes and see your real reviews, tagged
          and drafted, before the trial clock matters.
        </p>
        <div className="mt-[34px] flex flex-wrap justify-center gap-3">
          <AmberLink href="/sign-up">Start free trial</AmberLink>
          <LineLink href="/contact">Book a walkthrough</LineLink>
        </div>
        <p className="mt-[18px] text-[14px] text-[var(--rb-fg-3)]">{TRIAL_NOTE}</p>
      </div>
    </Section>
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
        <ReplyDeepDive />
        <ReleaseDeepDive />
        <HowItWorks />
        <Mechanics />
        <Pricing />
        <Faq />
        <Closing />
      </main>
      <MarketingFooter />
    </MarketingShell>
  );
}
