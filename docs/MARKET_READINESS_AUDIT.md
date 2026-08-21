# ReviewBox — Market Readiness Audit

**Date:** 2026-07-25 · **Auditor:** Claude (adversarial review) · **Branch:** `claude/product-market-readiness-zcfowh`
**Baseline at audit start:** `tsc` 0 errors · 80 unit tests passing · `eslint` 0 errors · production build passing

> ## Delivery status — updated 2026-08-21
>
> **P0 implementation COMPLETE. P1-1 — PASS WITH EXTERNAL DEPLOYMENT
> CONFIGURATION.** Both are engineering-verified and sitting on
> `fix/p0-commercial-readiness`. See **Part 6** for the item-by-item record,
> the verified numbers, and the four external blockers that no amount of code
> closes.
>
> This document remains the commercial-readiness audit of record. Part 6 is
> appended to it rather than written elsewhere, so the gaps in Part 2 and the
> work that closed them stay in one place.
>
> **Next engineering task: P1-2 — Multilingual AI Reply Generation.** Not
> started; no P1-2 code is in this branch.

---

## Verdict

**Not ready to sell. Close to ready to demo.**

The build is in better shape than most pre-launch products: real auth, real
multi-tenancy, real RLS, 62 API routes with 59 of them properly authenticated,
a clean design system, and a genuinely good-looking UI. The engineering
discipline in `docs/decisions.md` is unusually strong for a solo non-coder
operation.

That is not what was wrong. **Five defects were breaking the product for a real
paying customer, and none of them was caught.** The test suite verified that
pure functions compute correct values; nothing verified that a review fetched
on Monday was still there on Tuesday.

And then a worse discovery, mid-audit: **CI has never run. Not once, on any
branch, in the history of this repository.** `.github/workflows/ci.yml`
triggers on `main`; the default branch is `master` and no `main` branch has
ever existed. The GitHub API reports `total_count: 0` workflow runs across all
45 branches and every merged PR. Every "CI green" claim in `CLAUDE.md`,
`docs/today.md`, and `docs/backlog.md` describes something that never happened,
and D000's "the merge button is greyed out until all pass" guardrail has never
existed. See Part 4.

This is the exact failure mode `docs/SPINE.md` predicted in writing:

> "Our build status has dozens of ✅ that only ever meant 'compiles + unit tests
> pass.' That is a different claim from 'a real review flowed end-to-end.'"

The spine document was right, and then the team kept shipping features against
a 0/8 verified spine for two months. **The single highest-value process change
is to stop treating a green checkmark in the docs as evidence that anything was
verified** — and, first, to make the checkmark mean something by turning CI on.

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

All five were live on `master`, and all five were merged without any automated
check running against them (Part 4).

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

**Status 2026-08-21 — STILL OPEN, and deliberately so. P0-1 addressed the
safety of the gate, not the gate itself.** D013 stands; the keys are still
unset. What P0-1 established is that an unconfigured deployment **fails
closed and legibly** rather than half-charging or dead-ending: `stripe.ts`
throws on a missing `STRIPE_SECRET_KEY`, and both `/api/stripe/checkout` and
`/api/stripe/portal` check that key **before** the price lookup and return
`STRIPE_NOT_CONFIGURED` 503. The ordering is the point — checking the price
first made every plan answer "Invalid plan.", a dead end with no next action,
and it left the billing page's `STRIPE_NOT_CONFIGURED` branch unreachable. So
G-1 is a **business decision awaiting the founder**, no longer a latent defect
waiting to surface on the day a trial expires.

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

