# Today — 2026-08-17 (audit Waves 1–6, LT1, a live-testing round, then the overnight queue)

**State of master:** healthy, `0c7a74d`. **Production deploy green and current.**
`tsc` clean, lint 0 errors, full `next build` passes, **539 unit tests**.

Audit waves merged: **#97, #98, #99, #101, #102, #105** (+ #103, #106 docs).
Migrations **025–030 applied and verified by query.** **LT1** — the PGRST204
write sweep — shipped after them.

Then a founder testing round produced **#108, #109, #110** and a platform
finding that became **ADR 010**. See "Live-testing round" at the end.

**Overnight session (founder asleep, standing merge-on-green authority):**
**#112** (W6C), **#113** (review-history docs), **#114** (AU4), **#115** (deploy
quota). All merged and deployed. See "Overnight queue" below.

**Two audit findings remain open and both need the founder:** W5A
(`docs/adr/009-review-volume-limit.md`) and W6B (ADR 010's four questions).

---

## Overnight queue — 2026-08-17 night

### The one that mattered most: production stopped shipping

**#113 and #114 merged green and did not reach production.** Vercel's free plan
caps upload API requests at ~5,000 per rolling 24h, shared across all deploys;
each deploy of this app uploads thousands of files. The evening's merge cadence
exhausted it.

Two things made it worse than the outage itself:

1. **It reads as a flake.** The CLI retries ~12 times and prints a generic
   `Error: Upload aborted` stack for each, so the one actionable line
   (`more than 5000, code: "api-upload-free"`) is at the *head* of ~40 lines of
   noise. I re-ran the job before reading it. It failed identically — a quota is
   not a blip.
2. **Nothing said which commit was live.** A red deploy reads as "CI problem",
   not "production is running older code".

Fixed in **#115**: `--archive=tgz` (one tarball per deploy instead of thousands
of requests) plus a step summary that leads with *"this commit is NOT in
production"* and the real error. Deploy went green immediately after; all four
merges are live. Known Issues entry added to `CLAUDE.md`.

**Lesson for the loop:** merging many PRs in one evening has a cost that is
invisible until it isn't. Watch the deploy job, not just CI.

### #112 — W6C, the storefront ranking never ran

#109's most-reviews-wins ranking was unreachable on the one path that decides an
app's storefront for life. `resolveAppMetadata` fetched the onboarding search's
hint and returned the moment it answered; onboarding *always* supplies a hint and
search tries `us` first. That is the mechanism that pinned Mumbai One to `us`.
The hint is now a candidate, not a verdict.

### #113 — the review-history limit, documented where customers hit it

New `/help/review-history`, two FAQ entries, a "Why not all 2,945?" link on the
dashboard beside the synced count, and the API facts in `PRODUCT_CONTEXT.md`.

**Correction it carries:** the ~200 ceiling is *not* symmetric across stores.
Google's `reviews.list` has no date parameter — a genuine wall. App Store Connect
paginates properly and our own `fetchReviews()` defaults to `limit = 200`. **On
iOS the ceiling is ours.** Filed as **W6D**; the help page says so in those words
rather than blaming Apple.

No retention policy was published: ADR 010 is still `Proposed` with four open
questions, and putting "365 days" on the public site would commit to behaviour
that isn't built.

### #114 — AU4, a failed load no longer renders as an empty state

ASO, Sentiment, Competitors and both Reply Kit tabs treated a 500 as "no data".
The copy is what made it expensive — not "nothing here" but *"No gaps found — all
top phrases are already tracked"*, *"No templates yet. Create your first one
above"*, *"Add competitor · coming soon"*. Two invite the customer to rebuild a
library they still have; one denies a shipped feature exists.

**The Reply Kit root cause was a layer below the backlog item's description.**
Those tabs did `fetch().then(r => r.json()).catch(console.error)`. These routes
return a JSON error envelope on 500, so `res.json()` **resolves** — the promise
never rejects and the `.catch` was *unreachable dead code* for every HTTP
failure. Their mutation handlers already checked `res.ok`, which is exactly why
the load path's omission survived review.

