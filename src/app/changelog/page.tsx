import Link from "next/link";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export const metadata = {
  title: "Changelog — ReviewBox",
  description: "What's new in ReviewBox — release notes grouped by month.",
};

const RELEASES = [
  {
    month: "May 2026",
    entries: [
      {
        version: "v1.4.0",
        date: "May 15, 2026",
        type: "feature" as const,
        title: "Apple App Store sync + App Store Connect API",
        body: "You can now connect your App Store Connect account and sync reviews from any iOS app. Reviews land in the same queue as Google Play — with the same AI triage, priority scoring, and reply workflow.",
        items: [
          "App Store Connect JWT authentication (ES256, per-workspace credentials)",
          "Unified review queue across both stores",
          "Reply submission to App Store Connect API",
          "Country/territory field populated from App Store territory codes",
        ],
      },
      {
        version: "v1.3.2",
        date: "May 10, 2026",
        type: "improvement" as const,
        title: "AI cost optimisation — 94% fewer tokens",
        body: "Major rework of the AI reply pipeline to eliminate redundant API calls. The vast majority of replies are now handled without hitting Groq at all.",
        items: [
          "25-template match layer resolves ~70% of requests at zero tokens",
          "SHA-256 Redis reply cache (7-day TTL) handles ~20% of remainder",
          "Prompt compression strips filler phrases — 73% shorter inputs",
          "Gemini 2.0 Flash for batch sentiment on ambiguous 3★ reviews",
        ],
      },
      {
        version: "v1.3.0",
        date: "May 1, 2026",
        type: "feature" as const,
        title: "Automation rules + auto-draft",
        body: "Build rules that fire automatically when reviews arrive. Auto-triage, auto-escalate, and auto-draft replies — all configurable per workspace.",
        items: [
          "Visual rule builder with 8 condition types",
          "Actions: escalate, tag, draft reply, assign",
          "Runs on every sync batch, not just on demand",
          "Audit log showing which rule fired on each review",
        ],
      },
    ],
  },
  {
    month: "April 2026",
    entries: [
      {
        version: "v1.2.0",
        date: "April 20, 2026",
        type: "feature" as const,
        title: "Rating spike detection + email alerts",
        body: "ReviewBox now monitors for sudden bursts of low-rated reviews on the same app version. If ≥5 reviews rated ≤2★ arrive within 24 hours on a single version, the workspace owner gets an email alert.",
        items: [
          "Spike detection runs on every sync",
          "Alert email includes version, count, and sample reviews",
          "Configurable threshold in Settings → Alerts",
        ],
      },
      {
        version: "v1.1.0",
        date: "April 5, 2026",
        type: "feature" as const,
        title: "Supabase data layer + live review queue",
        body: "The review queue is now backed by a real Supabase database with row-level security. Reviews sync every 4 hours via Vercel Cron.",
        items: [
          "Paginated review API with full filter support",
          "Row-level security per workspace",
          "Dashboard KPI metrics from real data",
          "Vercel Cron: every 4h sync of all connected apps",
        ],
      },
    ],
  },
  {
    month: "March 2026",
    entries: [
      {
        version: "v1.0.0",
        date: "March 15, 2026",
        type: "launch" as const,
        title: "ReviewBox is live",
        body: "After 6 weeks of building, ReviewBox is open for signups. The full dashboard, onboarding flow, Google Play sync, and Groq-powered AI reply drafts are all working.",
        items: [
          "Unified review queue with AI triage (tags, sentiment, priority)",
          "AI reply drafts via Groq Llama 3.3 70B",
          "Google Play publisher API integration",
          "Clerk authentication, Stripe billing, Resend email",
          "14-day free trial, no credit card",
        ],
      },
    ],
  },
];

const TYPE_STYLES: Record<string, string> = {
  feature:     "bg-blue-50 text-blue-700",
  improvement: "bg-emerald-50 text-emerald-700",
  fix:         "bg-amber-50 text-amber-700",
  launch:      "bg-purple-50 text-purple-700",
};

const TYPE_LABELS: Record<string, string> = {
  feature:     "New",
  improvement: "Improved",
  fix:         "Fixed",
  launch:      "Launch",
};

export default function ChangelogPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <MarketingNav cta="trial" />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-600">Changelog</span>
        </nav>
      </div>

      <main className="mx-auto max-w-2xl px-6 pb-32">
        {/* Header */}
        <div className="pt-8 pb-12">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">Changelog</h1>
          <p className="mt-3 text-gray-500">
            Every release, every improvement — shipped and documented.
          </p>
        </div>

        {/* Releases */}
        <div className="space-y-16">
          {RELEASES.map((group) => (
            <div key={group.month}>
              <h2 className="mb-8 text-[11px] font-semibold uppercase tracking-widest text-gray-400">
                {group.month}
              </h2>
              <div className="space-y-10">
                {group.entries.map((entry) => (
                  <article key={entry.version} className="rounded-2xl border border-gray-200 bg-white p-8">
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                          TYPE_STYLES[entry.type]
                        }`}
                      >
                        {TYPE_LABELS[entry.type]}
                      </span>
                      <span className="font-mono text-xs text-gray-400">{entry.version}</span>
                      <span className="text-xs text-gray-400">·</span>
                      <span className="text-xs text-gray-400">{entry.date}</span>
                    </div>
                    <h3 className="mt-3 text-lg font-semibold text-gray-900">{entry.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-gray-600">{entry.body}</p>
                    <ul className="mt-4 space-y-1.5">
                      {entry.items.map((item) => (
                        <li key={item} className="flex items-start gap-2 text-sm text-gray-600">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#0A84FF]" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
