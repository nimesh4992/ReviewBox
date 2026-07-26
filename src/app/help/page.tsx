import Link from "next/link";
import { Search, BookOpen, Zap, CreditCard, Shield, ArrowRight } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export const metadata = {
  title: "Help Center",
  description:
    "Guides, tutorials, and answers for ReviewBox — setup, AI replies, automations, billing, and more.",
};

const CATEGORIES = [
  {
    icon: BookOpen,
    title: "Getting started",
    description: "Connect your first app, import reviews, and get your first AI draft.",
    color: "text-[#0A84FF]",
    bg: "bg-blue-50",
    articles: [
      { title: "Connect Google Play", href: "/help/connect-google-play", mins: 5 },
      { title: "Connect the App Store", href: "/help/connect-app-store", mins: 5 },
      { title: "Your first AI reply", href: "/help/ai-replies", mins: 3 },
      { title: "Invite a team member", href: "#", mins: 2 },
    ],
  },
  {
    icon: Zap,
    title: "AI replies & automation",
    description: "Configure tones, templates, caches, and auto-publish rules.",
    color: "text-purple-600",
    bg: "bg-purple-50",
    articles: [
      { title: "How the 3-tier pipeline works", href: "/help/ai-replies", mins: 4 },
      { title: "Setting your AI tone", href: "#", mins: 2 },
      { title: "Building automation rules", href: "/help/automation", mins: 6 },
      { title: "Auto-publish setup", href: "#", mins: 3 },
    ],
  },
  {
    icon: CreditCard,
    title: "Billing & plans",
    description: "Manage your subscription, upgrade, or request a refund.",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    articles: [
      { title: "Plan comparison", href: "/pricing", mins: 2 },
      { title: "How to upgrade", href: "#", mins: 2 },
      { title: "Request a refund", href: "#", mins: 2 },
      { title: "Startup & non-profit discounts", href: "#", mins: 1 },
    ],
  },
  {
    icon: Shield,
    title: "Privacy & security",
    description: "Data storage, GDPR compliance, DPAs, and account deletion.",
    color: "text-amber-600",
    bg: "bg-amber-50",
    articles: [
      { title: "Where your data is stored", href: "#", mins: 2 },
      { title: "Download our DPA", href: "/dpa", mins: 1 },
      { title: "GDPR & EU data residency", href: "#", mins: 3 },
      { title: "Delete your account", href: "#", mins: 2 },
    ],
  },
];

const POPULAR = [
  { title: "How do I connect Google Play?", href: "/help/connect-google-play", category: "Getting started" },
  { title: "How do I connect the App Store?", href: "/help/connect-app-store", category: "Getting started" },
  { title: "How does AI reply generation work?", href: "/help/ai-replies", category: "AI replies" },
  { title: "Can ReviewBox auto-publish replies?", href: "/help/automation", category: "Automation" },
  { title: "What happens when I hit my plan limit?", href: "/faq#billing", category: "Billing" },
  { title: "Is ReviewBox GDPR compliant?", href: "/faq#privacy", category: "Privacy" },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <MarketingNav />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-600">Help Center</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        {/* Hero + search */}
        <div className="pt-12 pb-12 text-center max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900">
            How can we help?
          </h1>
          <p className="mt-3 text-gray-500">
            Search the docs, or browse by category below.
          </p>

          {/* Search bar — decorative (no JS needed for static) */}
          <div className="mt-8 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search articles..."
              className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-4 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-[#0A84FF] focus:outline-none focus:ring-1 focus:ring-[#0A84FF]"
            />
          </div>
        </div>

        {/* Popular articles */}
        <div className="mb-12">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-4">
            Popular articles
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {POPULAR.map((a) => (
              <Link
                key={a.title}
                href={a.href}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-3.5 hover:border-gray-300 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{a.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{a.category}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 shrink-0 ml-3" />
              </Link>
            ))}
          </div>
        </div>

        {/* Category cards */}
        <div className="grid gap-6 sm:grid-cols-2">
          {CATEGORIES.map((cat) => (
            <div key={cat.title} className="rounded-2xl border border-gray-200 bg-white p-6">
              <div className={`inline-flex rounded-xl p-2.5 ${cat.bg} mb-4`}>
                <cat.icon className={`h-5 w-5 ${cat.color}`} strokeWidth={1.5} />
              </div>
              <h2 className="font-bold text-gray-900">{cat.title}</h2>
              <p className="mt-1 text-sm text-gray-500 mb-5">{cat.description}</p>
              <ul className="space-y-2">
                {cat.articles.map((a) => (
                  <li key={a.title}>
                    <Link
                      href={a.href}
                      className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-sm text-gray-700">{a.title}</span>
                      <span className="text-xs text-gray-400 shrink-0 ml-3">{a.mins} min</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact CTA */}
        <div className="mt-16 rounded-2xl border border-blue-100 bg-blue-50 px-8 py-10 text-center">
          <h2 className="text-lg font-bold text-gray-900">Can&apos;t find what you need?</h2>
          <p className="mt-2 text-sm text-gray-600">
            The whole team reads support email. You&apos;ll get a real answer, not a template.
          </p>
          <Link
            href="/contact"
            className="mt-6 inline-flex rounded-xl bg-[#0A84FF] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#0070e0]"
          >
            Email us
          </Link>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