**Status 2026-08-21 — P0-2 CLOSED the propagation half.** The storefront a
customer picks is now persisted and carried through ingestion instead of being
dropped mid-pipeline. `bootstrapAppStoreReviews()` normalized the requested
storefront into `store` and then passed **`null`** as the country when building
each row — so every App Store review landed with `country: null` while the
Google Play path beside it passed `store` correctly. A null country silently
breaks the inbox country filter and any automation rule keyed on `country`, and
it is invisible in the UI because a blank column reads as "not available".
Fixed at `src/services/bootstrap-reviews.ts`, pinned by
`src/services/bootstrap-reviews.test.ts` and by
`src/spine-customer-flow.test.ts` ("preserves country parameter 'in' as alpha-2
'IN' on review mapping"). Verified at runtime against both a US and an IN
storefront during the P1-1 review pass.

**What P0-2 did NOT do:** it did not fan the scrape out across locales, and it
did not add the honest UI labelling option (b) asks for. The
inbox-count-vs-lifetime-count discrepancy this gap opens with is therefore
**still live** for a non-US-majority app. Option (b) remains unbuilt.

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

**Status 2026-08-21 — this is P1-1. The code is done and verified; the
schedule cannot run on the current plan.** `vercel.json` now declares
`0 */3 * * *`, and **Vercel Hobby rejects any cron firing more than once per
day, at deploy time.** The application side of G-5 is closed; the deployment
side is a founder decision between Vercel Pro and the `pg_cron` path this
recommendation already names. Full record in **Part 6**.

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

## Part 4 — CI has never run

`.github/workflows/ci.yml` opens with:

```yaml
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
```

The default branch is **`master`**. There is no `main`, and there never has
been. `git ls-remote` lists 45 branches; none is called `main`. The GitHub
Actions API returns **`total_count: 0`** for this workflow — it has not run a
single time, on any branch, on any PR, ever.

So the five jobs that `docs/decisions.md` D000 calls "Layer 1 robot checks",
with the note *"the merge button is greyed out until all pass"* — build,
type-check, lint, unit tests, e2e, security audit — have gated nothing. Every
PR in this repo merged with zero automated verification. The green checkmarks
in the docs came from agents running commands locally and reporting the result,
which is a different thing entirely.

Fixing the trigger revealed that **two more jobs could never have passed
anyway**:

| Job | Why it could not pass | Resolution |
|---|---|---|
| `security-audit` | `npm audit --audit-level=high` exits 1 on 12 high-severity advisories. `npm audit fix` cleared 15 of 27, but the rest need semver-major jumps (ESLint 9, `eslint-config-next` 16 → which pulls Next 16, explicitly deferred in CLAUDE.md) or have **no published fix** (`next`, `postcss`, `sharp`) | Blocks on `critical` (currently zero). High severity still runs and reports, but advisory. **BUG-036** |
| `e2e-tests` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_ci-placeholder` is not a structurally valid Clerk key — Clerk base64-decodes it for the frontend API domain. Every request threw `Publishable key not valid`, `next dev` never became ready, Playwright timed out at 120s. **Reproduced directly.** | Replaced with a decodable dummy key. Verified: dev server now boots and serves 200 on `/`, `/pricing`, `/sign-in`, `/help` |

And one that still can't pass, which is the founder's to fix:

- **11 of 20 e2e specs assert a protected route redirects an anonymous visitor
  to `/sign-in`.** With an unusable `CLERK_SECRET_KEY`, `auth.protect()`
  returns **404** rather than redirecting. Confirmed against a clean `master`
  worktree, so it is the placeholder credentials, not a regression. Real Clerk
  test credentials must be added as GitHub repo secrets — founder action, since
  I neither can nor should add credentials (D009). **BUG-037**

The e2e job is therefore `continue-on-error: true` for now. Build, type-check,
lint and unit tests **do** block, and all four are verified passing on this
branch — confirmed by the first real CI run in this repository's history
(run #1, all four green).

### What the first CI run then revealed

The e2e job failed all 20 specs, and the log gave a sharper diagnosis than my
local reproduction had. Every request — **including the purely public marketing
pages** — came back as:

```json
{"errors":[{"message":"Invalid host","code":"host_invalid"}]}
```

That is Clerk refusing a key that doesn't name a real instance, which confirms
BUG-037 is credentials-only. But it also exposes a **production** problem
nobody had reason to notice (**BUG-040**):

> `clerkMiddleware` wraps every path in `config.matcher`. When Clerk cannot
> resolve the instance, **every route returns HTTP 400 with a Clerk error body**
> — `/`, `/pricing`, `/privacy`, `/terms`, `/help` included.

So a Clerk incident, or one botched key rotation, doesn't just lock users out
of the app: it takes down the marketing site, the pricing page people sign up
from, and the legal pages you are obliged to serve. The blast radius of an
auth-provider outage is currently the entire domain.

The fix is to let public routes short-circuit before Clerk runs, while keeping
the host-based subdomain redirects that also live in that file. I have **not**
made that change here. It is a restructure of the security-critical middleware,
it cannot be verified without real Clerk credentials, and shipping an unverified
auth change at the tail of an audit whose whole thesis is "verify things" would
be self-refuting. It deserves its own PR and a real spine walk behind it.

One more, minor: GitHub Actions artifact storage is full, so a failing e2e run
can't upload its Playwright report (**BUG-041**). Clear old artifacts when you
next look at CI.

**Turning this on is arguably worth more than any single bug fix in Part 1**,
because it is what stops Part 1 from happening again.

---

## Part 5 — The process finding

Every bug in Part 1 was **invisible to the entire quality apparatus**: strict
TypeScript, ESLint, 80 unit tests, a production build gate that never ran, and
three prior security audits that found 44+ issues between them.

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

## Part 6 — Commercial-readiness delivery: P0 + P1-1

**Branch:** `fix/p0-commercial-readiness` · **Recorded:** 2026-08-21

### P0 — implementation COMPLETE

| Item | What it was | Outcome |
|---|---|---|
| **P0-1** | Stripe safely gated | **Done.** No keys set (D013 unchanged). Every Stripe entry point fails closed with `STRIPE_NOT_CONFIGURED` 503, checked *before* the price lookup so the billing page's unconfigured branch is reachable. No code change was required — the gate was verified, not built. See G-1. |
| **P0-2** | Regional storefront persistence / propagation | **Done.** App Store ingestion was writing `country: null` on every row while Google Play beside it wrote the real storefront. Fixed and pinned by unit tests; verified at runtime on US and IN. See G-2. |
| **P0-3** | Server-side monthly quota enforcement | **Done.** `checkReviewLimit()` was fully implemented with **no call site** — the review cap advertised on `/pricing` and `/billing` was enforced nowhere (audit finding M-6). It is now called inside `syncWorkspaceApps()` **before** the per-app fetch loop, so an over-quota workspace contacts no provider at all, and `/api/sync/reviews` translates it to a `402 REVIEW_LIMIT_REACHED`. `plan-enforcement.test.ts`'s "is still not wired into the sync pipeline" case was inverted to assert the call site now exists. |
| **P0-4** | Clerk / public-route isolation | **Done.** `middleware.ts` was one `clerkMiddleware()` wrapper around everything, so a public route still paid for Clerk initialization and a Clerk outage took the marketing site with it. Public-route and host routing now run in `handlePublicOrHostRouting()` **before** Clerk is entered at all; `/sign-in` and `/sign-up` wrap their `auth()` probe in try/catch so a throw renders the form instead of a 500. |
| **P0-5** | CI / E2E configuration | **Done, with one external blocker.** Three defects fixed — see "Defects found inside the P0 work" below. The e2e job is now honest about its own result in both directions, but it still executes **zero specs in CI** until Clerk test secrets exist. |

### P1-1 — sub-daily review synchronization

**Status: PASS WITH EXTERNAL DEPLOYMENT CONFIGURATION.**

Engineering is complete and verified. The label is not "ENGINEERING VERIFIED"
alone because the shipped cron **cannot run on the current deployment plan** —
that is a real, unclosed dependency, not a footnote.

| | |
|---|---|
| **Freshness objective** | 2–4 hours from store post to visible in ReviewBox. Encoded as `FRESHNESS_OBJECTIVE_HOURS = 4` — the objective is a named constant, not a number living in a commit message. |
| **Actual cron** | `0 */3 * * *` — every 3 hours, 8 ticks/day, in `vercel.json`. |
| **Derived staleness threshold** | `SUB_DAILY_CADENCE_HOURS = max(0, 4 - 3) = 1h`. **Derived, never chosen.** |
| **Worst-case freshness reasoning** | The coordinator can only act on a tick, so the threshold and the interval **compound**. With cron interval `C`, threshold `h`, and an off-cycle sync landing `s` hours after a tick, the next tick skips the workspace whenever `s > C - h`, putting the following sync `C` later: **worst case `C + h`**. The originally shipped pair (C=3, h=2) gave **5h** — breaching the 4h objective, reached by nothing more exotic than a customer clicking "Sync now" 1–3 hours after a tick. A cron-only workspace (s=0) was always fine at 3h, which is exactly why casual testing would never surface it. Deriving `h = objective - C` fixes it and keeps it fixed: change the cron and the threshold follows. |
| **Idempotency** | Guaranteed twice over — `unique (app_id, external_id)` at the database, and `planSyncWrites()` never downgrading reply state. Raising 1 tick/day to 8 cannot duplicate a review or erase a reply. |
| **Quota placement** | Inside `syncWorkspaceApps()`, **before** the per-app fetch loop, per workspace. The coordinator cannot route around it: every path into a sync goes through `syncWorkspace()`, so an over-quota workspace touches no provider. |
| **Tenant isolation** | Every candidate query is scoped by `workspace_id`; workers are pinned to one workspace and a session caller's `?workspaceId=` is overridden with their own. Covered by `tenant-isolation.test.ts`. |
| **Provider-load behavior** | **Two DB queries per tick, regardless of workspace count**, and no provider is contacted to discover a workspace is not due. Raising the cron 8× therefore costs nothing upstream. The candidate filter is an **optimisation, not a correctness gate**: if the `apps` listing errors, or hits PostgREST's 1,000-row cap, the filter is disabled and every workspace is synced — i.e. exactly the pre-P1-1 behaviour, so it cannot regress. That fail-open matters: the first draft discarded the query error, so a failed listing made every workspace look app-less, queued nothing, and reported "all up to date" — a total sync outage reading as success. |
| **Sync Now production fix** | `/api/sync/reviews` was left in **neither** middleware matcher: P0 correctly removed it from `isPublicRoute` and never added it to `isAppRoute`. On the production app host a path in neither matcher is 307'd to `/dashboard`, returning HTML to a `fetch()` expecting JSON — so Settings → "Sync now" and the dashboard self-heal kick were broken **in production only** (localhost is not `isProd`). This is the **sixth** occurrence of this bug class in this repo. Fixed by adding `"/api/sync(.*)"` to `isAppRoute`, deliberately **not** to `isBilledRoute`: collecting a customer's own reviews is not a metered feature, and a trial-expired workspace still needs its data. |
| **CI configuration fixes** | See below. |
| **Playwright discovery fix** | `playwright.config.ts` never loaded `.env*`, so the skip gate read an empty `process.env`, concluded "placeholder", and skipped all 24 specs **on every developer machine** — for a reason that had nothing to do with the local environment. It now calls `loadEnvConfig()` from `@next/env` (Next's own loader, so test process and app resolve identically, and values already in `process.env` still win — which is what keeps CI's placeholders authoritative). The gate itself also modelled two states where there are three: **no keys at all is not a placeholder** — Clerk's Next SDK falls back to keyless mode in development and the app genuinely works. 20 of 24 specs are real signal in that state, and they were all being thrown away. |

### Defects found inside the surrounding P0 work (all fixed)

1. **`ci.yml` gated a job-level `continue-on-error` on the `secrets` context.**
   GitHub does not permit `secrets` there — it is a workflow **validation**
   error, so **no job in the file starts**. With CI green as this repo's only
   pre-merge gate, a PR carrying zero checks reads as "nothing red" — which is
   precisely how #95 was merged having received 1 of 6 checks. Tolerance moved
   to the step level, driven by a plain `E2E_BLOCKING` variable computed in
   `jobs.<id>.env`, where the context is unambiguously allowed.
2. **`ci-contract.test.ts` had silently stopped guarding anything.** Its
   resolver grabbed the first whitespace-delimited token, so once the Clerk key
   became a `${{ … }}` expression it captured `"${{"` — no placeholder marker,
   so the guard concluded CI had real keys and **both honesty assertions passed
   vacuously**. This is the same vacuous-pass class as the deploy job that
   reported success while shipping nothing.
3. **`e2e-execution-report.mjs` misdiagnosed an infrastructure failure as a
   pass.** A `webServer` timeout produced a report with zero specs collected,
   which fell through to the "specs were skipped" branch and printed "A real
   Clerk key appears to be configured" — while CI was running the placeholder
   pair. Wrong diagnosis and wrong exit code, on the one check whose entire job
   is to describe itself accurately.

### Verification — all re-run 2026-08-21 on the final tree

| Check | Result |
|---|---|
| `npx tsc --noEmit` | **clean**, 0 errors |
| `npx vitest run` | **886 / 886 passed**, 81 files |
| `npm run lint` | **0 errors** (13 pre-existing warnings) |
| `npm run build` | **passing**, 96/96 static pages |
| `npm run test:e2e` (local) | **20 passed · 4 skipped · 0 failed** |
| CI-contract mutation test | **9 / 9 mutations caught** |

One genuine failure was found by this pass and fixed rather than explained
away: `src/eval-exporter-tenant-isolation.test.ts` died with `SyntaxError:
Invalid or unexpected token`. `scripts/eval/export-golden-set.mjs` carried a
shebang, and on a Windows checkout (CRLF) esbuild's shebang stripping leaves
the `#!` in the transformed output, so the whole file fails to load. **Linux CI
is unaffected — it passed 886/886 on the same commit** — which is why the
failure reproduces only on the founder's machine and why a green CI tick would
never have surfaced it. The shebang was redundant anyway (`npm run eval:export`
passes `--experimental-strip-types` explicitly and the file is never executed
directly), so it was removed and the reason recorded in the file.

**The 4 skipped Playwright specs are skipped, not passed.** Three "mocked
inbox" specs and `spine-flow.spec.ts`'s full customer journey need an
authenticated browser session, and **there is no implemented way to create
one.** They were written against a documented mechanism that does not exist:
`NEXT_PUBLIC_BYPASS_E2E` is read only by the tests, never by `src/`, so setting
it changes nothing — middleware redirects to `/sign-in` before any `page.route`
stub is consulted. Its predecessor `BYPASS_AUTH` was **removed as a
red-severity security defect** (SEC-005 / AUD-005), so re-adding an app-side
bypass is explicitly not the fix; `src/e2e-gate-contract.test.ts` fails if one
reappears. **The browser-level spine therefore remains unverified by
automation.** What covers it today is `src/spine-customer-flow.test.ts` at the
unit level and the founder's manual 8/8 walk of `docs/SPINE.md` — neither of
which is a browser test.

The mutation figure is measured, not inherited: nine separate regressions were
introduced one at a time — the job-level `continue-on-error`, a single-key
`E2E_BLOCKING`, a step losing its tolerance guard, a real-looking Clerk key
contradicting CLAUDE.md, CLAUDE.md dropping its "runs NOTHING" declaration, a
spec dropping the shared skip helper, `vercel.json`'s cron drifting from
`SYNC_CRON_INTERVAL_HOURS`, `/api/sync` removed from `isAppRoute`, and an
app-side auth bypass re-added — and each was confirmed to turn its guard red
before the tree was restored. Every guard here is falsified, not trusted.

### Remaining external blockers — none of these is closable in code

1. **Vercel Hobby cannot run the 3-hour cron.** `0 */3 * * *` is rejected at
   **deploy** time — which takes the whole deploy down, not just the cron. Two
   valid production options, founder's call:
   - **A. Vercel Pro ($20/mo).** Works immediately, no code change. Note that
     Hobby's ±59-minute schedule jitter would breach the 4h objective even if
     the interval were allowed, so per-minute precision is a **correctness**
     requirement here, not a nicety.
   - **B. Supabase `pg_cron` + `pg_net` (free).** The extension is already
     enabled and this is the documented zero-cost path (`ZERO_COST_PLAN.md`).
     Needs a SQL job calling `/api/sync/reviews` with the `CRON_SECRET` bearer,
     and `vercel.json`'s cron reverted to daily as a backstop.

     **Not implemented — no `pg_cron` job was written.** Doing so unasked would
     mean an agent authoring SQL for production against D009.

   The cron was deliberately **not** reverted to daily: that would delete the
   feature while looking like a fix.
2. **Clerk test secrets are not configured in GitHub.** Until
   `CLERK_PUBLISHABLE_KEY_TEST` and `CLERK_SECRET_KEY_TEST` exist as repo
   secrets, `E2E_BLOCKING` is false, every spec skips, and the e2e job proves
   nothing — by design, and now it says so instead of showing a green tick.
   Both keys are required: gating on the publishable key alone made the steps
   blocking while the report script still classed the run as a declared skip,
   producing a green blocking check that proved nothing. HUMAN-REQUIRED,
   ≈10 minutes, tracked as BUG-037.
3. **The authenticated browser-level spine needs real Clerk Testing
   infrastructure** — `@clerk/testing/playwright` (not installed), a Clerk
   *development* instance, and a test user. This is the only supported route;
   the alternative was removed as a security defect.
4. **CI verification now depends on the pushed branch and on repository
   configuration** — branch protection, whether Actions runs on this ref, and
   the secrets above. A workflow that parses is not a workflow that ran, and a
   job that is green is not a job that executed anything. Both mistakes are on
   this repository's record (Part 4).

### Also deliberately left open

- **`CRON_SECRET` is now load-bearing.** The P0-4 middleware change means an
  unset secret in production bounces the cron **and its entire worker fan-out**
  through Clerk — nothing syncs. The backlog records it as set (N-CRON,
  2026-05-26); the failure mode is silent, so confirm it in Vercel.
- **No backoff for permanently failing apps.** `last_synced_at` only advances
  on success — correct, since dropping them would strand the customer — so a
  delisted app is now retried 8×/day instead of once. Harmless at this scale.
- **Quota-exhausted workspaces are still fanned out 8×/day**, each worker doing
  two queries and returning 402. Correct, but wasteful.
- **The `apps` candidate listing is capped at 1,000 rows** by PostgREST's
  default. Past that it truncates and the filter disables itself with an error
  log rather than silently skipping workspaces. The fix when it matters is
  keyset pagination, not a queue.

---

## Recommended order of work

*Original ordering, annotated 2026-08-21 with what has since happened.*

0. ~~**Merge the CI fix**~~ — **done**, and then fixed again twice: the job-level
   `continue-on-error` that would have stopped every job from starting, and the
   contract test that had gone vacuous. **Still outstanding:** add Clerk test
   credentials as repo secrets (BUG-037) so the e2e job can block. Blocker 2 in
   Part 6.
1. ~~**Walk the spine**~~ — **done 2026-08-19, 8/8, by the founder against a real
   app.** One follow-up is still unwalked: that a replied status survives the
   *next* sync. The code defends it; nobody has watched it.
2. **Decide G-2** — **half closed.** P0-2 fixed storefront propagation, so the
   data is now correct. The *disclosure* choice (option (b), honest UI
   labelling) is untouched and still a founder decision.
3. **Write the one e2e test** that covers sync → draft → mark replied → sync
   again — **written, and it does not run.** `tests/e2e/spine-flow.spec.ts`
   exists and is **skipped**, because nothing can authenticate a Playwright
   session (Part 6, blocker 3). `src/spine-customer-flow.test.ts` covers the
   same contract at the unit level. That is not the same net.
4. ~~**Move sync to `pg_cron`** for sub-daily latency (G-5)~~ — **superseded by
   P1-1.** The application side is done and verified; what remains is choosing
   between Vercel Pro and `pg_cron` for the schedule itself. Part 6, blocker 1.
5. **Then, and only then, reverse D013** and turn on Stripe. Unchanged — and
   P0-1 has made the unconfigured state safe in the meantime.
6. Feature work resumes after 1–5. Not before — the backlog is currently ranked
   by ICE, and ICE has no term for "the core loop is broken."

**Next engineering task: P1-2 — Multilingual AI Reply Generation.** Not started.

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
| `.github/workflows/ci.yml` | Trigger fixed (`main` → `master` + unfiltered PRs); Clerk key made decodable; audit blocks on critical, high advisory; e2e advisory pending real Clerk secrets |
| `package-lock.json` | `npm audit fix` — 27 advisories → 16, all remaining need semver-major or have no fix |

**Verification:** `tsc` 0 errors · 92 unit tests passing (80 → 92) · `eslint`
0 errors · production build passing.

**Not verified:** none of this has been exercised against a real app or a real
database. That is what step 1 above is for.
