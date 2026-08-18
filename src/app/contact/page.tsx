import Link from "next/link";
import { Mail, Handshake, Clock, Scale } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import {
  Band,
  Breadcrumb,
  Card,
  CtaBand,
  FaqList,
  PageHero,
  Reveal,
  Section,
  SectionHeading,
} from "@/features/marketing/components/primitives";
import { RHYTHM } from "@/features/marketing/rhythm";

export const metadata = {
  title: "Contact",
  description:
    "Get in touch with the ReviewBox team. Support, sales, and partnerships.",
};

// One accent, not three. These tiles used to be blue / emerald / amber with
// matching link colours, which reads as status coding ("green is good, amber
// is a warning") on a page where none of the three means anything different
// from the others. The icon distinguishes them; the colour does not need to.
//
// "Team plan" also came out of the Sales description — that tier no longer
// exists (see lib/plans.ts).
const CHANNELS = [
  {
    icon: Mail,
    title: "General & support",
    description: "Questions about the product, your account, or billing.",
    cta: "hello@tryreviewbox.com",
    href: "mailto:hello@tryreviewbox.com",
  },
  {
    icon: Handshake,
    title: "Sales",
    description: "Volume pricing, custom limits, contracts, or procurement.",
    cta: "sales@tryreviewbox.com",
    href: "mailto:sales@tryreviewbox.com",
  },
  {
    icon: Scale,
    title: "Legal & privacy",
    description: "DPA requests, GDPR queries, data deletion, subpoenas.",
    cta: "legal@tryreviewbox.com",
    href: "mailto:legal@tryreviewbox.com",
  },
];

const FAQS = [
  { q: "How fast do you respond?", a: "Within one business day for support. Sales emails typically same day." },
  { q: "Is there live chat?", a: "Not yet — but every email goes to a real person and we respond fast." },
  { q: "Can I schedule a demo?", a: "Yes — email sales@tryreviewbox.com and we'll find a time." },
  { q: "Where are you based?", a: "ReviewBox is operated by AT WORK Inc, a partnership firm registered in India. The team works remotely." },
];

export default function ContactPage() {
  return (
    <MarketingShell>
      <MarketingNav />
      <Breadcrumb label="Contact" />

      <main>
        <PageHero
          eyebrow="Contact"
          title="Talk to a real person."
          lede="No ticketing system. No chatbot. Every email goes to someone who can actually help."
        >
          <p className="rb-body inline-flex items-center gap-2 rounded-full border border-[var(--rb-border-1)] bg-surface px-4 py-2 text-fg-2 shadow-[var(--rb-shadow-xs)]">
            <Clock className="size-4 text-[var(--rb-green-500)]" strokeWidth={2} />
            We respond within <strong className="font-semibold text-fg-1">one business day</strong>
            — usually faster.
          </p>
        </PageHero>

        {/* Channels */}
        <Section className="pb-4">
          <div className="grid gap-4 md:grid-cols-3">
            {CHANNELS.map((c, i) => (
              <Reveal key={c.title} delay={i * 80}>
                <Card className="flex h-full flex-col">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--rb-blue-50)] dark:bg-[var(--rb-bg-accent-soft)]">
                    <c.icon className="size-5 text-[var(--rb-blue-500)]" strokeWidth={1.75} />
                  </span>
                  <h2 className="rb-h3 mt-5 text-fg-1">{c.title}</h2>
                  <p className="rb-body-sm mt-2 flex-1 text-fg-2">{c.description}</p>
                  <a
                    href={c.href}
                    className="rb-body mt-5 font-medium text-[var(--rb-blue-500)] hover:underline"
                  >
                    {c.cta}
                  </a>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>

        {/* Common questions + where we are. Equal-height columns: the left
            column used to end well short of the right, leaving a large notch
            above the footer. */}
        <Band className="mt-16 sm:mt-20">
          <Section className={RHYTHM.md}>
            <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
              <Reveal>
                <div>
                  <SectionHeading align="left" title="Common questions" />
                  <FaqList className="mt-8" items={FAQS} />
                </div>
              </Reveal>

              <Reveal delay={100}>
                <div>
                  <SectionHeading align="left" title="Where we are" />
                  <Card className="mt-8">
                    <dl className="divide-y divide-[var(--rb-border-1)]">
                      {[
                        {
                          k: "Headquarters",
                          v: (
                            <>
                              AT Work Inc. — a partnership firm registered in India.
                              The team is fully remote.
                            </>
                          ),
                        },
                        {
                          k: "Legal",
                          v: (
                            <>
                              For legal correspondence, DPA requests, or GDPR queries,
                              email{" "}
                              <a
                                href="mailto:legal@tryreviewbox.com"
                                className="font-medium text-[var(--rb-blue-500)] hover:underline"
                              >
                                legal@tryreviewbox.com
                              </a>
                              .
                            </>
                          ),
                        },
                        {
                          k: "Help centre",
                          v: (
                            <>
                              Before emailing, check the{" "}
                              <Link
                                href="/help"
                                className="font-medium text-[var(--rb-blue-500)] hover:underline"
                              >
                                help centre
                              </Link>{" "}
                              — it answers most setup questions instantly.
                            </>
                          ),
                        },
                      ].map((row) => (
                        <div key={row.k} className="py-5 first:pt-0 last:pb-0">
                          <dt className="rb-eyebrow text-fg-3">{row.k}</dt>
                          <dd className="rb-body-sm mt-2 text-fg-2">{row.v}</dd>
                        </div>
                      ))}
                    </dl>
                  </Card>
                </div>
              </Reveal>
            </div>
          </Section>
        </Band>

        <CtaBand
          title="Rather just try it?"
          lede="Connect an app and see your own reviews in about a minute. No card, no sales call."
          primary={{ href: "/sign-up", label: "Start free trial" }}
          secondary={{ href: "/pricing", label: "See pricing" }}
        />
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
