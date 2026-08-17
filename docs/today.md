# Today — 2026-08-17 (audit remediation, Waves 1–6 — complete)

**State of master:** healthy, `dfdde19`. Production deploys green. `tsc` clean,
lint 0 errors, full `next build` passes, **481 unit tests**.

All six waves merged: **#97, #98, #99, #101, #102, #105**. Migrations **025–030
applied and verified by query.**

**One audit finding remains open, and it needs the founder:** W5A, the
review-volume limit — `docs/adr/009-review-volume-limit.md`.

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

## Up next

1. **LT1** — sweep every write for the PGRST204 class. ICE 72, highest queued.
2. **CM1** — multi-language reviews + replies. ICE 60, and the same class of
   blind spot as the US-storefront bug one layer up.
