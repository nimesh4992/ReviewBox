import Link from "next/link";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";

export const metadata = {
  title: "Careers — ReviewBox",
  description: "Join the team building the best review management platform for mobile apps.",
};

const ROLES = [
  {
    title: "Senior Full-Stack Engineer",
    team: "Engineering",
    location: "Remote (US/EU)",
    type: "Full-time",
    description:
      "Own features end-to-end: API routes, React components, database schema. TypeScript, Next.js 15, Supabase, and Groq on the AI side.",
  },
  {
    title: "Product Designer",
    team: "Design",
    location: "Remote (US/EU)",
    type: "Full-time",
    description:
      "Design the product and the website. You care about both pixels and user journeys. Figma expert. Experience with SaaS dashboards strongly preferred.",
  },
  {
    title: "Growth Engineer",
    team: "Growth",
    location: "Remote",
    type: "Full-time",
    description:
      "Own acquisition: SEO, landing pages, onboarding funnel, email sequences. You can write code and copy. Obsessed with conversion rate.",
  },
  {
    title: "Customer Success Manager",
    team: "Customer Success",
    location: "Remote (US timezone)",
    type: "Full-time",
    description:
      "Help customers get value fast. Onboarding calls, proactive check-ins, churn prevention. You'll also be the voice of the customer back into product.",
  },
];

const BENEFITS = [
  { emoji: "ðŸ’°", label: "Competitive salary + equity" },
  { emoji: "ðŸ¥", label: "Full health, dental, vision (US)" },
  { emoji: "ðŸŒ", label: "Fully remote, async-first" },
  { emoji: "✈ï¸", label: "2× annual team offsites" },
  { emoji: "ðŸ“š", label: "$2K/year learning budget" },
  { emoji: "ðŸ’»", label: "Top-of-the-line equipment" },
  { emoji: "ðŸ–ï¸", label: "Unlimited PTO (min 20 days)" },
  { emoji: "⚡", label: "Founder access, fast decisions" },
];

export default function CareersPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-600">Careers</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        {/* Hero */}
        <div className="pt-16 pb-16 max-w-3xl">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
            We&apos;re hiring
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7] sm:text-5xl">
            A real human, not a ticketing form.
          </h1>
          <p className="mt-6 text-xl text-gray-500 dark:text-[#86868B] leading-relaxed">
            We&apos;re a small team building tools for other small teams. If you want to own big
            things fast, work on a product people pay for, and skip the corporate ladder —
            you might be our person.
          </p>

          {/* Stats */}
          <div className="mt-10 flex flex-wrap gap-8">
            {[
              { value: "12 + 21", label: "team size (now + by EOY)" },
              { value: "$4.2M", label: "seed round" },
              { value: "2 cities", label: "San Francisco + London" },
              { value: "90%ile", label: "eng compensation" },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="text-2xl font-bold text-gray-900 dark:text-[#F5F5F7]">{value}</div>
                <div className="text-xs text-gray-400 dark:text-[#636366]">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Four things we care about */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7] mb-6">
            Four things we genuinely care about
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { title: "Ownership over org charts", body: "You own the problem, not just a ticket. If something is broken, you fix it. If something is missing, you ship it." },
              { title: "Deliberate writing", body: "We write to think. Proposals, bug reports, design docs — clarity of writing reflects clarity of thinking." },
              { title: "Sustainable pacing", body: "We work normal hours most of the time. When we crunch, it's purposeful and temporary, not the default mode." },
              { title: "Quality sensing", body: "You notice when something is slightly off before anyone tells you. You care about the detail even when no-one's watching." },
            ].map((v) => (
              <div key={v.title} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6">
                <h3 className="font-semibold text-gray-900 dark:text-[#F5F5F7]">{v.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-[#86868B]">{v.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Open roles */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7] mb-2">
            Four open roles. Everything else, we&apos;re not hiring.
          </h2>
          <p className="text-gray-500 dark:text-[#86868B] mb-8 text-sm">
            We grow slowly and hire carefully. Every role here is a genuine need.
          </p>
          <div className="space-y-4">
            {ROLES.map((role) => (
              <div
                key={role.title}
                className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6 flex flex-col sm:flex-row sm:items-start sm:gap-6"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      {role.team}
                    </span>
                    <span className="text-gray-200">·</span>
                    <span className="text-[10px] text-gray-400">{role.location}</span>
                    <span className="text-gray-200">·</span>
                    <span className="text-[10px] text-gray-400">{role.type}</span>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-[#F5F5F7]">{role.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 dark:text-[#86868B] leading-relaxed">{role.description}</p>
                </div>
                <div className="mt-4 sm:mt-0 shrink-0">
                  <a
                    href={`mailto:hello@tryreviewbox.com?subject=Application: ${encodeURIComponent(role.title)}`}
                    className="inline-flex items-center rounded-xl border border-gray-200 dark:border-white/10 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-[#C7C7CC] hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    Apply →
                  </a>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-sm text-gray-400 dark:text-[#636366]">
            Don&apos;t see your role? Send a note to{" "}
            <a href="mailto:hello@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
              hello@tryreviewbox.com
            </a>{" "}
            anyway — we read every email.
          </p>
        </div>

        {/* Benefits */}
        <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-10">
          <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7] mb-6">What&apos;s in the box</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div key={b.label} className="flex items-center gap-3">
                <span className="text-2xl">{b.emoji}</span>
                <span className="text-sm text-gray-700 dark:text-[#C7C7CC]">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
