"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Check,
  CheckCircle2,
  Inbox,
  Layers,
  MessageSquareOff,
  PenLine,
  Send,
  Timer,
  Workflow,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { ProductFrame } from "@/features/marketing/components/product-frame";

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

const PLANS = [
  {
    name: "Starter",
    price: "49",
    body: "Solo developers and single-app teams.",
    features: ["2 apps", "5,000 reviews / month", "50 AI drafts / day", "Email alerts"],
  },
  {
    name: "Pro",
    price: "99",
    body: "Product teams shipping more than one app.",
    popular: true,
    features: [
      "10 apps",
      "50,000 reviews / month",
      "200 AI drafts / day",
      "Incident detection",
      "Release health",
    ],
  },
  {
    name: "Team",
    price: "199",
    body: "App portfolios and larger support orgs.",
    features: [
      "Unlimited apps",
      "Unlimited reviews",
      "1,000 drafts / day",
      "Audit log",
      "Unlimited seats",
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

// ─── Shared bits ──────────────────────────────────────────────────────────────

function Section({
  children,
  className = "",
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`mx-auto w-full max-w-6xl px-5 sm:px-6 ${className}`}>
      {children}
    </section>
  );
}

/**
 * Scroll-reveal wrapper. SSR (and no-JS) renders content fully visible; on
 * mount, elements still below the fold are hidden and fade/slide in when they
 * intersect. Reduced-motion users always get the static page.
 */
function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const el = ref.current;
    if (!el) return;
    // Only animate elements that start below the viewport — anything already
    // on screen at load stays put (no first-paint flash).
    if (el.getBoundingClientRect().top <= window.innerHeight * 0.92) return;

    setHidden(true);
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHidden(false);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-out",
        hidden ? "translate-y-5 opacity-0" : "translate-y-0 opacity-100",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PrimaryLink({
  href,
  children,
  size = "lg",
}: {
  href: string;
  children: React.ReactNode;
  size?: "lg" | "md";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[var(--rb-blue-500)] font-semibold text-white shadow-[0_2px_8px_rgba(10,132,255,0.35)] transition-all hover:bg-[var(--rb-blue-600)] hover:shadow-[0_4px_14px_rgba(10,132,255,0.45)]",
        size === "lg" ? "h-12 px-7 text-[15px]" : "h-10 px-5 text-[14px]",
      )}
    >
      {children}
      <ArrowRight className="size-4" strokeWidth={2.5} />
    </Link>
  );
}

function SecondaryLink({
  href,
  children,
  size = "lg",
}: {
  href: string;
  children: React.ReactNode;
  size?: "lg" | "md";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center rounded-full border border-[var(--rb-border-2)] bg-surface font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)]",
        size === "lg" ? "h-12 px-7 text-[15px]" : "h-10 px-5 text-[14px]",
      )}
    >
      {children}
    </Link>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-semibold tracking-[0.02em] text-[var(--rb-blue-500)] uppercase">
      {children}
    </p>
  );
}

function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  lede?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3 text-[30px] leading-tight font-bold tracking-[-0.025em] text-fg-1 text-balance sm:text-[40px]">
        {title}
      </h2>
      {lede && <p className="mt-4 text-[16px] leading-relaxed text-fg-2 sm:text-[17px]">{lede}</p>}
    </div>
  );
}

function Stars({ rating, size = 11 }: { rating: number; size?: number }) {
  return (
    <span
      aria-label={`${rating} out of 5 stars`}
      className="leading-none"
      style={{ fontSize: size }}
    >
      <span className="text-[var(--rb-amber-500)]">{"★".repeat(rating)}</span>
      <span className="text-fg-4">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

/** Floating "rating trend" card — illustrative product UI, single-hue spark. */
function FloatCardTrend() {
  return (
    <div className="w-[190px] rounded-xl border border-[var(--rb-border-1)] bg-surface p-3.5 shadow-[var(--rb-shadow-lg)]">
      <p className="font-[family-name:var(--rb-font-mono)] text-[10px] tracking-wide text-fg-3 uppercase">
        Avg rating · 30 days
      </p>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-[22px] font-bold tracking-[-0.02em] text-fg-1">4.6</span>
        <span className="text-[11px] font-medium text-[var(--rb-green-500)]">+0.3</span>
      </div>
      <svg viewBox="0 0 160 36" className="mt-2 h-9 w-full" aria-hidden="true">
        <polyline
          points="0,26 22,24 44,28 66,20 88,22 110,14 132,12 156,6"
          fill="none"
          stroke="var(--rb-blue-500)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="156" cy="6" r="3" fill="var(--rb-blue-500)" />
      </svg>
    </div>
  );
}

/** Floating alert toast — status color carried by icon + label, not color alone. */
function FloatCardAlert() {
  return (
    <div className="flex w-[230px] items-start gap-2.5 rounded-xl border border-[var(--rb-border-1)] bg-surface p-3.5 shadow-[var(--rb-shadow-lg)]">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--rb-red-100)]">
        <AlertTriangle className="size-3.5 text-[var(--rb-red-600)]" strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-fg-1">Rating spike detected</p>
        <p className="mt-0.5 text-[11px] leading-snug text-fg-3">
          6 one-star reviews on v4.2.1 in the last 24h
        </p>
      </div>
    </div>
  );
}

