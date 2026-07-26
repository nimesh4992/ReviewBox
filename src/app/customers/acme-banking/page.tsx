import Link from "next/link";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";

export const metadata = {
  title: "Acme Banking: 4.21 → 4.58 in 90 Days",
  description:
    "How Acme Banking went from a 4.21 to a 4.58 App Store rating in 90 days using ReviewBox's AI reply pipeline and automation rules.",
};

const METRICS = [
  { before: "4.21★", after: "4.58★", label: "App Store rating" },
  { before: "48h", after: "11 min", label: "Avg. first reply time" },
  { before: "18%", after: "94%", label: "Review reply rate" },
  { before: "$0", after: "$0", label: "Cost per template reply" },
];

export default function AcmeBankingCaseStudy() {
  return (
    <MarketingShell>
      <MarketingNav />

      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <Link href="/customers" className="hover:text-gray-600">Customers</Link>
          <span>/</span>
          <span className="text-gray-600">Acme Banking</span>
        </nav>
      </div>

      <main className="mx-auto max-w-4xl px-6 pb-32">

        {/* Header */}
        <div className="pt-12 pb-10">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-700">
              Case Study
            </span>
            <span className="text-xs text-gray-400 dark:text-[#636366]">Fintech · Consumer Banking · 500K MAU</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7] sm:text-5xl leading-tight">
            4.21 → 4.58 in 90 days.<br />No product changes.
          </h1>
          <p className="mt-5 text-lg text-gray-500 dark:text-[#86868B] leading-relaxed max-w-2xl">
            Acme Banking&apos;s mobile app had a ratings problem — not because the product was bad, but because they weren&apos;t responding to reviews. Here&apos;s exactly what changed.
          </p>
        </div>

        {/* Metric row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-14">
          {METRICS.map(({ before, after, label }) => (
            <div key={label} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-5 text-center">
              <div className="text-xs text-gray-400 dark:text-[#636366] mb-2">{label}</div>
              <div className="flex items-center justify-center gap-2">
                <span className="text-sm text-gray-400 dark:text-[#636366] line-through">{before}</span>
                <span className="text-gray-300 dark:text-white/20">→</span>
                <span className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7]">{after}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="prose-container space-y-10 max-w-none">

          {/* Section 1 */}
          <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7] mb-4">The problem</h2>
            <p className="text-gray-600 dark:text-[#C7C7CC] leading-relaxed">
              Acme Banking&apos;s product team was small. Responding to app store reviews wasn&apos;t anyone&apos;s job — it fell between the cracks of support, product, and engineering. When a customer left a 1-star review about a failed transfer, nobody replied. When a user couldn&apos;t log in after an update, the review sat unanswered for weeks.
            </p>
            <p className="mt-4 text-gray-600 dark:text-[#C7C7CC] leading-relaxed">
              The app had a 4.21 rating on the App Store and a 4.18 on Google Play. Both had been trending down for three quarters. The team knew response rate was part of the problem — they just didn&apos;t have the bandwidth to fix it manually.
            </p>
            <div className="mt-6 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 p-5">
              <p className="text-sm font-semibold text-red-900 dark:text-red-300 mb-1">Before ReviewBox</p>
              <ul className="text-sm text-red-800 dark:text-red-400 space-y-1 list-disc list-inside">
                <li>18% of reviews received a reply</li>
                <li>Average first reply time: 48 hours (when it happened at all)</li>
                <li>0 automation — every reply was manual</li>
                <li>No process for escalating crash-related reviews to engineering</li>
              </ul>
            </div>
          </section>

          {/* Section 2 */}
          <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7] mb-4">The setup</h2>
            <p className="text-gray-600 dark:text-[#C7C7CC] leading-relaxed">
              Setup took one afternoon. The team connected both Google Play and the App Store using API keys, imported their existing reply templates, and configured three automation rules to handle the highest-volume scenarios.
            </p>

            <div className="mt-6 space-y-4">
              {[
                {
                  title: "Rule 1: Auto-draft for 5-star reviews",
                  body: "Any 5-star review with positive sentiment automatically gets an AI draft ready to send. The customer success team reviews and publishes in a batch each morning — 30 minutes instead of 3 hours.",
                },
                {
                  title: "Rule 2: Escalate crash reports to engineering",
                  body: "Reviews tagged with crash keywords at 1–2 stars are immediately escalated to the engineering channel on Slack. The team caught a login regression three days before their on-call rotation flagged it.",
                },
                {
                  title: "Rule 3: Triage billing disputes to support",
                  body: "Reviews mentioning payment, charge, or refund are routed to the support team with high priority. Response time on billing-related reviews dropped from 72 hours to under 4 hours.",
                },
              ].map((rule) => (
                <div key={rule.title} className="rounded-xl border border-gray-100 dark:border-white/6 bg-gray-50 dark:bg-[#0E0E11] p-5">
                  <p className="font-semibold text-gray-900 dark:text-[#F5F5F7] text-sm">{rule.title}</p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-[#C7C7CC] leading-relaxed">{rule.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3 */}
          <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7] mb-4">The results — 90 days later</h2>
            <p className="text-gray-600 dark:text-[#C7C7CC] leading-relaxed">
              The App Store rating moved from 4.21 to 4.58. Google Play went from 4.18 to 4.51. The product didn&apos;t change — the team shipped one minor update in that window. What changed was the signal the app stores received: replies went up, dwell time on negative reviews went down, and the recency-weighted rating improved steadily.
            </p>
            <p className="mt-4 text-gray-600 dark:text-[#C7C7CC] leading-relaxed">
              Reply rate jumped from 18% to 94%. The remaining 6% are reviews that require manual investigation (complex billing disputes, account-specific issues) — everything else is handled automatically or with a single click.
            </p>
            <blockquote className="mt-6 border-l-4 border-[#0A84FF] pl-6">
              <p className="text-gray-700 dark:text-[#C7C7CC] italic leading-relaxed">
                &ldquo;We changed nothing in the product — we just started actually responding to every review. Three months later our rating is the highest it&apos;s ever been.&rdquo;
              </p>
              <footer className="mt-3">
                <p className="text-sm font-semibold text-gray-900 dark:text-[#F5F5F7]">James R.</p>
                <p className="text-xs text-gray-400 dark:text-[#636366]">Head of Mobile, Acme Banking</p>
              </footer>
            </blockquote>
          </section>

          {/* Section 4 */}
          <section className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7] mb-4">What&apos;s next</h2>
            <p className="text-gray-600 dark:text-[#C7C7CC] leading-relaxed">
              The team is now piloting auto-publish for 5-star template replies — the final step toward a fully automated positive-review pipeline. They&apos;re also using ReviewBox&apos;s sentiment trends to inform their quarterly roadmap: three features that previously had no voice are now tracked weekly from review sentiment data.
            </p>
          </section>

        </div>

        {/* CTA */}
        <div className="mt-16 rounded-2xl bg-gray-900 px-8 py-14 text-center">
          <h2 className="text-2xl font-bold text-white">Get the same results.</h2>
          <p className="mt-2 text-gray-400">14-day free trial. Setup in an afternoon. No card required.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-xl bg-[#0A84FF] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0070e0]"
            >
              Start free trial
            </Link>
            <Link
              href="/customers"
              className="rounded-xl border border-gray-600 px-6 py-3 text-sm font-semibold text-white hover:border-gray-400"
            >
              More customer stories
            </Link>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
