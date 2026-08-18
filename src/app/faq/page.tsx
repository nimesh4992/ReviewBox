import Link from "next/link";
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
} from "@/features/marketing/components/primitives";
import { RHYTHM } from "@/features/marketing/rhythm";
import { annualSavingsPercent, minAnnualSavingsPercent } from "@/lib/plans";
import { isIntervalPurchasable } from "@/lib/stripe";

export const metadata = {
  title: "FAQ",
  description: "Frequently asked questions about ReviewBox — setup, pricing, AI replies, and more.",
};

// ⚠️ These strings are rendered as TEXT (see `{a}` in the markup below) and
// copied verbatim into FAQ_JSON_LD. An HTML entity written here shows up as
// the literal characters "&apos;" both on the page and in Google's rich
// result — use real apostrophes, never entities.
const FAQ_SECTIONS = [
  {
    title: "Getting started",
    questions: [
      {
        q: "How do I connect Google Play?",
        a: "You need a Google Cloud service account with the \"Reply to reviews\" permission scoped to your Google Play Console. Create the service account in Google Cloud, download the JSON key, and paste it into ReviewBox Settings → Integrations. Full guide: tryreviewbox.com/help/connect-google-play.",
      },
      {
        q: "How do I connect the App Store?",
        a: "You need an App Store Connect API key (not the old iTunes key). In App Store Connect, go to Users & Access → Integrations → App Store Connect API, generate a key with Customer Support access, and enter the Key ID, Issuer ID, and .p8 file into ReviewBox Settings → Integrations.",
      },
      {
        q: "How long does the first sync take?",
        a: "The first sync fetches your most recent reviews immediately, typically under two minutes. After that we sync once a day automatically, and you can trigger a sync yourself any time from Settings.",
      },
      {
        q: "Why does ReviewBox show fewer reviews than my Play Console?",
        a: "Because Google's Play Developer API only returns recent reviews — roughly the last week — and offers no way to ask for older ones. The call that lists reviews has no date parameter at all, so there is no request we could make differently. Every review tool sits behind that same API: on an app with 2,064 rated reviews we measured AppFollow at 272 and ReviewBox at 202. The large number on your dashboard is your store's lifetime rating count; the \"synced\" figure below it is what we hold and can search, tag and reply to. Full explanation: tryreviewbox.com/help/review-history.",
      },
      {
        q: "My rating in ReviewBox doesn't match the one I see on Google Play. Why?",
        a: "Both stores publish ratings per country, so an app can read 4.3 in the US and 3.1 in India at the same moment — neither is wrong, they are different listings. ReviewBox picks the storefront with the most reviews when you connect an app, but you can set it explicitly under Settings → Apps → Store country. If the rating looks nothing like yours, that setting is almost always the reason.",
      },
      {
        q: "Can I try ReviewBox before paying?",
        a: "Yes — every account starts with a 14-day free trial at Pro tier. No credit card required. You can downgrade, upgrade, or cancel at any time from Billing settings.",
      },
    ],
  },
  {
    title: "AI replies",
    questions: [
      {
        q: "How does the AI reply system work?",
        a: "ReviewBox uses a 3-tier pipeline. First, it tries to match your review against one of 25 templates (instant, zero tokens). If no template matches, it checks a Redis cache for identical or near-identical reviews. If still no match, it generates a new reply via Groq's Llama 3.3 70B model. About 85% of replies are served from tiers 1–2.",
      },
      {
        q: "What tone options are available?",
        a: "Professional, Friendly, Empathetic, Brief, and Custom. Custom lets you write a persona description (up to 200 characters) that gets applied to every AI-generated reply. Templates always match the tone of the template, not the AI setting.",
      },
      {
        // This used to answer "Yes — on the Team plan": a plan that no longer
        // exists, describing a feature that is not built, and contradicting
        // the homepage FAQ on the same site ("nothing goes to the store until
        // you click Post"). Automations draft; a human publishes.
        q: "Can ReviewBox auto-publish replies?",
        a: "No. Automation rules tag, prioritise and pre-draft replies as reviews sync, so the queue is half-done before you open it — but nothing reaches the store without you clicking Post. Fully automatic publishing is on the roadmap and will be opt-in per workspace when it lands.",
      },
      {
        q: "Does ReviewBox learn from my edits?",
        a: "Not yet. When you edit an AI draft before publishing, your edit is stored but not currently used to fine-tune the model. We plan to add fine-tuning in a future release.",
      },
    ],
  },
  {
    title: "Billing",
    questions: [
      {
        q: "What happens if I go over my plan limits?",
        a: "We notify you at 80% of your review quota. Reviews already synced are safe. New review syncing pauses until the next billing cycle resets your quota, or until you upgrade. AI drafts similarly pause after the daily limit resets at midnight UTC.",
      },
      {
        q: "Can I get a refund?",
        a: "Subscription payments are non-refundable and we do not issue prorated refunds. Every plan starts with a 14-day free trial that needs no card, so you can evaluate ReviewBox fully before paying. You can cancel any time to stop future renewals and keep access until the end of the period you paid for. Duplicate charges and billing mistakes on our side are refunded in full. See our Refund & Cancellation Policy.",
      },
      {
        q: "Do you offer discounts for startups or non-profits?",
        a: "Yes. Email hello@tryreviewbox.com with a brief description of your organisation. We offer 50% off for early-stage startups (pre-Series A) and non-profits.",
      },
      {
        q: "Is there an annual billing option?",
        // Two things were wrong here and both were self-inflicted:
        //
        //   1. "~17% off" — the real discount is 20% on Starter and 23% on
        //      Pro. One hardcoded number cannot describe two plans, which is
        //      why this drifted. It is derived now.
        //   2. "we'll prorate your current plan" — flatly contradicted the
        //      answer two entries above ("we do not issue prorated refunds")
        //      AND the Refund & Cancellation Policy. An unsupported promise
        //      about money is the worst kind to leave lying around, so it is
        //      gone rather than reworded.
        a: isIntervalPurchasable("annual")
          ? `Yes. Pick Yearly on the pricing page or in Billing → you save at least ${minAnnualSavingsPercent()}% (${annualSavingsPercent("starter")}% on Starter, ${annualSavingsPercent("pro")}% on Pro) and are charged once a year instead of monthly. To change an existing subscription, use Billing → Manage Subscription. Switching does not refund the period you have already paid for — see our Refund & Cancellation Policy.`
          : `Not self-serve yet — every plan is billed monthly today and you can cancel any time. Yearly billing is coming and will save at least ${minAnnualSavingsPercent()}% (${annualSavingsPercent("starter")}% on Starter, ${annualSavingsPercent("pro")}% on Pro). Email hello@tryreviewbox.com if you want it now and we will set it up manually.`,
      },
    ],
  },
  {
    title: "Privacy & security",
    questions: [
      {
        q: "Where is my data stored?",
        a: "Review data and account information are stored in Supabase (PostgreSQL) on the EU region (AWS eu-west-1). Backups are encrypted and retained for 30 days.",
      },
      {
        q: "Does ReviewBox send my reviews to AI providers for training?",
        a: "No. We use Groq and Google (Gemini) under zero-data-retention agreements. Review text is processed for inference only and is not used to train their models.",
      },
      {
        q: "Is ReviewBox GDPR compliant?",
        a: "Yes. We act as a Data Processor for your review data. Our Data Processing Agreement (DPA) is available at tryreviewbox.com/dpa and is incorporated by reference into our Terms of Service.",
      },
      {
        q: "How do I delete my account and data?",
        a: "Go to Settings → Privacy → Delete account, or email legal@tryreviewbox.com. All personal data and review data is permanently deleted within 30 days. You can export your data first via Settings → Privacy → Export data.",
      },
    ],
  },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_SECTIONS.flatMap((section) =>
    section.questions.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    }))
  ),
};

