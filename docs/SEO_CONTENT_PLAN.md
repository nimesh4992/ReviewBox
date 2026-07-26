# ReviewBox — SEO & Content Plan

**Author:** Claude (acting as digital marketing manager / SEO content strategist)
**Date:** 2026-07-26
**Status:** DRAFT — needs founder decisions in §8 before execution starts

---

## 0. Read this first: what this plan does not contain

**No search volumes, no keyword difficulty scores, no traffic projections.**

The Ahrefs integration is connected but the account's plan does not include API
access — both the metered endpoints and the free quota endpoint return
`Insufficient plan`. I have no Search Console access either. So every number a
plan like this normally leads with is unavailable to me.

I could have written plausible-looking figures. I did not, for the same reason
this repo just spent a whole branch removing "312 apps shipping with us" and a
testimonial quoting metrics nobody measured: a confident number that nobody can
trace is worse than an honest gap, because it gets planned against.

Keyword targets below are therefore expressed as **intent and phrasing**, with
volume marked `TBD`. §7 lists the free tools that will fill those gaps in about
an hour of setup, and that step should happen before Phase 2 spends real effort
on content.

Everything else here — the page inventory, the technical faults, the
architecture — is derived from the codebase and is verifiable.

---

## 1. Baseline: where we actually stand

Measured from the repo on 2026-07-26 (commit `2c754dc`).

| | Count |
|---|---|
| Public pages | 30 |
| Pages in `sitemap.ts` | 26 |
| Pages with corrupted titles (UTF-8) | **17** |
| Pages with no meta description | 3 |
| Pages with a description under 30 chars | 2 |
| Blog posts | 1 |
| Help articles | 5 |
| Legal pages | 7 |
| Paying customers | 0 |

**Domain reality:** `tryreviewbox.com` is new. Assume near-zero domain
authority and near-zero organic traffic. No brand search demand exists yet —
nobody is googling "reviewbox". Every visit has to be earned from
problem-shaped queries.

**Competitive reality:** AppFollow, AppBot, Sensor Tower and Appfigures have
years of authority on the category head terms. A new domain does not beat them
on "app review management software" this year, and planning as though it might
is how content budgets get wasted.

---

## 2. Strategic position

### 2.1 Do not fight for the head term yet

"App review management" and similar category terms are the money keywords and
also the ones we are least able to win. They stay on the roadmap as the Pillar 1
target — we build toward them — but no Phase 1 or 2 effort is spent trying to
rank for them directly.

### 2.2 Compete where a new domain can actually win

Three surfaces, in order of realistic return:

**A. Comparison and alternative queries.** Someone searching "AppFollow
alternative" or "AppFollow pricing" has commercial intent and is not loyal.
These SERPs are thinner than the category terms, and a genuinely useful,
honest comparison can rank. We already have `/compare` — it is currently the
single best-optimised page on the site (708 words, clean title, 112-char
description) and it is the right instinct, under-exploited.

**B. Job-to-be-done queries.** The operator's actual problem, in their words:
"how to reply to app store reviews", "how to respond to a 1 star review",
"can you reply to app store reviews", "how to improve app rating". These are
long-tail, lower competition, and directly upstream of buying the product.

**C. Calculators and free tools.** Query-shaped utilities that answer a
specific question and earn links. The strongest candidate is a rating
calculator — "how many 5 star reviews to raise my rating from 3.4 to 4.0" is a
real, repeated, arithmetic question with genuine intent. Tools also give us
something to link *from* and a reason for other sites to link *to* us, which is
the actual constraint on a new domain.

Note: the old landing page advertised five free tools that do not exist. Two of
them — a sentiment analyser and a rating impact calculator — are the two best
SEO assets on this list. Building them converts a liability into an asset.

### 2.3 Our defensible content advantage

We have no customers, so no case studies, no logos, no social proof. What we do
have is real engineering depth on a niche problem: prompt compression, a
three-tier reply pipeline, store scraping, sentiment clustering. `/blog/ai-cost-reduction`
is the right kind of asset — first-hand technical work nobody else can copy.

For a product with zero customers, **founder expertise is the only honest
E-E-A-T signal available.** Lean on it hard. Publish the engineering. Do not
manufacture the social proof.

---

## 3. Disposition of all 30 existing pages

Every existing page gets one of five verdicts. This is the "rewrite the content"
half of the request, made concrete.

### 3.1 KEEP + OPTIMISE (12)

Real pages with real purpose. Fix technical faults, tighten copy, add internal
links and schema.

