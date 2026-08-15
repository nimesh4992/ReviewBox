import Link from "next/link";
import { cn } from "@/lib/utils";
import { COMPANY, companyLine } from "@/lib/legal/company";

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
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* ── Minimal nav ───────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-screen-xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">ReviewBox</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-gray-500 sm:flex">
            <Link href="/#pricing" className="hover:text-gray-900">Pricing</Link>
            <Link href="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link
              href="/sign-in"
              className="rounded-lg bg-[#0A84FF] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0070e0]"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-400">Legal</span>
          <span>/</span>
          <span className="text-gray-600">{breadcrumbLabel}</span>
        </nav>
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-screen-xl gap-10 px-6 pb-24 lg:grid lg:grid-cols-[240px_1fr]">

        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-6">
            {/* Other policies */}
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Other policies
              </p>
              <ul className="space-y-0.5">
                {ALL_POLICIES.map((p) => (
                  <li key={p.href}>
                    <Link
                      href={p.href}
                      className={cn(
                        "block rounded-md px-2 py-1 text-sm transition-colors",
                        p.href === currentHref
                          ? "border-l-2 border-[#0A84FF] bg-blue-50 pl-3 font-medium text-[#0A84FF]"
                          : "text-gray-500 hover:text-gray-800",
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
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                Sections
              </p>
              <ul className="space-y-0.5">
                {sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="block rounded-md px-2 py-1 text-sm text-gray-500 transition-colors hover:text-gray-800"
                    >
                      {i + 1}.&nbsp;{s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Questions */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold text-gray-700">Questions?</p>
              <p className="mt-1 text-xs text-gray-500">
                Email{" "}
                <a
                  href={`mailto:${COMPANY.emails.legal}`}
                  className="text-[#0A84FF] hover:underline"
                >
                  {COMPANY.emails.legal}
                </a>
                . For complaints, see{" "}
                <a href="/grievance" className="text-[#0A84FF] hover:underline">
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
          <div className="mb-8 border-b border-gray-200 pb-6 pt-2">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-700">
              Legal
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
              {title}
            </h1>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400">
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
          <div className="mb-10 rounded-xl border border-blue-100 bg-blue-50 px-5 py-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-blue-500">
              The plain-language version
            </p>
            <ul className="space-y-1.5">
              {plainLanguage.map((line, i) => (
                <li key={i} className="flex gap-2 text-sm text-blue-800">
                  <span className="mt-0.5 shrink-0">·</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs italic text-blue-500/70">
              This summary is for convenience. The legal terms below are what actually govern your use of the service.
            </p>
          </div>

          {/* Numbered sections */}
          <div className="space-y-10 text-[15px] leading-relaxed text-gray-700">
            {children}
          </div>

          {/* Footer note */}
          <div className="mt-16 border-t border-gray-100 pt-6 text-xs text-gray-400">
            {companyLine()} · Registered in {COMPANY.country} ·{" "}
            <a href={`mailto:${COMPANY.emails.legal}`} className="hover:text-gray-600">
              {COMPANY.emails.legal}
            </a>
          </div>
        </article>
      </main>
    </div>
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
      <h2 className="flex items-baseline gap-3 text-base font-semibold text-gray-900">
        <span className="shrink-0 text-sm text-gray-400">{number}.</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 pl-6">{children}</div>
    </section>
  );
}
