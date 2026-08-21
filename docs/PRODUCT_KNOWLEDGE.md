# ReviewBox — Product Knowledge Brief

> Orientation document for a CTO or CMO meeting this project for the first time: why it exists,
> what it does, how it's built and sold, and — the part most onboarding decks skip — an honest
> account of where it actually stands. A formatted PDF version of this brief was generated
> alongside this doc; regenerate it from this content if a polished copy is needed again.
>
> Compiled 19 August 2026 from `docs/PRODUCT_CONTEXT.md`, `decisions.md`, `backlog.md`, `today.md`,
> `FEATURES.md`, `ARCHITECTURE.md`, `ZERO_COST_PLAN.md`, `LAUNCH_PLAN.md`, `COMPETITIVE_MAP.md`,
> `marketing/BRAND_MESSAGING.md`, `marketing/LANDING_PAGE_COPY.md`, `SPINE.md`, `ASSUMPTIONS.md`,
> `MARKET_READINESS_AUDIT.md`, `UX_AUDIT.md`, `AUDIT_SYSTEM.md`, `ROLE_AUDIT.md`,
> `LAUNCH_CHECKLIST.md`, `BUGS.md`, `specs/review-sync.md`, `specs/marketing-product-pages.md`,
> ADRs 001/006/007/008/009/010, and the root `CLAUDE.md` build ledger. This is a synthesis, not a
> verbatim reproduction — where a source document was itself dated, contradicted a more recent one,
> or was self-flagged as unverified, this brief says so rather than picking silently.

---

## 1. Executive summary

**ReviewBox is an AI-native review-operations and light-ASO workspace for Google Play and Apple
App Store**, built so a solo founder or a 1–5 person mobile team can triage, reply to and learn
from every app review without buying an enterprise tool. It aggregates reviews from both stores
into one inbox, tags and prioritizes them for free using local rules and machine learning, drafts
replies with AI in the workspace's brand voice, detects rating-spike and crash incidents, and turns
the language of real reviewers into ASO keyword signal — all for **$49–$129/month** against
AppFollow's **~$399/month**.

| | |
|---|---|
| **Stage** | Pre-revenue · M0 (House in Order) |
| **Team** | 1 non-coder founder + a Claude agent pipeline |
| **Infra cost today** | ~$1/month (domain only) |
| **Target ceiling** | 40–50 paying customers, boutique by design |

The product is further along than most pre-launch SaaS: real multi-tenant auth (Clerk), real
Postgres with row-level security (Supabase), a genuinely novel zero-cost AI cost structure (a
3-tier reply pipeline plus local WASM machine learning), and essentially every screen an
AppFollow-class product needs is built and wired to live data. It has also been through five
rounds of adversarial self-audit and one round of the founder manually testing the live product —
and each round found defects the previous ones missed, several of them "whole-population" bugs
(every signup, every Android reply) invisible to strict TypeScript, linting, and hundreds of
passing unit tests.

> **The one fact to hold onto.** This codebase distinguishes sharply between *"compiles and the
> tests pass"* and *"a human walked the flow against a real app and watched it work."* The second
> claim is tracked separately in `docs/SPINE.md` as an 8-step launch gate, and as of the last
> recorded session it had not yet been walked to completion end-to-end. Billing (Stripe) is
> deliberately not switched on — **ReviewBox has not yet taken a payment.** Treat every "✅ Done"
> elsewhere in this brief as "the code exists and passed automated checks," not as "verified
> working for a customer," unless stated otherwise.

---

## 2. Why — the problem and the market thesis

### The problem

A mobile team's review workflow is scattered across tools that don't talk to each other: reviews
live in the Play Console, keywords live in an ASO tool, crashes live in Sentry, and replies live in
a support inbox or a spreadsheet a support lead maintains by hand. Every cycle the picture gets
stitched together manually, and by the time it's stitched it's stale. Three things are true at once
and existing tools price them as three separate problems:

1. **Reviews drive installs** — rating and rating velocity are ranking-algorithm inputs, and review
   text tells you exactly which words your best-converting users already use.
2. **Reviews drive product** — a crash, a regression, a billing bug shows up in the review feed
   before it shows up in Sentry, Slack, or a PM tool.
3. **ASO and review ops feed each other** — the phrases 5-star reviewers repeat are the keywords
   worth ranking for; the bugs 1-star reviewers scream about are the same ones killing conversion.

AppFollow, Sensor Tower and data.ai sell enterprise review/ASO suites at $300–$2,000+/month with AI
bolted on as a paid add-on. AppTweak and Mobile Action are ASO-only and treat reviews as a side
panel. Zendesk and Intercom are generic helpdesks with no concept of an app version or a star
rating. ReviewBox's bet is to collapse review triage, AI reply drafting, incident detection and
light ASO signal into one AI-native workspace at indie-team pricing.

### Who we sell to — and a note on where the docs disagree

The canonical, most-recently-updated definition of the customer (`docs/PRODUCT_CONTEXT.md`,
required reading before any code change in this repo) is:

