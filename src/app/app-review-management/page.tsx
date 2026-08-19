import type { Metadata } from "next";
import {
  Inbox,
  Tags,
  Sparkles,
  Send,
  Bell,
  Users,
} from "lucide-react";

import { MarketingShell } from "@/components/layout/marketing-shell";
import { MarketingNav } from "@/components/layout/marketing-nav";
import { MarketingFooter } from "@/components/layout/marketing-footer";
import { Breadcrumb } from "@/features/marketing/components/breadcrumb";
import {
  Actions,
  AmberLink,
  Card,
  CardBody,
  CardTitle,
  ClosingBand,
  Disclosure,
  IconMark,
  LineLink,
  PageHero,
  Section,
  SectionHead,
} from "@/features/marketing/components/primitives";
import { marketingUrl } from "@/lib/site-urls";
import { PLAN_LIMITS, PLAN_PRICING, TRIAL_DAYS } from "@/lib/plans";
import { TEMPLATE_COUNT } from "@/lib/templates";

/**
 * The product hub — the page this site did not have.
 *
 * Target term: "app review management" (170/mo, KD 18). That is the highest
 * value term currently reachable: at Authority Score 2 the KD 24–48 cluster is
 * out of range, and AppFollow defends this one with their homepage rather than
 * a dedicated page. See `docs/specs/marketing-product-pages.md`.
 *
 * EVERY NUMBER ON THIS PAGE IS IMPORTED. Prices from `lib/plans.ts`, template
 * count from `lib/templates.ts`. That is not stylistic — `/compare` was
 * withdrawn on 2026-08-18 because its hand-typed prices understated our own
 * by $80/month, and `marketing-claims-contract.test.ts` now fails the build if
 * a price literal appears in this file.
 *
 * What is deliberately NOT sold here: sentiment, ASO, competitors, incidents,
 * releases, automations and reports. `docs/SPINE.md` freezes all of them and
 * says plainly they may be half-broken. They appear once, in a list, with no
 * promise attached.
 */

