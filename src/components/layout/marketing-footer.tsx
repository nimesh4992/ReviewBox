import Link from "next/link";

import { LogoMark } from "@/components/layout/logo-mark";
import { COMPANY, companyLine, formatRegisteredOffice, orPending } from "@/lib/legal/company";

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
    heading: "Legal",
    links: [
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
      { label: "Refund & Cancellation", href: "/refund-policy" },
      { label: "Grievance Redressal", href: "/grievance" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "DPA", href: "/dpa" },
      { label: "Sub-processors", href: "/sub-processors" },
      { label: "Acceptable Use", href: "/acceptable-use" },
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
              <div className="rb-eyebrow text-fg-3">
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

        <div className="mt-14 border-t border-[var(--rb-border-1)] pt-6 text-[12px] text-fg-4">
          <p className="max-w-[70ch] leading-relaxed">
            {companyLine()} · {COMPANY.entityType} registered in {COMPANY.country}
            {COMPANY.firmRegistrationNumber ? ` · Firm Reg. ${COMPANY.firmRegistrationNumber}` : ""}
            {COMPANY.gstin ? ` · GSTIN ${COMPANY.gstin}` : ""}
          </p>
          <p className="mt-1 max-w-[70ch] leading-relaxed">
            Principal place of business: {formatRegisteredOffice()}
          </p>
          <p className="mt-1">
            Support:{" "}
            <a href={`mailto:${COMPANY.emails.support}`} className="transition-colors hover:text-fg-2">
              {COMPANY.emails.support}
            </a>
            {" · "}
            Grievances:{" "}
            <a href={`mailto:${COMPANY.emails.grievance}`} className="transition-colors hover:text-fg-2">
              {COMPANY.emails.grievance}
            </a>
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-[12px] text-fg-4">
          <span>&copy; {new Date().getFullYear()} {COMPANY.tradingAs}</span>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="transition-colors hover:text-fg-2">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-fg-2">
              Terms
            </Link>
            <Link href="/refund-policy" className="transition-colors hover:text-fg-2">
              Refunds
            </Link>
            <Link href="/contact" className="transition-colors hover:text-fg-2">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