12 contract tests, each mutation-verified.

---

---

## Where the waves came from

A full architecture + code-quality audit found 33 defects across 15 areas. They
were remediated in six waves, ordered by blast radius rather than by severity
label.

| Wave | PR | The thing worth remembering |
|---|---|---|
| 1 | #97 | Migration 002's CHECK constraint rejected `free` and `enterprise`, so **no trial had ever expired**. 136 green tests defended the broken behaviour, because TypeScript cannot see a SQL constraint. |
| 2 | #98 | Decomposed the two files behind seven merge outages: `review-queue.tsx` 1,971 → 626 lines, `dashboard/page.tsx` 991 → 679. |
| 3 | #99 | Made the vacuous checks honest — the e2e job now prints "0 of 23 specs executed — SUITE DID NOT RUN", and a blocking test fails if CLAUDE.md claims otherwise. |
| 4 | #101 | App Store replies were stored as `replied` with permanently blank text; four PATCH routes answered 500 where they meant 404. |
| 5 | #102 | The per-workspace sync lock (AS1), plus M-2/M-3/M-4/M-8 and migrations 027–029. |
| 6 | #105 | The tail: batched owner-email lookups, and three more silent failures. |

---

## Wave 5 — the sync lock and the Mediums

### The sync lock (backlog AS1 — what `auto_reply` was blocked on)

`src/lib/sync-lock.ts`. Redis `SET NX EX 90`, released with a Lua
compare-and-delete. Wired **inside `syncWorkspace()`**, not at the four call
sites, so a fifth trigger can't bypass it — the unlocked body is the private
`syncWorkspaceApps()` and is not exported. A declined run returns
`skipped: "already_running"` and is *not* an error.

Two corrections to what the backlog item claimed was at risk, because being
wrong in a comment is how this codebase's bugs survive:

- **Review rows were never at risk.** `unique (app_id, external_id)` plus
  `ignoreDuplicates: true` on the upsert already handle it.
- **Spike alerts were never at risk.** Email and Slack each take their own
  Redis `SET NX` claim per app+version.

What *is* at risk under a concurrent sync: `runAutomationRules()` executing
twice over the same reviews (two Groq calls, `times_run` double-counted, two
execution-log rows), `enrichOnboarding()` double-filling a new workspace's
knowledge base past its read-then-write guard, and every store fetch happening
twice against a shared egress IP. And the one that isn't internal —
`auto_reply` publishing two different AI replies to one live store listing.

**The lock fails open** when Redis is unreachable: an unlocked sync is exactly
the prior behaviour, whereas a lock that takes review sync offline during an
Upstash blip is a worse trade. **That is why AS1 shipping does not by itself
make `auto_reply` safe to enable** — publishing to a live listing needs an
answer for "what happens when Redis is down", not just a lock.

One knock-on, handled: a declined sync in `POST /api/apps` could leave a newly
added app unsynced if the lock holder had already loaded the app list. That path
retries on a **time budget** — another attempt starts only while a full sync's
worth of the route's 60s remains, because an attempt frozen mid-sync leaves the
app showing "sync attempted but no result recorded", which is worse than not
retrying. The onboarding routes don't need it: nothing else can hold the lock of
a workspace that is seconds old.

### The Mediums

- **M-2 — two copies of one read.** The incident detail page and
  `GET /api/incidents/[id]` each had their own hand-picked column list
  (`select("*")` vs nine named columns). Now one `getIncidentDetail()` in
  `src/services/incident-service.ts`, with a test that fails if either caller
  grows its own query again.
- **M-8 — Slack connect looked successful when it wasn't.** The second write
  (`workspaces.slack_webhook_url`) was unchecked, and `notifySlack()` reads
  *only* that column. A failure gave a green "Connected" state and silently
  no-op'd every future alert forever. Both writes now check and report.