const BASE = marketingUrl();
const TITLE = "App Review Management for Google Play and the App Store";
const DESCRIPTION =
  "Read, triage and reply to your Google Play and App Store reviews in one place. " +
  "AI drafts the reply in your brand voice — no store admin access needed to start.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/app-review-management" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${BASE}/app-review-management`,
    type: "website",
  },
};

/**
 * The four steps of the actual loop, in the order a customer meets them.
 *
 * Step 4 describes Draft Mode (D018) rather than one-click posting. That is the
 * launch tier: the founder-level customer has *user* access to their listing,
 * not API access, so the product's job is to produce a reply worth pasting.
 * One-click API posting exists in code but no human has walked it end to end
 * (`docs/SPINE.md` step 7 is unverified), so it is described as available on
 * request and never as the default.
 */
const LOOP = [
  {
    icon: Inbox,
    title: "See your reviews without connecting anything",
    body:
      "Search for your app by name — not by package name — and ReviewBox pulls its public reviews from " +
      "Google Play and the App Store. No Play Console owner access, no service account, no API keys to " +
      "get the first view.",
  },
  {
    icon: Tags,
    title: "Every review arrives triaged",
    body:
      "Each review is tagged by issue — crash, billing, login, performance, release-regression, " +
      "feature-request, support-delay, localization — then scored for sentiment and priority. This runs on " +
      "rules, not a model, so it costs nothing and happens on every review.",
  },
  {
    icon: Sparkles,
    title: "AI drafts the reply in your brand voice",
    body:
      `${TEMPLATE_COUNT} built-in templates cover the most common reviews outright. Anything they miss is ` +
      "drafted by AI in one of four tones — professional, empathetic, casual or direct — using the brand " +
      "voice you set during onboarding.",
  },
  {
    icon: Send,
    title: "Post it, and mark it replied",
    body:
      "Copy the finished reply into Play Console or App Store Connect and mark the review replied here, so " +
      "your queue stays honest. Apple caps replies at 350 characters; drafts are written to fit. Posting " +
      "straight to the store over the official APIs is available for teams with admin access — talk to us.",
  },
  {
    icon: Bell,
    title: "Get told when something breaks",
    body:
      "Reviews re-sync daily, and you can pull them on demand. A cluster of low ratings on a single app " +
      "version raises a rating-spike alert by email, because a bad release shows up in reviews before it " +
      "shows up anywhere else.",
  },
  {
    icon: Users,
    title: "Bring the rest of the team",
    body:
      `Pro includes ${PLAN_LIMITS.pro.seats} seats and up to ${PLAN_LIMITS.pro.appsMax} apps, so a portfolio ` +
      "and the people answering for it live in one workspace rather than one person's inbox.",
  },
];

/** Reads the price list rather than restating it. See AC4 in the spec. */
function priceLine(plan: "free" | "starter" | "pro"): string {
  const pricing = PLAN_PRICING[plan];
  if (pricing.monthlyUsd === 0) return "Free";
  return pricing.monthlyUsd === null ? "Talk to us" : `From $${pricing.monthlyUsd}/month`;
}

const TIERS = [
  {
    name: PLAN_PRICING.free.label,
    price: priceLine("free"),
    body: `${PLAN_LIMITS.free.appsMax} app, ${PLAN_LIMITS.free.publishedRepliesPerMonth} replies a month, ${PLAN_LIMITS.free.aiDraftsPerMonth} AI drafts. Enough to answer your worst reviews and see whether it helps.`,
  },
  {
    name: PLAN_PRICING.starter.label,
    price: priceLine("starter"),
    body: `${PLAN_LIMITS.starter.appsMax} apps, ${PLAN_LIMITS.starter.publishedRepliesPerMonth} replies and ${PLAN_LIMITS.starter.aiDraftsPerMonth} AI drafts a month. ${PLAN_PRICING.starter.tagline}`,
  },
  {
    name: PLAN_PRICING.pro.label,
    price: priceLine("pro"),
    body: `${PLAN_LIMITS.pro.appsMax} apps, ${PLAN_LIMITS.pro.seats} seats, ${PLAN_LIMITS.pro.publishedRepliesPerMonth} replies and AI drafts a month. ${PLAN_PRICING.pro.tagline}`,
  },
];

/**
 * Structured data. `SoftwareApplication` is the correct type for a SaaS
 * product page and the homepage carries none today.
 *
 * No `aggregateRating` — that needs real reviews from real customers, and
 * inventing one is both a Google structured-data violation and exactly what
 * `/customers` was withdrawn for. `offers` is generated from the price list so
 * it cannot disagree with the page it sits on.
 */
const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ReviewBox",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${BASE}/app-review-management`,
  description: DESCRIPTION,
  offers: (["free", "starter", "pro"] as const)
    .map((plan) => {
      const price = PLAN_PRICING[plan].monthlyUsd;
      if (price === null) return null;
      return {
        "@type": "Offer",
        name: PLAN_PRICING[plan].label,
        price: String(price),
        priceCurrency: "USD",
      };
    })
    .filter(Boolean),
};

