import Link from "next/link";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import {
  Breadcrumb,
  CtaBand,
  PageHero,
  Reveal,
  RHYTHM,
  Section,
} from "@/features/marketing/components/primitives";

export const metadata = {
  title: "Blog",
  description:
    "Engineering notes and practical guides on managing App Store and Google Play reviews — replies, ratings, sentiment, and release health.",
};

const FEATURED = {
  title: "How we reduced AI reply costs by 94% without hurting quality",
  excerpt:
    "We rebuilt the reply pipeline from scratch — 25 templates, a Redis cache, and Gemini for the hard cases. Here's exactly how the math works.",
  category: "Engineering",
  date: "May 15, 2026",
  readTime: "8 min read",
  slug: "/blog/ai-cost-reduction",
};

// Only entries that resolve.
//
// Three of the six cards here linked to pages that do not exist —
// /blog/reply-playbook, /blog/rating-spikes and
// /blog/appstore-vs-google-play-rating all returned 404, so half this index
// was a dead end. They are removed rather than left broken or dressed up as
// "coming soon": advertising writing that has not been written is the same
// class of claim as advertising a feature that has not been built. Add them
// back as they are actually published.
//
// (The deleted reply-playbook excerpt also claimed "We analyzed 10,000 replies
// across 200 apps", which never happened.)
//
// The two survivors are help-centre guides and say so, rather than implying a
// blog post that then turns out to be documentation.
const POSTS = [
  {
    title: "Connecting Google Play to ReviewBox: the complete guide",
    excerpt:
      "Service account setup, API scopes, the exact JSON you need — with screenshots for every step.",
    category: "Guide",
    date: "April 10, 2026",
    readTime: "7 min read",
    slug: "/help/connect-google-play",
  },
  {
    title: "App store automation rules: templates that actually work",
    excerpt:
      "Auto-triage crash reports. Auto-escalate billing disputes. Auto-draft for 5-star reviews. Steal these.",
    category: "Guide",
    date: "April 1, 2026",
    readTime: "5 min read",
    slug: "/help/automation",
  },
];

export default function BlogPage() {
  return (
    <MarketingShell>
      <MarketingNav />
      <Breadcrumb label="Blog" />

      <main>
        <PageHero
          eyebrow="Writing"
          title="Notes from building ReviewBox"
          lede="Engineering write-ups and practical guides on managing App Store and Google Play reviews. Everything here is something we actually shipped or actually measured."
        />

        <Section className={RHYTHM.sm}>
          {/* Featured */}
          <Reveal>
            <Link
              href={FEATURED.slug}
              className="group block overflow-hidden rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)] transition-shadow hover:shadow-[var(--rb-shadow-md)] md:grid md:grid-cols-[1fr_320px]"
            >
              <div className="p-7 sm:p-9">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rb-eyebrow rounded-full bg-[var(--rb-blue-50)] px-2.5 py-1 text-[var(--rb-blue-600)] dark:bg-[var(--rb-bg-accent-soft)] dark:text-[var(--rb-blue-400)]">
                    {FEATURED.category}
                  </span>
                  <span className="rb-meta font-normal text-fg-3">Featured</span>
                </div>
                <h2 className="rb-h2 mt-4 text-fg-1 transition-colors group-hover:text-[var(--rb-blue-500)]">
                  {FEATURED.title}
                </h2>
                <p className="rb-lead mt-4 text-fg-2">{FEATURED.excerpt}</p>
                <p className="rb-meta mt-6 font-normal text-fg-3">
                  {FEATURED.date} · {FEATURED.readTime}
                </p>
              </div>

              {/* Was an empty blue gradient rectangle — a placeholder where an
                  image should be, which reads as an unfinished page. This says
                  what the post is about instead of pretending to be art. */}
              <div
                aria-hidden="true"
                className="flex flex-col items-center justify-center gap-1 border-t border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-8 md:border-t-0 md:border-l"
              >
                <span className="text-[44px] leading-none font-bold tracking-[-0.04em] text-[var(--rb-blue-500)]">
                  94%
                </span>
                <span className="rb-meta text-center font-normal text-fg-3">
                  cheaper AI replies,
                  <br />
                  same output
                </span>
              </div>
            </Link>
          </Reveal>

          {/* Guides. Two cards in a two-column grid, so the row is full —
              five cards in a three-column grid left a hole in the last row. */}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {POSTS.map((post, i) => (
              <Reveal key={post.title} delay={i * 80}>
                <Link
                  href={post.slug}
                  className="group flex h-full flex-col rounded-2xl border border-[var(--rb-border-1)] bg-surface p-6 shadow-[var(--rb-shadow-xs)] transition-shadow hover:shadow-[var(--rb-shadow-md)]"
                >
                  <span className="rb-eyebrow w-fit rounded-full bg-[var(--rb-bg-sunken)] px-2.5 py-1 text-fg-3">
                    {post.category}
                  </span>
                  <h3 className="rb-h3 mt-4 text-fg-1 transition-colors group-hover:text-[var(--rb-blue-500)]">
                    {post.title}
                  </h3>
                  <p className="rb-body-sm mt-2.5 flex-1 text-fg-2">{post.excerpt}</p>
                  <p className="rb-meta mt-5 font-normal text-fg-3">
                    {post.date} · {post.readTime}
                  </p>
                </Link>
              </Reveal>
            ))}
          </div>
        </Section>

        <CtaBand
          title="Stop reading. Start replying."
          lede="Connect an app and see your own review queue in about a minute. Free for 14 days, no card."
          primary={{ href: "/sign-up", label: "Start free trial" }}
          secondary={{ href: "/help", label: "Browse the help centre" }}
        />
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
