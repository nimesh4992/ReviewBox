import Link from "next/link";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { MarketingShell } from "@/components/layout/marketing-shell";

export const metadata = {
  title: "Blog — ReviewBox",
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

const POSTS = [
  {
    title: "The app store reply playbook: what to say (and what not to)",
    excerpt: "We analyzed 10,000 replies across 200 apps. Here's what the best ones have in common.",
    category: "Guides",
    date: "May 10, 2026",
    readTime: "6 min read",
    slug: "/blog/reply-playbook",
  },
  {
    title: "Rating spikes: how to detect them before they become a PR problem",
    excerpt: "A burst of 1-star reviews in 24 hours is a signal. Here's how to read it — and what to do next.",
    category: "Product",
    date: "May 5, 2026",
    readTime: "4 min read",
    slug: "/blog/rating-spikes",
  },
  {
    title: "Why your App Store rating is lower than your Google Play rating",
    excerpt:
      "It's almost never about the product. It's usually about three specific differences in how each store handles reviews.",
    category: "Guides",
    date: "April 28, 2026",
    readTime: "5 min read",
    slug: "/blog/appstore-vs-google-play-rating",
  },
  {
    title: "Case study: Acme Banking, 4.21 → 4.58 in 90 days",
    excerpt:
      "11-minute average reply time. A structured response framework. And one weekend sprint that changed everything.",
    category: "Case Studies",
    date: "April 20, 2026",
    readTime: "9 min read",
    slug: "/customers/acme-banking",
  },
  {
    title: "Connecting Google Play to ReviewBox: the complete guide",
    excerpt:
      "Service account setup, API scopes, the exact JSON you need — with screenshots for every step.",
    category: "How-to",
    date: "April 10, 2026",
    readTime: "7 min read",
    slug: "/help/connect-google-play",
  },
  {
    title: "App store automation rules: 5 templates that actually work",
    excerpt:
      "Auto-triage crash reports. Auto-escalate billing disputes. Auto-draft for 5-star reviews. Steal these.",
    category: "Guides",
    date: "April 1, 2026",
    readTime: "5 min read",
    slug: "/help/automation",
  },
];

const CATEGORIES = ["All", "Guides", "Engineering", "Product", "Case Studies", "How-to"];

const CATEGORY_STYLES: Record<string, string> = {
  Engineering: "bg-purple-50 text-purple-700",
  Guides: "bg-blue-50 text-blue-700",
  Product: "bg-emerald-50 text-emerald-700",
  "Case Studies": "bg-amber-50 text-amber-700",
  "How-to": "bg-gray-100 text-gray-600",
};

export default function BlogPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      {/* Breadcrumb */}
      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <span className="text-gray-600">Blog</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        {/* Header */}
        <div className="pt-12 pb-10">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-[#F5F5F7]">Blog</h1>
          <p className="mt-2 text-gray-500 dark:text-[#86868B]">
            Guides, case studies, and product updates from the ReviewBox team.
          </p>
        </div>

        {/* Category pills */}
        <div className="mb-10 flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                cat === "All"
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] text-gray-600 dark:text-[#86868B] hover:bg-gray-50 dark:hover:bg-white/5"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Featured */}
        <div className="mb-10">
          <Link
            href={FEATURED.slug}
            className="block rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-8 hover:border-gray-300 dark:hover:border-white/20 transition-colors sm:flex sm:gap-8"
          >
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                    CATEGORY_STYLES[FEATURED.category] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {FEATURED.category}
                </span>
                <span className="text-xs text-gray-400">Featured</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-[#F5F5F7] leading-snug">{FEATURED.title}</h2>
              <p className="mt-3 text-gray-500 dark:text-[#86868B] leading-relaxed">{FEATURED.excerpt}</p>
              <div className="mt-4 flex items-center gap-3 text-xs text-gray-400 dark:text-[#636366]">
                <span>{FEATURED.date}</span>
                <span>·</span>
                <span>{FEATURED.readTime}</span>
              </div>
            </div>
            <div className="mt-6 sm:mt-0 sm:w-48 shrink-0 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 h-32 sm:h-auto" />
          </Link>
        </div>

        {/* Posts grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {POSTS.map((post) => (
            <Link
              key={post.title}
              href={post.slug}
              className="block rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-6 hover:border-gray-300 dark:hover:border-white/20 transition-colors"
            >
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest ${
                  CATEGORY_STYLES[post.category] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {post.category}
              </span>
              <h3 className="mt-3 font-semibold text-gray-900 dark:text-[#F5F5F7] leading-snug">{post.title}</h3>
              <p className="mt-2 text-sm text-gray-500 dark:text-[#86868B] leading-relaxed line-clamp-3">
                {post.excerpt}
              </p>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-400 dark:text-[#636366]">
                <span>{post.date}</span>
                <span>·</span>
                <span>{post.readTime}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <MarketingFooter />
    </MarketingShell>
  );
}
