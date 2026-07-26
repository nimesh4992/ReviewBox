"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, Moon, Sun, X } from "lucide-react";

import { LogoMark } from "@/components/layout/logo-mark";
import { useMarketingTheme } from "@/components/layout/marketing-shell";
import { cn } from "@/lib/utils";

// /customers, /careers and /status are scheduled for deletion (founder-approved
// page cut) — the nav stops promoting them ahead of the removal slice.
const NAV_LINKS = [
  { label: "Pricing", href: "/pricing" },
  { label: "Compare", href: "/compare" },
  { label: "Blog", href: "/blog" },
  { label: "Help", href: "/help" },
];

export function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { theme, toggle } = useMarketingTheme();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    fn();
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      <div
        className={cn(
          "border-b backdrop-blur-xl transition-colors duration-200",
          scrolled
            ? "border-[var(--rb-border-1)] bg-[color-mix(in_oklab,var(--rb-bg-canvas)_88%,transparent)]"
            : "border-transparent bg-[color-mix(in_oklab,var(--rb-bg-canvas)_70%,transparent)]",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-5 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5" aria-label="ReviewBox home">
            <LogoMark size={22} />
            <span className="text-[16px] font-semibold tracking-[-0.02em] text-fg-1">
              ReviewBox
            </span>
          </Link>

          <nav className="ml-8 hidden items-center gap-6 md:flex">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[13.5px] font-medium text-fg-2 transition-colors hover:text-fg-1"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="flex size-8 items-center justify-center rounded-lg border border-[var(--rb-border-1)] text-fg-3 transition-colors hover:bg-[var(--rb-bg-hover)] hover:text-fg-1"
            >
              {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>

            <Link
              href="/sign-in"
              className="hidden px-2 text-[13.5px] font-medium text-fg-2 transition-colors hover:text-fg-1 sm:block"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--rb-blue-500)] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--rb-blue-600)]"
            >
              Start free
              <ArrowRight className="size-3.5" strokeWidth={2} />
            </Link>

            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              className="flex size-8 items-center justify-center rounded-lg text-fg-2 transition-colors hover:bg-[var(--rb-bg-hover)] md:hidden"
            >
              {menuOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="border-t border-[var(--rb-border-1)] bg-[var(--rb-bg-canvas)] px-5 py-3 md:hidden">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-lg px-2 py-2.5 text-[15px] font-medium text-fg-1 hover:bg-[var(--rb-bg-hover)]"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/sign-in"
              onClick={() => setMenuOpen(false)}
              className="block rounded-lg px-2 py-2.5 text-[15px] font-medium text-fg-1 hover:bg-[var(--rb-bg-hover)]"
            >
              Sign in
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
