"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart2,
  Inbox,
  Send,
  Sparkles,
  Workflow,
  Rocket,
} from "lucide-react";

import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { ProductFrame } from "@/features/marketing/components/product-frame";

/**
 * Homepage — conventional, conversion-focused SaaS (Stripe/Intercom register):
 * bold sans headlines, the product UI as the hero image, an icon feature grid,
 * a three-step how-it-works, one deep-dive demo section, pricing, and a
 * closing CTA band. Gradient accents are used sparingly and stay in the
 * brand-blue family.
 *
 * Every claim on this page has to be something the product actually does
 * today. No customer logos, no counts of users we don't have, no invented
 * metrics or testimonials. If a capability below stops being true, the copy
 * comes out.
 */

// ─── Content ──────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Inbox,
    title: "One inbox, both stores",
    body: "App Store and Google Play reviews in a single queue — tagged, prioritized, searchable.",
  },
  {
    icon: Sparkles,
    title: "Replies in your voice",
    body: "Drafts grounded in your templates and knowledge base, not a generic model guess. You edit, you approve.",
  },
  {
    icon: Send,
    title: "Post straight to the store",
    body: "One click sends the reply through App Store Connect or the Play Console API. No tab-switching.",
  },
  {
    icon: AlertTriangle,
    title: "Catch bad releases early",
    body: "A cluster of 1-star reviews on one version raises an alert while a fix can still ship.",
  },
  {
    icon: BarChart2,
    title: "Sentiment & topics",
    body: "Recurring complaints tracked over time, tied to the release they arrived on.",
  },
  {
    icon: Workflow,
    title: "Automations",
    body: "Rules that tag, prioritize, and pre-draft replies for new reviews as they sync.",
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
    body: "Reviews arrive tagged and ranked — crashes and billing complaints float to the top, praise sorts itself.",
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
    features: ["10 apps", "50,000 reviews / month", "200 AI drafts / day", "Incident detection", "Release health"],
  },
  {
    name: "Team",
    price: "199",
    body: "App portfolios and larger support orgs.",
    features: ["Unlimited apps", "Unlimited reviews", "1,000 drafts / day", "Audit log", "Unlimited seats"],
  },
];

const DEMO_REVIEW = {
  title: "Crashes on iPad after 4.2.1",
  body: "Every time I open the budgets tab on iPad it freezes. Started after the last update. I use this daily for my small business.",
  meta: "App Store · iOS · v4.2.1",
};

const DEMO_DRAFT =
  "Thanks for flagging the iPad freeze on 4.2.1 — we reproduced it this morning and a fix is rolling out this week. I'll follow up here the moment it lands.";