| Attribute | Definition |
|---|---|
| Buyer | Solo founders and small mobile teams, 1–5 apps, no dedicated support staff |
| Primary market | **India first** (the founder's own network), then global English-speaking |
| Sophistication | Non-technical to semi-technical — many don't know their own package name or have Play Console owner access, and won't read documentation |
| Typical first app | Often a regional, non-US app (Indian transit, fintech, government, D2C) — sometimes with little or no English-language review volume |
| Competitive wedge | AppFollow at ~$399/month; ReviewBox wins on price ($49), AI-first design, and modern UX |

> **Note for the CMO.** The shipped marketing collateral (`docs/marketing/BRAND_MESSAGING.md`, the
> landing page copy) targets a noticeably different, more senior buyer — four named personas
> titled "ASO Manager," "Mobile Growth Lead," "Indie/Solo Dev" and "Mobile PM" at companies from 20
> to 1,000 people, competing head-to-head against AppFollow/Sensor Tower/AppTweak on feature
> tables. That framing predates `PRODUCT_CONTEXT.md` (which is dated later, is explicitly called
> "required reading every session," and is the version the engineering/audit process treats as
> ground truth) and has not been reconciled with it. Two other messaging docs are stale in ways
> worth knowing before quoting them externally: the pricing figures in `BRAND_MESSAGING.md` and the
> landing-page copy still show a three-tier **$49 / $99 / $199** structure with a "Team" plan — the
> current, code-verified pricing (Section 6) is **$49 / $129** plus a quote-only Enterprise tier,
> and "Team" was formally retired in ADR 008 (17 Aug 2026). Worth a deliberate reconciliation pass,
> not a reason to distrust the messaging pillars themselves (the tone guide and "more for less"
> framing are sound and reusable).

### Competitive positioning

*Figures marked ⚠ are drawn from AppFollow's public marketing/support pages by an earlier research
pass, not verified live — the vendor's own site returns 403 to automated fetches from this
environment. Treat as directionally right, re-verify before publishing externally.*

| Capability | ReviewBox | AppFollow ⚠ | Sensor Tower ⚠ | AppTweak ⚠ |
|---|---|---|---|---|
| Review sync, both stores | ✅ (public scrape primary; official API optional) | ✅ | ✅ | Partial |
| AI auto-triage | ✅ native, $0 (local ML + rules) | Paid add-on | Paid add-on | — |
| AI reply drafting | ✅ native (Groq, 3-tier, cheap) | $$ add-on (OpenAI) | — | — |
| Auto-reply rules | ✅ opt-in | — | — | — |
| ASO keywords sourced from reviews | ✅ signals, deliberately not a full ASO suite | — | Separate product | ✅ separate |
| Multi-language review + reply | ❌ English-only today | ✅ | ✅ | — |
| Starting price | **$49/mo** | ~$299–399/mo | $1,000+/mo | $349/mo |

Deliberately **not** building, even though the category leader has them: agent-performance
dashboards (the buyer here *is* the only agent — measuring a team of one is theatre), deep
keyword-research/traffic-channel ASO (a different product category), and enterprise connectors
(Salesforce, Zendesk, Tableau — wrong buyer, permanent maintenance cost). Saying no to these is
what keeps $49/month viable against a $399/month competitor.

> **The gap that's easy to miss.** The single highest-value gap against AppFollow is invisible in a
> feature-comparison table: multi-language review and reply. AppFollow translates in any language;
> ReviewBox is English-only. For AppFollow's US/EU enterprise buyer that's a convenience. For
> ReviewBox's actual India-first ICP, it is the difference between a product that works and one
> that silently shows a fraction of a customer's real feedback and drafts replies in the wrong
> language. It never shows up as a "missing feature" because the row technically exists on both
> sides — only reading the ICP file reveals it. Backlogged as **CM1**, currently the top item in
> the NOW queue (Section 8).

---

## 3. What — product overview & the core loop

**One-line pitch:** *"Reviews → Revenue. One tool."* — triage every review, reply at scale in your
brand voice, and surface ranking keywords from real reviewer language, from one workspace, starting
at $49/month.

### The core loop — "Draft Mode," and why it exists

The single most consequential product decision in the codebase is **decision D018**: the founder
only has *user-level* access to a real test app, not Play Console admin/API access — so the
official reply-posting APIs cannot be verified before launch, and most of the target ICP
(non-technical, no Play Console owner rights) won't have that access either. The launch product is
therefore **"Draft Mode":**

1. Reviews are pulled via a **public scraper** — zero store credentials required from the customer.
2. AI drafts a reply in the workspace's brand voice.
3. The user **copies the draft and pastes it** into Play Console / App Store Connect themselves,
   then marks the review "replied" inside ReviewBox.
4. One-click API reply-posting exists in code and is offered as a **sequenced Pro feature**,
   verified only once a customer (or the team) holds real store admin/API access.

This is why the onboarding flow explicitly supports "I'll connect later," and why the product can
credibly promise "see your reviews without connecting anything" — a promise most competitors can't
make because they gate everything behind an OAuth grant first.

### The end-to-end journey

| # | Step | What happens |
|---|---|---|
| 1 | Sign up | Clerk auth, no credit card, 14-day trial starts automatically |
| 2 | Onboarding | Name the workspace, search for the real app by *name* (not package ID) across both stores, pick brand voice tone |
| 3 | Bootstrap sync | Public scraper pulls the app's actual recent reviews within ~30–60 seconds, no credentials needed |
| 4 | Triage | Every review is tagged sentiment / priority / issue tag for free, instantly, by a rules engine (no AI call) |
| 5 | Reply | Open a review → AI draft appears in brand voice → edit → copy to store (Draft Mode) or one-click post (Pro, sequenced) |
| 6 | Alerts | Rating spikes, crash clusters and unreplied backlogs email (and optionally Slack) the owner |
| 7 | Learn | Sentiment trends, topic clusters and ASO keyword suggestions surface from the same review corpus |
| 8 | Pay | 14-day trial → Starter/Pro/Enterprise (Stripe wiring exists, not yet switched on — Section 4) |

This 8-step journey is exactly what `docs/SPINE.md` tracks as the launch gate — see Section 7 for
its current verification status, which is the single most important "how far along are we really"
data point in this brief.

---

## 4. Feature catalog — why, what, status, pending

Status reflects what shipped and was wired to real data as of the last recorded session (18 Aug
2026), per the codebase's own build ledger. Per the callout in Section 1, "Done" here means the
code exists and passes automated checks — not that it has been verified end-to-end against a real
customer flow unless separately noted.

### Review Inbox / Queue — `Shipped · real data`
- **Why:** Without reviews reliably in the inbox nothing else — AI drafts, sentiment, automations,
  digests — has any input. It is the single most valuable feature and the one that has broken
  silently the most times in this product's history.
- **What:** Unified list across Google Play + App Store, filterable by platform, rating, sentiment,
  priority, reply status and issue tag; full-text search; bulk mark-replied/archive; single-review
  detail pane with AI suggestion, reply editor and escalation controls.
- **Pending:** Multi-language display/reply (CM1, top of NOW queue); saved views / pinned smart
  inboxes (X11, NEXT tier).

### AI Reply Drafting — `Shipped · 3-tier pipeline`
- **Why:** Replying to every review, in a consistent brand voice, is the labor a solo founder or
  2-person support team cannot sustain by hand — and it's the trial's core demo moment.
- **What:** Three-tier pipeline designed to keep AI cost near zero: (1) regex template match —
  covers ~60–80% of replies for free in under 1ms; (2) a Redis-cached exact/near match; (3) Groq
  Llama 3.3 70B for the remaining ~15–20% of genuinely novel reviews, incorporating a
  per-workspace knowledge base so drafts don't hallucinate. Four tones (professional, empathetic,
  casual, direct). Editable before publish.