- **M-3 / M-4** — migrations 027 and 028.
- **M-6** — a pricing decision, not mine. ADR 009.

---

## Wave 6 — the audit tail

Checked first rather than assumed: **M-1, M-7, M-9, M-11, M-12, M-13, L-1, L-3
and L-5 were already fixed** in earlier waves. Four genuinely remained.

### L-6 — three copies of "who do I email about this workspace"

`weekly-digest`, `trial-nudge` and `health/user-check` each answered this
differently, and the first two did it **one workspace at a time inside a loop**.
Now one `resolveWorkspaceOwners()` in `src/lib/owner-emails.ts`: one member
query, one Clerk call per 100 workspaces.

The N+1 costs nothing at four workspaces, which is why it survived. It stops
being free at the scale weekly-digest's own comment is written for ("200+
workspaces"): 200 sequential Clerk calls inside a 60s function sends to the
first sixty owners and times out — while still answering 200, because
`Promise.allSettled` reports a cancelled batch exactly like a workspace with no
reviews.

**Also fixes a latent cliff.** The one already-batched copy passed
`limit: clerkIds.length` to `getUserList` unbounded. Clerk caps `limit` at 500,
so it was correct only below 500 workspaces. The shared version chunks at 100.

Behaviour preserved exactly: `trial-nudge` was the only caller that fell back to
a non-owner member, and it keeps that behind an explicit flag. A de-duplication
is not the place to change who receives mail.

### M-10 — the Retry button that couldn't report a failure

`handleRetry()` fired an un-awaited fetch with **no `.catch()` at all**, then
refetched on a blind 3-second timer. This is the button shown *when a sync has
already failed*, so it was the one place a second failure most needed to be
visible. It now awaits, surfaces the error, refetches when the sync actually
finishes, and says so when the run was declined by the lock.

Busy/message state lives in `workspace-status-strip.tsx`, not
`dashboard/page.tsx` — that file has been mangled by bad merges six times, and
widening its component signatures is how that keeps happening.

### L-4 — inbox search had two silent failures

Converted to `useQuery`. The conversion isn't the point; the shape it replaced
is: it never checked `res.ok`, so a 500 rendered as **"0 reviews", identical to
no matches**; and its `.catch()` silently reverted to client-side filtering of
the loaded page, so a network failure looked like a working search over a much
smaller set.

### L-2 — a constraint that does the opposite of its comment

`workspace_invites` has `unique (workspace_id, email, accepted_at)` commented
"unique while pending". NULLs are distinct in Postgres and `accepted_at` is NULL
for every pending invite, so it fires only for accepted ones. Migration 030 adds
the partial unique index; the invite route answers 409 with a readable sentence
instead of 500 when two admins invite the same person at once.

---

## ✅ Migrations — all applied 2026-08-17, verified by query

| | Result |
|---|---|
| 025 plan vocabulary | constraint allows `free`…`canceled` |
| 026 drop dead alert columns | applied |
| 027 RLS identity | **zero** policies mention `auth.uid()` |
| 028 tenant NOT NULL | all nine columns `is_nullable = NO`, nothing skipped |
| 029 blank-reply repair | **diagnostic returned zero rows** — no bad row ever existed |
| 030 pending-invite uniqueness | `workspace_invites_one_pending_idx` exists, no duplicates found |

Two of these are worth remembering rather than re-deriving:

- **029 found nothing.** The App Store defect PR #101 fixed never persisted a
  bad row on this database. Don't go looking for a repair that was never needed.
- **028 changes what a bug looks like.** An insert on `apps`, `reviews`,
  `automation_rules`, `reply_templates`, `knowledge_base`, `ai_usage`,
  `incidents` or `alert_preferences` that omits `workspace_id` now fails at the
  database instead of silently creating a tenant-less row. That is the point —
  but it means such an error is a bug in the new code, not in the schema. All 12
  existing write sites were checked before it was applied.

