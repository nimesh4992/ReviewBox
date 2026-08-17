# Today — 2026-08-17 (audit remediation, Waves 1–5)

**State of master:** healthy, `a6bf2ee`. Production deploy green. `tsc` clean,
lint 0 errors, full `next build` passes, **469 unit tests**.

Waves 1–4 are merged (#97, #98, #99, #101). **Wave 5 is on
`claude/wave5-sync-lock-and-mediums`.**

---

## Where the waves came from

A full architecture + code-quality audit (33 findings) ran against master and
was remediated in four waves. Wave 5 is the tail: the concurrency item that
everything else was waiting on, plus the Mediums that were left after the
Criticals and Highs shipped.

| Wave | PR | The thing worth remembering |
|---|---|---|
| 1 | #97 | Migration 002's CHECK constraint rejected `free` and `enterprise`, so **no trial had ever expired**. 136 green tests defended the broken behaviour, because TypeScript cannot see a SQL constraint. |
| 2 | #98 | Decomposed the two files behind seven merge outages: `review-queue.tsx` 1,971 → 626 lines, `dashboard/page.tsx` 991 → 679. |
| 3 | #99 | Made the vacuous checks honest — the e2e job now prints "0 of 23 specs executed — SUITE DID NOT RUN", and a blocking test fails if CLAUDE.md claims otherwise. |
| 4 | #101 | App Store replies were stored as `replied` with permanently blank text; four PATCH routes answered 500 where they meant 404. |

---

## What ships in Wave 5

### The sync lock (backlog AS1 — the item `auto_reply` was blocked on)

`src/lib/sync-lock.ts`. Redis `SET NX EX 90`, released with a Lua
compare-and-delete. Wired **inside `syncWorkspace()`**, not at the four call
sites, so a fifth trigger can't bypass it — the unlocked body is now a private
`syncWorkspaceApps()` and is not exported. A declined run returns
`skipped: "already_running"` and is *not* an error.

Two corrections to what the backlog item claimed was at risk, because getting
this wrong in a comment is how this codebase's bugs survive:

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
today's behaviour, whereas a lock that can take review sync offline during an
Upstash blip is a worse trade. **That is why this does not by itself make
`auto_reply` safe to enable** — publishing to a live listing needs an answer
for "what happens when Redis is down", not just a lock.

One knock-on, handled: a declined sync in `POST /api/apps` could leave a newly
added app unsynced if the run holding the lock had already loaded the app list.
That path now retries up to 3× with 12s spacing, inside its `maxDuration = 60`.
The onboarding routes don't need it — nothing else can hold the lock of a
workspace that is seconds old.

### The remaining Mediums

- **M-2 — two copies of one read.** The incident detail page and
  `GET /api/incidents/[id]` each had their own hand-picked column list
  (`select("*")` vs nine named columns). Now one `getIncidentDetail()` in
  `src/services/incident-service.ts`, with a test that fails if either caller
  grows its own query again.
- **M-8 — Slack connect looked successful when it wasn't.** The second write
  (`workspaces.slack_webhook_url`) was unchecked, and `notifySlack()` reads
  *only* that column. A failure there gave a green "Connected" state and
  silently no-op'd every future alert forever. Both writes now check and
  report.
- **M-3 / M-4** — migrations 027 and 028, below.
- **M-6** — a founder decision, not mine. See below.
- **M-7 was already fixed** (both sites use the canonical helpers), and **M-9
  shipped in Wave 2**. Verified, not assumed.

---

## Founder actions

### ✅ 1. Migrations 026–029 — DONE 2026-08-17, verified by query

All four applied. `pg_policies` returns zero `auth.uid()` rows; all nine tenant
columns report `is_nullable = NO` with nothing skipped.

**The 029 diagnostic returned zero rows** — no review on this database had ever
been stored as `replied` with a blank reply. So the App Store defect PR #101
fixed never persisted a bad row here, Section A was a no-op, and Section B never
ran. Nothing to chase; don't go looking for it later.

*(Original instructions kept below for the record.)*

### ~~1. Migrations 027–029 — paste in Supabase, any order, all idempotent~~

- **027 `rls_identity_reconcile`** — two policies
  (`automation_execution_logs`, `competitor_apps`) compare against
  `(auth.uid())::text`, which is Supabase-native auth. This product uses Clerk,
  whose subject isn't a uuid. Dormant today (nothing reaches RLS — every route
  uses the service-role client), which is exactly why it's worth removing: it
  springs on whoever first writes a client-side read and trusts it.
- **028 `tenant_columns_not_null`** — `NOT NULL` on the nine tenant-scoping
  columns migration 001 left nullable. **Self-checking**: if any NULL rows
  exist it prints a notice and skips that column rather than failing, so a
  paste never half-applies. Includes the repair query for orphaned reviews.