- **Pending:** Switch from Groq to Claude Haiku 3.5 + prompt caching is planned at the $1K MRR
  trigger, not before (cost discipline, Section 6). Auto-reply (no human in the loop) is built but
  gated behind an explicit opt-in and is not yet recommended for general availability — see the
  Redis sync-lock risk note in Section 9.

### Triage — sentiment, priority, issue tags — `Shipped · zero-cost`
- **Why:** A non-technical founder needs the review feed pre-sorted, not raw — crash reports,
  billing complaints and feature requests separated before the inbox is even opened.
- **What:** Every synced review is tagged instantly by a deterministic rules engine (keyword/regex,
  no network call, no token cost) into sentiment (critical/negative/mixed/positive), priority
  (urgent/high/normal/low) and issue tags (crash, billing, login, performance,
  release-regression, feature-request, support-delay, localization, +more). Ambiguous 3-star
  reviews are optionally refined by Gemini on demand. Tags are user-correctable per review and
  workspace-renameable.
- **Pending:** User-authored auto-tag *conditions* (AppFollow parity item CM2) — today the engine
  assigns tags automatically, but a user cannot yet define their own tagging rule from
  text/rating/language/length.

### Incidents — `Shipped · real data`
- **Why:** Rating and crash damage compounds for every hour it goes unnoticed; the goal is to know
  before the app store itself starts hiding the rating from search.
- **What:** Auto-detects incidents from review-pattern spikes (default: 5 reviews ≤2★ on the same
  app version within 24h), plus manual incident creation; severity levels, owner assignment,
  release-version linkage, timeline view, email + Slack alert.
- **Pending:** Auto-detection from crash-tag clustering beyond the rating-spike trigger (L3 in the
  LATER tier).

### Release Health — `Shipped · real data`
- **Why:** Ties review sentiment back to the release engineers actually shipped, so a regression is
  traceable to a version, not just a vague "ratings are down."
- **What:** Per-version health status (healthy/monitoring/degraded) from rating delta and
  complaint-volume delta vs the previous version; rollout percentage; drill-down to the reviews
  behind a given version.
- **Pending:** Rollback-consideration flagging is UI-present but not wired to any external action
  (by design — ReviewBox observes, it doesn't control the store rollout).

### Automations — `Shipped · GA path gated`
- **Why:** Leverage is the entire product for a team of one — a rule that auto-drafts or
  auto-replies to a known pattern is worth more to this ICP than to an enterprise team with staff.
- **What:** Rule builder (conditions → action), auto-draft on rule match, opt-in auto-publish,
  execution log. A per-workspace Redis sync lock (shipped) prevents the same rule firing twice on
  an overlapping sync.
- **Pending:** Auto-reply GA (Y2) is explicitly not yet recommended: the sync lock "fails open"
  when Redis is unreachable, which is the right trade-off for every other job the sync worker
  does, but publishing to a live store listing unattended needs its own answer for "what happens
  when Redis is down" — an unresolved question, not a bug.

### Reply Kit — templates, tones, knowledge base — `Shipped · real data`
- **Why:** Feeds tiers 1 and 3 of the AI pipeline above: templates are the free first line, and the
  knowledge base is what stops AI drafts from hallucinating a fix that doesn't exist.
- **What:** 19 built-in reply templates (filterable by tag/tone), 4 AI tone presets, a
  per-workspace knowledge base of product facts injected into every AI draft.
- **Pending:** Public help copy still advertises "25 templates" and a 5-tone set including
  "Friendly"/"Brief," which don't exist in code — a stale-copy cleanup, not a product gap (flagged
  18 Aug, not yet fixed).

### Sentiment analytics screen — `Shipped · real data`
- **Why:** Turns the review corpus into a trend line a founder can act on weekly, not just a queue
  to clear.
