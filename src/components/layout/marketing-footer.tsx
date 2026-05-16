import Link from "next/link";

const LogoMark = ({ size = 22 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={{ display: "block" }}>
    <defs>
      <linearGradient id="rb-footer-logo-grad" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="#4592FF" />
        <stop offset="1" stopColor="#0058B3" />
      </linearGradient>
    </defs>
    <path d="M14 8 H50 A8 8 0 0 1 58 16 V40 A8 8 0 0 1 50 48 H28 L18 58 V48 H14 A8 8 0 0 1 6 40 V16 A8 8 0 0 1 14 8 Z" fill="url(#rb-footer-logo-grad)" />
    <rect x="14" y="32" width="6" height="8"  rx="3" fill="#fff" fillOpacity="0.97" />
    <rect x="23" y="29" width="6" height="11" rx="3" fill="#fff" fillOpacity="0.97" />
    <rect x="32" y="25" width="6" height="15" rx="3" fill="#fff" fillOpacity="0.97" />
    <rect x="41" y="20" width="6" height="20" rx="3" fill="#fff" fillOpacity="0.97" />
  </svg>
);

const LivePulse = ({ size = 6, color = "var(--rb-green-500)" }: { size?: number; color?: string }) => (
  <div className="rb-live-pulse" style={{ width: size, height: size, background: color, borderRadius: "50%", flexShrink: 0 }} />
);

const FOOTER_COLS = [
  { h: "Product",   l: [{ t: "Inbox",              href: "/sign-up" }, { t: "AI replies",        href: "/sign-up" }, { t: "Incident detection", href: "/sign-up" }, { t: "Release health",  href: "/sign-up" }, { t: "Automations",   href: "/sign-up" }, { t: "Reply kit",   href: "/sign-up" }] },
  { h: "Compare",   l: [{ t: "vs AppFollow",        href: "/compare" }, { t: "vs AppBot",         href: "/compare" }, { t: "vs Sensor Tower",    href: "/compare" }, { t: "vs Spreadsheets", href: "/compare" }] },
  { h: "Resources", l: [{ t: "Blog",                href: "/blog" },    { t: "Customers",         href: "/customers" }, { t: "Changelog",       href: "/changelog" }, { t: "Help center", href: "/help" },    { t: "FAQ",           href: "/faq" }] },
  { h: "Company",   l: [{ t: "About",               href: "/about" },   { t: "Careers",           href: "/careers" }, { t: "Privacy",         href: "/privacy" },   { t: "Terms",        href: "/terms" },   { t: "Status",        href: "/status" }] },
];

export function MarketingFooter() {
  return (
    <footer style={{ padding: "80px 0 32px", background: "var(--rb-bg-sunken)", borderTop: "1px solid var(--rb-border-1)" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 40, marginBottom: 56 }}>
          {/* Brand column */}
          <div>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
              <LogoMark size={22} />
              <span style={{ fontFamily: "var(--rb-font-display)", fontSize: 17, fontWeight: 700, color: "var(--rb-fg-1)", letterSpacing: "-0.02em" }}>ReviewBox</span>
            </Link>
            <p style={{ fontSize: 13, color: "var(--rb-fg-3)", marginTop: 14, lineHeight: 1.55, maxWidth: 280 }}>
              App review management for product teams who&apos;d rather ship the fix than argue whose ticket it was.
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              {["X", "in", "GH"].map(s => (
                <a key={s} href="https://tryreviewbox.com" style={{ width: 30, height: 30, borderRadius: 7, background: "var(--rb-bg-surface)", border: "1px solid var(--rb-border-1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, fontWeight: 700, color: "var(--rb-fg-3)", fontFamily: "var(--rb-font-mono)", textDecoration: "none" }}>{s}</a>
              ))}
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map(s => (
            <div key={s.h}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "var(--rb-fg-1)", marginBottom: 16, letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "var(--rb-font-mono)" }}>/{s.h.toLowerCase()}</div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                {s.l.map(it => (
                  <li key={it.t}>
                    <Link href={it.href} style={{ fontSize: 13, color: "var(--rb-fg-3)", textDecoration: "none" }}>{it.t}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{ paddingTop: 24, borderTop: "1px solid var(--rb-border-1)", display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--rb-fg-4)", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
          <div style={{ fontFamily: "var(--rb-font-mono)" }}>© 2026 ReviewBox, Inc. // All rights reserved</div>
          <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "var(--rb-font-mono)" }}>
              <LivePulse /> ALL SYSTEMS NORMAL
            </span>
            <Link href="/dpa"     style={{ color: "var(--rb-fg-4)", textDecoration: "none" }}>DPA</Link>
            <Link href="/privacy" style={{ color: "var(--rb-fg-4)", textDecoration: "none" }}>Privacy</Link>
            <Link href="/terms"   style={{ color: "var(--rb-fg-4)", textDecoration: "none" }}>Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
