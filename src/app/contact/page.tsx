import Link from "next/link";
import { Mail, Handshake, Clock, Scale } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";

export const metadata = {
  title: "Contact",
  description:
    "Get in touch with the ReviewBox team. Support, sales, and partnerships.",
};

const CHANNELS = [
  {
    icon: Mail,
    title: "General & support",
    description: "Questions about the product, your account, or billing.",
    cta: "hello@tryreviewbox.com",
    href: "mailto:hello@tryreviewbox.com",
    color: "text-[#0A84FF]",
    bg: "bg-blue-50",
  },
  {
    icon: Handshake,
    title: "Sales",
    description: "Team plan, volume pricing, custom contracts, or procurement.",
    cta: "sales@tryreviewbox.com",
    href: "mailto:sales@tryreviewbox.com",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    icon: Scale,
    title: "Legal & privacy",
    description: "DPA requests, GDPR queries, data deletion, subpoenas.",
    cta: "legal@tryreviewbox.com",
    href: "mailto:legal@tryreviewbox.com",
    color: "text-amber-600",
    bg: "bg-amber-50",
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

      {/* Breadcrumb */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-600">Contact</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        {/* Hero */}
        <div className="pt-16 pb-12 max-w-2xl">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-blue-600">
            Contact
          </span>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7] sm:text-5xl">
            Talk to a real person.
          </h1>
          <p className="mt-4 text-lg text-gray-500 dark:text-[#86868B]">
            No ticketing system. No chatbot. Every email goes to someone who can actually help.
          </p>

          <div className="mt-6 flex items-center gap-2 text-sm text-gray-500 dark:text-[#86868B]">
            <Clock className="h-4 w-4 text-emerald-500" />
            <span>We respond within <strong className="text-gray-800 dark:text-[#F5F5F7]">one business day</strong> — usually faster.</span>
          </div>
        </div>

        {/* Channel cards */}
        <div className="grid gap-4 sm:grid-cols-3 mb-16">
          {CHANNELS.map((ch) => (
            <a
              key={ch.title}
              href={ch.href}
              className="block rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6 hover:border-gray-300 dark:hover:border-white/20 transition-colors"
            >
              <div className={`inline-flex rounded-xl p-2.5 ${ch.bg}`}>
                <ch.icon className={`h-5 w-5 ${ch.color}`} strokeWidth={1.5} />
              </div>
              <h2 className="mt-4 font-semibold text-gray-900 dark:text-[#F5F5F7]">{ch.title}</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-[#86868B] leading-relaxed">{ch.description}</p>
              <span className={`mt-4 block text-sm font-medium ${ch.color} hover:underline`}>
                {ch.cta}
              </span>
            </a>
          ))}
        </div>

        {/* Two column layout */}
        <div className="grid gap-8 lg:grid-cols-2 mb-16">
          {/* FAQ */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7] mb-6">Common questions</h2>
            <div className="space-y-4">
              {FAQS.map(({ q, a }) => (
                <div key={q} className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-5">
                  <p className="font-semibold text-gray-900 dark:text-[#F5F5F7] text-sm">{q}</p>
                  <p className="mt-2 text-sm text-gray-500 dark:text-[#86868B] leading-relaxed">{a}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Office info */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7] mb-6">Where we are</h2>
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-8 space-y-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-[#636366] mb-2">Headquarters</p>
                <p className="font-semibold text-gray-900 dark:text-[#F5F5F7]">AT Work Inc.</p>
                <p className="text-sm text-gray-500 dark:text-[#86868B] mt-1">Registered in India · team works remotely</p>
              </div>
              <div className="border-t border-gray-100 dark:border-white/6 pt-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-[#636366] mb-2">Legal</p>
                <p className="text-sm text-gray-500 dark:text-[#86868B] leading-relaxed">
                  For legal correspondence, DPA requests, or GDPR queries, email{" "}
                  <a href="mailto:legal@tryreviewbox.com" className="text-[#0A84FF] hover:underline">
                    legal@tryreviewbox.com
                  </a>
                  .
                </p>
              </div>
              <div className="border-t border-gray-100 dark:border-white/6 pt-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-[#636366] mb-2">Status</p>
                <p className="text-sm text-gray-500 dark:text-[#86868B]">
                  Check{" "}
                  <Link href="/status" className="text-[#0A84FF] hover:underline">
                    status.tryreviewbox.com
                  </Link>{" "}
                  for live uptime and incident reports.
                </p>
              </div>
              <div className="border-t border-gray-100 dark:border-white/6 pt-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-[#636366] mb-2">Help center</p>
                <p className="text-sm text-gray-500 dark:text-[#86868B]">
                  Before emailing, check{" "}
                  <Link href="/help" className="text-[#0A84FF] hover:underline">
                    help.tryreviewbox.com
                  </Link>{" "}
                  — it answers ~70% of questions instantly.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
