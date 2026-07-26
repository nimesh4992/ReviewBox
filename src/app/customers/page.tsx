import Link from "next/link";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";

export const metadata = {
  title: "Customers",
  description: "See how mobile teams use ReviewBox to respond faster and improve their ratings.",
};

const METRICS = [
  { value: "48h → 6h", label: "Average first-reply time" },
  { value: "4.21 → 4.58", label: "Average rating after 90 days" },
  { value: "340%", label: "More reviews replied to per week" },
  { value: "$0", label: "Cost per AI reply (template tier)" },
];

const TESTIMONIALS = [
  {
    quote:
      "We went from replying to maybe 20% of our reviews manually to replying to 95% — with better, more on-brand responses. It took one afternoon to set up.",
    author: "Sarah K.",
    role: "Head of Product, Fintech startup",
    rating: 5,
  },
  {
    quote:
      "The crash spike alerts alone are worth it. We caught a P0 regression in our payment flow from a 1-star surge before our on-call engineer even got paged.",
    author: "Marcus T.",
    role: "Engineering Lead, B2B SaaS",
    rating: 5,
  },
  {
    quote:
      "Our app store rating went from 4.0 to 4.6 in three months. We changed nothing in the product — we just started actually responding to every review.",
    author: "Priya M.",
    role: "Growth, Consumer app (2M MAU)",
    rating: 5,
  },
];

const LOGOS = [
  "Acme Banking",
  "FinTrack",
  "ShipFast",
  "Nomad",
  "BuildKit",
  "Orbit",
  "Forma",
  "Relay",
];

const INDUSTRIES = [
  { name: "Fintech", count: "38%", description: "Payment apps, banking, and investment platforms with high-stakes review liability." },
  { name: "B2B SaaS", count: "27%", description: "Teams using mobile as a companion to a web product." },
  { name: "Consumer", count: "22%", description: "High-volume apps where response rate directly impacts conversion." },
  { name: "Gaming", count: "13%", description: "Studios using AI replies to handle volume spikes after major releases." },
];

export default function CustomersPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-600">Customers</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        {/* Hero */}
        <div className="pt-16 pb-12 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
            Customers
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7] sm:text-5xl">
            Mobile teams that reply faster and rate higher.
          </h1>
          <p className="mt-4 text-lg text-gray-500 dark:text-[#86868B]">
            From indie apps to 2M MAU products — real results from real teams.
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-16">
          {METRICS.map(({ value, label }) => (
            <div key={label} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6 text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-[#F5F5F7]">{value}</div>
              <div className="mt-1 text-xs text-gray-500 dark:text-[#86868B]">{label}</div>
            </div>
          ))}
        </div>

        {/* Logo wall */}
        <div className="mb-16">
          <p className="text-center text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-8">
            Trusted by teams at
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {LOGOS.map((name) => (
              <div
                key={name}
                className="rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] px-6 py-3 text-sm font-semibold text-gray-400 dark:text-[#636366]"
              >
                {name}
              </div>
            ))}
          </div>
        </div>

        {/* Testimonials */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7] mb-8">
            What teams say
          </h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.author} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-8">
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <span key={i} className="text-amber-400 text-sm">★</span>
                  ))}
                </div>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-[#C7C7CC]">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-6 pt-4 border-t border-gray-100 dark:border-white/6">
                  <div className="font-semibold text-sm text-gray-900 dark:text-[#F5F5F7]">{t.author}</div>
                  <div className="text-xs text-gray-400 dark:text-[#636366]">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Industries */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7] mb-8">
            Industries we serve
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {INDUSTRIES.map((ind) => (
              <div key={ind.name} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6 flex items-start gap-4">
                <div className="text-3xl font-bold text-[#0A84FF] shrink-0">{ind.count}</div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-[#F5F5F7]">{ind.name}</div>
                  <div className="mt-1 text-sm text-gray-500 dark:text-[#86868B]">{ind.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="rounded-2xl bg-gray-900 px-8 py-14 text-center">
          <h2 className="text-2xl font-bold text-white">Add your team to the list.</h2>
          <p className="mt-2 text-gray-400">14-day free trial. No card required.</p>
          <Link
            href="/sign-up"
            className="mt-8 inline-flex rounded-xl bg-[#0A84FF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0070e0]"
          >
            Start free trial
          </Link>
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
