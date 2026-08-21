# Product Context — the brief every audit reads first

**Why this file exists.** On 2026-07-29 the founder searched for their own app,
"Mumbai One", and got four unrelated apps listed by raw package name. The
underlying bug — `country: "us"` hardcoded in every store call — had been in
the codebase since the beginning. It survived strict TypeScript, ESLint, 134
unit tests, a production build, three security audits and a role audit.

It survived all of them because **it is not a code defect. It is a context
defect.** `country: "us"` is perfectly well-typed, internally consistent,
idiomatic code. It is only *wrong* if you know that this product's first
customers are in India and their apps are region-locked. No amount of reading
the code can tell you that. You have to know who the customer is.

So: an audit without product context can only find inconsistency. To find
*wrongness*, the audit must be handed the same brief a product manager would
give a new engineer. That is this file. Every audit lens reads it first, and
every finding may cite it as the reason something is a defect.

Keep it current. A stale brief produces confidently wrong audits.

---

## Who this is for (ICP)

> **This table is the single authoritative ICP, ratified 2026-08-19 by
> `docs/decisions.md` D024, which superseded D011 ("indie dev, English-speaking
> primary") and D017 ("boutique SaaS, $200–500/mo"). If another document
> describes a different customer, it is stale — this one wins.**

| | |
|---|---|
| **Buyer** | Solo founders and small mobile teams, 1–5 apps, no dedicated support staff |
| **Primary market** | **India first** (the founder's own network), then global English-speaking |
| **Competitor** | AppFollow ($399/mo) — we win on price ($49), AI-first, modern UX |
| **Sophistication** | Non-technical to semi-technical. Many do NOT know their package name, do not have Play Console owner access, and will not read docs |
| **First app they connect** | Frequently a **regional, non-US app** — Indian transit, fintech, government, D2C. Often India-only, sometimes with few or no English reviews |

**Direct audit consequences.** Any of these is a defect on sight:
- Logic that assumes the US storefront, English-only content, or a global app.
- A flow that requires Play Console *owner* access to see any value.
- An error message that names a technical cause without a next action.
- A step that can only be completed by someone who knows their package name.

## What we promise the customer

Every promise below is a testable claim. If code cannot deliver one, either
the code or the promise is a defect — do not leave the gap silent.

1. **See your reviews without connecting anything.** Public store data appears
   on the dashboard within ~30 seconds of signup ("Draft Mode", D018).
   → *At risk:* if Google blocks our servers from scraping (finding A8), this
   promise cannot be kept for Google Play and the product must say so.
2. **Find your app by typing its name.** Not its package name.
3. **The numbers match the store.** Rating and review count agree with what
   the customer sees on their own listing.
4. **AI drafts a reply worth sending**, in the workspace's brand voice.
5. **We tell you when something is wrong**, in plain English, with the fix.
   Never a spinner that never resolves, never "success" for a no-op.

## Operating constraints that shape correctness

- **Vercel Pro** (confirmed 2026-08-21; this line previously said Hobby and was
  wrong): crons may fire as often as **once per minute**. Sync currently runs
  **every 3 hours**. A serverless function still freezes the moment its response
  is sent — hence `after()`, never `void fetch`. That part was never about the
  plan.
- **Zero paid services until a customer pays** (CLAUDE.md's one rule). Rules
  out paid scraping proxies, higher cron frequency, and paid store APIs today.
- **Non-coder founder:** every PR needs a 5-minute plain-English test plan; the
  founder is the only one who merges, deploys, and runs migrations.
- **Public scrapers are the primary data path** and are unofficial: Google
  rotates markup without notice and rate-limits datacenter IPs. Treat every
  scrape as "will break silently" and design the failure to be loud.

## Known reality about the data

- Google Play's Publisher API returns only ~7 days of reviews, and only for
  customers who invited our service account. **This is structural, not a quota:**
  `reviews.list` accepts `maxResults`, `packageName`, `startIndex`, `token`,
  `translationLanguage` — there is **no date parameter**, so no request exists
  that asks for older reviews. `androidpublisher` v3 has no ratings, statistics
  or reports resource at all, and `playdeveloperreporting` v1beta1 is vitals
  only. Verified against the installed API definitions, 2026-08-17.
  - Corroborated externally: on an app with 2,064 rated reviews, AppFollow — a
    funded paid competitor — returns **272**; we hold 202. Same wall.
  - The full history exists only in **Play Console → Download reports**, monthly
    CSVs in a customer-owned GCS bucket. Not in any API. `googleapis` already
    ships the `storage` client, so reading it needs permission, not a purchase.
- **The App Store is not the same story, and conflating them misleads.** App
  Store Connect's `customerReviews` paginates properly; our `fetchReviews()`
  defaults to `limit = 200` and `syncAppStore()` passes no override. On iOS the
  depth ceiling is **ours** and raisable; on Android it is Google's and is not.
  Never write "the stores only give us ~200" — half of that sentence is us.
- The public Play listing is **per-country**; an India-only app returns
  nothing on the US storefront — including zero reviews, forever, with no
  error (this was the Mumbai One bug).
- iTunes search and the review RSS feed are also per-country.
- Lifetime rating/review counts on a listing are **global**, while scraped
  reviews are **per-country** — do not present them as the same number
  without saying so (open: BUG-020).

## Scope — what we are and are not building

Derived from `docs/COMPETITIVE_MAP.md` (the category's feature surface mapped
against ours). Refuse-list included on purpose: at $49/mo against a $399/mo
competitor, the "no" decisions are what keep the product viable.

**In scope (the product):** review aggregation from both stores, unified
inbox, replies posted to the store, templates + knowledge base, AI drafts in
the workspace's brand voice, sentiment and topic tagging, automation rules,
rating-spike and unreplied alerts, release/version health, competitor
tracking, light ASO signals, exports and digests, multi-app workspaces.

**Deliberately NOT building** (revisit only when a paying customer asks):
- **Agent-performance dashboards** — our buyer *is* the only agent.
- **Deep ASO** (keyword research suites, traffic-channel analytics) — that is
  a different product category; we ship signals, not an ASO tool.
- **Enterprise connectors** (Salesforce, Tableau, Helpshift, Zendesk) — wrong
  buyer, and each one is permanent maintenance.

**The gap that matters most, and is easy to miss:** multi-language reviews.
Competitors translate reviews and reply in any language; we are English-only.
For their US/EU enterprise buyer that is a convenience — for our India-first
ICP it decides whether the product works at all. Tracked as backlog CM1.

## Reference customer fixtures (use these in probes and reviews)

| Case | Store ID | Storefront | Why it matters |
|---|---|---|---|
| Founder's own app | `com.mmrda.mumbaione` | `in` | Region-locked; the canary for the whole India-first thesis |
| Global control | `com.whatsapp` | `us` | If this fails too, the upstream is down or blocking us — not a regional bug |
| iOS control | `com.burbn.instagram` | `us` | Apple path is a different upstream from Google; isolates blame |

If a change cannot serve **all three**, it is not done.
