import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";

export const metadata = {
  title: "How much review history you get — Help",
  description:
    "Why ReviewBox shows fewer reviews than your store dashboard, what Google's and Apple's APIs actually return, and where the complete history lives.",
};

const RELATED = [
  { title: "Connect Google Play", href: "/help/connect-google-play" },
  { title: "Connect the App Store", href: "/help/connect-app-store" },
  { title: "How AI replies work", href: "/help/ai-replies" },
  { title: "FAQ", href: "/faq" },
];

const SECTIONS = [
  { label: "The short answer", id: "short-answer" },
  { label: "Google Play", id: "google-play" },
  { label: "The App Store", id: "app-store" },
  { label: "What we do guarantee", id: "guarantee" },
  { label: "Getting the full export", id: "full-export" },
];

export default function ReviewHistoryPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      <div className="mx-auto max-w-screen-xl px-6 py-3">
        <nav className="flex items-center gap-1.5 text-xs text-gray-400">
          <Link href="/" className="hover:text-gray-600">Home</Link>
          <span>/</span>
          <Link href="/help" className="hover:text-gray-600">Help Center</Link>
          <span>/</span>
          <span className="text-gray-600">Review history</span>
        </nav>
      </div>

      <main className="mx-auto max-w-screen-xl px-6 pb-32">
        <div className="pt-10 pb-8 max-w-3xl">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#0A84FF]">
            Getting started · 4 min
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
            How much review history you get
          </h1>
          <p className="mt-3 text-gray-500 leading-relaxed">
            Your store dashboard says you have thousands of reviews. ReviewBox
            imported a few hundred. Nothing is broken — this page explains
            exactly where the rest are, and why no tool in this category can
            reach them either.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_260px] max-w-5xl">
          <div className="space-y-8">

            {/* Short answer */}
            <div id="short-answer" className="scroll-mt-24">
              <h2 className="font-bold text-gray-900 text-lg mb-4">The short answer</h2>
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="text-sm text-gray-600 leading-relaxed">
                  When you connect an app, ReviewBox imports every review the
                  store is willing to hand over at that moment. From then on we
                  capture every new review as it arrives.
                </p>
                <p className="mt-4 text-sm text-gray-600 leading-relaxed">
                  How many that first import contains is a property of{" "}
                  <strong>your app and your store</strong>, not of ReviewBox. One
                  app returns 12 reviews, another returns 500. We deliberately
                  never quote a number in advance, because it isn&rsquo;t ours to
                  promise.
                </p>
                <div className="mt-5 rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    The two numbers on your dashboard measure different things.
                    The large one is the <strong>store&rsquo;s lifetime rating
                    count</strong>, read from your public listing. The{" "}
                    <strong>&ldquo;synced&rdquo;</strong> figure below it is what
                    we actually hold and can search, tag, and reply to.
                  </p>
                </div>
              </div>
            </div>

            {/* Google Play */}
            <div id="google-play" className="scroll-mt-24">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Google Play</h2>
              <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Google&rsquo;s Play Developer API returns only recent reviews —
                  roughly the last week. This is not a quota we can raise or a
                  setting we can change: <strong>the API has no way to express
                  the request</strong>. The call that lists reviews accepts a page
                  size, a package name, a page offset, a page token, and a
                  translation language. There is no date parameter and no
                  &ldquo;from the beginning&rdquo; option.
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  We also page through it up to ten times, so ReviewBox would
                  accept a thousand reviews if Google offered them. It
                  doesn&rsquo;t. We aren&rsquo;t asking wrongly — there is no
                  other way to ask.
                </p>

                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-xs font-semibold text-amber-900 mb-1">
                    You can verify this yourself
                  </p>
                  <p className="text-xs text-amber-900/80 leading-relaxed">
                    Every review tool sits behind the same API. Run the same app
                    through a competitor and you will see a number in the same
                    range as ours, not the thousands your Play Console reports.
                    We checked one head-to-head on an app with 2,064 rated
                    reviews: AppFollow returned 272, ReviewBox 202. Same wall,
                    same side of it.
                  </p>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed">
                  One thing that <em>is</em> in your control: Google Play ratings
                  are published <strong>per country</strong>. If ReviewBox is
                  reading the wrong storefront you will see a rating and a review
                  count that look nothing like your own. Set the right one under{" "}
                  <strong>Settings → Apps → Store country</strong>.
                </p>
              </div>
            </div>

            {/* App Store */}
            <div id="app-store" className="scroll-mt-24">
              <h2 className="font-bold text-gray-900 text-lg mb-4">The App Store</h2>
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Apple is more generous than Google here. App Store Connect
                  returns customer reviews newest-first with real pagination, so
                  the history goes back further than a week.
                </p>
                <p className="mt-4 text-sm text-gray-600 leading-relaxed">
                  ReviewBox currently imports the <strong>most recent 200 per
                  sync</strong>, and every sync adds whatever is new since the
                  last one — so an established App Store app builds up past that
                  200 over time. To be straight about it: on iOS that ceiling is
                  ours, not Apple&rsquo;s, and raising it is on our list. On
                  Android the ceiling is Google&rsquo;s and no list will move it.
                </p>
              </div>
            </div>

            {/* Guarantee */}
            <div id="guarantee" className="scroll-mt-24">
              <h2 className="font-bold text-gray-900 text-lg mb-4">What we do guarantee</h2>
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="text-sm text-gray-600 leading-relaxed">
                  We can&rsquo;t give you back the reviews Google never handed
                  over. We can make sure you never lose another one.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-gray-600 list-disc list-inside">
                  <li>Every review that arrives after you connect is captured and kept</li>
                  <li>Replies you post through ReviewBox are stored alongside them</li>
                  <li>Your archive is exportable to CSV at any time, from Reports</li>
                  <li>Disconnecting an app doesn&rsquo;t erase the reviews already captured</li>
                </ul>
                <p className="mt-4 text-xs text-gray-400 leading-relaxed">
                  The practical consequence: the sooner an app is connected, the
                  more history you end up with. An app connected today has a
                  complete record from today onward.
                </p>
              </div>
            </div>

            {/* Full export */}
            <div id="full-export" className="scroll-mt-24">
              <h2 className="font-bold text-gray-900 text-lg mb-4">
                Where the complete history does exist
              </h2>
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <p className="text-sm text-gray-600 leading-relaxed">
                  Google publishes your full review history in exactly one place:{" "}
                  <strong>Play Console → Download reports → Reviews</strong>. It
                  is a set of monthly CSV files in a Cloud Storage bucket that
                  belongs to you. It is not part of the API, which is why no
                  review tool imports it automatically.
                </p>
                <p className="mt-4 text-sm text-gray-600 leading-relaxed">
                  If you need the whole archive today, that export is the way to
                  get it. If you&rsquo;d find it useful inside ReviewBox, tell
                  us — we can read those files with your permission, and demand
                  decides whether we build it.
                </p>
                <Link
                  href="/contact"
                  className="mt-5 inline-flex rounded-lg bg-[#0A84FF] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0070e0]"
                >
                  Tell us you want this
                </Link>
              </div>
            </div>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">On this page</p>
              <ul className="space-y-1">
                {SECTIONS.map((item) => (
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
    </MarketingShell>
  );
}
