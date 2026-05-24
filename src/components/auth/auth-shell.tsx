"use client";

import Link from "next/link";
import { CheckCircle2, Sparkles, ShieldCheck } from "lucide-react";

/**
 * Shared shell for /sign-in and /sign-up.
 *
 * Desktop: 60/40 split — visual + value-prop on the left, form on the right.
 * Mobile : form-first, the visual side collapses to a slim header band.
 *
 * Children render inside the right-side card so the page-specific code
 * stays focused on the Clerk form + per-page copy.
 */

interface AuthShellProps {
  /** "Create your account" or "Welcome back" — main heading next to logo. */
  heading: string;
  /** One-line subheading. */
  subheading: string;
  /** The form (typically a Clerk <SignIn> or <SignUp>). */
  children: React.ReactNode;
  /** Below the form. "Already have an account? Sign in" pattern. */
  footer?: React.ReactNode;
}

const VALUE_PROPS = [
  {
    icon: Sparkles,
    title: "AI replies in seconds",
    body: "Smart drafts in your voice. Edit and send, or auto-reply on opt-in.",
  },
  {
    icon: CheckCircle2,
    title: "Inbox for every review",
    body: "Google Play and App Store reviews in one queue. Filter, tag, batch.",
  },
  {
    icon: ShieldCheck,
    title: "Catches crashes early",
    body: "Spike detection alerts you to crash clusters before they go viral.",
  },
];

export function AuthShell({ heading, subheading, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ── Left: visual + value prop (collapses on mobile) ─────────────────── */}
      <aside className="relative hidden flex-col justify-between overflow-hidden lg:flex lg:w-[55%] xl:w-[58%]">
        {/* Layered gradient background */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #003F80 0%, #006EE0 35%, #0A84FF 70%, #4592FF 100%)",
          }}
        />
        {/* Subtle dot pattern overlay for texture */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: "radial-gradient(circle, #ffffff 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        {/* Soft glow blobs */}
        <div
          aria-hidden
          className="absolute -left-32 -top-32 size-[480px] rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(circle, #7AB2FF 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="absolute -bottom-40 -right-32 size-[520px] rounded-full opacity-25 blur-3xl"
          style={{ background: "radial-gradient(circle, #ADD0FF 0%, transparent 70%)" }}
        />

        {/* Content layer */}
        <div className="relative z-10 flex h-full flex-col justify-between p-12 xl:p-16">
          {/* Top: brand mark */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="flex size-9 items-center justify-center rounded-[10px] bg-white/15 backdrop-blur-md ring-1 ring-white/25 transition-transform group-hover:scale-105">
              <span className="text-[15px] font-bold text-white tracking-tight">R</span>
            </div>
            <span className="text-[16px] font-semibold tracking-[-0.01em] text-white">
              ReviewBox
            </span>
          </Link>

          {/* Middle: headline + value props */}
          <div className="max-w-[440px]">
            <h2 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.025em] text-white xl:text-[38px]">
              The fastest way to reply to every app store review.
            </h2>
            <p className="mt-4 text-[15px] leading-relaxed text-white/75">
              AI-powered review management for Google Play and App Store. Trusted by indie studios shipping millions of reviews a year.
            </p>

            <ul className="mt-10 space-y-5">
              {VALUE_PROPS.map((vp) => (
                <li key={vp.title} className="flex gap-3.5">
                  <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                    <vp.icon className="size-3.5 text-white" strokeWidth={1.75} />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold tracking-[-0.005em] text-white">
                      {vp.title}
                    </div>
                    <div className="mt-0.5 text-[13px] leading-snug text-white/70">
                      {vp.body}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom: trust line */}
          <div className="flex items-center gap-3 text-[12px] text-white/60">
            <div className="flex -space-x-2">
              {[
                "from-[#FF6B6B] to-[#C0392B]",
                "from-[#4ECDC4] to-[#1A9E92]",
                "from-[#FFE66D] to-[#E1B100]",
                "from-[#A78BFA] to-[#6D28D9]",
              ].map((g, i) => (
                <div
                  key={i}
                  className={`size-7 rounded-full bg-gradient-to-br ${g} ring-2 ring-white/20`}
                />
              ))}
            </div>
            <span>Trusted by indie studios on Google Play &amp; App Store</span>
          </div>
        </div>
      </aside>

      {/* ── Right: form ─────────────────────────────────────────────────────── */}
      <main className="flex flex-1 flex-col bg-[var(--rb-bg-canvas)]">
        {/* Mobile-only top bar (the desktop left panel is hidden < lg) */}
        <div className="flex items-center justify-between border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-surface)] px-5 py-3.5 lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-[8px] bg-[#0A84FF]">
              <span className="text-[12px] font-bold text-white">R</span>
            </div>
            <span className="text-[14px] font-semibold text-[var(--rb-fg-1)]">ReviewBox</span>
          </Link>
          <span className="text-[12px] text-[var(--rb-fg-3)]">App Review Intelligence</span>
        </div>

        {/* Form region — vertically centered on tall screens, scrollable on short */}
        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[400px]">
            {/* Page-specific heading */}
            <div className="mb-7">
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[var(--rb-fg-1)] sm:text-[26px]">
                {heading}
              </h1>
              <p className="mt-1.5 text-[14px] text-[var(--rb-fg-3)]">{subheading}</p>
            </div>

            {/* Form (Clerk <SignIn> / <SignUp>) */}
            {children}

            {footer && (
              <div className="mt-6 text-center text-[13px] text-[var(--rb-fg-3)]">
                {footer}
              </div>
            )}
          </div>
        </div>

        {/* Bottom legal line */}
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-[var(--rb-border-1)] bg-[var(--rb-bg-surface)] px-5 py-3.5 text-[12px] text-[var(--rb-fg-3)]">
          <Link href="https://tryreviewbox.com/terms" className="hover:text-[var(--rb-fg-1)]">
            Terms
          </Link>
          <Link href="https://tryreviewbox.com/privacy" className="hover:text-[var(--rb-fg-1)]">
            Privacy
          </Link>
          <Link href="https://tryreviewbox.com/help" className="hover:text-[var(--rb-fg-1)]">
            Help
          </Link>
          <span className="text-[var(--rb-fg-4)]">&copy; {new Date().getFullYear()} ReviewBox</span>
        </div>
      </main>
    </div>
  );
}