export default function AppReviewManagementPage() {
  return (
    <MarketingShell>
      <MarketingNav />

      <PageHero
        eyebrow="App review management"
        title="Every review of your app, in one place — with the reply already written"
        lede={
          <>
            ReviewBox reads your Google Play and App Store reviews, sorts them by what
            they are actually about, and drafts a reply in your voice. You start
            without connecting a thing.
          </>
        }
      >
        <Actions>
          <AmberLink href="/sign-up">Start free</AmberLink>
          <LineLink href="/pricing">See pricing</LineLink>
        </Actions>
      </PageHero>

      <Breadcrumb trail={[{ label: "App review management" }]} />

      <Section tight>
        <SectionHead
          center
          eyebrow="The loop"
          title="Read, triage, reply — without the tab-switching"
          body="Both stores, one queue. Reviews arrive already sorted, with a draft attached."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {LOOP.map((step) => (
            <Card key={step.title} interactive={false}>
              <IconMark icon={step.icon} />
              <CardTitle>{step.title}</CardTitle>
              <CardBody>{step.body}</CardBody>
            </Card>
          ))}
        </div>
      </Section>

      <Section band>
        <SectionHead
          eyebrow="Who it is for"
          title="Built for the team that does not have a support department"
          body="One to ten apps, nobody whose whole job is answering reviews, and a store listing that matters more than any dashboard."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          <Card interactive={false}>
            <CardTitle>You do not need admin access to start</CardTitle>
            <CardBody>
              Most small teams cannot get Play Console owner rights on day one — the
              account belongs to someone else, or to an agency. ReviewBox reads public
              store data, so you see your reviews and get your drafts regardless. Connect
              the official APIs later, if and when you can.
            </CardBody>
          </Card>
          <Card interactive={false}>
            <CardTitle>It works outside the US storefront</CardTitle>
            <CardBody>
              Reviews are read from the storefront your app is actually published in, not
              a hardcoded US one. A region-locked app with few English reviews is a
              first-class case here, not an edge case.
            </CardBody>
          </Card>
        </div>
      </Section>

      <Section>
        <SectionHead
          center
          eyebrow="Pricing"
          title="Start free. Pay when it is saving you time."
          body={`Every paid plan starts with a ${TRIAL_DAYS}-day trial of Pro.`}
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {TIERS.map((tier) => (
            <Card key={tier.name} interactive={false}>
              <CardTitle>{tier.name}</CardTitle>
              <p className="mb-3 text-[15px] font-bold text-[var(--rb-fg-1)]">{tier.price}</p>
              <CardBody>{tier.body}</CardBody>
            </Card>
          ))}
        </div>
        <div className="mt-10 flex justify-center">
          <LineLink href="/pricing">Full plan comparison</LineLink>
        </div>
      </Section>

      <Section band>
        <SectionHead
          eyebrow="Questions"
          title="The things people actually ask"
        />
        <div className="mt-8 max-w-[760px]">
          <Disclosure q="Do I need Play Console or App Store Connect access?" open>
            Not to start. ReviewBox reads the public reviews on your store listing, so you
            can see your queue and get drafts without connecting anything. You do need
            access on the store side to publish a reply — that is the store&rsquo;s rule,
            not ours. The normal flow is to copy the finished draft into Play Console or
            App Store Connect and mark it replied here.
          </Disclosure>
          <Disclosure q="Which stores does it cover?">
            Google Play and the Apple App Store. Both in the same queue, with the source
            marked on every review.
          </Disclosure>
          <Disclosure q="How does the AI know how we talk?">
            You set a brand voice during onboarding, and it is applied to every draft.
            You also pick a tone — professional, empathetic, casual or direct. The{" "}
            {TEMPLATE_COUNT} built-in templates cover the most common reviews without
            calling a model at all.
          </Disclosure>
          <Disclosure q="Will it reply to reviews on its own?">
            Not unless you ask it to. The default is that you read the draft, decide, and
            post it. Automatic replying exists as an opt-in rule, and we would rather you
            turned it on after you trust the drafts than before.
          </Disclosure>
          <Disclosure q="What else is in the product?">
            Beyond the review queue there are screens for sentiment over time, release
            health by app version, crash-cluster incidents, competitor benchmarks, ASO
            keywords and scheduled reports. The review loop above is the part we build
            and test hardest; treat the rest as useful extras rather than the reason to
            buy.
          </Disclosure>
          <Disclosure q="How often do reviews update?">
            Automatically once a day, and on demand whenever you press Sync now.
          </Disclosure>
        </div>
      </Section>

      <ClosingBand
        title="Answer the review that is costing you installs"
        body="Start free, on your own app, without asking anyone for access."
        note="No card required."
      >
        <Actions>
          <AmberLink href="/sign-up">Start free</AmberLink>
          <LineLink href="/alternatives/appfollow">Compare with AppFollow</LineLink>
        </Actions>
      </ClosingBand>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <MarketingFooter />
    </MarketingShell>
  );
}
