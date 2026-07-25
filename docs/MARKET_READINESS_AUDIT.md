# ReviewBox — Market Readiness Audit

**Date:** 2026-07-25 · **Auditor:** Claude (adversarial review) · **Branch:** `claude/product-market-readiness-zcfowh`
**Baseline at audit start:** `tsc` 0 errors · 80 unit tests passing · `eslint` 0 errors · production build passing

---

## Verdict

**Not ready to sell. Close to ready to demo.**

The build is in better shape than most pre-launch products: real auth, real
multi-tenancy, real RLS, 62 API routes with 59 of them properly authenticated,
a clean design system, and a genuinely good-looking UI. The engineering
discipline in `docs/decisions.md` is unusually strong for a solo non-coder
operation.

That is not what was wrong. **Five defects were breaking the product for a real
paying customer, and every one of them passed CI.** They passed type-checking,
they passed 80 unit tests, they passed lint, they passed the production build.
The test suite verified that pure functions compute correct values; nothing
verified that a review fetched on Monday was still there on Tuesday.

This is the exact failure mode `docs/SPINE.md` predicted in writing:

> "Our build status has dozens of ✅ that only ever meant 'compiles + unit tests
> pass.' That is a different claim from 'a real review flowed end-to-end.'"

The spine document was right, and then the team kept shipping features against
a 0/8 verified spine for two months. **The single highest-value process change
is to stop trusting green CI as a proxy for "it works."**

### The three things standing between here and revenue

1. **There is no way to accept money.** Stripe keys are unset (D013). Not a bug
   — a decision — but it means market readiness is capped at 0% until reversed.
2. **The spine is 0/8 verified.** Nobody has walked signup → sync → draft →
   copy → mark-replied against a real app. Until that happens, every readiness
   claim in this repo is a compile-time claim.
3. **Review coverage is US/English only** (see G-2). A customer with a global
   app will see a fraction of their reviews next to a dashboard number that
   counts all of them. This will be the first thing a real customer notices.

---

## Part 1 — Defects found and fixed this session

All five were live on `master`. All five passed CI.

### B-1 · Reviews stopped updating after day one for every Draft Mode customer
**Severity: Critical · Fixed**

`syncWorkspace` ran the public scraper only when an app had **zero** reviews in
the database. Every subsequent sync went straight to the Google Play Publisher
API, which requires the customer to invite our service account to their Play
Console.

D018 says the launch tier is Draft Mode and explicitly requires **zero store
credentials from the customer**. So for every customer on the documented launch
path:

- the first sync worked (scraper seeded ~200 reviews),
- every sync after that failed with a 403,
- `last_sync_status` was pinned to `needs_play_console_access` permanently,
- the dashboard showed a red error banner and a setup modal forever,
- and the daily health cron emailed them "hasn't synced in 2 days" every 3 days,
  indefinitely.

**This is the email the founder has been receiving for a month.** It was not a
false alarm — the sync really was failing every day. The product had quietly
stopped working, and the nag email was the only symptom surfaced.

**Fix:** the public scraper is now the primary path on every sync for both
stores. The official Publisher API / App Store Connect API still run when
credentials exist and their rows take precedence (they carry developer replies
and device, which the public listing lacks), but their absence or failure no
longer fails the sync.

### B-2 · Every sync destroyed the user's reply work
**Severity: Critical · Fixed**

`upsert(rows, { onConflict: "app_id,external_id" })` rewrites **every column**
of an existing row from freshly-scraped store data — including `reply_status`
and `reply_text`, which are user-owned.

Consequences:
- A saved AI draft (`draft_ready` + draft text) reset to `needs_reply` / `null`
  on the next daily sync.
- A Draft Mode "mark as replied" — SPINE step 8, the last step of the core loop
  — reset the same way.
- The iTunes RSS feed **never** reports developer replies, so *every App Store
  review* was reset to `needs_reply` on *every sync*, including ones replied to
  through the official Connect API.

This would not have been caught by walking the spine once. SPINE step 8 says
"status persists after page reload" — it does. It does not survive until
tomorrow morning.

