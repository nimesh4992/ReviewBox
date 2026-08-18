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
  LineLink,
  PageHero,
  Section,
  SectionHead,
} from "@/features/marketing/components/primitives";
import { Breadcrumb } from "@/features/marketing/components/breadcrumb";

export const metadata = {
  title: "About",
  description:
    "ReviewBox is the app-store review management platform built by people who've shipped apps.",
};

/**
 * These were fabricated: "2,400+ AI drafts / day", "48h average first-reply
 * time drop", "4.21 -> 4.58 avg rating lift after 90 days". We have no
 * customers, so none of them could be measured, and a rating-lift figure is a
 * performance claim a regulator would read as an inducement.
 *
 * What replaces them is what the product actually does, stated without a
 * number we cannot stand behind. Put real figures here when there are real
 * customers to measure.
 */
const FACTS = [
  { value: "2", label: "Stores supported: App Store and Google Play" },
  { value: "1 click", label: "From AI draft to a published reply" },
  { value: "Daily", label: "Automatic review sync, plus sync on demand" },
  { value: "14 days", label: "Free trial, no card required" },
];

const VALUES = [
  {
    title: "Replies that sound human",
    body: "AI drafts are starting points, not finishes. We built templates and tone controls so every reply sounds like you wrote it — because eventually you'll hit publish.",
  },
  {
    title: "Signal over noise",
    body: "App stores generate thousands of reviews. Our job is to surface the ones that actually need your attention — the crashes, the billing issues, the 1-star spikes.",
  },
  {
    title: "Invisible infrastructure",
    body: "The best tools disappear. ReviewBox runs sync, triage, and alerting in the background so your team sees a clean queue, not a pipeline.",
  },
  {
    title: "Founder-speed iteration",
    body: "We ship weekly. If something is broken or missing, tell us and it'll be addressed by Friday. We read every support email ourselves.",
  },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      <PageHero
        eyebrow="Company"
        title="Built for teams who care about what users say."
        lede="ReviewBox started as an internal tool. We managed six apps across two stores, and responding to reviews was taking four hours a week — mostly spent on copy-pasting and writing the same replies over and over. We automated that. Then we made it better."
      />

      <main>
        <Breadcrumb trail={[{ label: "About" }]} />

        <Section tight>
          <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
            {FACTS.map((f) => (
              <Card key={f.label} interactive={false} className="p-6">
                <div className="text-[27px] font-bold tracking-[-0.035em] text-[var(--rb-fg-1)]">
                  {f.value}
                </div>
                <div className="mt-1.5 text-[14px] leading-[1.45] text-[var(--rb-fg-3)]">
                  {f.label}
                </div>
              </Card>
            ))}
          </div>
        </Section>

        <Section band>
          <SectionHead eyebrow="What we care about" title="Four things we genuinely care about" />
          <div className="mt-[50px] grid gap-5 sm:grid-cols-2">
            {VALUES.map((v) => (
              <Card key={v.title}>
                <CardTitle>{v.title}</CardTitle>
                <CardBody>{v.body}</CardBody>
              </Card>
            ))}
          </div>
        </Section>

        <Section>
          <SectionHead
            eyebrow="The team"
            title="Where the team hangs out"
            body="ReviewBox is operated by AT WORK Inc, a partnership firm registered in India. We're a small, fully remote team. We meet in person twice a year. Everything else is async — we write things down, ship things, and measure the impact."
          />
          <div className="mt-8">
            <LineLink href="/contact">Get in touch</LineLink>
          </div>
        </Section>

        <ClosingBand
          title="See it on your own reviews"
          body="Connect an app in about two minutes and see your real queue, tagged and drafted."
          note="14-day free trial · no credit card required · cancel anytime"
        >
          <Actions>
            <AmberLink href="/sign-up">Start free trial</AmberLink>
            <LineLink href="/pricing">See pricing</LineLink>
          </Actions>
        </ClosingBand>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