- **What:** Sentiment trend chart, topic breakdown from local ML clustering
  (`@xenova/transformers`, $0 forever), "re-cluster with AI" for a deeper Gemini pass on demand.
- **Pending:** Topic clustering is intentionally thin today ("local transformers, thin" per the
  competitive map) — a candidate for deepening once a paying customer asks.

### ASO (light) — `Shipped · scoped narrow on purpose`
- **Why:** The thesis's third leg: the words 5-star reviewers repeat are ASO gold, and no
  competitor connects that signal directly to a store listing.
- **What:** Keyword rank tracker, AI keyword suggestions mined from real review text (Gemini, 24h
  Redis cache), weekly rank movement.
- **Pending — deliberately:** Deep keyword-research and traffic-channel analytics are explicitly
  refused (Section 2) — that's AppTweak's product, not this one. What ships is *signal*, not a
  standalone ASO suite.

### Competitor tracking — `Placeholder data`
- **Why:** Context for "is our rating problem us, or the category" — a founder benchmark, not a
  full competitive-intelligence product.
- **What:** The "you" row uses real workspace metrics (rating, reviews/week, reply rate, 6-week
  trend); competitor rows are illustrative placeholder data, honestly labelled "sample" in the UI.
  The underlying table (migration 016) already exists.
- **Pending:** X6 (real competitor tracking) — add-by-store-URL, daily public-rating fetch, is
  scoped and ICE-ranked but not started. The Market Readiness Audit flags shipping fake rows next
  to real ones on a paid product as a trust cost worth resolving before broad marketing of this
  screen.

### Reports & digests — `CSV + 2 of 4 report types`
- **Why:** A founder checking in weekly, not living in the inbox, needs a pushed summary rather
  than a pulled one.
- **What:** CSV export with totals, a manual "send now" report action, and automated weekly digest
  + daily unreplied-backlog email (Vercel Cron). *The "daily-only" limit these were
  designed around was a Hobby-plan constraint; the project is on Pro as of
  2026-08-21, so digest frequency is now a product choice, not a platform limit.*
- **Pending:** 2 of 4 report card types (crash report, retention report) are UI stubs behind a
  "coming soon" label — not silently broken, just not built yet.

### Slack integration — `Built · needs founder setup`
- **Why:** The single most-requested feature in early product decisions and the most direct
  competitive parity item vs AppFollow.
- **What:** Incoming-webhook delivery for rating spikes, incidents and urgent unreplied reviews,
  with Redis-deduped alerts so the same event doesn't refire on every sync. An OAuth "Add to
  Slack" upgrade (channel picker, no pasted URL) is designed (ADR 006) alongside the shipped
  webhook path.
- **Pending — human-required:** the founder must register a Slack app at api.slack.com and add the
  client ID/secret to Vercel before this is live for any customer.

### Multi-app workspaces & team roles — `Works for solo workspaces`
- **Why:** The pricing tiers (Section 6) are differentiated partly by seats and app count — this
  has to work correctly before a Team-style plan can be sold in good conscience.
- **What:** Multi-app support exists in the schema and UI; invite flow, roles (owner/admin/member)
  exist in the data model.
- **Pending:** A dedicated role audit found internal role checks enforced in only **6 of 67** API
  routes — in practice "member" behaves like "owner" almost everywhere. Zero cross-workspace data
  leaks were found (tenant isolation is solid), but a member can today export the workspace's
  store credentials via GDPR export, redirect Slack alerts, or switch on auto-reply without being
  an owner. Backlogged as **R2/R3**, explicitly required before a multi-seat plan is marketed as
  safe.

### Admin business portal + support tickets — `Shipped`
- **Why:** The founder needs one internal place to see who signed up, what state each customer is
  in, and a support inbox that isn't a personal email thread — without paying for a third-party
  helpdesk before there's revenue to justify it.
- **What:** Overview KPIs (signups, estimated MRR from list price, AI usage), per-customer
  drill-down (members, apps, sync health, audit trail), and a full ticket system (migration 017)
  with customer-facing "Contact support" and an internal thread + notes view.
- **Pending:** Nothing blocking; a minor hygiene item (soft-deleted workspaces still appear as live
  customers in the MRR view) is open and low severity.

### Billing (Stripe) — `Built, intentionally OFF`
- **Why:** Checkout, portal and webhook routes were built ahead of need so the switch is fast once
  it's time — but per `docs/decisions.md`, no paid dependency or billing logic goes live until a
  customer is ready to pay, and it is explicitly gated by founder decision D013.
- **What:** Checkout session creation, billing portal, webhook handler for subscription lifecycle
  events — all exist, code-reviewed, and are structurally correct.
- **Pending:** Stripe keys are unset in every environment. **No customer has ever been charged.** A
  second open decision (ADR 009) — whether the advertised reviews-per-month cap is actually
  enforced — needs an answer before billing goes live, or the pricing page will promise a limit
  the product doesn't apply.

### GDPR / privacy tooling — `Shipped`
- **Why:** Table-stakes for any SaaS handling EU or India-adjacent customer data, and directly
  load-bearing for the "we tell you when something is wrong" trust promise.
- **What:** Self-service data export and hard-delete endpoints, a documented 30-day soft-delete
  grace window for voluntary account cancellation (separate from the immediate, irreversible GDPR
  path), audit logging on every mutating route.
- **Pending:** Export was previously found to leak App Store signing-key credentials to any
  workspace member (fixed, now owner-gated) — mentioned here as an example of the role-enforcement
  gap above, not because it's currently open.

---

## 5. How — technical architecture (for the CTO)

