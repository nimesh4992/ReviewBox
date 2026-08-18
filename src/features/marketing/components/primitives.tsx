"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";

import { cn } from "@/lib/utils";
// Not re-exported: a Server Component importing a plain value THROUGH this
// "use client" module receives a client reference, not the object. See
// ../rhythm.ts for the full story.
import { RHYTHM } from "@/features/marketing/rhythm";

/**
 * The marketing design system, in one file.
 *
 * Why this exists
 * ───────────────
 * The site had two design languages. The homepage used --rb-* tokens, a
 * hand-tuned type scale and pill CTAs; /pricing, /compare, /about, /blog,
 * /faq, /help, /contact, /changelog and /status used raw `gray-*` classes,
 * hardcoded dark-mode hex values and the default Tailwind type scale. A count
 * before this change: 232 raw gray-* utilities, 180 hardcoded hex values and
 * 146 default-scale text-* classes across those nine files, against exactly
 * zero uses of a design token. That is why the secondary pages read as though
 * a different (and more generic) site had been bolted on.
 *
 * Every primitive here is the one way to do its job. A marketing page should
 * be almost entirely composed of these; reaching for a raw <div> with bespoke
 * padding is the smell that something belongs in this file instead.
 *
 * Type comes from the .rb-* classes in globals.css, never from an ad-hoc
 * text-[Npx]. Those classes are clamp()-based, so they are already responsive
 * and nothing needs to be walked back at a breakpoint.
 */

// ─── Layout ───────────────────────────────────────────────────────────────────

/**
 * The page's one container width. Every section on every marketing page is
 * this wide, so the left edge of a heading lines up from the top of the site
 * to the bottom.
 *
 * Before this, /pricing alone mixed max-w-screen-xl (the feature matrix),
 * max-w-2xl (the FAQ) and the card grid's own width on a single page, which is
 * what made its vertical rhythm look ragged.
 */
export function Section({
  children,
  className,
  id,
  as: Tag = "section",
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  as?: "section" | "div" | "header" | "footer";
}) {
  return (
    <Tag id={id} className={cn("mx-auto w-full max-w-6xl px-5 sm:px-6", className)}>
      {children}
    </Tag>
  );
}

/** Alternating band background, for separating adjacent sections. */
export function Band({
  children,
  tone = "sunken",
  className,
}: {
  children: React.ReactNode;
  tone?: "canvas" | "sunken";
  className?: string;
}) {
  return (
    <div
      className={cn(tone === "sunken" && "bg-[var(--rb-bg-sunken)]", className)}
    >
      {children}
    </div>
  );
}

// ─── Motion ───────────────────────────────────────────────────────────────────

/**
 * Scroll-reveal wrapper. SSR (and no-JS) renders content fully visible; on
 * mount, elements still below the fold are hidden and fade/slide in when they
 * intersect. Reduced-motion users always get the static page.
 */
