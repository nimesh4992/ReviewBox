import Link from "next/link";
import { Check, Inbox, Zap, AlertTriangle, BarChart2, Trophy } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-[#1D1D1F]" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>

      {/* ── Nav ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#0A84FF] text-[11px] font-bold text-white tracking-tight">
              R
            </span>
            <span className="text-[14px] font-semibold tracking-tight text-[#1D1D1F]">Revi</span>
          </div>
          <nav className="hidden items-center gap-7 md:flex">
            {["Features", "Pricing", "Blog"].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase()}`}
                className="text-[13px] text-[#48484D] transition-colors hover:text-[#1D1D1F]"
              >
                {item}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            <Link
              href="/sign-in"
              className="text-[13px] font-medium text-[#48484D] transition-colors hover:text-[#1D1D1F]"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-[#0A84FF] px-4 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#006EE0]"
            >
              Start free
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center px-6 pt-14 text-center overflow-hidden">
        {/* Dot grid */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(circle, #d1d5db 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            opacity: 0.45,
          }}
        />
        {/* Blue glow */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: "radial-gradient(ellipse 70% 50% at 50% 60%, rgba(10,132,255,0.07) 0%, transparent 70%)",
          }}
        />

        <div className="relative z-10 flex max-w-[760px] flex-col items-center gap-7">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 rounded-full border border-[#0A84FF]/20 bg-[#0A84FF]/[0.07] px-3.5 py-1">
            <span className="size-1.5 rounded-full bg-[#0A84FF]" />
            <span className="text-[12px] font-semibold text-[#0A84FF]">Now supporting Google Play + App Store</span>
          </div>

          <h1
            className="font-semibold leading-[1.05] tracking-[-0.03em] text-[#1D1D1F]"
            style={{ fontSize: "clamp(48px, 7vw, 80px)" }}
          >
            Turn reviews into your{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #0A84FF 0%, #0058B3 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              competitive edge
            </span>
          </h1>

          <p className="max-w-[520px] text-[17px] leading-relaxed text-[#48484D]">
            AI-powered review management for Google Play and App Store. Reply faster, spot crashes earlier, keep ratings high.
          </p>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="rounded-xl bg-[#0A84FF] px-7 py-3 text-[15px] font-semibold text-white shadow-[0_4px_24px_rgba(10,132,255,0.30)] transition-colors hover:bg-[#006EE0]"
            >
              Start free trial
            </Link>
            <Link
              href="#features"
              className="rounded-xl border border-black/[0.1] bg-white px-7 py-3 text-[15px] font-semibold text-[#1D1D1F] transition-colors hover:bg-[#F5F5F7]"
            >
              See how it works
            </Link>
          </div>

          <p className="text-[12px] text-[#86868B]">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-black/[0.06] bg-[#F5F5F7] py-14">
        <div className="mx-auto grid max-w-[900px] grid-cols-3 divide-x divide-black/[0.06] px-6">
          {[
            { value: "2 min", label: "Avg. reply time with AI" },
            { value: "94%",   label: "Teams hit reply-rate target" },
            { value: "0.4★",  label: "Avg. rating lift in 60 days" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 px-8 text-center">
              <span className="text-[36px] font-semibold tracking-[-0.02em] text-[#1D1D1F]">{value}</span>
              <span className="text-[13px] text-[#86868B]">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="px-6 py-28">
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-16 text-center">
            <h2 className="text-[40px] font-semibold tracking-[-0.025em] text-[#1D1D1F]">
              Everything your team needs
            </h2>
            <p className="mt-3 text-[16px] text-[#86868B]">
              Built for mobile teams who care about ratings and product quality.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Inbox,
                color: "#0A84FF",
                bg: "rgba(10,132,255,0.08)",
                title: "Reviews inbox",
                body: "All reviews in one place. Filter by sentiment, priority, version, and country. Never miss a critical review.",
              },
              {
                icon: Zap,
                color: "#FF9F0A",
                bg: "rgba(255,159,10,0.10)",
                title: "AI reply drafts",
                body: "One-click replies trained on your brand voice. Empathetic, on-brand, and ready to send in seconds.",
              },
              {
                icon: AlertTriangle,
                color: "#FF453A",
                bg: "rgba(255,69,58,0.08)",
                title: "Crash detection",
                body: "Automatically cluster crash reports from reviews and alert your engineering team before ratings drop.",
              },
              {
                icon: BarChart2,
                color: "#30D158",
                bg: "rgba(48,209,88,0.08)",
                title: "Sentiment trends",
                body: "Track positive and negative sentiment over time. See which topics are rising and which need attention.",
              },
              {
                icon: Trophy,
                color: "#BF5AF2",
                bg: "rgba(191,90,242,0.08)",
                title: "Competitor intel",
                body: "Benchmark your rating and reply rate against top competitors. Know your rank in your category.",
              },
              {
                icon: Check,
                color: "#0A84FF",
                bg: "rgba(10,132,255,0.08)",
                title: "Automated reports",
                body: "Weekly digests, exec summaries, and bug triage exports. Delivered to your inbox, no manual work.",
              },
            ].map(({ icon: Icon, color, bg, title, body }) => (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-[18px] border border-black/[0.06] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              >
                <div
                  className="flex size-10 items-center justify-center rounded-[10px]"
                  style={{ background: bg }}
                >
                  <Icon className="size-5" style={{ color }} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1D1D1F]">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-[#86868B]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-[#F5F5F7] px-6 py-28">
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-16 text-center">
            <h2 className="text-[40px] font-semibold tracking-[-0.025em] text-[#1D1D1F]">
              Simple pricing
            </h2>
            <p className="mt-3 text-[16px] text-[#86868B]">Start free. Upgrade when you grow.</p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                name: "Starter",
                price: "$49",
                highlight: false,
                features: ["2 apps", "5,000 reviews / mo", "Email alerts", "50 AI drafts / day"],
              },
              {
                name: "Pro",
                price: "$99",
                highlight: true,
                features: ["10 apps", "50,000 reviews / mo", "Slack + email alerts", "200 AI drafts / day"],
              },
              {
                name: "Team",
                price: "$199",
                highlight: false,
                features: ["Unlimited apps", "Unlimited reviews", "Unlimited AI drafts", "Priority support"],
              },
            ].map(({ name, price, highlight, features }) => (
              <div
                key={name}
                className={`relative flex flex-col gap-6 rounded-[18px] border p-7 ${
                  highlight
                    ? "border-[#0A84FF]/40 bg-white shadow-[0_4px_32px_rgba(10,132,255,0.12)]"
                    : "border-black/[0.06] bg-white"
                }`}
              >
                {highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0A84FF] px-3 py-0.5 text-[11px] font-semibold text-white">
                    Most popular
                  </span>
                )}
                <div>
                  <p className="text-[13px] font-medium text-[#86868B]">{name}</p>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-[40px] font-semibold leading-none tracking-tight text-[#1D1D1F]">{price}</span>
                    <span className="mb-1 text-[13px] text-[#86868B]">/mo</span>
                  </div>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-[13px] text-[#48484D]">
                      <Check className="size-4 shrink-0 text-[#0A84FF]" strokeWidth={2.5} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/sign-up"
                  className={`mt-auto rounded-xl py-2.5 text-center text-[13px] font-semibold transition-colors ${
                    highlight
                      ? "bg-[#0A84FF] text-white hover:bg-[#006EE0]"
                      : "border border-black/[0.1] bg-white text-[#1D1D1F] hover:bg-[#F5F5F7]"
                  }`}
                >
                  Start free trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-black/[0.06] px-6 py-10">
        <div className="mx-auto flex max-w-[1080px] flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-md bg-[#0A84FF] text-[10px] font-bold text-white">R</span>
            <span className="text-[13px] font-semibold text-[#1D1D1F]">Revi</span>
            <span className="text-[12px] text-[#86868B]">— Review Intelligence</span>
          </div>
          <div className="flex items-center gap-6 text-[12px] text-[#86868B]">
            <Link href="/terms"   className="transition-colors hover:text-[#1D1D1F]">Terms</Link>
            <Link href="/privacy" className="transition-colors hover:text-[#1D1D1F]">Privacy</Link>
            <span>© 2026 Revi</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
