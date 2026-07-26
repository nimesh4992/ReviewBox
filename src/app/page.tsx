"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";

/**
 * Landing page.
 *
 * Every claim on this page has to be something the product actually does
 * today — see the build-status table in CLAUDE.md. No customer logos, no
 * counts of users we don't have, no metrics we haven't measured. If a
 * capability below stops being true, the copy comes out.
 */

// ─── Content ──────────────────────────────────────────────────────────────────

const CAPABILITIES = [
  {
    title: "One inbox, both stores",
    body: "App Store and Play Store reviews land in a single queue, tagged and ranked so the ones that cost you installs sit at the top.",
  },
  {
    title: "Replies drafted in your voice",
    body: "Drafts are grounded in your own templates and knowledge base — not a generic model guess. You edit, you send, and it posts back to the store.",
  },
  {
    title: "Alerts before it snowballs",
    body: "A cluster of one-star reviews against the same release raises an alert while you can still ship a fix, not after the rating has already moved.",
  },
  {
    title: "Release and sentiment tracking",
    body: "Every review is tied to the version it landed on, and recurring topics are tracked over time so you can see what's actually dragging the rating.",
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
  rating: 1,
  title: "Crashes on iPad after 4.2.1",
  body: "Every time I open the budgets tab on iPad it freezes for five to ten seconds. Started after the last update. I use this daily for my small business.",
  meta: "App Store · iOS · v4.2.1",
};

const DEMO_DRAFT =
  "Thanks for flagging the iPad freeze on 4.2.1 — we reproduced it this morning and a fix is rolling out this week. In the meantime, force-quitting and reopening restores the session. I'll follow up here the moment 4.2.2 lands.";

// ─── Utilities ────────────────────────────────────────────────────────────────

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto w-full max-w-5xl px-6 ${className}`}>
      {children}
    </section>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center rounded-lg bg-[var(--rb-blue-500)] px-5 text-[15px] font-medium text-white transition-colors hover:bg-[var(--rb-blue-600)]"
    >
      {children}
    </Link>
  );
}

function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-11 items-center rounded-lg border border-[var(--rb-border-2)] px-5 text-[15px] font-medium text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)]"
    >
      {children}
    </Link>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <header className="mx-auto w-full max-w-5xl px-6 pt-24 pb-20 sm:pt-32 sm:pb-28">
      <h1 className="max-w-3xl font-[family-name:var(--rb-font-display)] text-[44px] leading-[1.05] font-bold tracking-[-0.03em] text-fg-1 sm:text-[64px]">
        Stop managing app reviews in a spreadsheet.
      </h1>

      <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-fg-2">
        ReviewBox pulls every App Store and Play Store review into one queue,
        drafts a reply in your voice, and posts it back to the store.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <PrimaryLink href="/sign-up">Start free</PrimaryLink>
        <SecondaryLink href="/pricing">See pricing</SecondaryLink>
      </div>

      <p className="mt-5 text-[13px] text-fg-3">
        14-day trial · no credit card required
      </p>
    </header>
  );
}

// ─── Reply demo ───────────────────────────────────────────────────────────────

/**
 * Types the draft out on mount. This mirrors what the product does — a draft
 * written against a real review — rather than asserting a number we'd have to
 * stand behind.
 *
 * Deliberately not gated on scroll position: the text is server-rendered in
 * full and only *replayed* as an animation, so it stays readable with JS off,
 * with reduced motion on, or if the reader lands mid-page from an anchor.
 */
function ReplyDemo() {
  const [typed, setTyped] = useState(DEMO_DRAFT);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setTyped(DEMO_DRAFT.slice(0, i));
      if (i >= DEMO_DRAFT.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--rb-border-1)] bg-surface">
      {/* The review */}
      <div className="border-b border-[var(--rb-border-1)] p-6">
        <div className="flex items-center justify-between gap-4">
          <span className="font-[family-name:var(--rb-font-mono)] text-[11px] tracking-wide text-fg-3 uppercase">
            {DEMO_REVIEW.meta}
          </span>
          <span aria-label={`${DEMO_REVIEW.rating} out of 5 stars`} className="text-[13px] text-fg-3">
            <span className="text-[var(--rb-amber-500)]">{"★".repeat(DEMO_REVIEW.rating)}</span>
            {"★".repeat(5 - DEMO_REVIEW.rating)}
          </span>
        </div>
        <h3 className="mt-3 text-[15px] font-semibold text-fg-1">{DEMO_REVIEW.title}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-fg-2">{DEMO_REVIEW.body}</p>
      </div>

      {/* The draft */}
      <div className="bg-[var(--rb-bg-sunken)] p-6">
        <span className="font-[family-name:var(--rb-font-mono)] text-[11px] tracking-wide text-fg-3 uppercase">
          Suggested reply
        </span>
        {/* min-height reserves the two lines the finished draft occupies on a
            wide viewport, so the card doesn't grow while the text types in. */}
        <p className="mt-3 min-h-[3rem] text-[14px] leading-relaxed text-fg-1">
          {typed}
          {typed.length < DEMO_DRAFT.length && (
            <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-[var(--rb-blue-500)] align-baseline" />
          )}
        </p>
      </div>
    </div>
  );
}

// ─── Capabilities ─────────────────────────────────────────────────────────────

function Capabilities() {
  return (
    <Section className="py-24 sm:py-28">
      <h2 className="max-w-2xl font-[family-name:var(--rb-font-display)] text-[32px] leading-tight font-bold tracking-[-0.025em] text-fg-1 sm:text-[40px]">
        What it does
      </h2>

      <div className="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
        {CAPABILITIES.map((c) => (
          <div key={c.title}>
            <h3 className="text-[16px] font-semibold text-fg-1">{c.title}</h3>
            <p className="mt-2 text-[15px] leading-relaxed text-fg-2">{c.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <Section className="py-24 sm:py-28">
      <h2 className="font-[family-name:var(--rb-font-display)] text-[32px] leading-tight font-bold tracking-[-0.025em] text-fg-1 sm:text-[40px]">
        Pricing
      </h2>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg-2">
        Every plan starts with the same 14-day trial, and no plan asks for a card
        up front.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border p-6 ${
              plan.popular
                ? "border-[var(--rb-blue-500)] bg-surface"
                : "border-[var(--rb-border-1)] bg-surface"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <h3 className="text-[15px] font-semibold text-fg-1">{plan.name}</h3>
              {plan.popular && (
                <span className="font-[family-name:var(--rb-font-mono)] text-[10px] tracking-wider text-[var(--rb-blue-500)] uppercase">
                  Most picked
                </span>
              )}
            </div>

            <p className="mt-4">
              <span className="font-[family-name:var(--rb-font-display)] text-[36px] font-bold tracking-[-0.03em] text-fg-1">
                ${plan.price}
              </span>
              <span className="ml-1 text-[14px] text-fg-3">/ month</span>
            </p>

            <p className="mt-3 text-[14px] leading-relaxed text-fg-2">{plan.body}</p>

            <ul className="mt-6 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="text-[14px] text-fg-2">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-8 text-[14px] text-fg-3">
        <Link href="/pricing" className="text-[var(--rb-blue-500)] hover:underline">
          Full plan comparison
        </Link>
      </p>
    </Section>
  );
}

// ─── Closing ──────────────────────────────────────────────────────────────────

function Closing() {
  return (
    <Section className="border-t border-[var(--rb-border-1)] py-24 sm:py-28">
      <h2 className="max-w-2xl font-[family-name:var(--rb-font-display)] text-[32px] leading-tight font-bold tracking-[-0.025em] text-fg-1 sm:text-[40px]">
        Connect an app and see your real reviews in about a minute.
      </h2>
      <div className="mt-9 flex flex-wrap items-center gap-3">
        <PrimaryLink href="/sign-up">Start free</PrimaryLink>
        <SecondaryLink href="/help">Read the docs</SecondaryLink>
      </div>
    </Section>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <MarketingShell>
      <MarketingNav />
      <main>
        <Hero />
        <Section className="pb-24 sm:pb-28">
          <ReplyDemo />
        </Section>
        <Capabilities />
        <Pricing />
        <Closing />
      </main>
      <MarketingFooter />
    </MarketingShell>
  );
}
