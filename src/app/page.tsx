import Link from "next/link";
import { Check, Inbox, Zap, AlertTriangle, BarChart2, Trophy } from "lucide-react";

const FEATURES = [
  {
    icon: Inbox,
    iconBg: "bg-[#0A84FF]/[0.08]",
    iconColor: "text-[#0A84FF]",
    title: "Reviews inbox",
    body: "All reviews in one place. Filter by sentiment, priority, version, and country. Never miss a critical review.",
  },
  {
    icon: Zap,
    iconBg: "bg-[#FF9F0A]/10",
    iconColor: "text-[#FF9F0A]",
    title: "AI reply drafts",
    body: "One-click replies trained on your brand voice. Empathetic, on-brand, and ready to send in seconds.",
  },
  {
    icon: AlertTriangle,
    iconBg: "bg-[#FF453A]/[0.08]",
    iconColor: "text-[#FF453A]",
    title: "Crash detection",
    body: "Automatically cluster crash reports from reviews and alert your engineering team before ratings drop.",
  },
  {
    icon: BarChart2,
    iconBg: "bg-[#30D158]/[0.08]",
    iconColor: "text-[#30D158]",
    title: "Sentiment trends",
    body: "Track positive and negative sentiment over time. See which topics are rising and which need attention.",
  },
  {
    icon: Trophy,
    iconBg: "bg-[#BF5AF2]/[0.08]",
    iconColor: "text-[#BF5AF2]",
    title: "Competitor intel",
    body: "Benchmark your rating and reply rate against top competitors. Know your rank in your category.",
  },
  {
    icon: Check,
    iconBg: "bg-[#0A84FF]/[0.08]",
    iconColor: "text-[#0A84FF]",
    title: "Automated reports",
    body: "Weekly digests, exec summaries, and bug triage exports. Delivered to your inbox, no manual work.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-fg-1">

      {/* ── Nav ── */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 max-w-[1080px] items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[#0A84FF] text-[11px] font-bold text-white tracking-tight">
              R
            </span>
            <span className="text-[14px] font-semibold tracking-tight text-fg-1">ReviewBox</span>
          </div>
          <nav className="hidden items-center gap-7 md:flex">
            <a href="#features" className="text-[13px] text-fg-2 transition-colors hover:text-fg-1">Features</a>
            <Link href="/pricing" className="text-[13px] text-fg-2 transition-colors hover:text-fg-1">Pricing</Link>
            <Link href="/compare" className="text-[13px] text-fg-2 transition-colors hover:text-fg-1">Compare</Link>
            <Link href="/blog" className="text-[13px] text-fg-2 transition-colors hover:text-fg-1">Blog</Link>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link
              href="/sign-in"
              className="text-[13px] font-medium text-fg-2 transition-colors hover:text-fg-1"
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
        <div className="pointer-events-none absolute inset-0 hero-dot-grid" />
        <div className="pointer-events-none absolute inset-0 hero-blue-glow" />

        <div className="relative z-10 flex max-w-[760px] flex-col items-center gap-7">
          {/* Eyebrow */}
          <div className="flex items-center gap-2 rounded-full border border-[#0A84FF]/20 bg-[#0A84FF]/[0.07] px-3.5 py-1">
            <span className="size-1.5 rounded-full bg-[#0A84FF]" />
            <span className="text-[12px] font-semibold text-[#0A84FF]">Now supporting Google Play + App Store</span>
          </div>

          <h1 className="hero-h1 font-semibold leading-[1.05] tracking-[-0.03em] text-fg-1">
            Turn reviews into your{" "}
            <span className="rb-gradient-text">competitive edge</span>
          </h1>

          <p className="max-w-[520px] text-[17px] leading-relaxed text-fg-2">
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
              className="rounded-xl border border-black/[0.1] bg-white px-7 py-3 text-[15px] font-semibold text-fg-1 transition-colors hover:bg-canvas"
            >
              See how it works
            </Link>
          </div>

          <p className="text-[12px] text-fg-3">
            14-day free trial · No credit card required · Cancel anytime
          </p>
        </div>
      </section>

      {/* ── Logo wall ── */}
      <section className="border-y border-black/[0.04] bg-white px-6 py-10">
        <div className="mx-auto max-w-[1080px]">
          <p className="mb-8 text-center text-[11px] font-semibold uppercase tracking-widest text-fg-3">
            Trusted by mobile teams at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {["Acme Banking", "FinTrack", "ShipFast", "Nomad", "BuildKit", "Orbit", "Forma", "Relay"].map((name) => (
              <div
                key={name}
                className="rounded-xl border border-black/[0.06] bg-white px-5 py-2.5 text-[13px] font-semibold text-fg-3"
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-y border-black/[0.06] bg-canvas py-14">
        <div className="mx-auto grid max-w-[900px] grid-cols-3 divide-x divide-black/[0.06] px-6">
          {[
            { value: "2 min", label: "Avg. reply time with AI" },
            { value: "94%",   label: "Teams hit reply-rate target" },
            { value: "0.4★",  label: "Avg. rating lift in 60 days" },
          ].map(({ value, label }) => (
            <div key={label} className="flex flex-col items-center gap-1.5 px-8 text-center">
              <span className="text-[36px] font-semibold tracking-[-0.02em] text-fg-1">{value}</span>
              <span className="text-[13px] text-fg-3">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="px-6 py-28">
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-16 text-center">
            <h2 className="text-[40px] font-semibold tracking-[-0.025em] text-fg-1">
              Everything your team needs
            </h2>
            <p className="mt-3 text-[16px] text-fg-3">
              Built for mobile teams who care about ratings and product quality.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {FEATURES.map(({ icon: Icon, iconBg, iconColor, title, body }) => (
              <div
                key={title}
                className="flex flex-col gap-4 rounded-[18px] border border-black/[0.06] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
              >
                <div className={`flex size-10 items-center justify-center rounded-[10px] ${iconBg}`}>
                  <Icon className={`size-5 ${iconColor}`} strokeWidth={1.5} />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-fg-1">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-fg-3">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="px-6 py-20 bg-canvas">
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-12 text-center">
            <h2 className="text-[32px] font-semibold tracking-[-0.025em] text-fg-1">
              Real results from real teams
            </h2>
            <p className="mt-3 text-[15px] text-fg-3">
              Across fintech, B2B SaaS, and consumer apps.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                quote: "We went from replying to 20% of our reviews to 95% — with better, more on-brand responses. It took one afternoon to set up.",
                author: "Sarah K.", role: "Head of Product, Fintech startup", rating: 5,
              },
              {
                quote: "The crash spike alerts alone are worth it. We caught a P0 regression in our payment flow from a 1-star surge before our on-call engineer got paged.",
                author: "Marcus T.", role: "Engineering Lead, B2B SaaS", rating: 5,
              },
              {
                quote: "Our app store rating went from 4.0 to 4.6 in three months. We changed nothing in the product — we just started actually responding to every review.",
                author: "Priya M.", role: "Growth, Consumer app (2M MAU)", rating: 5,
              },
            ].map((t) => (
              <div key={t.author} className="flex flex-col gap-4 rounded-[18px] border border-black/[0.06] bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <span key={i} className="text-[#FF9F0A] text-sm">★</span>
                  ))}
                </div>
                <p className="flex-1 text-[13px] leading-relaxed text-fg-2">&ldquo;{t.quote}&rdquo;</p>
                <div className="border-t border-black/[0.05] pt-4">
                  <p className="text-[13px] font-semibold text-fg-1">{t.author}</p>
                  <p className="text-[12px] text-fg-3">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/customers" className="text-[13px] font-medium text-[#0A84FF] hover:underline">
              See all customer stories →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="bg-canvas px-6 py-28">
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-16 text-center">
            <h2 className="text-[40px] font-semibold tracking-[-0.025em] text-fg-1">
              Simple pricing
            </h2>
            <p className="mt-3 text-[16px] text-fg-3">Start free. Upgrade when you grow.</p>
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
                  <p className="text-[13px] font-medium text-fg-3">{name}</p>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-[40px] font-semibold leading-none tracking-tight text-fg-1">{price}</span>
                    <span className="mb-1 text-[13px] text-fg-3">/mo</span>
                  </div>
                </div>
                <ul className="flex flex-col gap-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-[13px] text-fg-2">
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
                      : "border border-black/[0.1] bg-white text-fg-1 hover:bg-canvas"
                  }`}
                >
                  Start free trial
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Demo CTA ── */}
      <section className="px-6 py-20 bg-white">
        <div className="mx-auto max-w-[680px] text-center">
          <h2 className="text-[32px] font-semibold tracking-[-0.025em] text-fg-1">
            Not ready to start a trial?
          </h2>
          <p className="mt-3 text-[15px] text-fg-3">
            Book a 20-minute demo and we&apos;ll walk through your specific app and use case.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="rounded-xl bg-[#0A84FF] px-7 py-3 text-[15px] font-semibold text-white shadow-[0_4px_24px_rgba(10,132,255,0.25)] transition-colors hover:bg-[#006EE0]"
            >
              Start free trial
            </Link>
            <Link
              href="mailto:sales@tryreviewbox.com?subject=Demo request"
              className="rounded-xl border border-black/[0.1] bg-white px-7 py-3 text-[15px] font-semibold text-fg-1 transition-colors hover:bg-canvas"
            >
              Book a demo
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-fg-3">14-day free trial · No credit card · Cancel anytime</p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-black/[0.06] bg-white px-6 py-12">
        <div className="mx-auto max-w-[1080px]">
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 mb-10">
            {[
              { group: "Product",   links: [{ l: "Pricing", h: "/pricing" }, { l: "Compare", h: "/compare" }, { l: "Customers", h: "/customers" }, { l: "Changelog", h: "/changelog" }] },
              { group: "Company",   links: [{ l: "About", h: "/about" }, { l: "Blog", h: "/blog" }, { l: "Careers", h: "/careers" }, { l: "Contact", h: "/contact" }] },
              { group: "Resources", links: [{ l: "Help Center", h: "/help" }, { l: "FAQ", h: "/faq" }, { l: "Status", h: "/status" }] },
              { group: "Legal",     links: [{ l: "Terms", h: "/terms" }, { l: "Privacy", h: "/privacy" }, { l: "DPA", h: "/dpa" }, { l: "Refund Policy", h: "/refund-policy" }] },
            ].map(({ group, links }) => (
              <div key={group}>
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-fg-3">{group}</p>
                <ul className="space-y-2">
                  {links.map(({ l, h }) => (
                    <li key={l}><Link href={h} className="text-[13px] text-fg-3 hover:text-fg-1 transition-colors">{l}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-black/[0.06] pt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <span className="flex size-6 items-center justify-center rounded-md bg-[#0A84FF] text-[10px] font-bold text-white">R</span>
              <span className="text-[13px] font-semibold text-fg-1">ReviewBox</span>
              <span className="text-[12px] text-fg-3">© 2026 AT Work Inc.</span>
            </div>
            <a href="mailto:hello@tryreviewbox.com" className="text-[12px] text-fg-3 hover:text-fg-1 transition-colors">
              hello@tryreviewbox.com
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
