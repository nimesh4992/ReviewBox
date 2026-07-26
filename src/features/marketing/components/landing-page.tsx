"use client";

import React from "react";
import Link from "next/link";

import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { ProductFrame } from "@/features/marketing/components/product-frame";

/**
 * Homepage, Direction A: product-forward light.
 *
 * The product frame is the hero image; an editorial serif (Newsreader) carries
 * the headlines; body copy stays on the system sans; mono is reserved for
 * labels and data. One interactive accent — brand blue.
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

// ─── Utilities ────────────────────────────────────────────────────────────────

function Section({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mx-auto w-full max-w-5xl px-5 sm:px-6 ${className}`}>
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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-serif text-[32px] leading-[1.1] font-medium tracking-[-0.01em] text-fg-1 sm:text-[40px]">
      {children}
    </h2>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <header className="mx-auto w-full max-w-5xl px-5 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
      <h1 className="mx-auto max-w-[21ch] font-serif text-[clamp(42px,7vw,72px)] leading-[1.06] font-medium tracking-[-0.015em] text-fg-1 text-balance">
        Your <em>worst</em> review deserves your <em>best</em> reply.
      </h1>

      <p className="mx-auto mt-6 max-w-[46ch] text-[17px] leading-relaxed text-fg-2 sm:text-[18px]">
        Every App Store and Google Play review in one inbox, answered in your
        voice — and posted back to the store.
      </p>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        <PrimaryLink href="/sign-up">Start free</PrimaryLink>
        <SecondaryLink href="#see-it-work">See it work ↓</SecondaryLink>
      </div>

      <p className="mt-5 text-[13px] text-fg-3">
        14-day trial · no credit card required
      </p>
    </header>
  );
}

// ─── Capabilities ─────────────────────────────────────────────────────────────

function Capabilities() {
  return (
    <Section className="py-24 sm:py-28">
      <SectionHeading>What it does</SectionHeading>

      <div className="mt-10 grid gap-x-12 sm:grid-cols-2">
        {CAPABILITIES.map((c) => (
          <div key={c.title} className="border-t border-[var(--rb-border-2)] py-7">
            <h3 className="text-[15.5px] font-semibold text-fg-1">{c.title}</h3>
            <p className="mt-2 text-[14.5px] leading-relaxed text-fg-2">{c.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────

function Pricing() {
  return (
    <Section className="pb-24 sm:pb-28">
      <SectionHeading>Pricing</SectionHeading>
      <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg-2">
        Every plan starts with the same 14-day trial, and no plan asks for a
        card up front.
      </p>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className={`rounded-xl border bg-surface p-6 ${
              plan.popular
                ? "border-[var(--rb-blue-500)] shadow-[var(--rb-shadow-sm)]"
                : "border-[var(--rb-border-2)]"
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
              <span className="font-serif text-[40px] font-medium tracking-[-0.01em] text-fg-1">
                ${plan.price}
              </span>
              <span className="ml-1.5 text-[13px] text-fg-3">/ month</span>
            </p>

            <p className="mt-2 text-[13.5px] leading-relaxed text-fg-2">{plan.body}</p>

            <ul className="mt-5 space-y-2 border-t border-[var(--rb-border-1)] pt-5">
              {plan.features.map((f) => (
                <li key={f} className="text-[13.5px] text-fg-2">
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
    <Section className="pb-28 sm:pb-32">
      <div className="border-t border-[var(--rb-border-2)] pt-20 text-center sm:pt-24">
        <h2 className="mx-auto max-w-[22ch] font-serif text-[34px] leading-[1.1] font-medium tracking-[-0.01em] text-fg-1 text-balance sm:text-[44px]">
          Connect an app and see your real reviews in about a minute.
        </h2>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <PrimaryLink href="/sign-up">Start free</PrimaryLink>
          <SecondaryLink href="/help">Read the docs</SecondaryLink>
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
        <Section>
          <ProductFrame id="see-it-work" />
        </Section>
        <Capabilities />
        <Pricing />
        <Closing />
      </main>
      <MarketingFooter />
    </MarketingShell>
  );
}
