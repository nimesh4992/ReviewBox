import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Breadcrumb } from "@/features/marketing/components/breadcrumb";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export const metadata = {
  title: "Automation Rules — Help",
  description:
    "Learn how to build automation rules in ReviewBox to auto-triage, auto-draft, and auto-reply to app store reviews.",
};

const RULE_EXAMPLES = [
  {
    name: "Auto-draft for 5-star reviews",
    trigger: "Rating is 5★",
    conditions: ["Sentiment: positive"],
    actions: ["Generate AI draft", "Tag: positive"],
    note: "Fills your inbox with ready-to-send replies for happy customers.",
  },
  {
    name: "Escalate crash reports",
    trigger: "Tag: crash detected",
    conditions: ["Rating ≤ 2★"],
    actions: ["Priority: urgent", "Escalate to: engineering", "Slack alert: #crashes"],
    note: "Pages your team before a crash spike becomes a PR crisis.",
  },
  {
    name: "Auto-triage billing disputes",
    trigger: "Tag: billing detected",
    conditions: [],
    actions: ["Priority: high", "Escalate to: support", "Tag: needs-human"],
    note: "Billing disputes always need a human — this keeps them from slipping.",
  },
  {
    name: "Handle short rating-only reviews",
    trigger: "Word count < 10",
    conditions: ["Rating is 4★ or 5★"],
    actions: ["Match template: rating_only", "Auto-publish (Team plan)"],
    note: "\"Great app!\" reviews don't need custom replies. Handle them at zero cost.",
  },
];

const RELATED = [
  { title: "How AI replies work", href: "/help/ai-replies" },
  { title: "Connect Google Play", href: "/help/connect-google-play" },
  { title: "Auto-publish FAQ", href: "/faq" },
  { title: "Compare plans", href: "/pricing" },
];

