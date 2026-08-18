import Link from "next/link";
import { Mail, Handshake, Scale } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import {
  Card,
  CardBody,
  CardTitle,
  Eyebrow,
  IconMark,
  PageHero,
  Section,
  SectionHead,
} from "@/features/marketing/components/primitives";
import { Breadcrumb } from "@/features/marketing/components/breadcrumb";

export const metadata = {
  alternates: { canonical: "/contact" },
  title: "Contact",
  description: "Get in touch with the ReviewBox team. Support, sales, and partnerships.",
};

/**
 * The per-channel `color` / `bg` pairs that used to sit here (blue-50,
 * emerald-50, amber-50 behind a tinted glyph) are gone. Three different pastel
 * fills across three cards read as decoration standing in for hierarchy, and
 * gave marketing an icon treatment the product does not use — the app draws
 * Lucide bare at strokeWidth 1.5.
 */
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
    // Was "Team plan, volume pricing, custom contracts, or procurement" — but
    // there is no Team plan. It exists in neither lib/plans.ts nor Stripe;
    // the sellable tiers are Starter, Pro and a quote-only Enterprise. This is
    // the same stale-plan copy that had the homepage advertising Team at $199.
    description: "Enterprise pricing, custom contracts, or procurement.",
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
  {
    q: "How fast do you respond?",
    a: "Within one business day for support. Sales emails typically same day.",
  },
  {
    q: "Is there live chat?",
    a: "Not yet — but every email goes to a real person and we respond fast.",
  },
  { q: "Can I schedule a demo?", a: "Yes — email sales@tryreviewbox.com and we'll find a time." },
  {
    q: "Where are you based?",
    a: "ReviewBox is operated by AT WORK Inc, a partnership firm registered in India. The team works remotely.",
  },
];

const DETAILS = [
  {
    label: "Headquarters",
    body: (
      <>
        <span className="font-semibold text-[var(--rb-fg-1)]">AT Work Inc.</span>
        <br />
        Registered in India · team works remotely
      </>
    ),
  },
  {
    label: "Legal",
    body: (
      <>
        For legal correspondence, DPA requests, or GDPR queries, email{" "}
        <a
          href="mailto:legal@tryreviewbox.com"
          className="font-semibold text-[var(--rb-mk-orange-text)] hover:underline"
        >
          legal@tryreviewbox.com
        </a>
        .
      </>
    ),
  },
  {
    label: "Help centre",
    body: (
      <>
        Before emailing, check the{" "}
        <Link href="/help" className="font-semibold text-[var(--rb-mk-orange-text)] hover:underline">
          help centre
        </Link>{" "}
        — it answers most questions instantly.
      </>
    ),
  },
];

export default function ContactPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      <PageHero
        eyebrow="Contact"
        title="Talk to a person, not a ticket queue"
        lede="Every email reaches someone who works on the product. We respond within one business day — usually faster."
      />

      <main>
        <Breadcrumb trail={[{ label: "Contact" }]} />

        <Section tight>
          <div className="grid gap-5 md:grid-cols-3">
            {CHANNELS.map((ch) => (
              <a key={ch.title} href={ch.href} className="group block">
                <Card className="h-full">
                  <IconMark icon={ch.icon} />
                  <CardTitle>{ch.title}</CardTitle>
                  <CardBody>{ch.description}</CardBody>
                  <p className="mt-4 text-[14.5px] font-semibold text-[var(--rb-mk-orange-text)] group-hover:underline">
                    {ch.cta}
                  </p>
                </Card>
              </a>
            ))}
          </div>
        </Section>

        <Section band>
          <div className="grid gap-[60px] lg:grid-cols-2">
            <div>
              <SectionHead eyebrow="Common questions" title="Before you write" />
              <div className="mt-8 grid gap-4">
                {FAQS.map(({ q, a }) => (
                  <Card key={q} interactive={false} className="p-6">
                    <p className="text-[15.5px] font-semibold text-[var(--rb-fg-1)]">{q}</p>
                    <p className="mt-2 text-[14.5px] leading-[1.55] text-[var(--rb-fg-3)]">{a}</p>
                  </Card>
                ))}
              </div>
            </div>

            <div>
              <SectionHead eyebrow="Details" title="Where we are" />
              <Card interactive={false} className="mt-8 p-8">
                <dl className="grid gap-6">
                  {DETAILS.map((d, i) => (
                    <div
                      key={d.label}
                      className={
                        i > 0 ? "border-t border-[var(--rb-mk-line)] pt-6" : undefined
                      }
                    >
                      <dt>
                        <Eyebrow className="mb-2">{d.label}</Eyebrow>
                      </dt>
                      <dd className="text-[14.5px] leading-[1.6] text-[var(--rb-fg-3)]">
                        {d.body}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>
          </div>
        </Section>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