| Route | Words | Action |
|---|---|---|
| `/` | 522 | Add page-level metadata. Currently a client component inheriting a generic root title that no longer matches the copy. Needs a `<title>` and description written to the new positioning. Add `SoftwareApplication` + `Organization` schema. |
| `/pricing` | 547 | Fix title encoding. Add `Product`/`Offer` schema. Add an FAQ block targeting "reviewbox pricing" style queries. Cross-link `/compare`. |
| `/compare` | 708 | **Highest-leverage existing page.** Split into a hub plus one page per competitor (see §4.4). Keep the honest tone — it is the reason this page can rank. |
| `/faq` | 592 | Fix nothing technical; already clean. Add `FAQPage` schema. Split the longest answers into cluster posts and link out. |
| `/about` | 241 | Thin. Rewrite around the founder's actual story and technical credibility — this page carries E-E-A-T weight we currently waste. |
| `/help` | 156 | Very thin hub. Rebuild as a real index with descriptions and search. |
| `/help/connect-google-play` | 562 | Best help page. Fix nothing structural; add schema, screenshots, and internal links. |
| `/help/connect-app-store` | 338 | Expand to parity with the Google Play guide. |
| `/help/ai-replies` | 439 | Description is 19 chars — rewrite it. Good candidate to become a cluster page under Pillar 1. |
| `/help/automation` | 391 | Fine. Add schema + cross-links. |
| `/blog/ai-cost-reduction` | 858 | Fix title encoding. **Verify the "94%" claim** — CLAUDE.md documents 73% token reduction, so either the figure measures something different and should say so, or it is inflated and must come down. |
| `/status` | 374 | Fix encoding. Keep, but see §8.3 — it currently reports hard-coded health. |

### 3.2 REWRITE (4)

Structurally sound, content not fit to optimise.

| Route | Problem | Action |
|---|---|---|
| `/blog` | Index page for a blog with one post | Rebuild as a real index once Phase 3 posts exist. Add category structure matching the four pillars. |
| `/changelog` | 4-character meta description | Rewrite metadata. Decide whether this is public-facing marketing or an internal log — it currently reads as neither. |
| `/careers` | 395 words advertising roles at a company with no revenue | Either be honest ("not hiring yet, here's how we work") or de-index. Do not optimise a fictional careers page. |
| `/contact` | 213 words, thin | Rewrite with real support expectations, response times we can honour, and `ContactPage` schema. |

### 3.3 MERGE (2 → 1)

| Routes | Action |
|---|---|
| `/refund` (408w) + `/refund-policy` (133w) | **Duplicate content.** Two refund policies, and only the *weaker* one (`/refund-policy`) is in the sitemap. Merge into a single canonical page, 301 the other, keep one in the sitemap. Also a live legal risk: if the two texts disagree, we are publishing contradictory terms. |

### 3.4 DECISION REQUIRED (2)

| Routes | Problem |
|---|---|
| `/customers` (270w) | Three testimonials attributed to a "Head of Product", "Engineering Lead" and "Growth" lead who do not exist. In the sitemap. |
| `/customers/acme-banking` (503w) | Full case study — *"Acme Banking: 4.21 → 4.58 in 90 Days"* — with the same fabricated metrics removed from the landing page last night. In the sitemap. |

These are **submitted to Google for indexing right now.** They cannot be
"optimised" — optimising them means investing in fiction and increasing the
number of people who see it. See §8.1. Until that decision is made, no content
work touches them.

### 3.5 LEAVE / DE-INDEX (10)

`/privacy`, `/terms`, `/dpa`, `/cookies`, `/acceptable-use` — legal, required,
low SEO value. Fix the title encoding, otherwise leave alone; do not "optimise"
legal copy.

`/sign-in`, `/sign-up`, `/onboarding`, `/account-deleted`, `/invite/[token]` —
correctly excluded from indexing already. No action.

---

## 4. Pillar and cluster architecture

Four pillars. Each is a long, comprehensive page targeting a category-level
intent, supported by cluster posts that target specific long-tail questions and
link up to the pillar. Pillars link down to every cluster; clusters link up to
the pillar and sideways to two or three siblings.

This is the structure that lets a new domain accumulate topical authority
instead of publishing 30 unconnected posts.

### 4.1 Pillar 1 — Replying to app store reviews *(the money pillar)*

**Pillar page:** `/guides/app-review-management` — the complete operator's guide.
**Target intent:** category-level, commercial. Volume `TBD`.
**Why this is the pillar:** it is the job the product does.

