"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu, X } from "lucide-react";

import { LogoMark } from "@/components/layout/logo-mark";
import { cn } from "@/lib/utils";

/**
 * The product pages, behind a "Product" disclosure.
 *
 * Until 2026-08-18 this nav was Pricing / Blog / Help and nothing else, so the
 * only description of what ReviewBox does was the homepage. That is a problem
 * for a visitor and a bigger one for Google: nav links appear on every page, so
 * they are the strongest internal link signal the site has, and none of it was
 * being spent on a page about the product.
 *
 * DELIBERATELY SHORT. The obvious move is a six-cell mega-menu like the one the
 * category leader runs, but we have two product pages worth linking to and an
 * `/integrations` page that does not exist yet. A grid with four confident
 * cells and two padded ones reads as a smaller company than a tight list of
 * three does. Add cells when there are pages to put in them —
 * `docs/specs/marketing-product-pages.md` lists what comes next.
 */
const PRODUCT_LINKS = [
  {
    label: "App review management",
    href: "/app-review-management",
    blurb: "Read, triage and reply to Google Play and App Store reviews.",
  },
  {
    label: "How AI replies work",
    href: "/help/ai-replies",
    blurb: "Templates, cache, then the model — and what each costs.",
  },
  {
    label: "AppFollow alternative",
    href: "/alternatives/appfollow",
    blurb: "Where we fit, and where we honestly do not.",
  },
];

// /customers, /careers and /status are scheduled for deletion (founder-approved
// page cut) — the nav stops promoting them ahead of the removal slice.
const NAV_LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
  { label: "Help", href: "/help" },
];

/**
 * Floating pill nav, adapted from the SassTech index-4 header: a rounded bar
 * that hovers over the hero mesh rather than a full-width band ruled off from
 * it.
 *
 * The light/dark toggle that used to live here is gone along with the
 * marketing theme context — see `marketing-shell.tsx` for why.
 *
 * The `scrolled` state only deepens the bar's own shadow and opacity; the
 * shape never changes. An earlier version swapped border colours on scroll,
 * which on a pill reads as the bar redrawing itself.
 */
export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const productRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  /**
   * Close the disclosure on Escape and on a click outside it.
   *
   * Opened on click rather than hover: a hover menu is unusable on touch and
   * unreachable by keyboard, and this one contains the pages we most want
   * people to reach.
   */
  useEffect(() => {
    if (!productOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProductOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (!productRef.current?.contains(e.target as Node)) setProductOpen(false);
    };

    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [productOpen]);

  return (
    <header className="sticky top-0 z-50 pt-[18px]">
      <div className="mx-auto w-full max-w-[1160px] px-5 sm:px-6">
        <nav
          className={cn(
            "flex items-center gap-3.5 rounded-full border border-white/85 py-2.5 pr-3 pl-6 backdrop-blur-xl transition-shadow duration-200",
            scrolled
              ? "bg-white/92 shadow-[0_8px_30px_rgba(21,14,62,0.13)]"
              : "bg-white/84 shadow-[0_6px_26px_rgba(21,14,62,0.09)]",
          )}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[17.5px] font-extrabold tracking-[-0.03em] text-[var(--rb-fg-1)]"
            aria-label="ReviewBox home"
          >
            <LogoMark size={21} />
            ReviewBox
          </Link>

          <div className="mx-auto hidden items-center gap-7 md:flex">
            <div ref={productRef} className="relative">
              <button
                type="button"
                onClick={() => setProductOpen((v) => !v)}
                aria-expanded={productOpen}
                aria-haspopup="true"
                className="flex items-center gap-1 text-[14.5px] font-semibold text-[var(--rb-fg-2)] transition-colors hover:text-[var(--rb-fg-1)]"
              >
                Product
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "size-4 transition-transform",
                    productOpen && "rotate-180",
                  )}
                />
              </button>

              {productOpen && (
                <div className="absolute top-full left-1/2 mt-3 w-[330px] -translate-x-1/2 rounded-[var(--rb-mk-r-card)] border border-[var(--rb-mk-line)] bg-white p-2 shadow-[0_12px_40px_rgba(21,14,62,0.14)]">
                  {PRODUCT_LINKS.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setProductOpen(false)}
                      className="block rounded-[10px] px-3.5 py-3 hover:bg-[var(--rb-mk-sunken)]"
                    >
                      <span className="block text-[14.5px] font-semibold text-[var(--rb-fg-1)]">
                        {l.label}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-[1.45] text-[var(--rb-fg-3)]">
                        {l.blurb}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[14.5px] font-semibold text-[var(--rb-fg-2)] transition-colors hover:text-[var(--rb-fg-1)]"
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-4 md:ml-0">
            <Link
              href="/sign-in"
              className="hidden text-[14.5px] font-semibold text-[var(--rb-fg-1)] sm:block"
            >
              Sign in
            </Link>
            {/* Ink text on amber, never white — white on #FFB114 is 1.9:1. */}
            <Link
              href="/sign-up"
              className="flex h-10 items-center rounded-full bg-[var(--rb-mk-amber-500)] px-5 text-[14px] font-bold tracking-[-0.01em] text-[var(--rb-mk-ink)] transition-colors hover:bg-[var(--rb-mk-amber-600)]"
            >
              Start free
            </Link>

            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="flex size-9 items-center justify-center rounded-full text-[var(--rb-fg-2)] transition-colors hover:bg-[var(--rb-mk-sunken)] md:hidden"
            >
              {menuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </nav>

        {menuOpen && (
          <nav className="mt-2 rounded-[var(--rb-mk-r-card)] border border-[var(--rb-mk-line)] bg-white p-2 shadow-[0_8px_30px_rgba(21,14,62,0.10)] md:hidden">
            {/* Flat on mobile. A nested disclosure inside a disclosure is two
                taps to reach a page, and these are the pages we most want
                reached. */}
            <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-[0.1em] text-[var(--rb-fg-3)] uppercase">
              Product
            </p>
            {PRODUCT_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-[10px] px-3 py-2.5 text-[15px] font-semibold text-[var(--rb-fg-1)] hover:bg-[var(--rb-mk-sunken)]"
              >
                {l.label}
              </Link>
            ))}
            <div className="my-1.5 border-t border-[var(--rb-mk-line)]" />
            {[...NAV_LINKS, { label: "Sign in", href: "/sign-in" }].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-[10px] px-3 py-2.5 text-[15px] font-semibold text-[var(--rb-fg-1)] hover:bg-[var(--rb-mk-sunken)]"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  );
}
