import Link from "next/link";
import { BookOpen, Workflow, CreditCard, Shield, ChevronRight } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import {
  Breadcrumb,
  Card,
  CtaBand,
  PageHero,
  Reveal,
  Section,
  SectionHeading,
} from "@/features/marketing/components/primitives";
import { RHYTHM } from "@/features/marketing/rhythm";

export const metadata = {
  title: "Help Center",
  description:
    "Guides, tutorials, and answers for ReviewBox — setup, AI replies, automations, billing, and more.",
};

/**
 * Two things were wrong with this page beyond its styling.
 *
 * 1. It never rendered <MarketingShell>. The nav's theme toggle reads its
 *    state from that provider, so on /help the moon button did nothing at all
 *    — and the page carried zero `dark:` variants, so it was permanently light
 *    while every other marketing page could switch. It was also pinned to a
 *    hardcoded `bg-[#F5F5F7]` canvas.
 *
 * 2. Nine of its sixteen article links pointed at `href: "#"`. They looked
 *    like links, took a hover state, and went nowhere. Those entries are gone
 *    — a help centre that sends you to the top of the same page is worse than
 *    one that admits it has four articles. Add each back with its href when
 *    the article is written.
 *
 * The search field was likewise decorative: an <input> that filtered nothing.
 * It has been removed rather than left to take a query and swallow it.
 */

const CATEGORIES = [
  {
    icon: BookOpen,
    title: "Getting started",
    description: "Connect your first app, import reviews, and get your first AI draft.",
    articles: [
      { title: "Connect Google Play", href: "/help/connect-google-play", mins: 5 },
      { title: "Connect the App Store", href: "/help/connect-app-store", mins: 5 },
      { title: "Your first AI reply", href: "/help/ai-replies", mins: 3 },
      { title: "How much review history you get", href: "/help/review-history", mins: 4 },
    ],
  },
  {
    icon: Workflow,
    title: "AI replies & automation",
    description: "How drafts are generated, and how rules pre-sort the queue.",
    articles: [
      { title: "How the 3-tier pipeline works", href: "/help/ai-replies", mins: 4 },
      { title: "Building automation rules", href: "/help/automation", mins: 6 },
    ],
  },
  {
    icon: CreditCard,
    title: "Billing & plans",
    description: "Compare plans, upgrade, and understand the refund policy.",
    articles: [
      { title: "Plan comparison", href: "/pricing", mins: 2 },
      { title: "Billing questions", href: "/faq", mins: 3 },
      { title: "Refund & cancellation policy", href: "/refund-policy", mins: 2 },
    ],
  },
  {
    icon: Shield,
    title: "Privacy & security",
    description: "Data storage, GDPR compliance, DPAs, and account deletion.",
    articles: [
      { title: "Download our DPA", href: "/dpa", mins: 1 },
      { title: "Privacy policy", href: "/privacy", mins: 4 },
      { title: "Sub-processors", href: "/sub-processors", mins: 2 },
    ],
  },
];

const POPULAR = [
  {
    title: "How do I connect Google Play?",
    href: "/help/connect-google-play",
    category: "Getting started",
  },
  {
    title: "How do I connect the App Store?",
    href: "/help/connect-app-store",
    category: "Getting started",
  },
  {
    title: "Why do I see fewer reviews than my store dashboard?",
    href: "/help/review-history",
    category: "Getting started",
  },
  {
    title: "How does AI reply generation work?",
    href: "/help/ai-replies",
    category: "AI replies",
  },
  {
    title: "Can ReviewBox auto-publish replies?",
    href: "/help/automation",
    category: "Automation",
  },
  // These two pointed at /faq#billing and /faq#privacy. The section ids they
  // targeted are not on that page, so both scrolled to the top and looked
  // broken. They now link to the FAQ itself.
  { title: "What happens when I hit my plan limit?", href: "/faq", category: "Billing" },
  { title: "Is ReviewBox GDPR compliant?", href: "/faq", category: "Privacy" },
];

export default function HelpPage() {
  return (
    <MarketingShell>
      <MarketingNav />
      <Breadcrumb label="Help Center" />

      <main>
        <PageHero
          eyebrow="Help centre"
          title="How can we help?"
          lede="Setup guides and answers. If none of these covers it, email us and a person replies — usually the same day."
        />

        {/* Popular */}
        <Section className="pb-4">
          <Reveal>
            <h2 className="rb-kicker text-[var(--rb-blue-500)]">Popular articles</h2>
          </Reveal>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {POPULAR.map((a, i) => (
              <Reveal key={a.title} delay={i * 40}>
                <Link
                  href={a.href}
                  className="group flex h-full items-center gap-3 rounded-2xl border border-[var(--rb-border-1)] bg-surface p-5 shadow-[var(--rb-shadow-xs)] transition-shadow hover:shadow-[var(--rb-shadow-md)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="rb-body-sm block font-semibold text-fg-1 transition-colors group-hover:text-[var(--rb-blue-500)]">
                      {a.title}
                    </span>
                    <span className="rb-meta mt-1 block font-normal text-fg-3">
                      {a.category}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-fg-4 transition-transform group-hover:translate-x-0.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* Categories */}
        <Section className={RHYTHM.md}>
          <Reveal>
            <SectionHeading eyebrow="Browse" title="By topic" />
          </Reveal>
          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            {CATEGORIES.map((cat, i) => (
              <Reveal key={cat.title} delay={i * 70}>
                <Card className="h-full">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--rb-blue-50)] dark:bg-[var(--rb-bg-accent-soft)]">
                    <cat.icon
                      className="size-5 text-[var(--rb-blue-500)]"
                      strokeWidth={1.75}
                    />
                  </span>
                  <h3 className="rb-h3 mt-5 text-fg-1">{cat.title}</h3>
                  <p className="rb-body-sm mt-2 text-fg-2">{cat.description}</p>
                  <ul className="mt-5 divide-y divide-[var(--rb-border-1)] border-t border-[var(--rb-border-1)]">
                    {cat.articles.map((a) => (
                      <li key={a.title}>
                        <Link
                          href={a.href}
                          className="group flex items-center gap-3 py-3 transition-colors hover:text-[var(--rb-blue-500)]"
                        >
                          <span className="rb-body-sm min-w-0 flex-1 text-fg-2 group-hover:text-[var(--rb-blue-500)]">
                            {a.title}
                          </span>
                          <span className="rb-meta shrink-0 font-normal text-fg-3">
                            {a.mins} min
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        <CtaBand
          title="Can't find what you need?"
          lede="The whole team reads support email. You'll get a real answer, not a template."
          primary={{ href: "/contact", label: "Email us" }}
          secondary={{ href: "/faq", label: "Read the FAQ" }}
        />
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