Cluster posts:
1. How to reply to Google Play reviews (step by step, with the API reality)
2. How to reply to App Store reviews (and what Apple does not let you do)
3. How to respond to a 1-star review — with real examples
4. 25 app review reply templates by issue type
5. Can you edit or delete a reply once it is posted?
6. How fast should you reply to app reviews?
7. Should you reply to positive reviews too?
8. Bulk-replying to reviews without sounding automated
9. What Apple's and Google's review-response policies actually forbid

### 4.2 Pillar 2 — App ratings and how they move

**Pillar page:** `/guides/improve-app-rating`
**Target intent:** informational → commercial. Volume `TBD`.
**Why:** this is the outcome customers actually want. Reviews are the mechanism.

Cluster posts:
1. How many 5-star reviews to offset a 1-star (with the calculator, §5)
2. How your store rating is actually calculated — Apple vs Google
3. Why your rating dropped after a release
4. How ratings affect install conversion
5. In-app review prompts: when to ask, and when it backfires
6. Rating recovery after a bad launch: a realistic timeline
7. Does replying to reviews improve your rating? What the data supports

### 4.3 Pillar 3 — Reviews as a product signal

**Pillar page:** `/guides/app-review-analytics`
**Target intent:** informational, higher-sophistication buyer. Volume `TBD`.
**Why:** this is where our engineering depth is defensible and competitors are generic.

Cluster posts:
1. Finding crash reports in your reviews before Sentry fires
2. Sentiment analysis of app reviews — methods and honest limitations
3. Tagging and clustering reviews by topic
4. Detecting a release regression from review language
5. Turning reviews into a product backlog
6. Review volume benchmarks by category — *only if we can source real data*

### 4.4 Pillar 4 — Alternatives and comparisons *(fastest commercial return)*

**Pillar page:** `/compare` rebuilt as a hub.
**Target intent:** high commercial intent, ready to switch. Volume `TBD`.
**Why:** thinner SERPs than the head terms, and buyers actively want this.

Cluster pages:
1. `/compare/appfollow` — ReviewBox vs AppFollow
2. `/compare/appbot` — ReviewBox vs AppBot
3. `/compare/sensor-tower` — ReviewBox vs Sensor Tower
4. `/compare/appfigures` — ReviewBox vs Appfigures
5. `/compare/spreadsheet` — vs the spreadsheet (our actual biggest competitor)
6. AppFollow alternatives — an honest roundup, including when to pick them

**Rule for this pillar:** every comparison must state where the competitor is
genuinely better. A comparison page that claims we win on everything reads as
marketing and converts worse than an honest one. It is also the only version we
can defend if a competitor reads it.

---

## 5. Free tools as link magnets

Real utilities, each targeting a specific query and each a reason for someone
to link to us. This is the highest-leverage link-building available to a domain
with no authority, because it does not require asking anyone for a link.

| Tool | Query it answers | Build cost | Priority |
|---|---|---|---|
| **Rating calculator** | "how many 5 star reviews to go from 3.4 to 4.0" | Low — pure arithmetic, no backend | **1st** |
| **Review sentiment analyser** | "analyse app reviews sentiment free" | Medium — reuses the existing local ML pipeline | 2nd |
| **Reply template generator** | "app review response template" | Low — reuses `src/lib/templates.ts` | 3rd |
| **Rating impact on installs** | "how does rating affect app downloads" | Low, but needs a sourced model — do not invent the coefficients | 4th |

The rating calculator ships first: lowest cost, clearest query intent, and it
naturally links into Pillar 2.

---

## 6. Phased roadmap

Effort figures are working days of focused execution, not calendar time.

### Phase 0 — Technical hygiene *(0.5 day, no content judgement needed)*

Do this first because it is mechanical, affects a third of the site, and
requires no decisions.

1. Fix UTF-8 corruption across 17 files — titles currently render as
   `About â€" ReviewBox` in browser tabs and Google results
2. Merge the duplicate refund pages, add the 301
3. Write the 3 missing and 2 stub meta descriptions
4. Add page-level metadata to `/`
5. Add `sitemap.ts` entries for anything kept but missing; remove anything de-indexed
6. Verify `robots.ts` allows what we want indexed

### Phase 1 — Fix the pages we have *(3 days)*