### Stack

| Layer | Choice | Note |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | Upgrade to 16 deferred until stable |
| Styling | Tailwind CSS v4 + shadcn/ui | CSS design tokens (`--rb-*`); brand blue `#0A84FF` is the only hardcoded color allowed |
| State | Zustand (UI) + TanStack React Query (server) | No React Context for global state |
| Database | Supabase — Postgres + Row-Level Security + pgvector + pg_cron | RLS active on every tenant table |
| Auth | Clerk | Free to 5,000 MAU |
| AI — replies | Groq (Llama 3.3 70B) | Free tier 6K req/day; switches to Claude Haiku 3.5 at $1K MRR |
| AI — sentiment/ASO | Gemini | Batch, ambiguous-cases-only, rules-engine fallback |
| Local ML | @xenova/transformers (WASM) | Tags, sentiment, clustering — $0 forever, runs in-process |
| Cache / rate limit | Upstash Redis | Free tier 10K commands/day |
| Email | Resend | Free tier 3K/month |
| Payments | Stripe | Built, not activated (Section 4) |
| Hosting | Vercel (**Pro** plan, confirmed 2026-08-21) | Crons may fire once/minute. This row said "Hobby / capped at once per day" until 2026-08-21 and was wrong; several product decisions were shaped by that false premise — see Section 9 |
| Errors / analytics | Sentry, PostHog | Both installed |
| Testing | Vitest (unit) + Playwright (e2e) | 609+ unit tests as of last session; e2e suite currently skips entirely in CI — see Section 7 |

### Architecture pattern

Feature-slice design: each domain (`reviews`, `incidents`, `releases`, `settings`, …) is
self-contained under `src/features/` and never imports another feature's internals. Data flows one
way — `Supabase → service layer → React Query hook → component` — components never call Supabase
directly, and services never import React. This is a disciplined, conventional structure; nothing
exotic.

### The zero-cost AI architecture — the product's actual moat

The most distinctive engineering decision is not a feature, it's a cost structure. AppFollow
charges extra for semantic tagging and AI replies; ReviewBox gives both away on every plan because
almost none of it touches a paid API:

1. **Tagging/sentiment/priority** — a deterministic keyword/rules engine, $0, runs on every review
   at write time, no network call.
2. **Reply drafts** — the 3-tier pipeline in Section 4 (template → cache → Groq), so an estimated
   80–85% of replies never reach a paid model at all.
3. **Clustering/embeddings** — local WASM transformers, unlimited, runs on the server process
   itself.

This is why the product can sustain $49/month pricing against a $399/month competitor without
subsidizing every customer's AI usage — the marginal cost of a customer approaches the Groq/Gemini
free tier ceiling, not a per-token bill.

> **Note for the CTO — the biggest structural risk.** The entire review pipeline's primary data
> path is an unofficial public scrape of Google Play and App Store listings (decision D018), not
> the official Publisher API — because most of the ICP will never grant Play Console access.
> Google actively rate-limits and blocks datacenter IP ranges, and the scraper parses HTML that can
> change without notice. There is retry-with-backoff for transient failures and Sentry alerting on
> sync failure, but **no proxy and no fallback data source.** A sustained Google-side block is a
> total outage for that store, not a degradation. This was a deliberate, documented trade-off (the
> alternative — requiring Play Console API access up front — was rejected as incompatible with the
> ICP), but it is the single risk most worth an incoming CTO's attention, and it is compounded by a
> hard platform ceiling: Google's `reviews.list` API has *no date parameter at all* (verified
> against the installed API definition), so no request — from ReviewBox or from any competitor —
> can ever retrieve reviews older than roughly a week via API. On the test fixture app, a funded
> paid competitor (AppFollow) holds only 272 of 2,064 total ratings; ReviewBox holds 202. Same
> wall, universal to the category, not a ReviewBox-specific gap — but worth knowing cold before a
> customer asks "where are the rest of my reviews."

### Security & multi-tenancy

- **Tenant isolation: verified clean.** Two independent full-codebase audits found zero
  cross-workspace data leaks across 67 API routes — every ID taken from a request is re-checked
  against the caller's own workspace.
- **Internal role enforcement is the known weak spot** — see the Multi-app workspaces entry in
  Section 4. Not a tenant-isolation issue; a "does a plain member have the same power as the
  owner" issue, real the day a customer's first teammate is invited.
- Canonical API error envelope, mandatory rate limiting on every paid-service or enumerable route,
  and a best-effort audit log on every mutating route are enforced as standing rules
  (`docs/decisions.md` D004/D005/D007) — not aspirational, checked in the current codebase.
- A Clerk outage currently takes down the *entire* domain, including the public marketing site and
  legal pages, because auth middleware wraps every route with no fallback (BUG-040, open, fix
  scoped but deliberately not shipped as a tail-end change to a security-critical file).

### Delivery process — the "autopilot"

The founder has never written a line of code (`docs/decisions.md` D000, IMMUTABLE). Product ships
through a fixed agent pipeline: a **PM agent** picks the next backlog item; an **Architect agent**
writes an ADR for anything non-trivial (auth, billing, schema, new external services); a **Coder
agent** branches, implements, opens a PR with a 5-minute plain-English test plan; a **Tester agent**
adds Vitest/Playwright coverage; a **Reviewer agent** flags BLOCKER/NIT issues before the founder
looks at it. CI (build, type-check, lint, unit tests, e2e, security audit) is the only pre-merge
gate — branch previews are disabled (a founder decision, originally argued partly from Hobby-plan
build queueing), so a PR is never merged while CI is red. As of 16 Aug 2026 the founder delegated merge-and-deploy authority to Claude once CI is fully
green (decision D020); everything else — no direct pushes to `main`, no production migrations, no
real customer emails, no pricing changes without an ADR, no new paid dependency — remains a hard
guardrail the agents are instructed to refuse even if asked.

