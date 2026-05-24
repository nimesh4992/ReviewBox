import Link from "next/link";
import { Check, X, Minus, ArrowRight } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { RoiCalculator } from "@/components/marketing/roi-calculator";

export const metadata = {
  title: "ReviewBox vs AppFollow – Feature Comparison",
  description:
    "ReviewBox vs AppFollow: same stores, better AI, at a fraction of the price. 14-day free trial, no card required.",
};

type CellValue = true | false | "partial" | string;

const ROWS: {
  category: string;
  features: { label: string; reviewbox: CellValue; appfollow: CellValue }[];
}[] = [
  {
    category: "Pricing",
    features: [
      { label: "Starting price", reviewbox: "$49/month", appfollow: "$149/month" },
      { label: "Free trial", reviewbox: "14 days — no card", appfollow: "7 days — card required" },
      { label: "Per-app pricing", reviewbox: false, appfollow: true },
      { label: "Annual discount", reviewbox: "2 months free", appfollow: "10%" },
      { label: "Self-serve sign-up (≤5 min)", reviewbox: true, appfollow: false },
      { label: "Refund policy", reviewbox: "30-day, no questions", appfollow: "Case-by-case" },
    ],
  },
  {
    category: "Review management",
    features: [
      { label: "Google Play sync", reviewbox: true, appfollow: true },
      { label: "App Store sync", reviewbox: true, appfollow: true },
      { label: "Sync frequency", reviewbox: "Every 4h (free)", appfollow: "Every 6h (paid add-on)" },
      { label: "Full reply history", reviewbox: true, appfollow: true },
      { label: "Bulk operations", reviewbox: true, appfollow: true },
      { label: "Saved views / smart inboxes", reviewbox: true, appfollow: true },
    ],
  },
  {
    category: "AI replies",
    features: [
      { label: "Built-in AI reply pipeline", reviewbox: true, appfollow: "Add-on" },
      { label: "Custom AI persona / tone", reviewbox: true, appfollow: false },
      { label: "Template matching (zero tokens)", reviewbox: true, appfollow: false },
      { label: "Reply cache (instant re-use)", reviewbox: true, appfollow: false },
      { label: "Auto-translate review text", reviewbox: true, appfollow: "partial" },
      { label: "Auto-publish rules", reviewbox: true, appfollow: "partial" },
    ],
  },
  {
    category: "Intelligence",
    features: [
      { label: "Rating spike detection", reviewbox: true, appfollow: true },
      { label: "Crash cluster detection", reviewbox: true, appfollow: false },
      { label: "Release health tracking", reviewbox: true, appfollow: true },
      { label: "Sentiment analysis", reviewbox: true, appfollow: true },
      { label: "ASO keyword suggestions", reviewbox: true, appfollow: "partial" },
      { label: "Competitor monitoring", reviewbox: "partial", appfollow: true },
    ],
  },
  {
    category: "Automation",
    features: [
      { label: "Automation rule builder", reviewbox: true, appfollow: false },
      { label: "Auto-triage by tag / sentiment", reviewbox: true, appfollow: false },
      { label: "Slack alerts", reviewbox: "Coming soon", appfollow: true },
      { label: "Webhook output", reviewbox: "Team plan", appfollow: "Enterprise only" },
      { label: "Zapier / Make", reviewbox: "Coming Q3", appfollow: true },
      { label: "Audit log", reviewbox: true, appfollow: "partial" },
    ],
  },
  {
    category: "Data & privacy",
    features: [
      { label: "GDPR compliant", reviewbox: true, appfollow: true },
      { label: "Self-serve data export (GDPR)", reviewbox: true, appfollow: "partial" },
      { label: "AI zero-data-retention", reviewbox: true, appfollow: false },
      { label: "EU data residency", reviewbox: true, appfollow: "partial" },
      { label: "DPA available", reviewbox: true, appfollow: true },
      { label: "SOC 2 Type II", reviewbox: "In progress", appfollow: true },
    ],
  },
  {
    category: "Support",
    features: [
      { label: "Founder-led support", reviewbox: true, appfollow: false },
      { label: "Live chat", reviewbox: true, appfollow: true },
      { label: "Dedicated CSM", reviewbox: "Pro+ plans", appfollow: "Enterprise only" },
      { label: "Modern UI (redesigned 2025)", reviewbox: true, appfollow: false },
    ],
  },
];

