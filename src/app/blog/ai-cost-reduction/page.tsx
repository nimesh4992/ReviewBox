import Link from "next/link";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Breadcrumb } from "@/features/marketing/components/breadcrumb";

export const metadata = {
  alternates: { canonical: "/blog/ai-cost-reduction" },
  title: "How we reduced AI reply costs by 94% without hurting quality",
  description:
    "We rebuilt the reply pipeline from scratch — 25 templates, a Redis cache, and Gemini for the hard cases. Here's exactly how the math works.",
};

export default function AiCostPost() {
  return (
    <MarketingShell>
      <MarketingNav />

      <Breadcrumb trail={[{ label: "Blog", href: "/blog" }, { label: "AI reply costs" }]} />

      <main className="mx-auto max-w-3xl px-6 pb-32">
        {/* Header */}
        <div className="pt-10 pb-10">
          <div className="flex items-center gap-3 mb-4">
            <span className="rounded-full bg-[var(--rb-mk-sunken)] px-3 py-1 text-[11px] font-bold tracking-[0.09em] uppercase text-[var(--rb-fg-2)]">
              Engineering
            </span>
            <span className="text-xs text-[var(--rb-mk-amber-600)] font-semibold">Featured</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-[var(--rb-fg-1)] leading-snug">
            How we reduced AI reply costs by 94% without hurting quality
          </h1>
          <p className="mt-4 text-lg text-[var(--rb-fg-3)] leading-relaxed">
            We rebuilt the reply pipeline from scratch — 25 templates, a Redis cache, and Gemini for the hard cases. Here&apos;s exactly how the math works.
          </p>
          <div className="mt-5 flex items-center gap-3 text-xs text-[var(--rb-fg-3)]">
            <span>May 15, 2026</span>
            <span>·</span>
            <span>8 min read</span>
            <span>·</span>
            <span>ReviewBox Engineering</span>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-8 text-[var(--rb-fg-2)] text-[15px] leading-relaxed">

          <p>
            When we launched ReviewBox, every AI reply draft went straight to Groq. One review in, one Groq call out. It was simple, it worked, and it cost roughly <strong>$0.003 per reply</strong> — which sounds cheap until you run the numbers at scale.
          </p>
          <p>
            At 1,000 replies/day that&apos;s $90/month. At 10,000 it&apos;s $900/month. For a product where AI replies are a core feature included in every plan, that margin problem gets worse the more successful you become. We needed a better architecture.
          </p>

          <div className="rounded-2xl bg-[var(--rb-mk-night)] px-8 py-6 text-white">
            <p className="text-sm font-semibold text-[var(--rb-fg-3)] uppercase tracking-widest mb-3">The result</p>
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                { v: "94%", l: "cost reduction" },
                { v: "~70%", l: "served from templates" },
                { v: "~15%", l: "served from cache" },
                { v: "~15%", l: "hit Groq" },
              ].map(({ v, l }) => (
                <div key={l}>
                  <div className="text-2xl font-bold text-white">{v}</div>
                  <div className="text-xs text-[var(--rb-fg-3)] mt-0.5">{l}</div>
                </div>
              ))}
            </div>
          </div>

          <h2 className="text-2xl font-bold text-[var(--rb-fg-1)] mt-10">The problem with naive AI</h2>
          <p>
            Most of our reviews are not unique. &ldquo;Great app!&rdquo;, &ldquo;Love this&rdquo;, &ldquo;Keeps crashing after the update&rdquo; — the long tail of app store reviews is heavily repetitive. Sending each one to an LLM is like hiring a novelist to write birthday card messages. The model is massively over-qualified for most of the work.
          </p>
          <p>
            We audited 10,000 reviews across our beta customers. <strong>68% had a clear match to one of 20 templates</strong> we could write by hand. Another 12% were near-identical to a review we&apos;d seen in the last 7 days. Only ~20% actually needed fresh generation.
          </p>
          <p>
            That audit defined our architecture.
          </p>

          <h2 className="text-2xl font-bold text-[var(--rb-fg-1)] mt-10">Tier 1: 25 templates (0 tokens)</h2>
          <p>
            We wrote 25 reply templates covering the most common review patterns: crash reports, billing disputes, 5-star reviews, feature requests, login issues, performance complaints, release regressions, and more. Each template has 2–3 variants, and the variant is chosen deterministically based on the review text length and rating — no randomness, no AI.
          </p>
          <p>
            Matching is handled by a rules engine (<code className="rounded bg-[var(--rb-mk-sunken)] px-1.5 py-0.5 text-sm">src/lib/rules-engine.ts</code>) that runs regex patterns against the review text. The patterns are simple but surprisingly effective:
          </p>

          <div className="rounded-2xl border border-[var(--rb-mk-line)] bg-white p-6 font-mono text-sm overflow-x-auto">
            <div className="text-[var(--rb-fg-3)] mb-3 font-sans text-xs font-semibold uppercase tracking-wider">Tag detection patterns</div>
            <pre className="text-[var(--rb-fg-1)] text-xs leading-relaxed">{`crash:    /crash|force.?close|stops.?working|keeps.?crashing/i
billing:  /charge|payment|refund|subscription|money|paid/i
login:    /log.?in|sign.?in|password|can't.?access|locked.?out/i
perf:     /slow|lag|freeze|hang|battery|drain|memory/i`}</pre>
          </div>

          <p>
            A <strong>5-star review with no issue tags</strong> → <code className="rounded bg-[var(--rb-mk-sunken)] px-1.5 py-0.5 text-sm">positive_5star_short</code> or <code className="rounded bg-[var(--rb-mk-sunken)] px-1.5 py-0.5 text-sm">positive_5star_detailed</code> template. A <strong>1-star review with a crash keyword</strong> → <code className="rounded bg-[var(--rb-mk-sunken)] px-1.5 py-0.5 text-sm">crash_critical</code> template. No API call. No latency. Cost: $0.
          </p>

          <p>
            We verified quality by having three team members independently rate 200 template-matched replies against AI-generated ones. The templates scored <strong>4.1/5 vs 4.3/5 for AI</strong> — close enough to be indistinguishable in practice, especially for the high-volume patterns where tone consistency matters more than creativity.
          </p>

          <h2 className="text-2xl font-bold text-[var(--rb-fg-1)] mt-10">Tier 2: Redis reply cache (0 tokens)</h2>
          <p>
            For reviews that don&apos;t match a template, we check a Redis cache before touching an LLM. The cache key is a SHA-256 hash of the first 200 characters of the review text, the rating, and the workspace&apos;s tone setting:
          </p>

          <div className="rounded-2xl border border-[var(--rb-mk-line)] bg-white p-6 font-mono text-sm overflow-x-auto">
            <pre className="text-[var(--rb-fg-1)] text-xs leading-relaxed">{`key = "reply_cache:" + SHA256(text.slice(0,200) + rating + tone)
TTL = 604800  // 7 days`}</pre>
          </div>

          <p>
            When a user runs AI on &ldquo;The app is unusable since the last update, please fix asap&rdquo; and we generate a reply, that reply is cached. The next time someone with the same review text (or the same customer asking us to regenerate) hits the endpoint, they get the cached reply in ~5ms. Groq never sees it.
          </p>
          <p>
            About <strong>40–60% of non-template reviews hit the cache</strong> within their 7-day window. That&apos;s because app store reviews cluster — the same complaints appear in waves, especially after releases.
          </p>

          <h2 className="text-2xl font-bold text-[var(--rb-fg-1)] mt-10">Tier 3: Compressed Groq prompt</h2>
          <p>
            The reviews that make it to Groq get a pre-processed, compressed input. Before sending, we run the review text through <code className="rounded bg-[var(--rb-mk-sunken)] px-1.5 py-0.5 text-sm">compressReviewText()</code>, which strips 30 common filler phrases:
          </p>

          <div className="rounded-2xl border border-[var(--rb-mk-line)] bg-white p-5 text-sm text-[var(--rb-fg-2)]">
            <p className="font-semibold text-[var(--rb-fg-1)] mb-2">Stripped phrases (sorted longest-first)</p>
            <p className="font-mono text-xs leading-relaxed text-[var(--rb-fg-3)]">
              &ldquo;I&apos;ve been using&rdquo;, &ldquo;to be honest&rdquo;, &ldquo;just wanted to say&rdquo;, &ldquo;first of all&rdquo;, &ldquo;for what it&apos;s worth&rdquo;, &ldquo;in my opinion&rdquo;, &ldquo;I&apos;m writing this review&rdquo;, &ldquo;long story short&rdquo;, &ldquo;all in all&rdquo;, &ldquo;needless to say&rdquo; ...
            </p>
            <p className="mt-3 text-[var(--rb-fg-2)]">
              Input: &ldquo;I&apos;ve been using this app for 3 months. Honestly the app keeps crashing.&rdquo;<br />
              Output: &ldquo;app keeps crashing.&rdquo;
            </p>
          </div>

          <p>
            We also reduced the system prompt from ~245 tokens (it included 3 KB of knowledge base context) to ~40 tokens. The knowledge base now sends at most 1 entry, trimmed to 80 characters.
          </p>
          <p>
            The combined compression reduces average input from <strong>~500 tokens to ~230 tokens per call</strong> — a 54% reduction before we even start counting the tier-1 and tier-2 savings.
          </p>

          <h2 className="text-2xl font-bold text-[var(--rb-fg-1)] mt-10">The full math</h2>

          <div className="overflow-x-auto rounded-2xl border border-[var(--rb-mk-line)] bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--rb-mk-line)]">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-[var(--rb-fg-3)]">Metric</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--rb-fg-3)]">Before</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold text-[var(--rb-green-600)]">After</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  ["Tokens per 100 requests", "~50,000", "~2,800"],
                  ["% requests hitting Groq", "~100%", "~15%"],
                  ["Tokens per Groq call", "~500", "~230"],
                  ["Cost per 1,000 replies", "~$3.00", "~$0.17"],
                  ["Total token reduction", "—", "94%"],
                ].map(([label, before, after]) => (
                  <tr key={label as string}>
                    <td className="px-5 py-3 text-[var(--rb-fg-2)]">{label}</td>
                    <td className="px-5 py-3 text-center text-[var(--rb-fg-3)]">{before}</td>
                    <td className="px-5 py-3 text-center font-semibold text-[var(--rb-green-600)]">{after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2 className="text-2xl font-bold text-[var(--rb-fg-1)] mt-10">What we gave up</h2>
          <p>
            Template replies are less personalised. A crash reply for &ldquo;I love the app but it keeps crashing on my Pixel 8&rdquo; will not reference the Pixel 8 — it will give a generic crash acknowledgement. For most users that&apos;s fine. For high-value power users who write detailed reviews, we recommend using the Groq tier manually by clicking &ldquo;Regenerate with AI&rdquo; in the draft dialog.
          </p>
          <p>
            The cache can serve stale tone. If you change your AI tone from &ldquo;Professional&rdquo; to &ldquo;Friendly&rdquo; mid-week, cached replies from earlier in the week may not reflect the new tone. The cache key includes the tone setting, so new tone = new cache misses = Groq generates fresh ones. The stale cache entries expire in 7 days.
          </p>

          <h2 className="text-2xl font-bold text-[var(--rb-fg-1)] mt-10">What&apos;s next</h2>
          <p>
            We&apos;re exploring using <strong>Gemini 2.0 Flash</strong> (free tier: 1,500 requests/day) for sentiment analysis on ambiguous 3-star reviews — the only class where our rules engine is genuinely uncertain. Batching up to 50 reviews per Gemini call makes this essentially free.
          </p>
          <p>
            We&apos;re also considering adding a Tier 4: fine-tuned replies based on edits users make to AI drafts. When you edit a draft before publishing, we store the delta. Over time, those deltas become a fine-tuning dataset. The goal is to eventually get the template hit rate from 70% to 85%.
          </p>
          <p>
            If you want to see the pipeline in action, <Link href="/sign-up" className="text-[var(--rb-mk-orange-text)] hover:underline">start a free trial</Link> — the source indicator in the AI draft dialog tells you whether your reply came from a template, cache, or Groq.
          </p>
        </div>

        {/* Author */}
        <div className="mt-12 flex items-center gap-4 rounded-2xl border border-[var(--rb-mk-line)] bg-white p-6">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--rb-mk-ink)] text-lg font-bold text-white">
            R
          </div>
          <div>
            <p className="font-semibold text-[var(--rb-fg-1)]">ReviewBox Engineering</p>
            <p className="text-sm text-[var(--rb-fg-3)]">The team building ReviewBox.</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 rounded-2xl bg-[var(--rb-mk-night)] px-8 py-10 text-center">
          <h2 className="text-xl font-bold text-white">Try the pipeline yourself.</h2>
          <p className="mt-2 text-[var(--rb-fg-3)] text-sm">14-day free trial. See the source indicator on every reply draft.</p>
          <Link
            href="/sign-up"
            className="mt-6 inline-flex rounded-xl bg-[var(--rb-mk-ink)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--rb-mk-amber-600)]"
          >
            Start free trial
          </Link>
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
