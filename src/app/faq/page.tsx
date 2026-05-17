import Link from "next/link";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";

export const metadata = {
  title: "FAQ — ReviewBox",
  description: "Frequently asked questions about ReviewBox — setup, pricing, AI replies, and more.",
};

const FAQ_SECTIONS = [
  {
    title: "Getting started",
    questions: [
      {
        q: "How do I connect Google Play?",
        a: "You need a Google Cloud service account with the \"Reply to reviews\" permission scoped to your Google Play Console. Create the service account in Google Cloud, download the JSON key, and paste it into ReviewBox Settings → Apps. Full guide: tryreviewbox.com/help/connect-google-play.",
      },
      {
        q: "How do I connect the App Store?",
        a: "You need an App Store Connect API key (not the old iTunes key). In App Store Connect, go to Users & Access → Integrations → App Store Connect API, generate a key with Customer Support access, and enter the Key ID, Issuer ID, and .p8 file into ReviewBox Settings → Apps.",
      },
      {
        q: "How long does the first sync take?",
        a: "The first sync fetches your most recent reviews immediately — typically under 2 minutes for up to 500 reviews. Subsequent syncs run automatically every 4 hours.",
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
        q: "Can ReviewBox auto-publish replies?",
        a: "Yes — on the Team plan, you can configure auto-publish rules. You set the conditions (e.g. \"5-star reviews + positive sentiment + reply from template\") and ReviewBox will publish without human approval. This is disabled by default and opt-in per workspace.",
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
        a: "Yes — 30-day full refund on monthly plans (most recent charge) and annual plans (from purchase/renewal date). No questions asked. See our Refund Policy for full details.",
      },
      {
        q: "Do you offer discounts for startups or non-profits?",
        a: "Yes. Email hello@tryreviewbox.com with a brief description of your organisation. We offer 50% off for early-stage startups (pre-Series A) and non-profits.",
      },
      {
        q: "Is there an annual billing option?",
        a: "Yes — annual billing is 2 months free (equivalent to ~17% off). Contact us to switch; we&apos;ll prorate your current plan.",
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

      {/* Breadcrumb */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-600">FAQ</span>
        </nav>
      </div>

      <main className="mx-auto max-w-3xl px-6 pb-32">
        {/* Header */}
        <div className="pt-12 pb-12">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7]">
            Frequently asked questions
          </h1>
          <p className="mt-3 text-gray-500 dark:text-[#86868B]">
            Can&apos;t find an answer?{" "}
            <Link href="/contact" className="text-[#0A84FF] hover:underline">
              Email us
            </Link>{" "}
            — we respond within one business day.
          </p>
        </div>

        {/* FAQ sections */}
        <div className="space-y-12">
          {FAQ_SECTIONS.map((section) => (
            <div key={section.title}>
              <h2 className="mb-6 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-[#636366]">
                {section.title}
              </h2>
              <dl className="space-y-4">
                {section.questions.map(({ q, a }) => (
                  <div
                    key={q}
                    className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6"
                  >
                    <dt className="font-semibold text-gray-900 dark:text-[#F5F5F7]">{q}</dt>
                    <dd className="mt-3 text-sm leading-relaxed text-gray-600 dark:text-[#C7C7CC]">{a}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl border border-blue-100 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 px-8 py-10 text-center">
          <h2 className="text-lg font-bold text-gray-900 dark:text-[#F5F5F7]">Still have questions?</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-[#C7C7CC]">
            The whole team reads support email. You&apos;ll get a real answer, not a template.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex rounded-xl bg-[#0A84FF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0070e0]"
          >
            Get in touch
          </Link>
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