---

## Founder actions still open

1. **W5A — decide the review-volume limit.** `docs/adr/009-review-volume-limit.md`.
   `reviewsPerMonth` is advertised on `/pricing` and Billing and enforced
   nowhere. Recommendation is **B — soft cap** (never stop ingesting, show an
   upgrade banner). Option A, the hard stop at sync, is written up specifically
   as the one not to take: it stops a paying customer seeing their own 1★
   reviews, which reads as the product breaking. D009 puts this with you. Worth
   settling before Stripe goes live. **This is the last open audit finding.**
2. **BUG-037 — Clerk test keys into GitHub Actions secrets** (~10 min). Turns 23
   skipped e2e specs into real ones, and unblocks M-14.
3. **2026-08-30 — FieldLog's trial lapses.** It's the only workspace with a
   `trial_ends_at`; the other three are `null` and the expiry cron excludes
   nulls, so they're on permanent trials. Backfilling those is a pricing call.

## Deliberately not done

- **`auto_reply` stays off.** The lock was its prerequisite, not its approval —
  see the fail-open note above.
- **M-14 (e2e coverage gaps)** is blocked behind BUG-037. Playwright can't run
  in the agent environment, and shipping tests that cannot be executed is the
  same class of defect this audit flagged in H-8.

---

## LT1 — the PGRST204 write sweep (shipped 2026-08-17)

Every write that touches a column added to an **already-existing** table now
states what happens when that column is unavailable, and
`src/schema-write-contract.test.ts` fails the build when a new write doesn't.

**The backlog item's "Done when" was wrong, and following it literally would
have caused a bug.** It said to route every such write through
`writeWithOptionalColumns()`. That helper *drops* the column and continues —
right when the column is enrichment, catastrophic when the column IS the write:

- dropping `deleted_at` from "cancel my account" leaves the account live while
  the API reports it cancelled;
- dropping `slack_webhook_url` from "connect Slack" recreates M-8 exactly.

So most sites got the opposite treatment — a new `migrationPendingError()` that
returns **503 MIGRATION_PENDING** with an accurate sentence instead of
"Something went wrong on our end. We've been notified" (which was also untrue;
those branches notify nothing). Exactly one site wanted the retry helper: the
reply save, where `draft_source`/`draft_edited` rode in the same payload as
`reply_text` and could take the customer's reply down with them — after it may
already be live on the store.