1. Resolve §8.1 (the customer pages) — blocks everything else on this list
2. Rewrite the 4 REWRITE pages
3. Optimise the 12 KEEP pages: schema, internal links, tightened copy
4. Rebuild `/compare` as a hub and ship the first two competitor pages
5. Verify the "94%" blog claim

### Phase 2 — Get real keyword data *(0.5 day, mostly waiting)*

Do not skip this. Everything in Phase 3 is guesswork until it is done. See §7.

### Phase 3 — Pillars *(4 days, one per pillar)*

Publish the four pillar pages. Long, genuinely comprehensive, internally linked.
Pillars before clusters — the clusters need something to point at.

### Phase 4 — Clusters *(ongoing, 2 posts/week)*

Work down the cluster lists in §4, highest-intent first. Pillar 1 and Pillar 4
clusters before Pillar 2 and 3.

### Phase 5 — Tools *(2 days)*

Rating calculator, then sentiment analyser.

### Phase 6 — Measure and iterate *(continuous)*

Monthly: what ranks, what does not, what to prune. Content that has not earned
an impression in 90 days gets rewritten or deleted, not left to rot.

---

## 7. Measurement: the free stack

We have no paid SEO tooling. This is sufficient to start and costs nothing.

| Tool | Gives us | Setup |
|---|---|---|
| **Google Search Console** | Real impressions, clicks, positions, and the queries we already appear for. The single most important missing input. | Verify the domain, submit `sitemap.xml` |
| **Bing Webmaster Tools** | Same for Bing, plus a free keyword research tool with actual volumes | Import from GSC |
| **Google Keyword Planner** | Real search volumes, free with any Ads account (no spend required) | Create an Ads account, skip the campaign |
| **PostHog** | On-site behaviour, which pages convert to signup | Already installed |

**Blocking note:** Search Console needs 2–4 weeks of data collection before it
is useful. Set it up *today*, in parallel with Phase 0, so the data exists when
Phase 2 needs it.

If SEO becomes a real channel, an Ahrefs or Semrush seat is the first paid tool
worth buying — but per the repo's one rule, not before a customer pays.

---

## 8. Decisions needed from the founder

Execution is blocked on these. They are judgement calls, not technical ones.

### 8.1 The fabricated customer pages — BLOCKING

`/customers` and `/customers/acme-banking` present invented testimonials and an
invented case study, and both are in the sitemap. Options:

- **A. Delete both, 410 them, remove from sitemap.** Cleanest. Loses two pages
  we were not ranking for anyway. *My recommendation.*
- **B. Rewrite as honest pre-launch content** — e.g. "who this is for" instead
  of invented customers. Keeps the URLs and the internal links.
- **C. Leave and optimise.** I will not do this one. Optimising fabricated
  testimonials means deliberately increasing how many people see them, and
  invented customer claims carry real legal exposure.

### 8.2 The "94%" claim in the blog post

CLAUDE.md documents 73% token reduction from prompt compression. The post
headlines 94% cost reduction. If those measure different things (tokens vs
dollars, including the cache-hit path) say so explicitly in the post. If not,
the number comes down. I cannot verify which from the repo.

### 8.3 `/status` and `/careers`

`/status` reports hard-coded health — it will say "all systems operational"
during an outage. `/careers` advertises roles at a pre-revenue company. Both
should either become real or be de-indexed. Low urgency, but they undercut
trust on a site whose whole credibility problem is that it has no customers yet.

### 8.4 Scope confirmation

This plan is ~14 days of focused work before Phase 4 becomes ongoing. Confirm
you want all of it, or pick a slice — Phase 0 alone is half a day and
improves how every existing page appears in search.

---

## 9. What I will not do

Stated up front so there is no ambiguity later:

- **No invented metrics, volumes, or projections.** If a number is not
  traceable, it does not go in.
- **No fabricated testimonials, customers, or logos.** Including "illustrative"
  ones.
- **No claims the product cannot currently deliver.** The build-status table in
  CLAUDE.md is the source of truth for what we say the product does.
- **No AI-generated filler to hit a word count.** Thin content that exists to
  be indexed is a liability; Google's helpful-content signals treat it as one,
  and readers treat it worse.
- **No keyword stuffing or doorway pages**, including in the comparison pillar.

---

## 10. Immediate next step

Phase 0 needs no decisions and improves 17 pages. Say the word and I will start
there while you consider §8.

In parallel, and worth doing yourself today because it gates Phase 2: verify
`tryreviewbox.com` in **Google Search Console** and submit the sitemap. Nothing
in this plan is measurable until that clock starts.