export default function FaqPage() {
  return (
    <MarketingShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <MarketingNav />
      <Breadcrumb label="FAQ" />

      <main>
        <PageHero
          eyebrow="Answers"
          title="Frequently asked questions"
          lede={
            <>
              Can&apos;t find an answer?{" "}
              <Link
                href="/contact"
                className="font-medium text-[var(--rb-blue-500)] hover:underline"
              >
                Email us
              </Link>{" "}
              — we respond within one business day.
            </>
          }
        />

        <Section className={RHYTHM.sm}>
          <div className="mx-auto max-w-3xl space-y-14">
            {FAQ_SECTIONS.map((section, si) => (
              <Reveal key={section.title} delay={si * 60}>
                <section aria-labelledby={`faq-${si}`}>
                  <h2 id={`faq-${si}`} className="rb-kicker text-[var(--rb-blue-500)]">
                    {section.title}
                  </h2>
                  <dl className="mt-5 grid gap-3">
                    {section.questions.map(({ q, a }) => (
                      <Card key={q}>
                        <dt className="rb-h4 text-fg-1">{q}</dt>
                        <dd className="rb-body-sm mt-2.5 text-fg-2">{a}</dd>
                      </Card>
                    ))}
                  </dl>
                </section>
              </Reveal>
            ))}
          </div>
        </Section>

        <CtaBand
          title="Still have questions?"
          lede="The whole team reads support email. You'll get a real answer, not a template."
          primary={{ href: "/contact", label: "Get in touch" }}
          secondary={{ href: "/help", label: "Browse the help centre" }}
        />
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
