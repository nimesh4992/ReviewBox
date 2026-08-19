import type { Metadata } from "next";

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
  LineLink,
  PageHero,
  Prose,
  Section,
  SectionHead,
} from "@/features/marketing/components/primitives";
import { marketingUrl } from "@/lib/site-urls";
import { PLAN_LIMITS, PLAN_PRICING, TRIAL_DAYS } from "@/lib/plans";

/**
 * Target terms: "appfollow alternative", "appfollow competitors",
 * "appfollow reviews" — all KD 0 at 20–30/mo each (Semrush US, 2026-08-18).
 *
 * KD 0 is the whole reason this page exists. At Authority Score 2 it is one of
 * the few things this site can actually rank for this quarter, and it is the
 * highest purchase intent available: someone searching a competitor's name is
 * shopping. The head term "appfollow" (880/mo) is KD 47 and is their brand —
 * we are not taking it and are not trying to.
 *
 * ── WHY THERE IS NO COMPARISON TABLE ────────────────────────────────────────
 *
 * `appfollow.io` is unreachable from this build environment (egress-blocked),
 * so not one claim about their pricing, plans, limits or features could be
 * verified. The previous `/compare` page was withdrawn on 2026-08-18 for
 * carrying exactly that — an unsourced competitor price, alongside three
 * invented testimonials and an ROI calculator that understated our own price
 * by $80/month.
 *
 * So this page describes ReviewBox, states plainly who it is not for, and
 * sends the reader to AppFollow's own pages to check anything about AppFollow.
 * That is weaker as a sales asset and stronger as a page that will still be
 * true in six months. A sourced, dated table is backlog SEO4 and needs the
 * founder to supply figures.
 *
 * `marketing-claims-contract.test.ts` fails the build if a price literal or a
 * "per month" figure is added to this file.
 */

const BASE = marketingUrl();
const TITLE = "ReviewBox — an AppFollow Alternative for Small App Teams";
const DESCRIPTION =
  "Looking for an AppFollow alternative? ReviewBox handles Google Play and App Store review " +
  "management for small teams — AI-drafted replies, no store admin access needed to start.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/alternatives/appfollow" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: `${BASE}/alternatives/appfollow`,
    type: "website",
  },
};

const HONEST = [
  {
    title: "A portfolio, not an enterprise",
    body:
      `ReviewBox tops out at ${PLAN_LIMITS.pro.appsMax} apps and ${PLAN_LIMITS.pro.seats} seats on Pro. ` +
      "If you are managing hundreds of listings across many teams, you want a platform built for that, " +
      "and this is not it.",
  },
  {
    title: "Review operations first, ASO second",
    body:
      "The review queue is the part we build and test hardest. There are ASO keyword and competitor " +
      "screens in the product, but if deep ASO tooling is the reason you are shopping, buy for that " +
      "and judge us on replies.",
  },
  {
    title: "We are early, and we are not hiding it",
    body:
      "No customer logos on this page, because there are no customers to name yet. If you need a vendor " +
      "with references and a procurement process, we are the wrong call today. If you would rather have " +
      "the person who wrote it answer your email, we are a good one.",
  },
];

const FOR_US = [
  {
    title: "You do not have store admin access",
    body:
      "ReviewBox reads public store data, so you see your reviews and get drafts without Play Console " +
      "owner rights or a service account. For a small team whose store account belongs to someone else, " +
      "that is the difference between evaluating a tool and not being able to.",
  },
  {
    title: "You want the reply written, not just the review shown",
    body:
      "Dashboards tell you the rating dropped. The job is answering the review. Every review here arrives " +
      "tagged, prioritised, and with a draft in your brand voice already attached.",
  },
  {
    title: "You are not on the US storefront",
    body:
      "Reviews are read from the storefront your app is actually published in. Region-locked apps with few " +
      "English reviews are a first-class case, not an afterthought.",
  },
  {
    title: "You want to see the price before you talk to anyone",
    body:
      "Every plan we sell is published on the pricing page, with its limits. There is a free tier and a " +
      `${TRIAL_DAYS}-day trial, and no call is required to reach either.`,
  },
];

