import Link from "next/link";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";
import {
  Card,
  Eyebrow,
  PageHero,
  Section,
} from "@/features/marketing/components/primitives";
import { Breadcrumb } from "@/features/marketing/components/breadcrumb";

export const metadata = {
  title: "Blog",
  description:
    "Engineering notes and practical guides on managing App Store and Google Play reviews — replies, ratings, sentiment, and release health.",
};

/**
 * One entry, because one article exists.
 *
 * This list previously carried four more:
 *
 *   /blog/reply-playbook
 *   /blog/rating-spikes
 *   /blog/appstore-vs-google-play-rating
 *
 * None of them had a route. Every card was a 404 — the only working link on
 * the page was the featured one. They also carried invented evidence for
 * articles that did not exist ("We analyzed 10,000 replies across 200 apps"),
 * which is the same defect that took /compare and /status down.
 *
 * Add an entry here when the route exists, not when the idea does.
 */
const POSTS = [
  {
    title: "How we reduced AI reply costs by 94% without hurting quality",
    excerpt:
      "We rebuilt the reply pipeline from scratch — templates, a Redis cache, and a model call only for the hard cases. Here's exactly how the math works.",
    category: "Engineering",
    date: "May 15, 2026",
    readTime: "8 min read",
    slug: "/blog/ai-cost-reduction",
  },
];

export default function BlogPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      <PageHero
        eyebrow="Writing"
        title="Blog"
        lede="Engineering notes and practical guides on managing App Store and Google Play reviews."
      />

      <main>
        <Breadcrumb trail={[{ label: "Blog" }]} />

        {/* The category filter pills that used to sit here were <button>
            elements with no onClick and no state — they could not filter
            anything. With one article they would be doubly pointless. Bring
            them back as real filters when there is enough to filter. */}
        <Section tight>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {POSTS.map((post) => (
              <Link key={post.slug} href={post.slug} className="group block">
                <Card className="flex h-full flex-col">
                  <Eyebrow className="mb-3">{post.category}</Eyebrow>
                  <h2 className="text-[19px] leading-[1.3] font-bold tracking-[-0.015em] text-[var(--rb-fg-1)] group-hover:underline">
                    {post.title}
                  </h2>
                  <p className="mt-3 flex-1 text-[15.5px] leading-[1.55] text-[var(--rb-fg-3)]">
                    {post.excerpt}
                  </p>
                  <p className="mt-5 flex items-center gap-2 text-[13px] text-[var(--rb-fg-3)]">
                    <span>{post.date}</span>
                    <span aria-hidden="true">·</span>
                    <span>{post.readTime}</span>
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </Section>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
