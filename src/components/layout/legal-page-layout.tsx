import Link from "next/link";
import { cn } from "@/lib/utils";
import { COMPANY, companyLine } from "@/lib/legal/company";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";

// ── Cross-link navigation ─────────────────────────────────────────────────────

// /refund is a permanent redirect to /refund-policy — linking it here sent
// every legal page's sidebar through a redirect hop to reach the policy.
const ALL_POLICIES = [
  { label: "Terms of Service",     href: "/terms" },
  { label: "Privacy Policy",       href: "/privacy" },
  { label: "Refund & Cancellation", href: "/refund-policy" },
  { label: "DPA",                  href: "/dpa" },
  { label: "Sub-processors",       href: "/sub-processors" },
  { label: "Acceptable Use",       href: "/acceptable-use" },
  { label: "Cookie Policy",        href: "/cookies" },
  { label: "Grievance Redressal",  href: "/grievance" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LegalSection {
  id: string;
  title: string;
}

export interface LegalPageProps {
  /** Title shown in breadcrumb + heading */
  title: string;
  /** Short slug, e.g. "Refund Policy" */
  breadcrumbLabel: string;
  /** Href of this page (used to highlight sidebar link) */
  currentHref: string;
  /** YYYY-MM-DD */
  effectiveDate: string;
  /** e.g. "Global", "EEA / UK" */
  jurisdiction: string;
  /** e.g. "4.0" */
  version: string;
  /** Three-to-five bullet plain English summary */
  plainLanguage: string[];
  /** Table of contents driven by section id+title */
  sections: LegalSection[];
  children: React.ReactNode;
}

// ── Shared layout ─────────────────────────────────────────────────────────────

export function LegalPageLayout({
  title,
  breadcrumbLabel,
  currentHref,
  effectiveDate,
  jurisdiction,
  version,
  plainLanguage,
  sections,
  children,
}: LegalPageProps) {
  const fmtDate = new Date(effectiveDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    /*
     * These eight pages used to render a bespoke 14px "minimal nav" with three
     * links and no footer at all, on a hardcoded `bg-[#F5F5F7]` canvas that
     * could not go dark. The site footer links to every one of them, so a
     * reader who followed "Terms" or "Privacy" arrived somewhere with no way
     * back to the product and no way to reach anything else — a third layout
     * on a site that should have one.
     *
     * They now use the same shell, nav and footer as the rest of marketing.
     * Nothing inside the legal text is touched; only the frame around it.
     */
    <MarketingShell>
      <MarketingNav />

      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-6xl px-5 pt-4 sm:px-6">
        <nav aria-label="Breadcrumb" className="rb-meta text-fg-3">
          <Link href="/" className="transition-colors hover:text-fg-1">
            Home
          </Link>
          <span className="px-2 text-fg-4" aria-hidden="true">
            /
          </span>
          <span>Legal</span>
          <span className="px-2 text-fg-4" aria-hidden="true">
            /
          </span>
          <span className="text-fg-2">{breadcrumbLabel}</span>
        </nav>
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <main className="mx-auto w-full max-w-6xl gap-10 px-5 pt-6 pb-24 sm:px-6 lg:grid lg:grid-cols-[240px_1fr]">

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            {/* Other policies */}
            <div>
              <p className="rb-eyebrow mb-2.5 text-fg-3">
                Other policies
              </p>
              <ul className="space-y-0.5">
                {ALL_POLICIES.map((p) => (
                  <li key={p.href}>
                    <Link
                      href={p.href}
                      className={cn(
                        "block rounded-md px-2 py-1.5 text-[14px] transition-colors",
                        p.href === currentHref
                          ? "border-l-2 border-[var(--rb-blue-500)] bg-[var(--rb-blue-50)] pl-3 font-semibold text-[var(--rb-blue-500)] dark:bg-[var(--rb-bg-accent-soft)]"
                          : "text-fg-3 hover:text-fg-1",
                      )}
                    >
                      {p.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sections */}
            <div>
              <p className="rb-eyebrow mb-2.5 text-fg-3">
                Sections
              </p>
              <ul className="space-y-0.5">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block rounded-md px-2 py-1.5 text-[14px] text-fg-3 transition-colors hover:text-fg-1"
                    >
                      {i + 1}.&nbsp;{s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Questions */}
            <div className="rounded-xl border border-[var(--rb-border-1)] bg-surface p-4 shadow-[var(--rb-shadow-xs)]">
              <p className="rb-body-sm font-semibold text-fg-1">Questions?</p>
              <p className="rb-meta mt-1.5 font-normal text-fg-2">
                Email{" "}
                <a
                  href={`mailto:${COMPANY.emails.legal}`}
                  className="font-medium text-[var(--rb-blue-500)] hover:underline"
                >
                  {COMPANY.emails.legal}
                </a>
                . For complaints, see{" "}
                <a href="/grievance" className="font-medium text-[var(--rb-blue-500)] hover:underline">
                  grievance redressal
                </a>
                .
              </p>
            </div>
          </div>
        </aside>

        {/* Content */}
        <article className="min-w-0">
          {/* Header */}
          <div className="mb-8 border-b border-[var(--rb-border-1)] pt-2 pb-7">
            <span className="rb-kicker text-[var(--rb-blue-500)]">
              Legal
            </span>
            <h1 className="rb-h1 mt-3 text-fg-1">
              {title}
            </h1>
            <div className="rb-meta mt-4 flex flex-wrap gap-x-6 gap-y-1 font-normal text-fg-3">
              <span>
                <span className="font-medium uppercase tracking-wide">Effective</span>{" "}
                · {fmtDate}
              </span>
              <span>
                <span className="font-medium uppercase tracking-wide">Jurisdiction</span>{" "}
                · {jurisdiction}
              </span>
              <span>
                <span className="font-medium uppercase tracking-wide">Version</span>{" "}
                · {version}
              </span>
            </div>
          </div>

          {/* Plain-language callout */}
          <div className="mb-10 rounded-xl border border-[var(--rb-blue-200)] bg-[var(--rb-blue-50)] px-5 py-5 dark:border-[var(--rb-blue-800)] dark:bg-[var(--rb-bg-accent-soft)]">
            <p className="rb-kicker mb-3 text-[var(--rb-blue-600)] dark:text-[var(--rb-blue-300)]">
              The plain-language version
            </p>
            <ul className="space-y-1.5">
              {plainLanguage.map((line, i) => (
                <li key={i} className="rb-body-sm flex gap-2 text-[var(--rb-blue-800)] dark:text-[var(--rb-blue-100)]">
                  <span className="mt-0.5 shrink-0">·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="rb-meta mt-4 font-normal text-[var(--rb-blue-700)]/80 italic dark:text-[var(--rb-blue-300)]/80">
              This summary is for convenience. The legal terms below are what actually govern your use of the service.
            </p>
          </div>

          {/* Numbered sections */}
          <div className="rb-body space-y-10 text-fg-2">
            {children}
          </div>

          {/* Footer note */}
          <div className="rb-meta mt-16 border-t border-[var(--rb-border-1)] pt-6 font-normal text-fg-3">
            {companyLine()} · Registered in {COMPANY.country} ·{" "}
            <a href={`mailto:${COMPANY.emails.legal}`} className="hover:text-fg-1">
              {COMPANY.emails.legal}
            </a>
          </div>
        </article>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}

// ── Reusable section wrapper ──────────────────────────────────────────────────

export function LegalSection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="rb-h3 flex items-baseline gap-3 text-fg-1">
        <span className="shrink-0 text-[15px] font-normal text-fg-3">{number}.</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 pl-6">{children}</div>
    </section>
  );
}