- **029 `repair_blank_replies`** — repairs rows already stored as `replied`
  with no text (#101 stopped new ones only).
  **Section A runs automatically** — `replied_at IS NOT NULL` + blank text is a
  shape only the bug produces.
  **Section B is commented out on purpose.** Those rows are indistinguishable
  from a deliberate bulk "mark as replied" (D018 Draft Mode), which also leaves
  `reply_text` and `replied_at` null. Run the diagnostic SELECT first; if
  you've never used bulk mark-as-replied, the whole set is safe to reset.

### 2. Decide the review-volume limit — `docs/adr/009-review-volume-limit.md`

`reviewsPerMonth` is advertised on `/pricing` and Billing and enforced nowhere.
Three options; recommendation is **B — soft cap** (never stop ingesting, show
an upgrade banner over the limit). Option A (hard-stop at sync) is written up
specifically as the one not to take: it stops the customer seeing their own
1★ reviews, which reads as the product breaking. D009 puts this with you.

### 3. Still outstanding from earlier waves

- **BUG-037** — Clerk test keys into GitHub Actions secrets (~10 min). Turns
  23 skipped e2e specs into real ones.
- **2026-08-30** — FieldLog's trial lapses. It's the only workspace with a
  `trial_ends_at`; the other three are `null` and the expiry cron excludes
  nulls, so they're on permanent trials. Backfilling those is a pricing call.
- After 029, verify via **Settings → Apps → Sync now** on the App Store app.

---

---

## Wave 6 — the audit tail

Everything left after Waves 1–5, except M-6 (a pricing decision, yours).
Checked first rather than assumed: **M-1, M-7, M-9, M-11, M-12, M-13, L-1, L-3
and L-5 were already fixed** in earlier waves. What actually remained:

### L-6 — three copies of "who do I email about this workspace"

`weekly-digest`, `trial-nudge` and `health/user-check` each answered this
differently, and the first two did it **one workspace at a time inside a loop**
— two round trips per workspace. Now one `resolveWorkspaceOwners()` in
`src/lib/owner-emails.ts`: one member query, one Clerk call per 100 workspaces.

The N+1 costs nothing at four workspaces, which is why it survived. It stops
being free at the scale weekly-digest's own comment is written for ("200+
workspaces"): 200 sequential Clerk calls inside a 60s function sends to the
first sixty owners and times out — while still answering 200, because
`Promise.allSettled` reports a cancelled batch exactly like a workspace with
no reviews.

**Also fixes a latent cliff.** The one already-batched copy passed
`limit: clerkIds.length` to `getUserList` with no bound. Clerk caps `limit` at
500, so it was correct only while the account stayed under 500 workspaces. The
shared version chunks at 100.

Behaviour is preserved exactly: `trial-nudge` was the only one that fell back
to a non-owner member when a workspace had no owner row, and it keeps that via
an explicit flag. This was a de-duplication, not a decision about who gets mail.

### M-10 — the Retry button that couldn't report a failure

`handleRetry()` fired an un-awaited fetch with **no `.catch()` at all**, then
refetched on a blind 3-second timer. This is the button shown *when a sync has
already failed*, so it was the one place a second failure most needed to be
visible. It now awaits, surfaces the error, refetches when the sync actually
finishes, and says so when the run was declined by the sync lock.

The busy/message state lives in `workspace-status-strip.tsx`, not in
`dashboard/page.tsx` — that file has been mangled by bad merges six times, and
widening its component signatures is how that keeps happening. The page hands
over one async function and nothing else.

### L-4 — inbox search had two silent failures

Converted from a hand-rolled `useEffect` + `fetch` + cancellation flag to
`useQuery`. The conversion is not the point; the shape it replaced is:

1. It never checked `res.ok`, so a 500 parsed into the error envelope,
   `data.reviews` came back undefined, `?? []` turned it into an empty array —
   and a failed search rendered as **"0 reviews", identical to no matches**.
2. Its `.catch()` reset to null, silently reverting to client-side filtering of
   the loaded page — a network failure looked like a working search over a much
   smaller set.

Both are now visible.

### L-2 — a constraint that does the opposite of its comment

`workspace_invites` has `unique (workspace_id, email, accepted_at)` commented
"unique while pending". NULLs are distinct in Postgres and `accepted_at` is
NULL for every pending invite, so it fires only for accepted ones. Migration
**030** adds the partial unique index. The invite route now answers 409 with a
readable sentence instead of 500 when two admins invite the same person at once.

---

## Up next

1. The two founder decisions above (W5A, W5B in the backlog).
2. **LT1** — sweep every write for the PGRST204 class. ICE 72, highest queued.
3. **CM1** — multi-language reviews + replies. ICE 60, and the same class of
   blind spot as the US-storefront bug one layer up.
