# Spec — marketing product pages

**Status:** in progress · **Backlog:** SEO7 · **Owner:** coder
**Companions:** `docs/SEO_KEYWORD_PLAN.md` (which terms), `docs/SPINE.md` (what
is actually verified), `docs/PRODUCT_CONTEXT.md` (who the customer is).

## The gap this closes

The marketing nav is `Pricing · Blog · Help`. There is no product page at all,
so the only description of what ReviewBox does is ~268 words on the homepage.
Google has nothing to classify the site by, and a visitor who wants to know
what the product *does* has to read the pricing table to find out.

Semrush, US database, checked 2026-08-18:

| Term | Vol/mo | KD | Note |
|---|---|---|---|
| app review management | 170 | **18** | exact product match; AppFollow defends it with their homepage |
| app store review management | 170 | 36 | CPC **$25.60** |
| managing app store ratings and reviews | 110 | 24 | |
| manage app store reviews | 40 | 21 | |
| review management software for app stores | 30 | 0 | |
| appfollow alternative / competitors / pricing / reviews | ~150 combined | **0** | winnable at AS 2 today |

At Authority Score 2 with 14 referring domains (all spam — see
`docs/today.md`), KD 18 and KD 0 are the only tiers currently reachable. These
two pages are chosen for that reason, not because they are the biggest terms.

## Scope

| Page | Primary term | Why |
|---|---|---|
| `/app-review-management` | app review management | The hub. Highest-value reachable term. |
| `/alternatives/appfollow` | appfollow alternative | KD 0, highest purchase intent available. |
| `/vs/appfollow` | — | **301 to `/alternatives/appfollow`.** Same intent; two pages would cannibalise each other. |

## The claims constraint

This is the part that matters most, and it is why this spec exists rather than
just a ticket.

`/compare`, `/customers` and `/status` were all withdrawn on 2026-08-16/18 for
publishing things that were not true — invented testimonials, a fabricated
customer story, an unsourced competitor price, and a status page that could not
report an outage. These two pages are new surfaces with the same temptation.

### Rules

1. **Every product claim must be traceable to code, and derived from it where a
   number is involved.** Prices come from `lib/plans.ts`. The template count is
   exported from `lib/templates.ts`. Nothing about pricing or limits is retyped
   into a page.
2. **No competitor facts we cannot source.** `appfollow.io` is unreachable from
   the build environment (egress-blocked), so *no* AppFollow price, plan name,
   feature or limit appears on `/alternatives/appfollow`. The page links to
   their own pages and lets the reader check. If a sourced, dated comparison
   table is wanted later, it needs the founder to supply the figures — that is
   backlog SEO4, not this spec.
3. **No testimonials, customer names, or customer counts.** There are no
   customers yet.
4. **No unverified time-to-value or performance claims.** Not "in 30 seconds",
   not "85% of replies are free", not an uptime figure. Every spine step in
   `docs/SPINE.md` is currently ⬜ unverified.
5. **Describe the launch tier, which is Draft Mode (D018).** The customer
   copies the AI draft into Play Console / App Store Connect and marks the
   review replied here. One-click API posting exists in code but is a sequenced
   Pro feature that no human has verified end-to-end, so it is described as
   available on request, never as the default flow.
6. **Do not market the frozen secondary organs as headline capabilities.**
   `docs/SPINE.md` freezes sentiment, ASO, competitors, incidents, releases,
   automations, reports and Slack, and says plainly they may be half-broken.
   They may be mentioned as "also in the product"; they may not carry a
   promise.

### Sources for every number that appears

| Claim | Source |
|---|---|
| Free / Starter / Pro prices, limits, seats | `PLAN_PRICING`, `PLAN_LIMITS` in `lib/plans.ts` — imported, not typed |
| 14-day trial | `TRIAL_DAYS` in `lib/plans.ts` |
| Built-in reply template count | `TEMPLATE_COUNT` exported from `lib/templates.ts` |
| Reply tones: professional, empathetic, casual, direct | `AIReplyTone` in `lib/templates.ts` |
| Issue tags: crash, billing, login, performance, release-regression, feature-request, support-delay, localization | `ReviewIssueTag` in `types/review.ts` |
| Two stores | `AppReview.source` in `types/review.ts` |
| Daily sync | `vercel.json` cron `0 8 * * *` |
| Apple's 350-character reply cap | Apple platform limit, stated as a store rule not our feature |