// ─── Shared bits ──────────────────────────────────────────────────────────────

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto w-full max-w-6xl px-5 sm:px-6 ${className}`}>
      {children}
    </section>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center gap-1.5 rounded-full bg-[var(--rb-blue-500)] px-6 text-[15px] font-semibold text-white shadow-[0_2px_8px_rgba(10,132,255,0.35)] transition-all hover:bg-[var(--rb-blue-600)] hover:shadow-[0_4px_14px_rgba(10,132,255,0.4)]"
    >
      {children}
      <ArrowRight className="size-4" strokeWidth={2.5} />
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center rounded-full border border-[var(--rb-border-2)] bg-surface px-6 text-[15px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)]"
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

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <header className="relative overflow-hidden">
      {/* Soft brand-blue wash — the one gradient flourish on the page */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[560px]"
        style={{
          background:
            "radial-gradient(58% 100% at 50% 0%, rgba(10,132,255,0.10) 0%, rgba(10,132,255,0.04) 45%, transparent 100%)",
        }}
      />

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-20 pb-14 text-center sm:px-6 sm:pt-24">
        <h1 className="mx-auto max-w-[24ch] text-[clamp(38px,5.5vw,60px)] leading-[1.08] font-bold tracking-[-0.03em] text-fg-1 text-balance">
          Answer every app review — in your voice, in minutes.
        </h1>

        <p className="mx-auto mt-6 max-w-[52ch] text-[17px] leading-relaxed text-fg-2 sm:text-[19px]">
          ReviewBox pulls your App Store and Google Play reviews into one inbox,
          drafts replies you&apos;d actually send, and posts them back to the store.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <PrimaryLink href="/sign-up">Start free</PrimaryLink>
          <SecondaryLink href="/pricing">See pricing</SecondaryLink>
        </div>

        <p className="mt-5 text-[13px] text-fg-3">
          14-day free trial · no credit card required
        </p>

        {/* The product is the hero image */}
        <div className="mt-14 text-left">
          <ProductFrame id="see-it-work" />
        </div>

        {/* Factual platform row — where a logo wall would go if we were the
            kind of company that invents one */}
        <p className="mt-8 text-[13px] font-medium text-fg-3">
          Works with the App Store and Google Play — sync, triage, and replies for both.
        </p>
      </div>
    </header>
  );
}

// ─── Feature grid ─────────────────────────────────────────────────────────────

function Features() {
  return (
    <Section className="py-20 sm:py-24">
      <div className="mx-auto max-w-2xl text-center">
        <Eyebrow>Everything reviews touch</Eyebrow>
        <h2 className="mt-3 text-[30px] leading-tight font-bold tracking-[-0.025em] text-fg-1 sm:text-[38px]">
          Built for the team that answers
        </h2>
        <p className="mt-4 text-[16px] leading-relaxed text-fg-2">
          From the 1-star crash report to the feature request you&apos;ll ship next
          quarter — one place to see it, understand it, and respond.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-2xl border border-[var(--rb-border-1)] bg-surface p-6 shadow-[var(--rb-shadow-xs)] transition-shadow hover:shadow-[var(--rb-shadow-sm)]"
          >
            <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--rb-blue-50)]">
              <f.icon className="size-5 text-[var(--rb-blue-500)]" strokeWidth={1.75} />
            </div>
            <h3 className="mt-4 text-[16px] font-semibold text-fg-1">{f.title}</h3>
            <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{f.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <div className="bg-[var(--rb-bg-sunken)]">
      <Section className="py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 text-[30px] leading-tight font-bold tracking-[-0.025em] text-fg-1 sm:text-[38px]">
            From signup to first reply in about a minute
          </h2>
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="text-center sm:text-left">
              <div className="mx-auto flex size-9 items-center justify-center rounded-full bg-[var(--rb-blue-500)] text-[15px] font-bold text-white sm:mx-0">
                {s.n}
              </div>
              <h3 className="mt-4 text-[16px] font-semibold text-fg-1">{s.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{s.body}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
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
          <span aria-label="1 out of 5 stars" className="text-[12px]">
            <span className="text-[var(--rb-amber-500)]">★</span>
            <span className="text-fg-4">★★★★</span>
          </span>
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
    <Section className="py-20 sm:py-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div>
          <Eyebrow>AI replies</Eyebrow>
          <h2 className="mt-3 max-w-[18ch] text-[30px] leading-tight font-bold tracking-[-0.025em] text-fg-1 sm:text-[38px]">
            Drafts that sound like you wrote them
          </h2>
          <p className="mt-4 max-w-[50ch] text-[16px] leading-relaxed text-fg-2">
            Every draft is grounded in your own reply templates and knowledge
            base — refund policy, known issues, tone — so it answers the actual
            complaint instead of apologizing generically. You always review
            before anything posts.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Four tones: professional, empathetic, casual, direct",
              "Grounded in your templates and knowledge base",
              "Translate and reply across languages",
              "Nothing posts without your click",
            ].map((li) => (
              <li key={li} className="flex items-start gap-2.5 text-[14.5px] text-fg-2">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-[var(--rb-blue-500)]" />
                {li}
              </li>
            ))}
          </ul>
        </div>
        <ReplyDemoCard />
      </div>
    </Section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <div className="bg-[var(--rb-bg-sunken)]">
      <Section className="py-20 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Pricing</Eyebrow>
          <h2 className="mt-3 text-[30px] leading-tight font-bold tracking-[-0.025em] text-fg-1 sm:text-[38px]">
            Simple pricing, no surprises
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-fg-2">
            Every plan starts with the same 14-day trial, and no plan asks for a
            card up front.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border bg-surface p-6 ${
                plan.popular
                  ? "border-[var(--rb-blue-500)] shadow-[var(--rb-shadow-md)]"
                  : "border-[var(--rb-border-1)] shadow-[var(--rb-shadow-xs)]"
              }`}
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
              <ul className="mt-5 space-y-2 border-t border-[var(--rb-border-1)] pt-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13.5px] text-fg-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-[var(--rb-green-500)]" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-[14px] text-fg-3">
          <Link href="/pricing" className="font-medium text-[var(--rb-blue-500)] hover:underline">
            Full plan comparison →
          </Link>
        </p>
      </Section>
    </div>
  );
}

// ─── Closing CTA band ─────────────────────────────────────────────────────────

function Closing() {
  return (
    <Section className="py-20 sm:py-24">
      <div
        className="overflow-hidden rounded-3xl px-6 py-16 text-center sm:py-20"
        style={{
          background:
            "linear-gradient(135deg, var(--rb-blue-500) 0%, var(--rb-blue-700) 100%)",
        }}
      >
        <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-white/15">
          <Rocket className="size-5 text-white" strokeWidth={1.75} />
        </div>
        <h2 className="mx-auto mt-5 max-w-[24ch] text-[28px] leading-tight font-bold tracking-[-0.025em] text-white text-balance sm:text-[36px]">
          Connect an app and see your real reviews in about a minute
        </h2>
        <p className="mx-auto mt-4 max-w-[44ch] text-[15.5px] leading-relaxed text-white/85">
          Free for 14 days on every plan. No credit card, no sales call — your
          reviews are already waiting.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/sign-up"
            className="inline-flex h-11 items-center gap-1.5 rounded-full bg-white px-6 text-[15px] font-semibold text-[var(--rb-blue-600)] transition-transform hover:scale-[1.02]"
          >
            Start free
            <ArrowRight className="size-4" strokeWidth={2.5} />
          </Link>
          <Link
            href="/help"
            className="inline-flex h-11 items-center rounded-full border border-white/40 px-6 text-[15px] font-semibold text-white transition-colors hover:bg-white/10"
          >
            Read the docs
          </Link>
        </div>
      </div>
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
        <Features />
        <HowItWorks />
        <ReplyDeepDive />
        <Pricing />
        <Closing />
      </main>
      <MarketingFooter />
    </MarketingShell>
  );
}
