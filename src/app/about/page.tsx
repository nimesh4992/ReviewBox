import Link from "next/link";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";

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

export default function AboutPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-600">About</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        {/* Hero */}
        <div className="pt-16 pb-20 max-w-3xl">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
            Company
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7] sm:text-5xl">
            Built for teams who care about what users say.
          </h1>
          <p className="mt-6 text-xl text-gray-500 dark:text-[#86868B] leading-relaxed">
            ReviewBox started as an internal tool. We managed six apps across two stores, and
            responding to reviews was taking four hours a week — mostly spent on copy-pasting and
            writing the same replies over and over. We automated that. Then we made it better.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-4 mb-20">
          {[
            { value: "2,400+", label: "AI drafts generated / day" },
            { value: "48h", label: "Average first-reply time drop" },
            { value: "4.21→4.58", label: "Avg. rating lift after 90 days" },
            { value: "< 5 min", label: "Setup to first synced review" },
          ].map(({ value, label }) => (
            <div key={label} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6">
              <div className="text-3xl font-bold text-gray-900 dark:text-[#F5F5F7]">{value}</div>
              <div className="mt-1 text-sm text-gray-500 dark:text-[#86868B]">{label}</div>
            </div>
          ))}
        </div>

        {/* Values */}
        <div className="mb-20">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7]">
            Four things we genuinely care about
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {VALUES.map((v) => (
              <div key={v.title} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-8">
                <h3 className="font-semibold text-gray-900 dark:text-[#F5F5F7]">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-[#86868B]">{v.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Where we hang out */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-10 max-w-2xl">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7]">Where the team hangs out</h2>
          <p className="mt-3 text-gray-500 dark:text-[#86868B] text-sm leading-relaxed">
            We&apos;re a small, fully remote team. Most of us are in San Francisco and London.
            We meet in person twice a year. Everything else is async — we write things down,
            ship things, and measure the impact.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/careers"
              className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-700"
            >
              See open roles
            </Link>
            <Link
              href="/contact"
              className="rounded-xl border border-gray-200 dark:border-white/10 px-5 py-2.5 text-sm font-semibold text-gray-700 dark:text-[#C7C7CC] hover:bg-gray-50 dark:hover:bg-white/5"
            >
              Get in touch
            </Link>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