---

## 6. Business model & go-to-market (for the CMO)

### Pricing — current, code-verified

| Plan | Price | Notes |
|---|---|---|
| Trial | Free, 14 days, no card | Mirrors Pro-level allowances so the trial can actually demonstrate the AI feature it exists to sell |
| Free (post-trial resting state) | $0 | 1 app · 10 AI drafts/day · 25 published replies/month — a deliberately usable floor, not a locked-out state, so a slow decision doesn't turn into a refund request |
| **Starter** | **$49/mo** ($39/mo billed annually) | Entry tier |
| **Pro** | **$129/mo** ($99/mo billed annually) | Automation rules, Slack alerts, ASO tracking |
| Enterprise | Quote-only | No fixed price ID — assigned by hand. Replaces the retired "Team" tier (ADR 008, 17 Aug 2026) |

A monthly reviews-ingested cap is defined per plan in code (free 1,000 / starter 5,000 / trial &
pro 50,000 / enterprise ~unlimited) and is shown on the pricing and billing pages — but per ADR 009
it is **not currently enforced anywhere**, a known, tracked, founder-level open decision (Section
9). Billing itself is not switched on (Section 4) — treat all of the above as the priced product,
not yet the sold product.

### Unit economics — the zero-cost survival plan

The operating rule stated at the top of every planning document: **"Do not add a paid service until
a customer pays first."** Every tool in the stack has a free tier sized to cover 0–20 customers, and
total infrastructure cost today is approximately **$1/month** (the domain). A defined upgrade ladder
only spends money once revenue is already covering it several times over:

| Revenue | Infra spend | Trigger |
|---|---|---|
| $0 – $1,000 MRR | ~$1/month | none — everything on free tiers |
| $1,000 MRR | ~$36/month (3.6%) | Supabase Pro (no auto-pause) + switch reply AI to Claude Haiku |
| $2,000 MRR | ~$56/month (2.8%) | + Vercel Pro (native cron, better logs) |
| $5,000 MRR | <$100/month (<2%) | comfortable headroom on every service |

Business-model target is explicitly a **boutique ceiling, not mass-market scale**: 40–50 paying
customers at 2–4 apps each (decision D014). The stated reason: at that ceiling, "simple and
reliable beats clever and scalable" — sequential sync jobs and no message queue are correct choices
at this scale and would be wrong ones past it.

### Positioning & messaging pillars

Positioning statement: *"For app marketers, growth leads, ASO managers and small mobile teams who
need to manage reviews and ASO without an enterprise budget, ReviewBox is the AI-native review
operations + ASO platform that triages, replies, spots incidents and feeds keyword strategy from
one workspace — unlike AppFollow, Sensor Tower or AppTweak, purpose-built, AI-native end to end,
and priced from $49/month."*

| Pillar | One line |
|---|---|
| 1. Triage in seconds | AI sorts every review by sentiment, priority and issue tag the moment it hits the store |
| 2. Reply at scale, on brand | 60–80% of replies served free from templates/cache; the rest draft in ~2s from Groq |
| 3. ASO that listens | Keyword suggestions from real reviewer language, not a black box |
| 4. Spot incidents first | Rating spikes and crash clusters alert before the store itself hides the rating |
| 5. One workspace, two stores | Same templates, automations and ASO data across Google Play and App Store |

Voice: short sentences, verbs not nouns ("ship, triage, reply, save, spot, surface"), every numeric
claim traceable to a proof point, no "leverage/empower/synergy/next-gen." This discipline is
enforced by an automated build check, not just a style guide.

> **A genuinely useful process detail for the CMO.** Three marketing pages (`/compare`,
> `/customers`, `/status`) were built and then voluntarily withdrawn within 48 hours in August 2026
> for containing invented testimonials, an unsourced competitor price, and a status page that could
> not actually report an outage. The team's response was not just to delete the pages — it added an
> automated build check (`marketing-claims-contract.test.ts`) that now fails the build if a new
> page contains an unsourced dollar figure near a competitor's name, an invented customer quote, or
> an unverifiable performance claim. Two new product pages shipped since
> (`/app-review-management`, `/alternatives/appfollow`) were built under that constraint from day
> one — every price on them is imported live from the pricing code, never retyped. Worth knowing
> before approving any future comparison or case-study page: the bar for "can we say this" is
> enforced by a test, not a reviewer's memory.

### Go-to-market

- **SEO** — foundational bugs (missing canonical tags, and `/robots.txt` + `/sitemap.xml` literally
  404ing to Google for months) were only fixed 18 Aug 2026. The site currently ranks for 9 URLs,
  all at zero measurable traffic, at Authority Score 2 (effectively no domain authority, 14
  referring domains, all low-quality). The plan's own conclusion: content alone won't move the
  needle at this domain strength — **link acquisition is the gate** (backlog item SEO5,
  human-required: directories, Product Hunt, mobile-dev communities), and every higher-difficulty
  keyword cluster is blocked on it regardless of how much content ships.
- **Direct channels** (from the original launch plan): IndieHackers, r/androiddev, Product Hunt,
  cold outreach to apps with visible unanswered reviews, build-in-public on X/Twitter — none yet
  executed at the time of this brief.
