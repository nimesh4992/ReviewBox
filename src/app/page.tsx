import Link from "next/link";
import { Inbox, Zap, AlertTriangle } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0d0f14] text-white">
      {/* ─── Nav ─── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.06] bg-[#0d0f14]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#5B5BD6] text-sm font-bold text-white">
              R
            </span>
            <span className="text-sm font-semibold tracking-tight text-white">Revi</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/sign-in"
              className="text-sm text-white/60 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-[#5B5BD6] px-4 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section
        className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-14 text-center"
        style={{
          background: "linear-gradient(to bottom, #0d0f14 0%, #111318 100%)",
        }}
      >
        {/* Subtle glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 40% at 50% 30%, rgba(91,91,214,0.12) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex max-w-3xl flex-col items-center gap-6">
          {/* Logo mark */}
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B5BD6] text-lg font-bold text-white shadow-lg shadow-[#5B5BD6]/30">
              R
            </span>
            <span className="text-xl font-semibold tracking-tight text-white">Revi</span>
          </div>

          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            Turn app store reviews into your{" "}
            <span className="text-[#5B5BD6]">competitive advantage</span>
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-white/60 sm:text-lg">
            AI-powered review management for Google Play and App Store. Reply
            faster, spot crashes earlier, keep ratings high.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="rounded-xl bg-[#5B5BD6] px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-[#5B5BD6]/25 transition-opacity hover:opacity-90"
            >
              Start free trial
            </Link>
            <Link
              href="#features"
              className="rounded-xl border border-white/[0.12] px-6 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/25 hover:text-white"
            >
              See how it works
            </Link>
          </div>

          <p className="text-xs text-white/30">
            14-day free trial · No credit card required
          </p>
        </div>
      </section>

      {/* ─── Stats bar ─── */}
      <section className="border-y border-white/[0.06] bg-white/[0.03] py-12">
        <div className="mx-auto grid max-w-3xl grid-cols-3 gap-8 px-6 text-center">
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-bold text-white sm:text-4xl">2 min</span>
            <span className="text-sm text-white/50">Average reply time with AI</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-bold text-white sm:text-4xl">94%</span>
            <span className="text-sm text-white/50">Review response rate</span>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-3xl font-bold text-white sm:text-4xl">4.8★</span>
            <span className="text-sm text-white/50">Average rating improvement</span>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Everything your support team needs
            </h2>
            <p className="mt-3 text-white/50">
              Built for mobile teams who care about ratings.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B5BD6]/15">
                <Inbox className="h-5 w-5 text-[#5B5BD6]" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-semibold text-white">Reviews feed</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                  All your reviews in one place. Filter by sentiment, priority,
                  version, and country.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B5BD6]/15">
                <Zap className="h-5 w-5 text-[#5B5BD6]" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-semibold text-white">AI reply drafts</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                  One-click AI replies trained on your product context.
                  Empathetic, on-brand, always.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5B5BD6]/15">
                <AlertTriangle className="h-5 w-5 text-[#5B5BD6]" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-semibold text-white">Crash detection</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-white/55">
                  Automatically detect crash spikes before your rating tanks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Pricing ─── */}
      <section id="pricing" className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-3 text-white/50">
              Start free. Upgrade when you need more.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {/* Starter */}
            <div className="flex flex-col gap-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div>
                <p className="text-sm font-medium text-white/50">Starter</p>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">$49</span>
                  <span className="mb-1 text-sm text-white/50">/mo</span>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5 text-sm text-white/60">
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  2 apps
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  5,000 reviews / month
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  Email alerts
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  50 AI drafts / day
                </li>
              </ul>
              <Link
                href="/sign-up"
                className="mt-auto rounded-xl border border-white/[0.12] py-2.5 text-center text-sm font-semibold text-white/80 transition-colors hover:border-white/25 hover:text-white"
              >
                Start free trial
              </Link>
            </div>

            {/* Pro */}
            <div className="relative flex flex-col gap-6 rounded-2xl border border-[#5B5BD6]/50 bg-[#5B5BD6]/[0.06] p-6">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#5B5BD6] px-3 py-0.5 text-xs font-semibold text-white">
                Most popular
              </span>
              <div>
                <p className="text-sm font-medium text-white/50">Pro</p>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">$99</span>
                  <span className="mb-1 text-sm text-white/50">/mo</span>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5 text-sm text-white/60">
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  10 apps
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  50,000 reviews / month
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  Slack alerts
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  200 AI drafts / day
                </li>
              </ul>
              <Link
                href="/sign-up"
                className="mt-auto rounded-xl bg-[#5B5BD6] py-2.5 text-center text-sm font-semibold text-white shadow-lg shadow-[#5B5BD6]/25 transition-opacity hover:opacity-90"
              >
                Start free trial
              </Link>
            </div>

            {/* Team */}
            <div className="flex flex-col gap-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6">
              <div>
                <p className="text-sm font-medium text-white/50">Team</p>
                <div className="mt-2 flex items-end gap-1">
                  <span className="text-4xl font-bold text-white">$199</span>
                  <span className="mb-1 text-sm text-white/50">/mo</span>
                </div>
              </div>
              <ul className="flex flex-col gap-2.5 text-sm text-white/60">
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  Unlimited apps
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  Unlimited reviews
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  Unlimited AI drafts
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-[#5B5BD6]">✓</span>
                  Priority support
                </li>
              </ul>
              <Link
                href="/sign-up"
                className="mt-auto rounded-xl border border-white/[0.12] py-2.5 text-center text-sm font-semibold text-white/80 transition-colors hover:border-white/25 hover:text-white"
              >
                Start free trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/[0.06] py-10 px-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#5B5BD6] text-xs font-bold text-white">
                R
              </span>
              <span className="text-sm font-semibold text-white">Revi</span>
            </div>
            <p className="text-xs text-white/35">
              AI-powered app store review management
            </p>
          </div>

          <div className="flex items-center gap-6 text-xs text-white/40">
            <Link href="/terms" className="transition-colors hover:text-white/70">
              Terms
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-white/70">
              Privacy
            </Link>
            <span>© 2026 Revi. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