/** Floating success toast. */
function FloatCardPosted() {
  return (
    <div className="flex w-[210px] items-center gap-2.5 rounded-xl border border-[var(--rb-border-1)] bg-surface p-3.5 shadow-[var(--rb-shadow-lg)]">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--rb-green-100)]">
        <CheckCircle2 className="size-3.5 text-[var(--rb-green-600)]" strokeWidth={2} />
      </span>
      <p className="text-[12px] font-semibold text-fg-1">Reply posted to App Store</p>
    </div>
  );
}

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
        <p className="mx-auto flex w-fit items-center gap-2 rounded-full border border-[var(--rb-border-1)] bg-surface px-3.5 py-1.5 text-[12.5px] font-medium text-fg-2 shadow-[var(--rb-shadow-xs)]">
          <span className="size-2 rounded-full bg-[var(--rb-green-500)]" />
          Syncing the App Store and Google Play
        </p>

        <h1 className="mx-auto mt-7 max-w-[22ch] text-[clamp(40px,6vw,68px)] leading-[1.05] font-bold tracking-[-0.035em] text-fg-1 text-balance">
          Every app review answered.{" "}
          <span className="text-[var(--rb-blue-500)]">In your voice.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-[54ch] text-[17px] leading-relaxed text-fg-2 sm:text-[19px]">
          ReviewBox pulls your App Store and Google Play reviews into one inbox,
          drafts replies you&apos;d actually send, and posts them back to the
          store before a bad week becomes a bad rating.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <PrimaryLink href="/sign-up">Start free trial</PrimaryLink>
          <SecondaryLink href="#see-it-work">See it work</SecondaryLink>
        </div>

        <p className="mt-5 text-[13px] text-fg-3">
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
          <div className="relative">
            <ProductFrame id="see-it-work" />
            <div aria-hidden="true" className="absolute -left-10 top-16 hidden -rotate-3 xl:block">
              <FloatCardTrend />
            </div>
            <div aria-hidden="true" className="absolute -right-12 top-8 hidden rotate-2 xl:block">
              <FloatCardAlert />
            </div>
            <div aria-hidden="true" className="absolute -right-8 bottom-14 hidden rotate-1 xl:block">
              <FloatCardPosted />
            </div>
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
                <span className="block text-[24px] font-bold tracking-[-0.02em] text-fg-1">
                  {s.value}
                </span>
                <span className="mt-1 block text-[12.5px] leading-snug text-fg-3">{s.label}</span>
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
    <Section className="py-20 sm:py-24">
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
              <h3 className="mt-4 text-[16px] font-semibold text-fg-1">{p.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{p.body}</p>
            </div>
          </Reveal>
        ))}
      </div>

      <Reveal delay={200}>
        <p className="mx-auto mt-10 max-w-[46ch] text-center text-[17px] font-medium text-fg-1">
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
        <h3 className="text-[16px] font-semibold text-fg-1">{title}</h3>
      </div>
      <p className="mt-2.5 text-[14px] leading-relaxed text-fg-2">{body}</p>
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
          <span className="min-w-0 truncate text-[12.5px] font-medium text-fg-1">{r.title}</span>
          <span className="ml-auto hidden shrink-0 rounded bg-surface px-1.5 py-px font-[family-name:var(--rb-font-mono)] text-[9.5px] text-fg-3 sm:block">
            {r.tag}
          </span>
          <span className="shrink-0">
            <Stars rating={r.rating} size={10} />
          </span>
          <span className="hidden shrink-0 font-[family-name:var(--rb-font-mono)] text-[9.5px] text-fg-4 md:block">
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
        <span className="truncate text-[11.5px] font-medium text-fg-1">
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
          <span className="w-[110px] shrink-0 truncate text-[11.5px] text-fg-2">{t.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
            <div
              className="h-full rounded-full bg-[var(--rb-blue-500)]"
              style={{ width: `${t.pct * 2.4}%` }}
            />
          </div>
          <span className="w-8 shrink-0 text-right font-[family-name:var(--rb-font-mono)] text-[10.5px] text-fg-3">
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
    "rounded-md border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-2 py-1 font-[family-name:var(--rb-font-mono)] text-[10.5px] text-fg-2";
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
        <span className="text-[10.5px] text-fg-4">→ App Store Connect</span>
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
    <div className="bg-[var(--rb-bg-sunken)]">
      <Section className="py-20 sm:py-24">
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
    </div>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <Section className="py-20 sm:py-24">
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
              <h3 className="mt-4 text-[16px] font-semibold text-fg-1">{s.title}</h3>
              <p className="mx-auto mt-1.5 max-w-[34ch] text-[14px] leading-relaxed text-fg-2">
                {s.body}
              </p>
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
          <span className="font-[family-name:var(--rb-font-mono)] text-[10.5px] tracking-wide text-fg-3 uppercase">
            {DEMO_REVIEW.meta}
          </span>
          <Stars rating={1} size={12} />
        </div>
        <p className="mt-2.5 text-[14px] font-semibold text-fg-1">{DEMO_REVIEW.title}</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-fg-2">{DEMO_REVIEW.body}</p>
      </div>
      <div className="bg-[var(--rb-bg-sunken)] p-5">
        <span className="font-[family-name:var(--rb-font-mono)] text-[10.5px] tracking-wide text-fg-3 uppercase">
          Suggested reply · your voice
        </span>
        <p className="mt-2 min-h-[4.2rem] text-[13.5px] leading-relaxed text-fg-1">
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
    <div className="bg-[var(--rb-bg-sunken)]">
      <Section className="py-20 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <div>
              <Eyebrow>AI replies</Eyebrow>
              <h2 className="mt-3 max-w-[18ch] text-[30px] leading-tight font-bold tracking-[-0.025em] text-fg-1 sm:text-[38px]">
                Drafts that sound like you wrote them
              </h2>
              <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-fg-2">
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
                  <li key={li} className="flex items-start gap-2.5 text-[14.5px] text-fg-2">
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
    </div>
  );
}