- **Competitive-conversion pages** are treated as the highest-intent traffic available ("someone
  searching a competitor's name is shopping") but are explicitly gated on having sourced, dated
  facts to cite — see the honesty callout above.

---

## 7. Current state — build maturity, honestly

### What "done" means in this codebase — read this before the status tables

The team's own internal audit charter (`docs/AUDIT_SYSTEM.md`) opens by explaining why it exists:
the product's worst bugs were never caught by strict TypeScript, ESLint, a full test suite, or a
production build — because they were "state-over-time" bugs (correct the first time a thing runs,
wrong the second time, or wrong only for a customer whose app happens to be region-locked).
`docs/SPINE.md` states the rule directly: *"'Done' means a human walked this step against a REAL
app and watched it work. Not 'CI green.' Not 'code written.' Not 'unit tests pass.'"*

### The launch gate: 8 steps, tracked separately from feature completeness

The 8-step journey from Section 3 is the literal launch gate. All secondary screens (sentiment,
ASO, competitors, incidents, releases, automations, reports, Slack) are explicitly frozen in
priority terms until this passes — "a narrow product where the spine is 100% beats a broad product
where everything is 80%." As of the most recent recorded status, verification was in progress but
not complete end-to-end against a real app; the founder had begun walking it and several defects it
surfaced (below) had been fixed, but a full 8-of-8 pass had not yet been recorded.

### What five audit rounds actually found

This history matters for a CTO because it's the strongest evidence available of how the codebase
actually fails, not how it's assumed to fail:

| Round | Method | Headline finding |
|---|---|---|
| Market Readiness Audit (25 Jul) | Adversarial code read + "what happens the 2nd time?" | 5 live critical/high defects, all invisible to 80 passing unit tests: sync silently died after day one for every Draft Mode customer; **every sync run erased the customer's own reply/draft work**; trial users were 100% locked out of the AI feature the trial exists to demo, with no way to pay (Stripe deferred); nag emails fired for apps the customer had already deleted. Also discovered in the same pass: **CI had never run, on any branch, ever** — the workflow trigger pointed at a branch name (`main`) that never existed in this repo (default is `master`). Every past "CI green" note in the project's history was an agent reporting a local run, not a real gate. Fixed the same session. |
| Five-lens audit (15 Aug) | Four parallel review lenses + live walkthrough | 27 further verified defects, 25 fixed same round, including: every automation rule was silently a no-op (a type mismatch made every write match zero rows, while the log recorded "success"); onboarding abandonment could strand a user on 0 AI drafts forever; GDPR export leaked App Store signing keys to any workspace member. |
| Founder live-testing (16 Aug) | Founder using the product on production, ~2 hours, no code read | **13 more defects, several whole-population**: every new signup got a 500 error; every Android customer was permanently denied one-click reply posting (a credential check meant for App Store apps was being asked of Google Play apps, which structurally never pass it); the dashboard's headline rating silently averaged in the ratings of apps the customer had already deleted. None of these were findable by reading code — each looked like a correct check against a plausible-looking value that was simply the wrong value. **The team's own conclusion:** "founder testing live found more in two hours than the last audit round found in a day. Audits find inconsistency; use finds wrongness." |

> **Process risk worth flagging to a CTO directly.** Since mid-August the shared dashboard file has
> been corrupted by colliding merges **five separate times**, and one other core file once —
> almost always two branches (or, on the fifth occasion, one branch merging in a base that had
> already fixed the same bug independently) editing the same component in parallel, with GitHub's
> auto-merge fusing both changes into invalid, CI-breaking code. The lesson now written into the
> team's process notes: *"two fixes for one bug collide worse than two features — each side is
> green alone, which is exactly why nobody catches it until the merge."* The durable fix (branch
> protection requiring green CI on `master`) is recommended but, as of the last recorded session,
> not yet turned on by the founder.

### Testing & CI — read the green checks carefully

- **609+ Vitest unit tests**, CI-gated, cover pure functions (rules engine, plan enforcement,
  sync-write logic, sentiment classification, etc.) — genuinely useful and growing.
- **The Playwright e2e job is green in CI, but currently runs zero tests.** Every spec self-skips
  because CI's Clerk key is a structurally-valid-but-fake placeholder that Clerk rejects with
  "Invalid host." The team's own docs flag this explicitly after previously (and wrongly)
  describing the green check as a real signal — a good example of the project correcting its own
  record rather than leaving a stale claim in place. Fix is scoped (real Clerk dev-instance keys
  as GitHub secrets) and tracked as human-required, not yet done.
- **Deploy pipeline has twice reported success while shipping nothing** — once from a missing
  deploy token, once (most recently recorded, 18 Aug) from a GitHub secret pointing at the wrong
  Vercel team ID, which silently left every merge from that day sitting on a green `master` that
  was never promoted to production. Both were eventually made to fail loudly instead of silently;
  whether the most recent one has since been corrected by the founder is not something this brief
  can confirm — worth a direct check before assuming `tryreviewbox.com` reflects the latest merged
  code.

### Frontend / backend build ledger (summary)

Per the project's own tracking: essentially every screen in the product is built and, per the
table in Section 4, the large majority are wired to real Supabase data rather than mocks. The
backend is similarly far along — sync, AI drafting, rules engine, Slack, GDPR, admin portal and the
report/digest crons are implemented. The two deliberate, known exceptions are **billing** (built,
intentionally not activated) and **competitor tracking** (built, intentionally showing placeholder
data pending X6). Design-system debt (raw `gray-*` Tailwind classes instead of the token system,
~125 raw `<button>` elements instead of the accessible `<Button>` component) is tracked but
low-severity and not launch-blocking.

