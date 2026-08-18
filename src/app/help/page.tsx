import Link from "next/link";
import { BookOpen, Workflow, CreditCard, Shield, ChevronRight } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import {
  Actions,
  AmberLink,
  Card,
  CardBody,
  CardTitle,
  ClosingBand,
  IconMark,
  LineLink,
  PageHero,
  Section,
  SectionHead,
} from "@/features/marketing/components/primitives";
import { Breadcrumb } from "@/features/marketing/components/breadcrumb";

export const metadata = {
  alternates: { canonical: "/help" },
  title: "Help Center",
  description:
    "Guides, tutorials, and answers for ReviewBox — setup, AI replies, automations, billing, and more.",
};

/**
 * Every entry here points somewhere real.
 *
 * Eight of these were `href: "#"` — "Setting your AI tone", "Auto-publish
 * setup", "How to upgrade", "Request a refund", "Startup & non-profit
 * discounts", "Where your data is stored", "GDPR & EU data residency" and
 * "Delete your account". They rendered as ordinary article links with a
 * reading time beside them, so a reader could not tell them from the four
 * that worked; clicking one just jumped to the top of the page.
 *
 * Several were answerable from pages that already exist, so they now link
 * there rather than to a article nobody has written. The rest are gone until
 * someone writes them.
 *
 * The per-category `color`/`bg` tints went with them: four pastel fills
 * behind four glyphs is decoration standing in for hierarchy, and gave
 * marketing an icon treatment the product does not use.
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
    description: "Configure tones, templates, caches, and auto-publish rules.",
    articles: [
      { title: "How the 3-tier pipeline works", href: "/help/ai-replies", mins: 4 },
      { title: "Building automation rules", href: "/help/automation", mins: 6 },
    ],
  },
  {
    icon: CreditCard,
    title: "Billing & plans",
    description: "Compare plans, understand limits, and read the refund policy.",
    articles: [
      { title: "Plan comparison", href: "/pricing", mins: 2 },
      { title: "Billing questions", href: "/faq#billing", mins: 3 },
      { title: "Refund & cancellation policy", href: "/refund-policy", mins: 2 },
    ],
  },
  {
    icon: Shield,
    title: "Privacy & security",
    description: "Data storage, GDPR compliance, DPAs, and account deletion.",
    articles: [
      { title: "Privacy questions", href: "/faq#privacy", mins: 3 },
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
  // These two land on real anchors now — /faq's sections carry ids. They were
  // pointing at #billing and #privacy on a page that had no such elements, so
  // both silently did nothing.
  { title: "What happens when I hit my plan limit?", href: "/faq#billing", category: "Billing" },
  { title: "Is ReviewBox GDPR compliant?", href: "/faq#privacy", category: "Privacy" },
];

export default function HelpPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      {/*
        The search box that used to sit here was decorative — the source even
        said so ("Search bar — decorative (no JS needed for static)"). It took
        a query, and pressing Enter did nothing. An input that looks like
        search but cannot search is worse than no search: it costs the reader
        the attempt before they fall back to browsing. Bring it back when
        there is an index behind it.
      */}
      <PageHero
        eyebrow="Help centre"
        title="How can we help?"
        lede="Browse by category, or start with the questions people ask most."
      />

      <main>
        <Breadcrumb trail={[{ label: "Help centre" }]} />

        <Section tight>
          <SectionHead eyebrow="Popular" title="Most-read answers" />
          <div className="mt-8 grid gap-2.5 md:grid-cols-2 lg:grid-cols-3">
            {POPULAR.map((a) => (
              <Link
                key={a.title}
                href={a.href}
                className="group flex items-center justify-between gap-3 rounded-[var(--rb-mk-r-card)] border border-[var(--rb-mk-line)] bg-white px-5 py-3.5 transition-colors hover:border-[var(--rb-mk-line-2)]"
              >
                <span>
                  <span className="block text-[15px] font-semibold text-[var(--rb-fg-1)] group-hover:underline">
                    {a.title}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-[var(--rb-fg-3)]">
                    {a.category}
                  </span>
                </span>
                <ChevronRight
                  className="size-4 shrink-0 text-[var(--rb-mk-ink-4)]"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </Section>

        <Section band>
          <SectionHead eyebrow="Browse" title="By category" />
          <div className="mt-[50px] grid gap-5 md:grid-cols-2">
            {CATEGORIES.map((cat) => (
              <Card key={cat.title} interactive={false}>
                <IconMark icon={cat.icon} />
                <CardTitle>{cat.title}</CardTitle>
                <CardBody>{cat.description}</CardBody>
                <ul className="mt-5 grid border-t border-[var(--rb-mk-line)]">
                  {cat.articles.map((a) => (
                    <li key={a.title}>
                      <Link
                        href={a.href}
                        className="flex items-center justify-between gap-3 border-b border-[var(--rb-mk-line)] py-3 text-[15px] text-[var(--rb-fg-2)] transition-colors hover:text-[var(--rb-fg-1)]"
                      >
                        <span>{a.title}</span>
                        <span className="shrink-0 text-[13px] text-[var(--rb-fg-3)]">
                          {a.mins} min
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </Section>

        <ClosingBand
          title="Can't find what you need?"
          body="The whole team reads support email. You'll get a real answer, not a template."
        >
          <Actions>
            <AmberLink href="/contact">Email us</AmberLink>
            <LineLink href="/faq">Read the FAQ</LineLink>
          </Actions>
        </ClosingBand>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
