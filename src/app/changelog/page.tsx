import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import {
  Breadcrumb,
  Card,
  CtaBand,
  PageHero,
  Reveal,
  RHYTHM,
  Section,
} from "@/features/marketing/components/primitives";

export const metadata = {
  title: "Changelog",
  description: "Release notes for ReviewBox, grouped by month — new features, fixes, and changes to review sync, AI replies, and alerting.",
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

// Light-mode-only tints (`bg-blue-50 text-blue-700`) with no dark counterpart
// rendered as near-white pills on the dark canvas. These are token pairs, so
// each keeps its contrast in both themes. The four hues are meaningful here —
// unlike on /contact, the type of a changelog entry genuinely differs — but
// the label carries the meaning too, so colour is never doing the work alone.
const TYPE_STYLES: Record<string, string> = {
  feature:
    "bg-[var(--rb-blue-50)] text-[var(--rb-blue-600)] dark:bg-[var(--rb-bg-accent-soft)] dark:text-[var(--rb-blue-400)]",
  improvement:
    "bg-[var(--rb-green-100)] text-[var(--rb-green-600)] dark:bg-[color-mix(in_oklab,var(--rb-green-500)_18%,transparent)] dark:text-[var(--rb-green-100)]",
  fix:
    "bg-[var(--rb-amber-100)] text-[var(--rb-amber-600)] dark:bg-[color-mix(in_oklab,var(--rb-amber-500)_20%,transparent)] dark:text-[var(--rb-amber-100)]",
  launch:
    "bg-[var(--rb-purple-100)] text-[var(--rb-purple-600)] dark:bg-[color-mix(in_oklab,var(--rb-purple-500)_20%,transparent)] dark:text-[var(--rb-purple-100)]",
};

const TYPE_LABELS: Record<string, string> = {
  feature:     "New",
  improvement: "Improved",
  fix:         "Fixed",
  launch:      "Launch",
};

export default function ChangelogPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      <Breadcrumb label="Changelog" />

      <main>
        <PageHero
          eyebrow="Product"
          title="Changelog"
          lede="Every release, every improvement — shipped and documented."
        />

        <Section className={RHYTHM.sm}>
          <div className="mx-auto max-w-3xl space-y-14">
            {RELEASES.map((group, gi) => (
              <Reveal key={group.month} delay={gi * 60}>
                <section aria-labelledby={`rel-${gi}`}>
                  <h2 id={`rel-${gi}`} className="rb-kicker text-[var(--rb-blue-500)]">
                    {group.month}
                  </h2>
                  <div className="mt-5 grid gap-4">
                    {group.entries.map((entry) => (
                      <Card key={entry.version} className="p-7 sm:p-8">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span
                            className={`rb-eyebrow rounded-full px-2.5 py-1 ${TYPE_STYLES[entry.type]}`}
                          >
                            {TYPE_LABELS[entry.type]}
                          </span>
                          <span className="rb-meta font-normal text-fg-3 font-[family-name:var(--rb-font-mono)]">
                            {entry.version}
                          </span>
                          <span className="rb-meta font-normal text-fg-4" aria-hidden="true">
                            ·
                          </span>
                          <span className="rb-meta font-normal text-fg-3">{entry.date}</span>
                        </div>
                        <h3 className="rb-h3 mt-4 text-fg-1">{entry.title}</h3>
                        <p className="rb-body mt-2.5 text-fg-2">{entry.body}</p>
                        <ul className="mt-5 space-y-2">
                          {entry.items.map((item) => (
                            <li
                              key={item}
                              className="rb-body-sm flex items-start gap-2.5 text-fg-2"
                            >
                              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-[var(--rb-blue-500)]" />
                              {item}
                            </li>
                          ))}
                        </ul>
                      </Card>
                    ))}
                  </div>
                </section>
              </Reveal>
            ))}
          </div>
        </Section>

        <CtaBand
          title="All of this is in the free trial."
          lede="Connect an app and see the current build on your own reviews. No card required."
          primary={{ href: "/sign-up", label: "Start free trial" }}
          secondary={{ href: "/pricing", label: "See pricing" }}
        />
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
