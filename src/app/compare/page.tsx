import Link from "next/link";
import { Check, X, Minus } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export const metadata = {
  title: "ReviewBox vs AppFollow — Feature Comparison",
  description:
    "See how ReviewBox compares to AppFollow across AI replies, automation, pricing, and data ownership.",
};

type CellValue = true | false | "partial" | string;

const ROWS: {
  category: string;
  features: { label: string; reviewbox: CellValue; appfollow: CellValue }[];
}[] = [
  {
    category: "Review management",
    features: [
      { label: "Google Play sync", reviewbox: true, appfollow: true },
      { label: "App Store sync", reviewbox: true, appfollow: true },
      { label: "Sync frequency", reviewbox: "Every 4h (free)", appfollow: "Every 6h (paid add-on)" },
      { label: "Full reply history", reviewbox: true, appfollow: true },
      { label: "Bulk reply", reviewbox: true, appfollow: true },
    ],
  },
  {
    category: "AI replies",
    features: [
      { label: "AI reply drafts", reviewbox: true, appfollow: "partial" },
      { label: "Custom AI persona/tone", reviewbox: true, appfollow: false },
      { label: "Template matching (0 tokens)", reviewbox: true, appfollow: false },
      { label: "Reply cache (instant)", reviewbox: true, appfollow: false },
      { label: "Auto-publish rules", reviewbox: true, appfollow: "partial" },
      { label: "AI model selection", reviewbox: "Groq + Gemini", appfollow: "ChatGPT (GPT-4o)" },
    ],
  },
  {
    category: "Intelligence",
    features: [
      { label: "Rating spike detection", reviewbox: true, appfollow: true },
      { label: "Crash cluster detection", reviewbox: true, appfollow: false },
      { label: "Release health tracking", reviewbox: true, appfollow: true },
      { label: "ASO keyword suggestions", reviewbox: true, appfollow: "partial" },
      { label: "Competitor monitoring", reviewbox: "partial", appfollow: true },
      { label: "Sentiment analysis", reviewbox: true, appfollow: true },
    ],
  },
  {
    category: "Automation",
    features: [
      { label: "Automation rule builder", reviewbox: true, appfollow: false },
      { label: "Auto-triage by tag/sentiment", reviewbox: true, appfollow: false },
      { label: "Slack alerts", reviewbox: true, appfollow: true },
      { label: "Webhook output", reviewbox: "Team plan", appfollow: "Enterprise only" },
      { label: "Zapier / Make", reviewbox: "Coming Q3", appfollow: true },
    ],
  },
  {
    category: "Pricing",
    features: [
      { label: "Free trial", reviewbox: "14 days, no card", appfollow: "7 days, card required" },
      { label: "Starting price", reviewbox: "$49/month", appfollow: "$149/month" },
      { label: "Per-app pricing", reviewbox: false, appfollow: true },
      { label: "Annual discount", reviewbox: "2 months free", appfollow: "10%" },
      { label: "Refund policy", reviewbox: "30-day, no questions", appfollow: "Case-by-case" },
    ],
  },
  {
    category: "Data & privacy",
    features: [
      { label: "GDPR compliant", reviewbox: true, appfollow: true },
      { label: "DPA available", reviewbox: true, appfollow: true },
      { label: "EU data residency", reviewbox: true, appfollow: "partial" },
      { label: "AI zero-data-retention", reviewbox: true, appfollow: false },
      { label: "Self-serve data export", reviewbox: true, appfollow: "partial" },
      { label: "SOC 2 Type II", reviewbox: "In progress", appfollow: true },
    ],
  },
];

function Cell({ value }: { value: CellValue }) {
  if (value === true)
    return <Check className="mx-auto h-4 w-4 text-emerald-500" strokeWidth={2.5} />;
  if (value === false)
    return <X className="mx-auto h-4 w-4 text-gray-300" strokeWidth={2} />;
  if (value === "partial")
    return <Minus className="mx-auto h-4 w-4 text-amber-400" strokeWidth={2.5} />;
  return <span className="text-xs text-gray-500">{value}</span>;
}

export default function ComparePage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <MarketingNav cta="trial" />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-600">vs AppFollow</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        {/* Hero */}
        <div className="pt-16 pb-12 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
            Comparison
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            ReviewBox vs AppFollow
          </h1>
          <p className="mt-4 text-gray-500 text-lg">
            Feature-by-feature. No marketing spin.
          </p>
        </div>

        {/* Legend */}
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

        {/* Table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 w-1/2">
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
                  <tr key={group.category} className="border-t border-gray-100 bg-gray-50">
                    <td
                      colSpan={3}
                      className="px-6 py-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400"
                    >
                      {group.category}
                    </td>
                  </tr>
                  {group.features.map((row) => (
                    <tr key={row.label} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-6 py-3 text-gray-700">{row.label}</td>
                      <td className="px-6 py-3 text-center">
                        <Cell value={row.reviewbox} />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <Cell value={row.appfollow} />
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-gray-900 px-8 py-14 text-center">
          <h2 className="text-2xl font-bold text-white">
            Switch in an afternoon. We&apos;ll help.
          </h2>
          <p className="mt-3 text-gray-400">
            Import your existing templates. Connect your apps. Be live in under 2 hours.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-xl bg-[#0A84FF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0070e0]"
            >
              Start free trial
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-gray-600 px-6 py-3 text-sm font-semibold text-white hover:border-gray-400"
            >
              Talk to us first
            </Link>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