export function Reveal({
  children,
  delay = 0,
  className,
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

// ─── Type ─────────────────────────────────────────────────────────────────────

/** Marketing section eyebrow. Always brand blue, always above the heading. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("rb-kicker text-[var(--rb-blue-500)]", className)}>{children}</p>
  );
}

/**
 * The section header: eyebrow, heading, optional lede. Centered by default
 * because that is what the homepage established; `align="left"` for the
 * split deep-dive sections.
 */
export function SectionHeading({
  eyebrow,
  title,
  lede,
  align = "center",
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  align?: "center" | "left";
  className?: string;
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className={cn("rb-h2 text-fg-1", eyebrow && "mt-3")}>{title}</h2>
      {lede && <p className="rb-lead mt-4 text-fg-2">{lede}</p>}
    </div>
  );
}

/**
 * The top of a secondary page. Every non-home marketing page opens with this,
 * so /pricing, /about and /contact no longer each invent their own hero.
 *
 * Centered, with the same soft brand wash the homepage hero uses at a lower
 * intensity — enough to tie the pages together without competing with the
 * homepage. Previously these heroes were left-aligned in a ~50%-wide column,
 * which is what left /about and /contact with a large empty right half.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  children,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("relative overflow-hidden", className)}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 0%, rgba(10,132,255,0.09) 0%, rgba(10,132,255,0.03) 50%, transparent 100%)",
        }}
      />
      <Section className="relative pt-14 pb-10 text-center sm:pt-20 sm:pb-12">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className={cn("rb-h1 mx-auto max-w-[20ch] text-fg-1", eyebrow && "mt-4")}>
          {title}
        </h1>
        {lede && <p className="rb-lead mx-auto mt-5 max-w-[58ch] text-fg-2">{lede}</p>}
        {children && <div className="mt-8">{children}</div>}
      </Section>
    </header>
  );
}

// ─── Actions ──────────────────────────────────────────────────────────────────

const CTA_SIZE = {
  lg: "h-12 px-7 text-[16px]",
  md: "h-11 px-5 text-[15px]",
} as const;

export function PrimaryLink({
  href,
  children,
  size = "lg",
  className,
}: {
  href: string;
  children: React.ReactNode;
  size?: keyof typeof CTA_SIZE;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[var(--rb-blue-500)] font-semibold text-white shadow-[0_2px_8px_rgba(10,132,255,0.35)] transition-all hover:bg-[var(--rb-blue-600)] hover:shadow-[0_4px_14px_rgba(10,132,255,0.45)]",
        CTA_SIZE[size],
        className,
      )}
    >
      {children}
      <ArrowRight className="size-4" strokeWidth={2.5} />
    </Link>
  );
}

export function SecondaryLink({
  href,
  children,
  size = "lg",
  className,
}: {
  href: string;
  children: React.ReactNode;
  size?: keyof typeof CTA_SIZE;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        // --rb-border-2, not --rb-border-1. A 6%-white divider on a dark
        // surface makes an outline button stop reading as a button at all —
        // see the design-system note in CLAUDE.md about border weights being
        // semantic. Interactive elements get the heavier weight.
        "inline-flex items-center rounded-full border border-[var(--rb-border-2)] bg-surface font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)]",
        CTA_SIZE[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

// ─── Surfaces ─────────────────────────────────────────────────────────────────

/**
 * The standard marketing card. One radius, one border, one shadow, everywhere.
 *
 * `tone="sunken"` is for cards sitting on the canvas; `tone="raised"` (the
 * default) is for cards sitting on a sunken band. Getting this backwards is
 * what makes a card disappear into its background.
 */
export function Card({
  children,
  className,
  tone = "raised",
  interactive = false,
}: {
  children: React.ReactNode;
  className?: string;
  tone?: "raised" | "sunken";
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--rb-border-1)] p-6",
        tone === "raised"
          ? "bg-surface shadow-[var(--rb-shadow-xs)]"
          : "bg-[var(--rb-bg-sunken)]",
        interactive && "transition-shadow hover:shadow-[var(--rb-shadow-md)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * The closing call-to-action band.
 *
 * Replaces the `bg-gray-900` slabs that /pricing and /compare each rolled
 * themselves: a hardcoded near-black panel renders as a dark rectangle on a
 * dark canvas in dark mode, and matched nothing else on the site.
 */
export function CtaBand({
  title,
  lede,
  primary,
  secondary,
}: {
  title: React.ReactNode;
  lede?: React.ReactNode;
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <Section className={RHYTHM.md}>
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(135deg,var(--rb-blue-500)_0%,var(--rb-blue-700)_100%)] px-6 py-14 text-center sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "radial-gradient(rgba(255,255,255,0.6) 1px, transparent 1px)",
              backgroundSize: "22px 22px",
              maskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 75%)",
            }}
          />
          <div className="relative">
            <h2 className="rb-h2 mx-auto max-w-[22ch] text-white">{title}</h2>
            {lede && (
              <p className="rb-lead mx-auto mt-4 max-w-[52ch] text-white/85">{lede}</p>
            )}
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href={primary.href}
                className="inline-flex h-12 items-center gap-1.5 rounded-full bg-white px-7 text-[16px] font-semibold text-[var(--rb-blue-600)] transition-colors hover:bg-white/90"
              >
                {primary.label}
                <ArrowRight className="size-4" strokeWidth={2.5} />
              </Link>
              {secondary && (
                <Link
                  href={secondary.href}
                  className="inline-flex h-12 items-center rounded-full border border-white/35 px-7 text-[16px] font-semibold text-white transition-colors hover:bg-white/10"
                >
                  {secondary.label}
                </Link>
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

// ─── Data bits ────────────────────────────────────────────────────────────────

/**
 * Real icons, not the "★" glyph. A text star resolves through whatever the OS
 * ships, so the core data type of a review product rendered at a different
 * weight and baseline on Windows than on the Mac it was designed on. `role`
 * is required for the label to be exposed — a bare <span> is `generic`.
 */
export function Stars({ rating, size = 13 }: { rating: number; size?: number }) {
  return (
    <span
      role="img"
      aria-label={`${rating} out of 5 stars`}
      className="inline-flex items-center gap-px"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          style={{ width: size, height: size }}
          className={i < rating ? "text-[var(--rb-amber-500)]" : "text-fg-3"}
          fill={i < rating ? "currentColor" : "none"}
          strokeWidth={i < rating ? 0 : 1.5}
        />
      ))}
    </span>
  );
}

/**
 * Breadcrumb above a secondary-page hero.
 *
 * Centered to sit with PageHero rather than the old left-aligned variant each
 * page hand-rolled with its own `text-gray-400 hover:text-gray-600` colours.
 */
export function Breadcrumb({ label }: { label: string }) {
  return (
    <Section className="pt-4">
      <nav aria-label="Breadcrumb" className="rb-meta text-fg-3">
        <Link href="/" className="transition-colors hover:text-fg-1">
          Home
        </Link>
        <span className="px-2 text-fg-4" aria-hidden="true">
          /
        </span>
        <span className="text-fg-2">{label}</span>
      </nav>
    </Section>
  );
}

/**
 * A definition-style FAQ list. /pricing, /faq and the homepage each had their
 * own; this is the shared one.
 */
export function FaqList({
  items,
  className,
}: {
  items: readonly { q: string; a: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-3", className)}>
      {items.map((item) => (
        <Card key={item.q} className="p-6">
          <dt className="rb-h4 text-fg-1">{item.q}</dt>
          <dd className="rb-body-sm mt-2 text-fg-2">{item.a}</dd>
        </Card>
      ))}
    </dl>
  );
}