export default function AppFollowAlternativePage() {
  return (
    <MarketingShell>
      <MarketingNav />

      <PageHero
        eyebrow="AppFollow alternative"
        title="A smaller, cheaper way to answer your app reviews"
        lede={
          <>
            AppFollow is a capable, established platform built for large app portfolios.
            ReviewBox is built for the team of one to ten apps that mainly needs the
            reviews answered — starting today, without asking anyone for access.
          </>
        }
      >
        <Actions>
          <AmberLink href="/sign-up">Start free</AmberLink>
          <LineLink href="/pricing">See our pricing</LineLink>
        </Actions>
      </PageHero>

      <Breadcrumb
        trail={[{ label: "Alternatives", href: "/alternatives/appfollow" }, { label: "AppFollow" }]}
      />

      <Section tight>
        <div className="mx-auto max-w-[760px]">
          <Prose>
            <h2>How to read this page</h2>
            <p>
              We are not going to print AppFollow&rsquo;s prices or feature list here.
              Comparison pages go stale the week after they are published, and a
              competitor&rsquo;s pricing is the first thing to move — so anything we
              copied across would quietly become wrong, and you would be the one
              acting on it.
            </p>
            <p>
              Check theirs at the source:{" "}
              <a href="https://appfollow.io/pricing" rel="nofollow noopener" target="_blank">
                appfollow.io/pricing
              </a>{" "}
              and{" "}
              <a href="https://appfollow.io" rel="nofollow noopener" target="_blank">
                appfollow.io
              </a>
              . Ours is on{" "}
              <a href="/pricing">our pricing page</a>, in full, with the limits attached.
            </p>
            <p>
              What follows is what <strong>ReviewBox</strong> does, who it suits, and —
              just as usefully — who it does not.
            </p>
          </Prose>
        </div>
      </Section>

      <Section band>
        <SectionHead
          eyebrow="Where we fit"
          title="Pick ReviewBox if this sounds like you"
        />
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {FOR_US.map((item) => (
            <Card key={item.title} interactive={false}>
              <CardTitle>{item.title}</CardTitle>
              <CardBody>{item.body}</CardBody>
            </Card>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHead
          eyebrow="Where we do not"
          title="Do not pick ReviewBox if this sounds like you"
          body="Three reasons to buy something else. We would rather lose the signup than the trust."
        />
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {HONEST.map((item) => (
            <Card key={item.title} interactive={false}>
              <CardTitle>{item.title}</CardTitle>
              <CardBody>{item.body}</CardBody>
            </Card>
          ))}
        </div>
      </Section>

      <Section band>
        <div className="mx-auto max-w-[760px]">
          <Prose>
            <h2>What you get on the free plan</h2>
            <p>
              One app, {PLAN_LIMITS.free.publishedRepliesPerMonth} published replies a
              month and {PLAN_LIMITS.free.aiDraftsPerMonth} AI drafts — enough to answer
              your worst reviews and judge whether the drafts are worth sending. Paid
              plans start at {PLAN_PRICING.starter.label} and open with a{" "}
              {TRIAL_DAYS}-day trial of Pro.
            </p>
            <p>
              The full mechanics — how reviews are pulled, tagged and drafted — are on the{" "}
              <a href="/app-review-management">app review management</a> page.
            </p>
          </Prose>
        </div>
      </Section>

      <ClosingBand
        title="Try it on your own app before you decide"
        body="No card, no store admin access, no call with anyone."
        note={`Free plan, or a ${TRIAL_DAYS}-day trial of Pro.`}
      >
        <Actions>
          <AmberLink href="/sign-up">Start free</AmberLink>
          <LineLink href="/contact">Ask us a question</LineLink>
        </Actions>
      </ClosingBand>

      <MarketingFooter />
    </MarketingShell>
  );
}
