import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export const metadata = {
  title: "How AI Replies Work â€” ReviewBox Help",
  description:
    "Learn how ReviewBox's 3-tier AI reply pipeline works: templates, cache, and Groq â€” and how 85% of replies cost $0.",
};

const TIERS = [
  {
    number: "1",
    label: "Template match",
    cost: "$0 Â· instant",
    color: "bg-emerald-500",
    description:
      "ReviewBox checks your review against 25 built-in reply templates. Templates match on rating + detected tags (crash, billing, login, feature request, etc.). If a template matches, the reply is returned instantly with zero AI tokens consumed.",
    detail: "~70% of all reviews are handled here.",
  },
  {
    number: "2",
    label: "Reply cache",
    cost: "$0 Â· ~5ms",
    color: "bg-blue-500",
    description:
      "If no template matches, ReviewBox checks a Redis cache for a previously-generated reply to an identical or near-identical review. Cache keys are SHA-256 hashes of the review text + rating + tone. Cached replies are served instantly.",
    detail: "~15% of reviews are handled here. Cache entries live for 7 days.",
  },
  {
    number: "3",
    label: "AI generation",
    cost: "~$0.001 Â· ~600ms",
    color: "bg-purple-500",
    description:
      "If neither tier 1 nor 2 matches, ReviewBox generates a new reply using Groq's Llama 3.3 70B model. Before sending, the review text is compressed (stripping filler phrases) to reduce token usage by ~73%. The generated reply is stored in the cache so identical future reviews are free.",
    detail: "~12â€“18% of reviews reach AI generation.",
  },
];

const TONES = [
  { name: "Professional", desc: "Formal, concise, corporate-safe." },
  { name: "Friendly", desc: "Warm, conversational, approachable." },
  { name: "Empathetic", desc: "Leads with understanding before solutions." },
  { name: "Brief", desc: "2â€“3 sentences max. Respect the reader's time." },
  { name: "Custom", desc: "Write your own persona description (up to 200 chars). Applied to every AI-generated reply." },
];

const RELATED = [
  { title: "Connect Google Play", href: "/help/connect-google-play" },
  { title: "Connect the App Store", href: "/help/connect-app-store" },
  { title: "Building automation rules", href: "/help/automation" },
  { title: "AI replies FAQ", href: "/faq" },
];

export default function AiRepliesPage() {
  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      <MarketingNav />

      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <Link href="/help" className="hover:text-gray-600">Help Center</Link>
          <span>/</span>
          <span className="text-gray-600">How AI Replies Work</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        <div className="pt-10 pb-8 max-w-3xl">
          <span className="inline-flex items-center rounded-full bg-purple-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-purple-600">
            AI replies Â· 4 min
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How AI replies work
          </h1>
          <p className="mt-3 text-gray-500 leading-relaxed">
            ReviewBox uses a 3-tier pipeline to generate reply drafts. About 85% of replies are served from tiers 1â€“2 at zero cost. Only ~15% of reviews ever touch an AI model.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_260px] max-w-5xl">
          <div className="space-y-8">

            {/* Pipeline */}
            <div>
              <h2 className="font-bold text-gray-900 text-lg mb-4">The 3-tier pipeline</h2>
              <div className="space-y-4">
                {TIERS.map((tier) => (
                  <div key={tier.number} className="rounded-2xl border border-gray-200 bg-white p-6">
                    <div className="flex items-start gap-4">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tier.color} text-sm font-bold text-white`}>
                        {tier.number}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-2">
                          <h3 className="font-semibold text-gray-900">{tier.label}</h3>
                          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                            {tier.cost}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed">{tier.description}</p>
                        <p className="mt-2 text-xs font-semibold text-gray-400">{tier.detail}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div id="tones" className="scroll-mt-24">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Tone options</h2>
              <div className="rounded-2xl border border-gray-200 bg-white divide-y divide-gray-100">
                {TONES.map((tone) => (
                  <div key={tone.name} className="flex items-start gap-4 px-6 py-4">
                    <span className="text-sm font-semibold text-gray-900 w-28 shrink-0">{tone.name}</span>
                    <p className="text-sm text-gray-500">{tone.desc}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-400">
                Tone is applied to AI-generated replies only. Template replies use their own pre-written tone.
              </p>
            </div>

            {/* Auto-publish */}
            <div id="auto-publish" className="scroll-mt-24">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Auto-publish rules</h2>
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="text-sm text-gray-600 leading-relaxed">
                  On the <strong>Team plan</strong>, you can configure auto-publish rules. A rule defines conditions
                  (e.g. &ldquo;5-star review + positive sentiment + reply from template&rdquo;) â€” when all conditions match,
                  ReviewBox publishes the reply without human approval.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600 list-disc list-inside">
                  <li>Disabled by default â€” opt-in per workspace</li>
                  <li>Only template-tier replies can be auto-published (not AI-generated ones)</li>
                  <li>All auto-published replies are logged in the audit trail</li>
                  <li>You can pause or disable auto-publish at any time from Settings â†’ Automations</li>
                </ul>
              </div>
            </div>

            {/* Does it learn */}
            <div id="learning" className="scroll-mt-24">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Does ReviewBox learn from edits?</h2>
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Not yet. When you edit an AI draft before publishing, your edit is saved but not currently used
                  to fine-tune the model. This is on the roadmap â€” the goal is for ReviewBox to learn your preferred
                  phrasing over time and reduce AI-generated replies in favour of cached edits.
                </p>
              </div>
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">On this page</p>
              <ul className="space-y-1">
                {[
                  { label: "3-tier pipeline", id: "pipeline" },
                  { label: "Tone options", id: "tones" },
                  { label: "Auto-publish", id: "auto-publish" },
                  { label: "Does it learn?", id: "learning" },
                ].map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Related</p>
              <ul className="space-y-1">
                {RELATED.map((r) => (
                  <li key={r.title}>
                    <Link href={r.href} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50">
                      {r.title}
                      <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center">
              <p className="text-sm font-semibold text-gray-900">Still stuck?</p>
              <p className="mt-1 text-xs text-gray-500">Real answers from real people.</p>
              <Link href="/contact" className="mt-4 inline-flex rounded-lg bg-[#0A84FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0070e0]">
                Email us
              </Link>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