## Acceptance criteria

### AC1 — the hub page exists and is indexable
**Given** a signed-out visitor (or Googlebot)
**When** they request `https://www.tryreviewbox.com/app-review-management`
**Then** the page renders without auth, returns 200, declares
`<link rel="canonical" href="https://www.tryreviewbox.com/app-review-management">`,
and appears in `sitemap.xml`.
**Verified by:** `canonical-contract.test.ts` (canonical present and correct),
`seo-indexing-contract.test.ts` (in `MARKETING_ONLY_PREFIXES`), and step 2 of
the PR test plan.

### AC2 — the same page is not duplicated on the app host
**Given** the same visitor
**When** they request `https://app.tryreviewbox.com/app-review-management`
**Then** they are 301-redirected to `https://www.tryreviewbox.com/app-review-management`.
**Verified by:** `seo-indexing-contract.test.ts` asserts the path is in
`MARKETING_ONLY_PREFIXES`; middleware does the redirect. PR test plan step 4.

### AC3 — `/vs/appfollow` does not compete with `/alternatives/appfollow`
**Given** a visitor on `/vs/appfollow`
**When** the page loads
**Then** they are permanently redirected to `/alternatives/appfollow`, and only
the latter is in the sitemap.
**Verified by:** unit test reading `next.config.ts`; PR test plan step 5.

### AC4 — no price is written by hand
**Given** a change to `PLAN_PRICING` in `lib/plans.ts`
**When** the site is rebuilt
**Then** every price shown on `/app-review-management` changes with it, with no
edit to the page.
**Verified by:** `marketing-claims-contract.test.ts` — fails if a `$`-prefixed
price literal appears in either page's source.

### AC5 — no unsourced competitor claim
**Given** `/alternatives/appfollow`
**When** its source is scanned
**Then** it contains no AppFollow price, plan name, or numeric feature limit.
**Verified by:** `marketing-claims-contract.test.ts` — fails on a `$` amount or
a "per month" figure appearing near the AppFollow name.

### AC6 — the region-locked fixture app is not contradicted
**Given** the Mumbai One fixture from `docs/PRODUCT_CONTEXT.md` — an India-only
app whose owner does not have Play Console owner access
**When** they read `/app-review-management`
**Then** nothing on the page requires store admin access to get value, and the
copy states that reviews are visible without connecting anything.
**Verified by:** manual read against `PRODUCT_CONTEXT.md` §"Who this is for";
PR test plan step 3.

## Done does NOT mean

- **It does not mean these pages rank.** At AS 2, `/alternatives/appfollow` may
  rank for the KD-0 modifiers within weeks; `app review management` at KD 18 is
  a several-month proposition and only with real links. Ranking is gated on
  SEO5 (link acquisition), not on this spec.
- **It does not mean a full comparison table exists.** Deliberately excluded —
  see claims rule 2. That is SEO4.
- **It does not mean the spine is verified.** These pages describe capabilities
  that exist in code. `docs/SPINE.md` is still 0/8 walked against a real app.
  **The founder should walk the spine before driving traffic here**, because
  the pages are honest about what the product does and will still disappoint if
  step 3 or step 7 turns out to be broken.
- **It does not cover `/integrations`, `/review-response-templates` or
  `/aso-tools`.** Those are the next slice.

## Follow-ups found while writing this

Both are stale public claims found while sourcing numbers, neither fixed here:

1. `/help/ai-replies` says **25 built-in templates**; `lib/templates.ts`
   contains **19**.
2. The same page lists tones **"Professional, Friendly, Empathetic, Brief,
   Custom"**. The `AIReplyTone` type is **professional, empathetic, casual,
   direct** — two of the five named do not exist.
3. The same page describes auto-publish as being "on the **Team plan**". There
   is no Team plan; it was removed (`lib/plans.ts` sells Starter and Pro).
4. `docs/marketing/BRAND_MESSAGING.md` quotes ReviewBox at "$49–$199/month"
   (there is no $199 plan), an unsourced "0.5★ bump lifts conversion 15–30%",
   and unsourced competitor pricing of "$300–$2,000/mo". It should not be used
   as a source of facts until corrected — only of tone.
