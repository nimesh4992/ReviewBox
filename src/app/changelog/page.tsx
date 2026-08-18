import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Card, Eyebrow, PageHero, Section } from "@/features/marketing/components/primitives";
import { Breadcrumb } from "@/features/marketing/components/breadcrumb";

export const metadata = {
  alternates: { canonical: "/changelog" },
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

/**
 * Four cycling pastel tints (blue-50 / emerald-50 / amber-50 / purple-50) gave
 * every entry a differently-coloured chip, which reads as decoration rather
 * than hierarchy — four colours saying "this is a changelog entry" four ways.
 *
 * The label already carries the category. Emphasis is spent once, on `launch`,
 * which is the only type a reader scanning the page actually wants to spot.
 */
const TYPE_STYLES: Record<string, string> = {
  feature:     "bg-[var(--rb-mk-sunken)] text-[var(--rb-fg-2)]",
  improvement: "bg-[var(--rb-mk-sunken)] text-[var(--rb-fg-2)]",
  fix:         "bg-[var(--rb-mk-sunken)] text-[var(--rb-fg-2)]",
  launch:      "bg-[var(--rb-mk-amber-500)] text-[var(--rb-mk-ink)]",
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

      <PageHero
        eyebrow="Releases"
        title="Changelog"
        lede="Every release, every improvement — shipped and documented."
      />

      <main>
        <Breadcrumb trail={[{ label: "Changelog" }]} />

        {RELEASES.map((group, gi) => (
          <Section key={group.month} band={gi % 2 === 1} tight={gi > 0}>
            <div className="mx-auto max-w-[760px]">
              <Eyebrow>{group.month}</Eyebrow>
              <div className="grid gap-5">
                {group.entries.map((entry) => (
                  <Card key={entry.version} interactive={false}>
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-bold tracking-[0.09em] uppercase ${
                          TYPE_STYLES[entry.type]
                        }`}
                      >
                        {TYPE_LABELS[entry.type]}
                      </span>
                      <span className="font-[family-name:var(--rb-font-mono)] text-[13px] font-semibold text-[var(--rb-fg-2)]">
                        {entry.version}
                      </span>
                      <span aria-hidden="true" className="text-[13px] text-[var(--rb-fg-3)]">
                        ·
                      </span>
                      <span className="text-[13px] text-[var(--rb-fg-3)]">{entry.date}</span>
                    </div>
                    <h2 className="mt-4 text-[19px] leading-[1.3] font-bold tracking-[-0.015em] text-[var(--rb-fg-1)]">
                      {entry.title}
                    </h2>
                    <p className="mt-2 text-[15.5px] leading-[1.55] text-[var(--rb-fg-3)]">
                      {entry.body}
                    </p>
                    <ul className="mt-4 grid gap-2">
                      {entry.items.map((item) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 text-[15px] text-[var(--rb-fg-2)]"
                        >
                          <span
                            aria-hidden="true"
                            className="mt-[9px] size-1.5 shrink-0 rounded-full bg-[var(--rb-mk-ink-4)]"
                          />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            </div>
          </Section>
        ))}
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
