import React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The shared vocabulary for every marketing page, in the design language
 * adapted from the SassTech index-4 ("CRM") theme.
 *
 * These live here rather than in each page so the seventeen marketing routes
 * cannot drift apart one heading at a time. Before this module the homepage
 * had its own Section/Eyebrow/Card and every other page hand-rolled headings
 * from raw Tailwind, which is how /help ended up carrying a literal
 * `bg-[#F5F5F7]` while the homepage used tokens.
 *
 * Two hard rules, both learned the expensive way:
 *
 * 1. EVERY --rb-mk-* TOKEN USED HERE ONLY RESOLVES INSIDE <MarketingShell>,
 *    which puts `.rb-marketing` on the tree. A page that renders these
 *    outside the shell gets no palette at all and, worse, gets it silently —
 *    the CTA simply paints no background. `src/marketing-shell-contract.test.ts`
 *    fails CI if that combination reappears.
 *
 * 2. Marketing is LIGHT-ONLY by founder decision. Do not add `dark:`
 *    variants; nothing sets the `dark` class on this subtree any more, so
 *    they would be dead code that reads as live intent.
 */

// ─── Type and rhythm ──────────────────────────────────────────────────────────

/**
 * Uppercase, letterspaced, set in --rb-mk-orange-text.
 *
 * NOT the theme's own #FF5E1A: that measures 3.06:1 on white, which clears
 * the large-text floor but fails AA at this size — and the source theme used
 * it for exactly this label. The decorative token is kept for the hero
 * underline, where it is a mark rather than text.
 */
export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "mb-4 block text-[12.5px] font-bold tracking-[0.13em] text-[var(--rb-mk-orange-text)] uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Section({
  children,
  className,
  id,
  band = false,
  tight = false,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Sunken ground, for alternating the page rhythm. */
  band?: boolean;
  /**
   * Half the vertical padding. For strips that sit directly under a hero or
   * breadcrumb, where the full rhythm leaves a visibly empty band.
   */
  tight?: boolean;
}) {
  return (
    <section
      id={id}
      className={cn(
        tight ? "py-[clamp(32px,4vw,56px)]" : "py-[clamp(66px,8vw,112px)]",
        band && "bg-[var(--rb-mk-sunken)]",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[1160px] px-5 sm:px-6">{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  body,
  center = false,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  body?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div className={cn("max-w-[660px]", center && "mx-auto text-center")}>
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="text-[length:var(--rb-mk-h2)] leading-[1.1] font-bold tracking-[-0.028em] text-balance text-[var(--rb-fg-1)]">
        {title}
      </h2>
      {body && <p className="mt-[18px] text-[17.5px] text-[var(--rb-fg-3)]">{body}</p>}
    </div>
  );
}

/**
 * The top of an interior page: the same pastel mesh as the homepage hero, but
 * shorter, and with the heading at h1 weight.
 *
 * The mesh is applied through `.rb-mesh-hero`, a real class in globals.css,
 * NOT a Tailwind arbitrary value. `bg-[image:var(--token)]` compiles to
 * nothing in Tailwind v4 — the class lands in the HTML, the token resolves,
 * and no rule is ever emitted. That shipped the homepage hero plain white
 * with tsc, lint and the build all green.
 *
 * It is also painted on this element rather than a negatively-stacked child:
 * a child at -z-20 paints behind MarketingShell's own opaque background,
 * because element backgrounds do not propagate to the canvas the way body's
 * does.
 */
export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  lede?: React.ReactNode;
  /** Actions, search boxes, or anything else below the lede. */
  children?: React.ReactNode;
}) {
  return (
    <header className="rb-mesh-hero relative -mt-[82px] pt-[clamp(128px,13vw,176px)] pb-[clamp(48px,6vw,76px)] text-center">
      <div className="relative mx-auto w-full max-w-[1160px] px-5 sm:px-6">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mx-auto max-w-[20ch] text-[length:var(--rb-mk-h1)] leading-[1.1] font-extrabold tracking-[-0.038em] text-balance text-[var(--rb-fg-1)]">
          {title}
        </h1>
        {lede && (
          <p className="mx-auto mt-6 max-w-[58ch] text-[18.5px] text-[var(--rb-fg-2)]">{lede}</p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </header>
  );
}

// ─── Surfaces ─────────────────────────────────────────────────────────────────

/**
 * Hairline surface. No lift on hover — the border does the work.
 *
 * Radius comes from --rb-mk-r-card (14px) rather than a uniform large radius:
 * in this design radii are graded by role, with pills reserved for actions
 * (the source theme's actual signature) and the larger --rb-mk-r-frame kept
 * for full product frames.
 */
export function Card({
  children,
  className,
  interactive = true,
}: {
  children: React.ReactNode;
  className?: string;
  /** Set false for static panels that are not links or controls. */
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-[var(--rb-mk-r-card)] border border-[var(--rb-mk-line)] bg-white p-[30px]",
        interactive && "transition-colors hover:border-[var(--rb-mk-line-2)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2.5 text-[19px] leading-[1.3] font-bold tracking-[-0.015em] text-[var(--rb-fg-1)]">
      {children}
    </h3>
  );
}

export function CardBody({ children }: { children: React.ReactNode }) {
  return <p className="text-[15.5px] leading-[1.55] text-[var(--rb-fg-3)]">{children}</p>;
}

/**
 * Icons are Lucide at strokeWidth 1.5 — the weight the authenticated app sets
 * globally — sitting bare on the surface. No tinted rounded tile behind them:
 * that treatment gave the marketing site a second icon language the product
 * does not share, and cycling pastel fills per card read as decoration
 * standing in for hierarchy.
 */
export function IconMark({ icon: Icon }: { icon: React.ElementType }) {
  return <Icon className="mb-5 size-[26px] text-[var(--rb-fg-1)]" strokeWidth={1.5} />;
}

/** Native disclosure — no JS, keyboard-accessible for free. */
export function Disclosure({
  q,
  children,
  open = false,
}: {
  q: string;
  children: React.ReactNode;
  open?: boolean;
}) {
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
      <div className="max-w-[62ch] pb-5 text-[15.5px] leading-[1.6] text-[var(--rb-fg-3)]">
        {children}
      </div>
    </details>
  );
}

// ─── Actions ──────────────────────────────────────────────────────────────────

const BTN_BASE =
  "inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-transparent px-7 py-3.5 text-[15px] font-bold tracking-[-0.01em] transition-colors";

/**
 * The gold pill. Ink text, never white — white on #FFB114 measures 1.9:1 and
 * is illegible.
 */
export function AmberLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        BTN_BASE,
        "bg-[var(--rb-mk-amber-500)] text-[var(--rb-mk-ink)] hover:bg-[var(--rb-mk-amber-600)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function InkLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(BTN_BASE, "bg-[var(--rb-mk-ink)] text-white hover:bg-[#241a5c]", className)}
    >
      {children}
    </Link>
  );
}