---

## 8. Roadmap — what's next, what's explicitly out

### Immediate queue (NOW — this week, ICE-ranked)

| Item | What | Why it's next |
|---|---|---|
| **SPINE** | Walk the 8-step launch gate to 8/8 against a real app | The literal launch gate — nothing else matters until this is true (Section 7) |
| **CM1** | Multi-language review + reply | Highest-value gap for the actual India-first ICP (Section 2) |
| **CM2** | Bulk reply + user-editable tag rules | Half-shipped (tag correction/renaming is live); leverage for a team of one |
| **R2 / R3** | Role-enforcement pack + role-aware UI | Required before a multi-seat plan can be sold honestly (Section 4/5) |
| **W6B / ADR 010** | Founder decision on review-retention policy | Blocks building the retention feature at all (Section 9) |
| **SEO2–SEO5** | Reply-template library, free ASO tool, honest AppFollow comparison, link acquisition | SEO5 (links) gates nearly everything else in this cluster |

### Milestone map

| Milestone | Goal | State |
|---|---|---|
| M0 — House in order | Nothing embarrasses you if someone lands today | In progress — config cleanup done; Sentry/PostHog done; onboarding UX simplification queued |
| M1 — Real product | Sign up → connect Google Play → see real reviews | Substantially done — sync, apps API, dashboard all wired to real data |
| M2 — First dollar | Stripe live, someone pays, admin shows it | **Not started by design** — gated on D013 (founder must explicitly ask) and on SPINE reaching 8/8 first |
| M3 — Retention engine | Automated touchpoints, automations live, Apple sync complete | Partially built ahead of schedule (Slack, digests, sync all exist); GA gates remain (auto-reply, Section 4) |
| M4 — Growth | Referrals, public API, Zapier, Slack-native distribution | Not started |

### Explicitly out of scope (tracked so nobody rebuilds it by accident)

2FA/SSO, a native mobile app, a public API with key management, a free-forever tier, SOC 2 prep,
multi-region deployment, Salesforce/Helpshift/Zendesk connectors, white-labeling, and training AI
on customer data are all deliberately deferred — "not in scope until a paying customer asks." This
list exists precisely to stop a well-meaning contributor (human or agent) from quietly picking one
up.

---

## 9. Key risks & open decisions

### Decisions waiting on the founder specifically

| Decision | Options on the table | Team's recommendation |
|---|---|---|
| **ADR 009** — enforce the advertised review-volume cap? | (A) hard-stop ingestion at the cap, (B) soft cap — keep syncing, prompt to upgrade, (C) drop the claim from pricing entirely | **B.** (A) risks a paying customer's own reviews silently disappearing, the worst possible form of an upsell. |
| **ADR 010** — review-history retention (4 sub-questions) | Hide vs. delete at 365 days · free/lapsed-trial access to old data · retention measured from review date or capture date · does this replace the volume cap above | Hide (never delete) · retain but restrict view · capture date · yes, retire the volume cap in favor of this |
| US/English-only review coverage | Disclose honestly in the UI (~1 hour of work) vs. fan out scraping across ~8 locales (8× scrape volume, raises the Google-block risk in Section 5) | Disclose now; multi-locale only once a customer asks (partially superseded by CM1 above, which solves this properly) |

### Structural risks worth carrying into any planning conversation

- **Single unofficial data source.** Public scraping of Google Play/App Store is the primary and,
  for most of the ICP, *only* viable path (Section 5) — a sustained block from Google is a total
  outage for that store with no fallback today.
- **The review-history ceiling is structural, not a ReviewBox gap** — Google's API cannot return
  reviews older than about a week under any circumstance, industry-wide, including for funded
  competitors. The risk is not that this is fixable and unfixed; it's that it needs to be marketed
  honestly (ADR 010) rather than discovered by an angry customer.
- **Auto-reply is not yet recommended for general availability** even though it's built and
  opt-in — the per-workspace sync lock that protects it fails open when Redis is down, which is
  the right default for every other job the sync worker runs and the wrong one for unattended
  posting to a live store listing.
- **Internal role enforcement** (Section 5) is the most concrete "don't sell this yet" technical
  gate on the Team/Enterprise motion specifically — tenant isolation is solid, but member-vs-owner
  is not.
- **Documentation drift is a known, self-diagnosed pattern in this project** — plan vocabulary,
  pricing figures, and ICP framing have each drifted between code and docs at least once (Section
  2, Section 6), serious enough in one case (plan vocabulary) that it silently disabled the entire
  trial-to-paid downgrade path for months. The team's stated response when this happens: reconcile
  in a new written decision, never silently patch one side while leaving the other stale. Worth the
  same discipline from whoever owns this brief going forward.

---

## Glossary

| Term | Meaning |
|---|---|
| Draft Mode | Launch tier: AI drafts, human copies the reply into the store manually — zero store credentials required from the customer (D018) |
| SPINE | The 8-step signup→reply→mark-replied journey that must be verified against a real app before launch; tracked separately from feature completeness |
| ICP | Ideal Customer Profile — currently India-first solo founders / small mobile teams (Section 2) |
| ICE score | Impact × Confidence ÷ Effort — how every backlog item is ranked |
| ADR | Architecture Decision Record — written before any non-trivial technical change |
| Whole-population bug | A defect affecting every user of a code path (e.g. every signup), as opposed to an edge case — the class the founder's live-testing round specifically surfaced |
| Autopilot | The PM → Architect → Coder → Tester → Reviewer agent pipeline that ships product for a non-coder founder |