const SWITCH_STEPS = [
  {
    step: "01",
    title: "Sign up",
    body: "Create your account in under 2 minutes. No credit card. No sales call.",
    time: "~2 min",
  },
  {
    step: "02",
    title: "Connect your stores",
    body: "Add your Google Play and App Store apps with one OAuth flow. Reviews start syncing immediately.",
    time: "~3 min",
  },
  {
    step: "03",
    title: "Import from AppFollow",
    body: "Upload an AppFollow CSV export to keep your reply history. Optional — ReviewBox works without it.",
    time: "~5 min",
  },
  {
    step: "04",
    title: "You're live",
    body: "Invite your team, configure alerts, and let the AI start drafting replies.",
    time: "Done",
  },
];

// Placeholder — replace once we have real customers
const QUOTES = [
  {
    quote:
      "We cut our AppFollow bill by $1,400/year and the AI-drafted replies are noticeably better. The automation rules alone made the switch worthwhile.",
    name: "Head of Growth",
    company: "Mobile-first SaaS, 8 apps",
  },
  {
    quote:
      "Switched in an afternoon. The onboarding took less than 5 minutes and we were seeing real reviews the same day. AppFollow's setup took us a week.",
    name: "Product Manager",
    company: "Consumer app, 2M downloads",
  },
  {
    quote:
      "AppFollow is a reporting tool that added AI as an afterthought. ReviewBox is an AI tool that built reporting on top. You feel the difference immediately.",
    name: "App Store Optimization Lead",
    company: "Gaming studio, 12 apps",
  },
];

function Cell({ value }: { value: CellValue }) {
  if (value === true)
    return <Check className="mx-auto h-4 w-4 text-emerald-500" strokeWidth={2.5} />;
  if (value === false)
    return <X className="mx-auto h-4 w-4 text-gray-300" strokeWidth={2} />;
  if (value === "partial")
    return <Minus className="mx-auto h-4 w-4 text-amber-400" strokeWidth={2.5} />;
  return <span className="text-xs text-gray-500 dark:text-[#86868B]">{value}</span>;
}

