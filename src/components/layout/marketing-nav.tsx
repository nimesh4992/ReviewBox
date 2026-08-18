"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

import { LogoMark } from "@/components/layout/logo-mark";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

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