export default function AutomationPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      <Breadcrumb
        trail={[{ label: "Help centre", href: "/help" }, { label: "Automation Rules" }]}
      />

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        <div className="pt-10 pb-8 max-w-3xl">
          <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-600">
            Automation · 6 min
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--rb-fg-1)] sm:text-4xl">
            Building automation rules
          </h1>
          <p className="mt-3 text-[var(--rb-fg-3)] leading-relaxed">
            Automation rules let ReviewBox take actions automatically when new reviews arrive — without you clicking anything. Rules are available on all plans; auto-publish requires Team.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_260px] max-w-5xl">
          <div className="space-y-8">

            {/* How rules work */}
            <div id="how-rules-work" className="scroll-mt-24">
              <h2 className="font-bold text-[var(--rb-fg-1)] text-lg mb-4">How rules work</h2>
              <div className="rounded-2xl border border-[var(--rb-mk-line)] bg-white p-6">
                <p className="text-sm text-[var(--rb-fg-2)] leading-relaxed">
                  Each rule has three parts: a <strong>trigger</strong> (what starts it), optional <strong>conditions</strong> (filters to narrow down which reviews match), and <strong>actions</strong> (what ReviewBox does when a match is found).
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {[
                    { label: "Trigger", desc: "A new review arrives, or an existing review is re-synced.", icon: "⚡" },
                    { label: "Conditions", desc: "Filter by rating, sentiment, tags, version, country, word count.", icon: "🎯" },
                    { label: "Actions", desc: "Set priority, add tags, escalate, draft reply, auto-publish.", icon: "🤖" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-[var(--rb-mk-sunken)] p-4">
                      <div className="text-2xl mb-2">{item.icon}</div>
                      <p className="font-semibold text-sm text-[var(--rb-fg-1)]">{item.label}</p>
                      <p className="mt-1 text-xs text-[var(--rb-fg-3)] leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm text-[var(--rb-fg-2)]">
                  Rules are evaluated in order. The first matching rule wins — unless you enable <strong>Run all matching rules</strong> in Settings → Automations.
                </p>
              </div>
            </div>

            {/* Create a rule */}
            <div id="create-rule" className="scroll-mt-24">
              <h2 className="font-bold text-[var(--rb-fg-1)] text-lg mb-4">Create your first rule</h2>
              <div className="rounded-2xl border border-[var(--rb-mk-line)] bg-white p-6">
                <ol className="space-y-4 text-sm text-[var(--rb-fg-2)]">
                  {[
                    "Go to **Automations** in the sidebar",
                    "Click **New rule**",
                    'Give your rule a name (e.g. "Escalate crash reports")',
                    'Set your **trigger** — usually "New review received"',
                    "Add **conditions** to filter which reviews match",
                    "Choose one or more **actions** to perform",
                    "Click **Save** — the rule activates immediately",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--rb-mk-ink)] text-[10px] font-bold text-white mt-0.5">
                        {i + 1}
                      </span>
                      <span dangerouslySetInnerHTML={{ __html: step.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Example rules */}
            <div id="examples" className="scroll-mt-24">
              <h2 className="font-bold text-[var(--rb-fg-1)] text-lg mb-4">4 rules to steal</h2>
              <div className="space-y-4">
                {RULE_EXAMPLES.map((rule) => (
                  <div key={rule.name} className="rounded-2xl border border-[var(--rb-mk-line)] bg-white p-6">
                    <div className="mb-4">
                      <h3 className="font-semibold text-[var(--rb-fg-1)]">{rule.name}</h3>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 text-xs">
                      <div>
                        <p className="font-semibold text-[var(--rb-fg-3)] uppercase tracking-wider mb-1.5">Trigger</p>
                        <p className="rounded-lg bg-[var(--rb-mk-sunken)] px-3 py-2 text-[var(--rb-fg-2)]">{rule.trigger}</p>
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--rb-fg-3)] uppercase tracking-wider mb-1.5">Conditions</p>
                        {rule.conditions.length > 0 ? (
                          <div className="space-y-1">
                            {rule.conditions.map((c) => (
                              <p key={c} className="rounded-lg bg-[var(--rb-mk-sunken)] px-3 py-2 text-[var(--rb-fg-2)]">{c}</p>
                            ))}
                          </div>
                        ) : (
                          <p className="rounded-lg bg-[var(--rb-mk-sunken)] px-3 py-2 text-[var(--rb-fg-3)] italic">None (matches all)</p>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-[var(--rb-fg-3)] uppercase tracking-wider mb-1.5">Actions</p>
                        <div className="space-y-1">
                          {rule.actions.map((a) => (
                            <p key={a} className="rounded-lg bg-blue-50 px-3 py-2 text-blue-700">{a}</p>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-[var(--rb-fg-3)] italic">{rule.note}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Auto-publish */}
            <div id="auto-publish" className="scroll-mt-24">
              <h2 className="font-bold text-[var(--rb-fg-1)] text-lg mb-4">Auto-publish (Team plan)</h2>
              <div className="rounded-2xl border border-[var(--rb-mk-line)] bg-white p-6">
                <p className="text-sm text-[var(--rb-fg-2)] leading-relaxed">
                  Auto-publish sends replies to the app store without human approval. It&apos;s disabled by default and must be opted in per workspace.
                </p>
                <div className="mt-4 space-y-2 text-sm text-[var(--rb-fg-2)]">
                  <p className="font-semibold text-[var(--rb-fg-1)]">Requirements:</p>
                  <ul className="list-disc list-inside space-y-1 text-[var(--rb-fg-2)]">
                    <li>Team plan subscription</li>
                    <li>The rule&apos;s action must use a template reply (not AI-generated)</li>
                    <li>Auto-publish must be enabled in Settings → Automations → Allow auto-publish</li>
                  </ul>
                </div>
                <div className="mt-4 rounded-xl bg-amber-50 border border-amber-100 p-4">
                  <p className="text-sm text-amber-800">
                    <strong>Tip:</strong> Start with a narrow rule (e.g. 5★ + positive + short review) and monitor for a week before expanding. All auto-published replies appear in your audit log.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--rb-mk-line)] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--rb-fg-3)] mb-3">On this page</p>
              <ul className="space-y-1">
                {[
                  { label: "How rules work", id: "how-rules-work" },
                  { label: "Create a rule", id: "create-rule" },
                  { label: "Example rules", id: "examples" },
                  { label: "Auto-publish", id: "auto-publish" },
                ].map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[var(--rb-fg-2)] hover:bg-[var(--rb-mk-sunken)]">
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--rb-mk-line)] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-[var(--rb-fg-3)] mb-3">Related</p>
              <ul className="space-y-1">
                {RELATED.map((r) => (
                  <li key={r.title}>
                    <Link href={r.href} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm text-[var(--rb-fg-2)] hover:bg-[var(--rb-mk-sunken)]">
                      {r.title}
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--rb-fg-3)] shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[var(--rb-mk-line)] bg-white p-5 text-center">
              <p className="text-sm font-semibold text-[var(--rb-fg-1)]">Need a hand?</p>
              <p className="mt-1 text-xs text-[var(--rb-fg-3)]">We&apos;ll help you set up your first rule.</p>
              <Link href="/contact" className="mt-4 inline-flex rounded-lg bg-[var(--rb-mk-amber-500)] px-4 py-2 text-xs font-bold text-[var(--rb-mk-ink)] hover:bg-[var(--rb-mk-amber-600)]">
                Email us
              </Link>
            </div>
          </div>
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