Two writes turned out not to be checked at all: **Slack disconnect** (the
mirror of the connect-side bug fixed in Wave 6 — a failed clear meant alerts
kept arriving for someone who had just turned them off) and
**test-credentials** (`publisher_api_connected`, where losing the flag means
the customer passes the connection test and still sees "connect your Play
Console" forever, with the test reporting success every retry).

**The "pending migration" framing is now stale.** All migrations are applied.
PGRST204 also fires when the column exists but PostgREST hasn't reloaded its
schema cache — so this window reopens on every future migration. It's a
property each write keeps, not a cleanup that finishes.

The enforcing test was itself mutation-tested, and the first version failed:
deleting a `writeWithOptionalColumns` call left the words
"`writeWithOptionalColumns`" in the comment above it, and the substring check
stayed true. It now blanks comments before looking. A guard you can satisfy by
mentioning it is not a guard.

## Up next

1. **CM1** — multi-language reviews + replies. ICE 60, and the same class of
   blind spot as the US-storefront bug one layer up.
2. **AU4** — finish the swallowed-error sweep on the remaining screens.


---

## Live-testing round — 2026-08-17 evening

Founder tested production with screenshots. Five reported items, plus two bugs
and one platform limit found while investigating.

### #108 — Inbox counts described the loaded page, not the app

`/api/reviews` is cursor-paginated at 20 and returns no total, and the Inbox
computed every number on screen from the loaded rows. An app with 260 reviews
and 117 unreplied read "All · 20 / Unreplied · 20" while the sidebar badge two
inches away said 117.

Counts now come from `/api/dashboard/metrics` — the source the sidebar already
used — so the two cannot disagree. `lowRatingCount` added there, next to its
siblings, rather than a second implementation inside `/api/reviews` (that would
have been M-2 again). Header reads "Showing 20 of 260".

The chips also filtered the loaded page: "App Store" under All apps matched none
of the first 20 and fell through to an empty state reading "Connect an app in
Settings" — on a workspace with 130 reviews. Chips are lifted to the page so
they drive the fetch, and the empty state has a fourth branch.

Two traps found on the way: `/api/reviews` mapped **every** unrecognised
platform value — including `google_play`, the value the database stores — to
App Store; and the rating filter was exact-match, so "1–2 ★" would have dropped
every 1-star review.

### #109 — Home storefront by review count, plus a Settings override

Both stores publish **per-country ratings**. `findAppAcrossStorefronts` took the
first storefront that answered and `us` is first, so any app merely *visible* in
the US claimed it. Mumbai One read 4.3 (US) instead of 3.1 (India).

Now ranks by review count, with a manual override in Settings → Apps. **The
override is what fixed the founder's app** — after setting India, the dashboard
read 3.15 ★ / 2,945 ratings against Play Console's 3.133 / 2,946.

**A gap in this fix, still open:** `resolveAppMetadata` short-circuits on the
search's storefront hint and returns before the ranking runs. At onboarding
there is always a hint, so the new ranking never runs for a newly added app —
which is how the app was pinned to `us` in the first place.

### #110 — The AI summary blamed the data for its own failure

"Not enough recent review data to generate a summary" appeared under the panel's
own "Based on 50 recent reviews", on 202 reviews. Three exits shared one
sentence: no reviews, an empty completion, and a thrown request. Groq's free tier
rate-limits in bursts, so the failing path is the expected one. Now
distinguished, and failures are logged.

### The platform limit — ADR 010

Play Console reports 2,064 ratings-with-reviews; we hold 202. **Not reachable.**
Verified against the installed API definitions: `androidpublisher` v3 has no
ratings/statistics/reports resource, and `reviews.list` has **no date
parameter** — older reviews cannot be requested. `playdeveloperreporting` is
vitals only.

**AppFollow holds 272 for the same app.** The limit is universal. Full history
exists only in Play Console's Download reports (a GCS bucket), which nobody in
the category appears to use.

`docs/adr/010-review-history-and-retention.md` records this plus the founder's
retention model, and carries **four open questions** that need answering before
it is built — including whether retention replaces the W5A volume cap.

### Corrections I made during this round

Recorded because each one was stated confidently and was wrong:

- **"202 vs 2.9k is ratings vs reviews"** — no. 2,064 have text. The gap was real.
- **"The review count won't parse; Google abbreviates it as 2.9K"** — no. That
  came from AppFollow's *rendering*, not Google's HTML. The India listing gave
  2,945 exactly, and the caveat I wrote into #109's comments and tests about the
  ranking being inert for Play is contradicted by that. **Still to fix.**
- **"3.1 is India's rating"** — Play Console calls 3.133 the *default* Google
  Play rating. Close to India's because India dominates this app, not the same
  thing.

### Open from this round

1. **ADR 010's four questions** — hide vs delete at 365 days, free-tier
   behaviour, capture-date vs review-date, and whether retention replaces W5A.
2. **The `resolveAppMetadata` short-circuit** — the ranking never runs at
   onboarding.
3. **The stale caveat in #109** about Play never yielding a review count.
4. **Show the detected storefront during onboarding** — confirm, don't ask.
5. **Docs pass** — PRODUCT_CONTEXT, `/help/review-history`, `/faq`, and a link
   at the point where the two numbers differ.