// ─── Release-health deep-dive ─────────────────────────────────────────────────

function ReleaseHealthCard() {
  const releases = [
    { v: "4.2.1", status: "Regressing", delta: "−0.8★", rollout: 46, alert: true },
    { v: "4.2.0", status: "Healthy", delta: "+0.1★", rollout: 100, alert: false },
    { v: "4.1.9", status: "Healthy", delta: "+0.2★", rollout: 100, alert: false },
  ];
  return (
    <div
      aria-label="Release health: version 4.2.1 flagged as regressing with an alert sent"
      className="overflow-hidden rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-md)]"
    >
      <div className="flex items-center justify-between border-b border-[var(--rb-border-1)] px-5 py-3.5">
        <span className="text-[13px] font-semibold text-fg-1">Release health</span>
        <span className="font-[family-name:var(--rb-font-mono)] text-[10.5px] text-fg-3">
          last 3 versions
        </span>
      </div>
      <div>
        {releases.map((r) => (
          <div
            key={r.v}
            className="flex items-center gap-3 border-b border-[var(--rb-border-1)] px-5 py-3.5 last:border-b-0"
          >
            <span className="w-12 shrink-0 font-[family-name:var(--rb-font-mono)] text-[12px] font-medium text-fg-1">
              {r.v}
            </span>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
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
            <span className="ml-1 shrink-0 font-[family-name:var(--rb-font-mono)] text-[11.5px] text-fg-2">
              {r.delta}
            </span>
            <div className="ml-auto hidden h-1.5 w-20 overflow-hidden rounded-full bg-[var(--rb-bg-sunken)] sm:block">
              <div
                className="h-full rounded-full bg-[var(--rb-blue-500)]"
                style={{ width: `${r.rollout}%` }}
              />
            </div>
            <span className="hidden w-9 shrink-0 text-right font-[family-name:var(--rb-font-mono)] text-[10.5px] text-fg-3 sm:block">
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
    <Section className="py-20 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <Reveal className="lg:order-2">
          <div>
            <Eyebrow>Release monitoring</Eyebrow>
            <h2 className="mt-3 max-w-[20ch] text-[30px] leading-tight font-bold tracking-[-0.025em] text-fg-1 sm:text-[38px]">
              Know a bad release before your rating does
            </h2>
            <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-fg-2">
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
                <li key={li} className="flex items-start gap-2.5 text-[14.5px] text-fg-2">
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
    <div className="bg-[var(--rb-bg-sunken)]">
      <Section className="py-20 sm:py-24">
        <Reveal>
          <SectionHeading
            eyebrow="Pricing"
            title="Simple pricing, no surprises"
            lede="Every plan starts with the same 14-day trial, and no plan asks for a card up front."
          />
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
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
                <h3 className="text-[15px] font-semibold text-fg-1">{plan.name}</h3>
                <p className="mt-3">
                  <span className="text-[38px] font-bold tracking-[-0.03em] text-fg-1">
                    ${plan.price}
                  </span>
                  <span className="ml-1.5 text-[14px] text-fg-3">/ month</span>
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-fg-2">{plan.body}</p>
                <ul className="mt-5 flex-1 space-y-2 border-t border-[var(--rb-border-1)] pt-5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[13.5px] text-fg-2">
                      <Check
                        className="size-3.5 shrink-0 text-[var(--rb-green-500)]"
                        strokeWidth={2.5}
                      />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className={cn(
                    "mt-6 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-full text-[14px] font-semibold transition-colors",
                    plan.popular
                      ? "bg-[var(--rb-blue-500)] text-white hover:bg-[var(--rb-blue-600)]"
                      : "border border-[var(--rb-border-3)] text-fg-1 hover:bg-[var(--rb-bg-hover)]",
                  )}
                >
                  Start free trial
                  <ArrowRight className="size-3.5" strokeWidth={2.25} />
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <p className="mt-10 text-center text-[14px] text-fg-3">
            <Link
              href="/pricing"
              className="font-medium text-[var(--rb-blue-500)] hover:underline"
            >
              Full plan comparison →
            </Link>
          </p>
        </Reveal>
      </Section>
    </div>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────

function Faq() {
  return (
    <Section className="py-20 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
        <Reveal>
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <h2 className="mt-3 max-w-[14ch] text-[30px] leading-tight font-bold tracking-[-0.025em] text-fg-1 sm:text-[38px]">
              Questions, answered straight
            </h2>
            <p className="mt-4 max-w-[38ch] text-[15px] leading-relaxed text-fg-2">
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
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-fg-1 [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <span
                    aria-hidden="true"
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border border-[var(--rb-border-2)] text-fg-3 transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-[62ch] text-[14px] leading-relaxed text-fg-2">{f.a}</p>
              </details>
            ))}
          </div>
        </Reveal>
      </div>
    </Section>
  );
}

// ─── Closing CTA band ─────────────────────────────────────────────────────────

function Closing() {
  return (
    <Section className="pb-20 sm:pb-24">
      <Reveal>
        <div
          className="relative overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20"
          style={{
            background:
              "linear-gradient(135deg, var(--rb-blue-500) 0%, var(--rb-blue-700) 100%)",
          }}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              maskImage: "radial-gradient(60% 80% at 50% 0%, black 0%, transparent 100%)",
              WebkitMaskImage:
                "radial-gradient(60% 80% at 50% 0%, black 0%, transparent 100%)",
            }}
          />
          <h2 className="relative mx-auto max-w-[24ch] text-[28px] leading-tight font-bold tracking-[-0.025em] text-white text-balance sm:text-[38px]">
            Your reviews are already waiting. Answer them today.
          </h2>
          <p className="relative mx-auto mt-4 max-w-[44ch] text-[15.5px] leading-relaxed text-white/85">
            Connect an app and see your real reviews in about a minute. Free for
            14 days on every plan. No credit card, no sales call.
          </p>
          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex h-12 items-center gap-1.5 rounded-full bg-white px-7 text-[15px] font-semibold text-[var(--rb-blue-600)] shadow-[0_4px_16px_rgba(0,0,0,0.15)] transition-transform hover:scale-[1.02]"
            >
              Start free trial
              <ArrowRight className="size-4" strokeWidth={2.5} />
            </Link>
            <Link
              href="/help"
              className="inline-flex h-12 items-center rounded-full border border-white/40 px-7 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </Reveal>
    </Section>
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
