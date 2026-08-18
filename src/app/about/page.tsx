import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import {
  Band,
  Breadcrumb,
  Card,
  CtaBand,
  PageHero,
  Reveal,
  RHYTHM,
  Section,
  SectionHeading,
  SecondaryLink,
} from "@/features/marketing/components/primitives";

export const metadata = {
  title: "About",
  description: "ReviewBox is the app-store review management platform built by people who've shipped apps.",
};

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

// These were fabricated: "2,400+ AI drafts / day", "48h average first-reply
// time drop", "4.21 -> 4.58 avg rating lift after 90 days". We have no
// customers, so none of them could be measured, and a rating-lift figure is a
// performance claim a regulator would read as an inducement.
//
// What replaces them is what the product actually does, stated without a
// number we cannot stand behind. Put real figures here when there are real
// customers to measure.
const FACTS = [
  { value: "2", label: "Stores supported: App Store and Google Play" },
  { value: "1 click", label: "From AI draft to a published reply" },
  { value: "Daily", label: "Automatic review sync, plus sync on demand" },
  { value: "14 days", label: "Free trial, no card required" },
];

export default function AboutPage() {
  return (
    <MarketingShell>
      <MarketingNav />
      <Breadcrumb label="About" />

      <main>
        <PageHero
          eyebrow="Company"
          title="Built for teams who care about what users say."
          lede="ReviewBox started as an internal tool. We managed six apps across two stores, and responding to reviews was taking four hours a week — mostly copy-pasting and writing the same replies over and over. We automated that. Then we made it better."
        />

        {/* Facts */}
        <Section className="pb-4">
          <Reveal>
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {FACTS.map((f) => (
                <Card key={f.label} className="text-center">
                  <dt className="sr-only">{f.label}</dt>
                  <dd>
                    <span className="block text-[30px] font-bold tracking-[-0.03em] text-fg-1">
                      {f.value}
                    </span>
                    <span className="rb-body-sm mt-2 block text-fg-3">{f.label}</span>
                  </dd>
                </Card>
              ))}
            </dl>
          </Reveal>
        </Section>

        {/* Values */}
        <Band className="mt-16 sm:mt-20">
          <Section className={RHYTHM.md}>
            <Reveal>
              <SectionHeading
                eyebrow="How we work"
                title="Four things we genuinely care about"
              />
            </Reveal>
            <div className="mt-12 grid gap-4 sm:grid-cols-2">
              {VALUES.map((v, i) => (
                <Reveal key={v.title} delay={i * 80}>
                  <Card className="h-full">
                    <h3 className="rb-h3 text-fg-1">{v.title}</h3>
                    <p className="rb-body mt-2.5 text-fg-2">{v.body}</p>
                  </Card>
                </Reveal>
              ))}
            </div>
          </Section>
        </Band>

        {/* Who runs it. Centered and full-width: as a half-width card floated
            against the left edge, this left the bottom third of the page as
            one large empty rectangle. */}
        <Section className={RHYTHM.md}>
          <Reveal>
            <Card className="mx-auto max-w-3xl p-8 text-center sm:p-10">
              <h2 className="rb-h2 text-fg-1">Who runs ReviewBox</h2>
              <p className="rb-lead mx-auto mt-4 max-w-[54ch] text-fg-2">
                ReviewBox is operated by AT WORK Inc, a partnership firm registered
                in India. We are a small, fully remote team. We meet in person twice
                a year; everything else is async — we write things down, ship things,
                and measure the impact.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <SecondaryLink href="/contact" size="md">
                  Get in touch
                </SecondaryLink>
              </div>
            </Card>
          </Reveal>
        </Section>

        <CtaBand
          title="See it on your own reviews."
          lede="Connect an app and the queue fills in about a minute. Free for 14 days, no card."
          primary={{ href: "/sign-up", label: "Start free trial" }}
          secondary={{ href: "/pricing", label: "See pricing" }}
        />
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
