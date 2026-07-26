import Link from "next/link";

import { LogoMark } from "@/components/layout/logo-mark";

/**
 * Columns reflect the approved post-cut sitemap — no links to /customers,
 * /careers or /status (all scheduled for deletion), and no social buttons:
 * the old footer showed X / LinkedIn / GitHub chips that all pointed back at
 * tryreviewbox.com, implying accounts that don't exist. The one real contact
 * channel is the email address.
 */
const FOOTER_COLS = [
  {
    heading: "Product",
    links: [
      { label: "Pricing", href: "/pricing" },
      { label: "Compare", href: "/compare" },
      { label: "Changelog", href: "/changelog" },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Help center", href: "/help" },
      { label: "FAQ", href: "/faq" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "DPA", href: "/dpa" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)]">
      <div className="mx-auto max-w-6xl px-5 pt-16 pb-8 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex w-fit items-center gap-2.5" aria-label="ReviewBox home">
              <LogoMark size={22} />
              <span className="text-[16px] font-semibold tracking-[-0.02em] text-fg-1">
                ReviewBox
              </span>
            </Link>
            <p className="mt-4 max-w-[280px] text-[13px] leading-relaxed text-fg-3">
              App review management for teams who&apos;d rather ship the fix than
              argue whose ticket it was.
            </p>
            <a
              href="mailto:hello@tryreviewbox.com"
              className="mt-4 inline-block text-[13px] text-fg-3 transition-colors hover:text-fg-1"
            >
              hello@tryreviewbox.com
            </a>
          </div>

          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <div className="font-[family-name:var(--rb-font-mono)] text-[11px] font-semibold tracking-[0.08em] text-fg-3 uppercase">
                {col.heading}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[13px] text-fg-3 transition-colors hover:text-fg-1"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--rb-border-1)] pt-6 text-[12px] text-fg-4">
          <span>&copy; {new Date().getFullYear()} ReviewBox</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="transition-colors hover:text-fg-2">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-fg-2">
              Terms
            </Link>
            <Link href="/dpa" className="transition-colors hover:text-fg-2">
              DPA
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