export function LineLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        BTN_BASE,
        "border-[var(--rb-mk-line-2)] text-[var(--rb-fg-1)] hover:border-[var(--rb-mk-ink)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** Row of actions under a hero or closing band. */
export function Actions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap justify-center gap-3">{children}</div>;
}

// ─── Long-form ────────────────────────────────────────────────────────────────

/**
 * Body copy for help articles and legal pages: one measure, one rhythm.
 * Set at 68ch rather than the 60ch used for marketing lede text — these are
 * read continuously rather than scanned.
 */
export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-[68ch] text-[16.5px] leading-[1.7] text-[var(--rb-fg-2)]",
        "[&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-[26px] [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_h2]:text-[var(--rb-fg-1)]",
        "[&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-[19px] [&_h3]:font-bold [&_h3]:tracking-[-0.015em] [&_h3]:text-[var(--rb-fg-1)]",
        "[&_p]:mb-4 [&_ul]:mb-4 [&_ol]:mb-4",
        "[&_li]:mb-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5",
        "[&_a]:font-semibold [&_a]:text-[var(--rb-mk-orange-text)] [&_a:hover]:underline",
        "[&_strong]:font-semibold [&_strong]:text-[var(--rb-fg-1)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The pastel closing band used at the foot of most pages. */
export function ClosingBand({
  title,
  body,
  children,
  note,
}: {
  title: React.ReactNode;
  body?: React.ReactNode;
  children?: React.ReactNode;
  note?: string;
}) {
  return (
    <Section>
      <div className="rb-mesh-panel rounded-[28px] border border-[var(--rb-mk-line)] px-8 py-[clamp(48px,6vw,78px)] text-center">
        <h2 className="text-[length:var(--rb-mk-h2)] leading-[1.1] font-bold tracking-[-0.028em] text-balance text-[var(--rb-fg-1)]">
          {title}
        </h2>
        {body && (
          <p className="mx-auto mt-[18px] max-w-[56ch] text-[18px] text-[var(--rb-fg-3)]">{body}</p>
        )}
        {children && <div className="mt-[34px]">{children}</div>}
        {note && <p className="mt-[18px] text-[14px] text-[var(--rb-fg-3)]">{note}</p>}
      </div>
    </Section>
  );
}