**Fix:** sync now inserts only reviews it has never seen, and promotes
`needs_reply → replied` when the store shows a reply it did not have. It never
downgrades. Logic extracted to `src/lib/sync-writes.ts` with 12 regression
tests covering each destruction path.

### B-3 · Trial users were locked out of the core AI feature
**Severity: Critical · Fixed**

`middleware.ts` gated `isBilledRoute` — which includes `/api/reply(.*)`, the AI
draft endpoint — to `paidPlans = {starter, pro, team}`. `/api/onboarding/complete`
stamps every new user with `plan: "trial"`.

So every trial user hitting "generate draft" was 307-redirected to `/billing`.
Since Stripe is deferred (D013), there was no way to become a paid plan. **The
trial could not demonstrate the one feature the trial exists to demonstrate.**

Worse, the redirect was a 307 to an HTML page. The client does
`fetch("/api/reply/draft", {method:"POST"})` and then `res.json()` — which
receives markup and throws. The user saw a generic failure, not "upgrade
required."

**Fix:** `trial` is now an entitled plan (expiry is enforced separately, three
lines above). Billing blocks on API routes return a `402` JSON body instead of
redirecting to HTML.

### B-4 · Health nudge emails for apps the customer already deleted
**Severity: High · Fixed**

`/api/health/user-check` queried `apps` with no `deleted_at` filter, and checked
workspace liveness for only one of its three signals.

A soft-deleted app is skipped by the sync worker, so its
`last_sync_attempted_at` freezes at the moment of deletion. It therefore
satisfies "failing for 48h+" **forever**, and re-nags the owner every 3 days
about an app they explicitly disconnected. Owners of soft-deleted workspaces
were reachable the same way.

**Fix:** `deleted_at IS NULL` on the apps query; workspace liveness enforced on
all three signals. Also rewrote the never-synced email copy, which told Draft
Mode users to go set up a Play Console service account they do not need.

### B-5 · The inbox silently dropped reviews, and the app selector did nothing
**Severity: High · Fixed**

Two separate bugs in `/api/reviews`:

- **Pagination lost rows.** The cursor was `store_created_at` alone, applied
  with `.lt()`. When several reviews share a timestamp — common, since store
  feeds batch to the same second and the scraper falls back to `now()` for
  unparseable dates — page 2 skipped *every* review sharing page 1's last
  timestamp. Those reviews became unreachable in the UI. Now a composite
  `timestamp|id` cursor with a matching tiebreak order (legacy cursors still
  accepted).
