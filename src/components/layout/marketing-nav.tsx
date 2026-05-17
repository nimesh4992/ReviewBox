"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useMarketingTheme } from "./marketing-shell";

// ─── Primitives ───────────────────────────────────────────────────────────────

const LogoMark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "block" }}>
    <defs>
      <linearGradient id="rb-nav-logo-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#4592FF" />
        <stop offset="1" stopColor="#0058B3" />
      </linearGradient>
    </defs>
    <path d="M14 8 H50 A8 8 0 0 1 58 16 V40 A8 8 0 0 1 50 48 H28 L18 58 V48 H14 A8 8 0 0 1 6 40 V16 A8 8 0 0 1 14 8 Z" fill="url(#rb-nav-logo-grad)" />
    <rect x="14" y="32" width="6" height="8"  rx="3" fill="#fff" fillOpacity="0.97" />
    <rect x="23" y="29" width="6" height="11" rx="3" fill="#fff" fillOpacity="0.97" />
    <rect x="32" y="25" width="6" height="15" rx="3" fill="#fff" fillOpacity="0.97" />
    <rect x="41" y="20" width="6" height="20" rx="3" fill="#fff" fillOpacity="0.97" />
  </svg>
);

const LivePulse = ({ size = 7, color = "var(--rb-green-500)" }: { size?: number; color?: string }) => (
  <div className="rb-live-pulse" style={{ width: size, height: size, background: color, borderRadius: "50%", flexShrink: 0 }} />
);

const Arrow = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
);

const SunIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

const MoonIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

// ─── Nav ─────────────────────────────────────────────────────────────────────

const NAV_LINKS = [
  { l: "Pricing",   href: "/pricing" },
  { l: "Compare",   href: "/compare" },
  { l: "Customers", href: "/customers" },
  { l: "Blog",      href: "/blog" },
  { l: "Help",      href: "/help" },
];

export function MarketingNav() {
  const [scrolled, setScrolled]   = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { theme, toggle }         = useMarketingTheme();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 50 }}>
      {/* Announcement bar */}
      {!dismissed && (
        <div style={{ background: "var(--rb-fg-1)", color: "var(--rb-bg-canvas)", fontSize: 12.5, height: 34, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, position: "relative" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "2px 8px", borderRadius: 99, background: "var(--rb-blue-500)", color: "#fff", fontSize: 10, fontWeight: 800, letterSpacing: "0.08em", fontFamily: "var(--rb-font-mono)" }}>SHIPPED</span>
          <span style={{ letterSpacing: "-0.005em" }}>Incident detection is generally available. Auto-paging from review patterns, live today.</span>
          <Link href="/changelog" style={{ color: "var(--rb-bg-canvas)", fontWeight: 600, fontSize: 12.5, display: "inline-flex", alignItems: "center", gap: 4 }}>
            Read the post <Arrow size={11} />
          </Link>
          <button onClick={() => setDismissed(true)} aria-label="Dismiss" style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", background: "transparent", border: 0, color: "var(--rb-bg-canvas)", opacity: 0.6, cursor: "pointer", padding: 4, display: "inline-flex" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}

      {/* Main bar */}
      <div style={{ background: scrolled ? "color-mix(in oklab, var(--rb-bg-canvas) 88%, transparent)" : "color-mix(in oklab, var(--rb-bg-canvas) 70%, transparent)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", borderBottom: scrolled ? "1px solid var(--rb-border-1)" : "1px solid transparent", transition: "background 200ms, border-color 200ms" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, height: 64 }}>

            {/* Logo + status */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 12, marginRight: 8 }}>
              <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
                <LogoMark size={22} />
                <span style={{ fontFamily: "var(--rb-font-display)", fontSize: 17, fontWeight: 700, color: "var(--rb-fg-1)", letterSpacing: "-0.02em" }}>ReviewBox</span>
              </Link>
              <Link href="/status" style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 8px", borderRadius: 99, background: "var(--rb-bg-sunken)", border: "1px solid var(--rb-border-1)", fontSize: 10.5, fontWeight: 600, color: "var(--rb-fg-3)", fontFamily: "var(--rb-font-mono)", letterSpacing: "0.04em", textDecoration: "none" }}>
                <LivePulse size={6} color="var(--rb-green-500)" />
                <span>All systems normal</span>
              </Link>
            </div>

            {/* Nav links */}
            <nav style={{ display: "flex", gap: 24, marginLeft: 14 }}>
              {NAV_LINKS.map(it => (
                <Link key={it.l} href={it.href} style={{ fontSize: 13.5, color: "var(--rb-fg-2)", fontWeight: 500, letterSpacing: "-0.005em", textDecoration: "none" }}>{it.l}</Link>
              ))}
            </nav>

            {/* Actions */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
              {/* Theme toggle */}
              <button
                onClick={toggle}
                aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
                style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid var(--rb-border-1)", background: "var(--rb-bg-sunken)", color: "var(--rb-fg-2)", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 150ms, border-color 150ms", flexShrink: 0 }}
              >
                {theme === "dark" ? <SunIcon /> : <MoonIcon />}
              </button>

              <Link href="/sign-in" style={{ fontSize: 13.5, color: "var(--rb-fg-2)", fontWeight: 500, padding: "0 8px", textDecoration: "none" }}>Sign in</Link>
              <Link href="/sign-up" style={{ display: "inline-flex", alignItems: "center", gap: 6, height: 34, padding: "0 14px", borderRadius: 9, background: "var(--rb-blue-500)", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap", letterSpacing: "-0.01em" }}>
                Start free <Arrow size={11} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