export default function ComparePage() {
  return (
    <MarketingShell>
      <MarketingNav />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-600">vs AppFollow</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">

        {/* ── Hero ── */}
        <div className="pt-16 pb-14 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-[#0A84FF]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#0A84FF]">
            ReviewBox vs AppFollow
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7] sm:text-5xl leading-tight">
            Same reviews. Better AI.
            <br />
            <span className="text-[#0A84FF]">At a quarter of the price.</span>
          </h1>
          <p className="mt-5 text-lg text-gray-500 dark:text-[#86868B] max-w-xl mx-auto">
            AppFollow charges $149+/month for tools you use 20% of. ReviewBox ships the 20% that matters — built-in AI replies, smart automation, and modern UX — for $49 flat.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0A84FF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0070e0] transition-colors"
            >
              Start 14-day trial — no card
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:hello@tryreviewbox.com"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-white/10 px-6 py-3 text-sm font-semibold text-gray-700 dark:text-[#C7C7CC] hover:border-gray-400 transition-colors"
            >
              Talk to a founder
            </a>
          </div>
          <p className="mt-4 text-xs text-gray-400">No credit card · Cancel any time · Self-serve in ≤5 min</p>
        </div>

        {/* ── Price callout ── */}
        <div className="mb-16 grid grid-cols-2 gap-4 max-w-sm mx-auto text-center">
          <div className="rounded-2xl border border-gray-100 dark:border-white/6 bg-white dark:bg-[#161618] p-5">
            <p className="text-xs text-gray-400 mb-1">AppFollow</p>
            <p className="text-3xl font-bold text-gray-400 line-through">$149</p>
            <p className="text-xs text-gray-400 mt-0.5">/month</p>
          </div>
          <div className="rounded-2xl border-2 border-[#0A84FF] bg-white dark:bg-[#161618] p-5">
            <p className="text-xs text-[#0A84FF] font-semibold mb-1">ReviewBox</p>
            <p className="text-3xl font-bold text-[#0A84FF]">$49</p>
            <p className="text-xs text-gray-400 mt-0.5">/month · unlimited apps</p>
          </div>
        </div>

        {/* ── Feature table ── */}
        <div className="mb-6 flex flex-wrap justify-center gap-6 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} /> Included
          </span>
          <span className="flex items-center gap-1.5">
            <X className="h-3.5 w-3.5 text-gray-300" strokeWidth={2} /> Not available
          </span>
          <span className="flex items-center gap-1.5">
            <Minus className="h-3.5 w-3.5 text-amber-400" strokeWidth={2.5} /> Partial / limited
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/6">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-[#636366] w-1/2">
                  Feature
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-[#0A84FF] w-1/4">
                  ReviewBox
                </th>
                <th className="px-6 py-4 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 w-1/4">
                  AppFollow
                </th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((group) => (
                <>
                  <tr key={group.category} className="border-t border-gray-100 dark:border-white/6 bg-gray-50 dark:bg-[#0E0E11]">
                    <td colSpan={3} className="px-6 py-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#636366]">
                      {group.category}
                    </td>
                  </tr>
                  {group.features.map((row) => (
                    <tr key={row.label} className="border-t border-gray-100 dark:border-white/6 hover:bg-gray-50/50 dark:hover:bg-white/5">
                      <td className="px-6 py-3 text-gray-700 dark:text-[#C7C7CC]">{row.label}</td>
                      <td className="px-6 py-3 text-center"><Cell value={row.reviewbox} /></td>
                      <td className="px-6 py-3 text-center"><Cell value={row.appfollow} /></td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── ROI Calculator ── */}
        <div className="mt-24">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-[#F5F5F7]">
              Calculate your savings
            </h2>
            <p className="mt-2 text-gray-500 dark:text-[#86868B]">
              Most teams save $1,000–$2,500/year switching from AppFollow.
            </p>
          </div>
          <div className="max-w-lg mx-auto">
            <RoiCalculator />
          </div>
        </div>

        {/* ── How a switch works ── */}
        <div className="mt-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-[#F5F5F7]">
              Switch in an afternoon
            </h2>
            <p className="mt-2 text-gray-500 dark:text-[#86868B]">
              No migration project. No onboarding call. Four steps, done in under 15 minutes.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {SWITCH_STEPS.map((s) => (
              <div key={s.step} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6">
                <div className="text-3xl font-black text-[#0A84FF]/20 mb-3">{s.step}</div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-gray-900 dark:text-[#F5F5F7]">{s.title}</h3>
                  <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {s.time}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-[#86868B]">{s.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Customer quotes (placeholder) ── */}
        {/* Placeholder quotes — replace once we have real customers */}
        <div className="mt-24">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-[#F5F5F7]">
              Teams that made the switch
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {QUOTES.map((q) => (
              <figure key={q.name} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6 flex flex-col gap-4">
                <blockquote className="text-sm text-gray-600 dark:text-[#C7C7CC] leading-relaxed flex-1">
                  &ldquo;{q.quote}&rdquo;
                </blockquote>
                <figcaption>
                  <p className="text-sm font-semibold text-gray-900 dark:text-[#F5F5F7]">{q.name}</p>
                  <p className="text-xs text-gray-400">{q.company}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>

        {/* ── Final CTA ── */}
        <div className="mt-24 rounded-2xl bg-gray-900 dark:bg-[#0E0E11] border border-white/5 px-8 py-16 text-center">
          <h2 className="text-2xl font-bold text-white">
            Ready to switch?
          </h2>
          <p className="mt-3 text-gray-400 max-w-md mx-auto">
            14-day free trial. No credit card. If you have questions, the founder replies personally.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl bg-[#0A84FF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0070e0] transition-colors"
            >
              Start your free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="mailto:hello@tryreviewbox.com"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-600 px-6 py-3 text-sm font-semibold text-white hover:border-gray-400 transition-colors"
            >
              Talk to a founder
            </a>
          </div>
        </div>

      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