- **No app scoping.** Reviews were not filtered by app at all. Reviews from
  soft-deleted apps lingered in the inbox indefinitely, and the sidebar's app
  selector — the primary navigation control for the 2–4 app ICP in D017 — was
  decorative. Now scoped to live apps, with the selector wired through and an
  "All apps" option added. Selection moved from app *name* to app *id*
  (names collide and can't be used as an API filter).

### Also fixed
- `GOOGLE_PRIVATE_KEY` was parsed at module load in `publisher-api.ts`. A
  malformed key threw during import, taking down **every route that imports the
  file** — including sync and reply — with an opaque module-init failure. Now
  lazy.
- Sync failures now report to Sentry. Previously a `console.warn` nobody reads;
  now that the scrape is the primary data path, a scrape outage is the loudest
  possible signal that the product has stopped working.
- Removed the leftover `sentry-example-page` scaffold.

---

## Part 2 — Gaps that need a founder decision (not fixed)

These are judgment calls with real trade-offs. I've stated a recommendation for
each rather than deciding unilaterally.

### G-1 · No payment path · **Blocks revenue entirely**
Stripe keys unset, per D013. The routes exist and look correct; nothing is
wired. **Market readiness is 0% until this is reversed** — everything else in
this document is about whether the product is worth paying for, which is moot
if it cannot be paid for.

*Recommendation:* reverse D013 as soon as the spine is 8/8. Not before — taking
money for a product whose core loop is unverified is the worse failure.

### G-2 · Reviews are US/English only · **Will be noticed by the first customer**
`bootstrap-reviews.ts` hardcodes `lang: "en", country: "us"`. The iTunes RSS
call hardcodes `country=us`.

Meanwhile the dashboard's headline "total reviews" comes from
`lifetime_review_count`, scraped from the store page — which is the **global**
count. So a customer with a mostly non-US audience sees "3,412 reviews" on the
dashboard and perhaps 200 in the inbox. That discrepancy destroys trust in
every other number on the page.

D017 says "English-first", which makes US-only defensible as a *starting
scope* — but only if it is disclosed. Right now it is silent.

*Recommendation:* pick one before launch —
(a) fan out the scrape across ~8 locales (costs ~8× scrape volume, raises
    block risk — see G-3), or
(b) keep US-only and label it honestly in the UI ("US reviews" on the inbox,
    "all markets" on the lifetime figure).
(b) is the D014-consistent choice and takes an hour. Do (b) now, (a) when a
customer asks.

### G-3 · The entire product now depends on scraping Google Play from Vercel IPs
**Severity: High strategic risk**

My B-1 fix makes the public scraper the primary data path — which is what D018
requires, but it concentrates all risk on one unofficial dependency. Google
actively rate-limits and blocks datacenter IP ranges. `google-play-scraper`
parses Play Store HTML, which changes without notice. There is 3× retry with
backoff, which handles transient 503s and nothing else.

There is no proxy, no fallback, and (until this session) no alerting.

*Recommendation:* accept the risk for launch — the alternative (requiring
Play Console API access) is what D018 already rejected, for good reasons. But:
(1) I've added Sentry alerting on sync failure — watch it,
(2) treat "customer grants Publisher API access" as the Pro upsell it already
    is in D018, since it's also the reliability upgrade, and
(3) know that a Google-side block is a total outage, not a degradation.

### G-4 · The spine is 0/8 verified
`docs/SPINE.md` defines 8 steps that must be verified against a real app before
launch. All 8 are still `⬜ unverified`, two months after the document was
written. Three of the five bugs above sit directly on that path.

*Recommendation:* this is the highest-value thing to do next, ahead of any
feature. It takes about 30 minutes and it is the only activity that produces
real information about readiness.

### G-5 · Sync latency is 24 hours
Vercel Hobby caps crons at once-per-day, so `/api/sync/reviews` runs at 08:00
UTC. For a product whose pitch is fast response to negative reviews, "we'll
tell you tomorrow" is a weak value proposition, and competitors sync hourly.

*Recommendation:* Supabase `pg_cron` + `pg_net` can call the sync endpoint on
any schedule for free — the extension is already enabled per CLAUDE.md. Worth
doing before charging $99/mo.

---

## Part 3 — Lower-severity findings (not fixed, logged)

| ID | Severity | Finding |
|----|----------|---------|
| M-1 | Medium | Competitors screen ships placeholder competitor rows. Honestly labelled "sample", but a paid product showing fake rows next to real ones is a trust cost. Either ship real competitor tracking or remove the screen. |
| M-2 | Medium | 2 of 4 report types are "Coming soon" stubs. |
| M-3 | Medium | E2E covers unauthenticated redirects, auth pages, marketing pages, and a *mocked* inbox. **Nothing covers the spine.** The one flow that must not break is the one flow with no automated test. |
| M-4 | Medium | 125 raw `<button>` elements instead of `<Button>` — missing focus rings and disabled states (accessibility). |
| M-5 | Low | 1,031 raw `gray-*` Tailwind classes across 64 files bypass the `--rb-*` token system; dark mode is unreliable in those components. 47 tokens are defined and rarely used. |
| M-6 | Low | `#5B5BD6` indigo hardcoded across Reply Kit + Automations with no token defined. ~10 min fix, listed as DS1 in the backlog since May. |
| M-7 | Low | `/admin/customers` doesn't filter soft-deleted workspaces — deleted accounts appear as live customers in your own MRR view. |
| M-8 | Low | `tsconfig.tsbuildinfo` (640 KB) is committed despite being in `.gitignore`. |

### Verified as *not* problems
Worth recording, because these were checked and are fine:
- **Auth coverage.** 59 of 62 API routes authenticate. The 3 that don't are
  intentionally public (`/api/health`, the IP-rate-limited `/api/demo/reply`,
  and the cookie-clear endpoint).
- **Admin gate fails closed.** `ADMIN_CLERK_USER_ID` unset means nobody gets in,
  rather than everybody.
- **No secrets committed.** `.gitignore` is correct; `git ls-files` is clean.
- **Cron auth fails closed** on missing `CRON_SECRET`.
- **Rate limiting** is present on 28 routes including every AI and enumeration
  path.
- **Pricing is consistent** between the marketing page and the in-app billing
  page ($49 / $99 / $199).

---

## Part 4 — The process finding

This is the most important section.

Every bug in Part 1 was **invisible to the entire quality apparatus**: strict
TypeScript, ESLint, 80 unit tests, a production build gate, and three prior
security audits that found 44+ issues between them.

That apparatus is well-built and it is aimed at the wrong target. It verifies
that code is *internally consistent*. Every Part 1 bug was a **state-over-time**
bug — something that is correct on first execution and wrong on the second:

- B-1: sync #1 works, sync #2 onward fails
- B-2: reply saved, next sync erases it
- B-4: app deleted, emails continue
- B-5: page 1 correct, page 2 drops rows

No amount of unit testing catches this class. Two things do:

1. **Walk the spine, then walk it again tomorrow.** The "again tomorrow" is
   where B-2 and B-4 live. A single-session walk would have missed both.
2. **One e2e test that runs the full loop against a seeded database** — sign in,
   sync, draft, mark replied, *sync again*, assert the reply survived. That
   single test would have caught B-1, B-2, and B-5.

The 44 issues found by prior audits were nearly all input-validation and
authorization issues — the class that reading code finds. The class that broke
the product needed someone to ask "what happens the second time?"

---

## Recommended order of work

1. **Walk the spine** (`docs/SPINE.md`, 8 steps, ~30 min). Nothing else produces
   real information. Do this against a real app on the Vercel preview.
2. **Decide G-2** (US-only disclosure vs multi-locale). One hour for the honest
   labelling option.
3. **Write the one e2e test** that covers sync → draft → mark replied → sync
   again. This is the regression net for everything in Part 1.
4. **Move sync to `pg_cron`** for sub-daily latency (G-5).
5. **Then, and only then, reverse D013** and turn on Stripe.
6. Feature work resumes after 1–5. Not before — the backlog is currently ranked
   by ICE, and ICE has no term for "the core loop is broken."

---

## What changed in this branch

| File | Change |
|---|---|
| `src/app/api/sync/reviews/route.ts` | Scraper is primary path both stores; insert-only writes with reply-state promotion; automation rules fire on new reviews only; Sentry on failure |
| `src/lib/sync-writes.ts` *(new)* | Pure write-planning logic — what a sync may overwrite |
| `src/lib/sync-writes.test.ts` *(new)* | 12 regression tests for the data-loss paths |
| `src/middleware.ts` | `trial` entitled; API billing blocks return 402 JSON not an HTML redirect |
| `src/app/api/health/user-check/route.ts` | Soft-deleted apps and workspaces excluded from all three signals |
| `src/lib/email/send-health-nudge.ts` | Never-synced copy no longer contradicts Draft Mode |
| `src/app/api/reviews/route.ts` | Composite cursor; live-app scoping; `appId` filter |
| `src/hooks/use-review-queue.ts`, `src/app/(app)/inbox/page.tsx`, `src/components/layout/sidebar.tsx`, `src/store/use-workspace-store.ts` | App selector wired to the inbox; "All apps" option; selection by id |
| `src/services/google-play/publisher-api.ts` | Lazy private-key parse |
| `src/app/api/reports/weekly-digest/route.ts` | Soft-deleted app filter |
| `src/app/sentry-example-page/` | Removed |

**Verification:** `tsc` 0 errors · 92 unit tests passing (80 → 92) · `eslint`
0 errors · production build passing.

**Not verified:** none of this has been exercised against a real app or a real
database. That is what step 1 above is for.
