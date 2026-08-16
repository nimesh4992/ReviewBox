# Today — Handoff for next agent

**Last updated:** 2026-08-16 (session 2 — live founder testing round)
**State:** PR #85 **MERGED to master** (e69aa79). 13 defects fixed across
onboarding, the inbox, replies, sentiment and the dashboard. Migration 022
applied to production by the founder. PRs #77–#84 also merged earlier today.

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/PRODUCT_CONTEXT.md`** — who the customer is; an audit without it can only find inconsistency
3. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (never-do list) are critical.
4. **`docs/backlog.md`** — ICE-ranked queue
5. **This file (`docs/today.md`)** — last session's handoff

---

## The lesson from this session: read the failure, don't infer it

Every bug below was found by the founder using the product and sending a
screenshot. Not one was found by reading code, and several had **survived
multiple audit rounds** because they are invisible in code review:

- A fallback that reads correctly but is gated on an error code the failing
  path never emits (PGRST204 vs 42703).
- A boolean that is not wrong so much as *asking a different platform's
  question* (`has_credentials` on Google Play).
- A spinner whose end condition can never occur.

The pattern: **each one is a check against a value that looks right and is the
wrong value entirely.** Grepping for the symptom finds nothing, because the
code says what it means to say. What breaks them is a mismatch between two
layers — Postgres vs PostgREST, App Store vs Play auth, display string vs DB
enum — and only running the thing surfaces that.

When a screenshot arrives, resist the first plausible theory. Twice this
session the first theory was wrong and the Vercel log settled it in one line.

---

## What shipped (PR #85, merged 2026-08-16)

### 1. Onboarding 500'd for **every** new signup — nobody could sign up

Production log:

```
[onboarding/setup] app insert: {
  code: 'PGRST204',
  message: "Could not find the 'store_country' column of 'apps' in the schema cache"
}
```

`apps.store_country` (migration 019) had never been applied to production. The
route *already had* a "retry without the metadata columns" fallback for exactly
this — gated on Postgres error **42703**.

**A write never produces 42703.** PostgREST validates an INSERT payload against
its own cached copy of the schema *before* it builds any SQL and rejects it
itself with **PGRST204**; Postgres never sees the statement. Reads produce
42703, writes produce PGRST204.

**Every degrade-on-pending-migration fallback in this repo was written against
42703 alone**, so on the write path none of them had ever been reachable.

- `src/lib/db-errors.ts` (new) — `isMissingColumnError` accepts both codes;
  `isMissingTableError` accepts 42P01 **and** PGRST205. Use these, never a bare
  code comparison.
- `writeWithOptionalColumns()` replaces the all-or-nothing retries: it reads
  the offending column out of the error message and drops **only that one**.
  The old fallbacks discarded the icon, developer and rating because one
  *other* column was missing.
- `/api/admin/probe/schema` probed reads only, so it would have reported
  `store_country` as healthy while onboarding was down. It now also reads
  PostgREST's schema cache via the OpenAPI document and distinguishes *column
  missing* (run the migration) from *column present but uncached* (run
  `notify pgrst, 'reload schema'`).
- `supabase/migrations/022_app_column_catchup.sql` — idempotent `ADD COLUMN IF
  NOT EXISTS` for every `apps`/`workspaces` column the code writes, plus the
  cache reload. **Applied by the founder.**

### 2. Passing the Google Play connection test marked the app *broken*

The setup modal said "Connection verified! You're ready to sync." while the
banner behind it said "Mumbai One can't sync yet · Finish setup".

Verification writes `last_sync_status: "credentials_verified"`. The dashboard
decided "is this app broken?" with `status !== "success"`, which classifies
that value as a failure. The single action that proves the connection works was
the action that marked it broken — and reloading didn't help, because the
database genuinely held that value. `/api/health/user-check` already had the
correct list of healthy statuses; the dashboard never got it.

`src/lib/sync-status.ts` (new) now owns that judgement. Unknown statuses count
as failures, so a status added later fails loudly rather than reading healthy.
The modal also never invalidated the `["apps"]` query after verifying, so the
banner would have stayed stale until a full reload regardless.

### 3. No Google Play customer was ever offered one-click reply posting

The reply pane offered "Copy reply" and "Paste into Google Play Console, then
mark it replied here" — the exact manual work the product exists to remove.

```ts
canPostViaApi = composerApp.has_credentials   // = !!(access_token && refresh_token)
```

That is the **App Store's** per-app `.p8` key pair. Google Play never writes
those columns — its auth is the workspace service account
(`GOOGLE_CLIENT_EMAIL` / `GOOGLE_PRIVATE_KEY`) once invited to Play Console,
recorded in `publisher_api_connected`. So the check was **structurally false
for every Play app in every workspace**: not a state a customer was in, a state
no Android customer could ever leave.

The server has been able to do this the whole time — `POST
/api/reviews/[id]/reply` branches on platform and posts Play replies through
the service account without touching `access_token`. Bulk "Reply all" always
posted via the API. So two paths in the same product disagreed about whether
one app could reply.

`canPostRepliesViaApi(app)` in `lib/sync-status.ts` asks the right question per
platform; the composer and the Settings badge both use it. Unknown platforms
fail closed.

### 4. Settings called every Google Play app "Connected" before it was

`has_credentials || platform === "google_play"` — green tick from the moment an
app was added, nothing granted. The dashboard's warning was closer to the truth
than the badge. Now three honest states: **Connected** (can post replies) ·
**Public data only** (scraping the public listing, replies not possible yet —
the state most new workspaces are actually in, previously unrepresented) ·
**Needs setup**.

### 5. Inbox was empty until you picked an app by hand

`/app/(app)/inbox/page.tsx` passed the persisted `selectedApp` value straight
to the API instead of through `resolveSelectedApp()` — the function whose
docstring exists to prevent precisely this. The stored value outlives the app
it points at: disconnect an app and the id stays in localStorage. The sidebar
resolves the dangling id back to "All apps" and looks fine; the inbox kept
sending it as a filter, and the API refuses an appId that isn't a live app.

**If a customer reports an empty inbox: this is the first thing to check.**

### 6. Deleted apps kept feeding the dashboard, the app limit and ASO

A brand-new workspace showed a confident **4.60** portfolio rating above the
words "No reviews synced yet". `/api/dashboard/metrics` averages
`apps.lifetime_rating` filtered on `workspace_id` **and nothing else** — and
because the average is weighted by review count, a long-dead app with thousands
of ratings drowns out the one actually connected.

Same root cause as the phantom 200 reviews. Swept the rest; two more mattered:

- **`canAddApp` counted deleted apps against the plan limit.** A customer on a
  1-app plan who disconnected an app could never add another — refused with
  "you've reached your app limit" for an app invisible everywhere in the
  product. This may be part of why adding an app kept failing.
- `/api/aso/suggest` and `/api/debug/sync-status` resolved deleted apps.

Both new filters retry without `deleted_at` if the column is absent: no column
means nothing has ever been soft-deleted, so unfiltered is equivalent.

### 7. Sentiment reported a Google-Play-only workspace as 100% App Store

`reviews.source` is a DB enum — `google_play` / `app_store` (check constraint,
001). The platform split compared it against the **display** strings
("Google Play" / "App Store"), which only exist after `/api/reviews` maps a row
for the client. Neither branch could match, so both counters stayed 0 and the
panel rendered `0 · 0%` beside `0 · 100%`.

### 8. "AI is preparing your workspace… about 10 seconds" never stopped

Enrichment being in-flight was inferred purely from the Knowledge Base being
empty — equally true when enrichment finished and produced nothing (Gemini
returns no entries, or the call fails and is swallowed). No state could ever
clear it, so it promised 10 seconds indefinitely and polled every 8s forever.

Now bounded twice: enrichment only counts as in-flight within 5 minutes of a
sync (it runs as part of one), and the poll gives up after ~2 minutes. The same
flag also drove a second banner in `WorkspaceStatusStrip`, so the screen showed
two stacked spinners saying the same thing — most of why it read as "stuck in a
loop".

### 9. Replies were signed with the *workspace* name

A Mumbai One reviewer got "— The AT WORK Team". Nothing leaked between
accounts: "AT WORK" is the workspace's own name, and `workspace-persona` built
both `appName` and `teamName` from `workspaces.name`.

Wrong source. A workspace name is the customer's internal label; the reply is
**published on the store** to someone who reviewed an *app* and has never heard
of the workspace. `getWorkspacePersona(workspaceId, appId?)` now signs with the
app's name; a workspace with exactly one live app resolves without an appId,
two or more falls back rather than picking one arbitrarily. The persona cache
is keyed per (workspace, app), so Settings→Save had to stop deleting one fixed
key — it SCANs the workspace's keys now, or a support-email change stayed
stale for an hour.

### 10. Reviewer avatars

Was one flat tile per row showing "G" or "A" for the platform — the same letter
on every row, in the one position in a list whose job is telling rows apart,
for a fact the row already states twice.

Now initials on a name-derived colour with the store's mark badged in the
corner. `--rb-avatar-1..8` in `globals.css`; index from an FNV-1a hash
(`lib/avatar-color.ts`) — deterministic, since `Math.random()` would repaint on
every render and give one person different colours in the list and the detail
pane. FNV rather than a char-code sum because the sum clusters short similar
names ("Ravi"/"Ravindra"/"Rahul"), recreating the flat look. Palette is
mid-tone, not pastel: initials are 13px, so body text under WCAG, needing 4.5:1
against white.

Store marks are the **official** outlines from simple-icons (CC0), copied as
path data — not a dependency, for two icons out of 3,000. **They were rendered
to PNG at 8/10/12/16px in light and dark before committing**, which is the only
reason the sizing is right; the first pass was too small to identify either
store.

---

## Signup path — verified answers (unchanged, still true)

- **Sentiment covers every review at signup.** The rules engine tags each
  bootstrapped review at write time (sentiment/priority/tags/escalation), no
  network, no tokens. Gemini only refines ambiguous 3★ reviews later.
- **Why customers see ~50-60 reviews, not 200.** `BOOTSTRAP_LIMIT` is 200, but
  the Play scrape is filtered to `lang: "en"`, so an app whose reviews are
  mostly Hindi/Marathi returns only its English subset. For the India-first ICP
  that is the normal case. This is backlog **CM1** and remains the
  highest-value item for the core promise.

## ⚠️ The build sandbox cannot test the live store calls

Its egress proxy refuses `CONNECT` to `play.google.com`, `itunes.apple.com`,
`tryreviewbox.com` and `unpkg.com` with **403 before any request leaves the
box** (`curl: (56) CONNECT tunnel failed, response 403`). Every store 403 seen
from a Claude session — including the one recorded as finding **A8** — is the
sandbox, **not** Google blocking us. Do not record a sandbox 403 as a store
block again.

**`npm pack <package>` does work** through the registry, which is how the
official store icons were obtained this session. Use it when you need a file
from npm rather than concluding the network is closed.

**Playwright works** (`/opt/pw-browsers/chromium`) and is the right tool for
checking anything visual before committing it.

## Resolved — don't re-investigate

- **`aso_keywords` schema ambiguity: CLOSED.** Production has
  `volume_estimate` / `trend_data` / `added_at` / `updated_at`, matching
  `007_aso_keywords.sql`. `pending_combined.sql` deleted.
- **Migrations 020 and 022 applied.** 022 includes `notify pgrst, 'reload
  schema'` and every `apps`/`workspaces` column the code writes.
- **Google Play lookup by package name works from production** — founder
  confirmed ChatGPT, Mumbai One and Instagram. Only free-text *search* is
  refused. No paid proxy needed. (A8 is closed.)
- **Backlog R1** (middleware matcher gaps) was already fixed; re-verified.

## Still open — founder actions

1. **Migration 021** (`021_orphaned_review_cleanup.sql`) — deletes reviews
   whose app is already soft-deleted. Was ~250 rows (200 ixigo + 50 Mumbai
   One). Unclear whether it has been run; if Sentiment shows a review count
   with no apps connected, it hasn't.
2. **`VERCEL_TOKEN`** — see the note in git history; the `deploy-production` CI
   job fails loudly without it by design. Do not restore the skip.
3. **Clerk dev keys scoped to Preview** in Vercel — preview sign-in is broken
   with placeholder keys (`"Invalid host"`), which is why every fix this
   session had to be verified on production instead of the preview. ~10 min,
   and it would shorten every future loop.

## Open question for the founder

**App deletion is currently permanent** — deleting an app deletes its reviews
(D015 sanctions this). Asked twice, not yet answered. If it should be
recoverable, that's a soft-delete with a `deleted_at` on reviews, not a big
change — but it must be decided before a paying customer deletes something.

## What's next

1. **CM1** — multi-language reviews; the `lang: "en"` filter is costing our ICP
   most of their feedback. Highest value remaining.
2. **AU3** — `ai_usage` is read by four dashboards and written by nothing, so
   every "AI drafts" figure is permanently 0. Same class as the bugs above:
   a number that is confidently wrong rather than absent.
3. **AU4** — finish the swallowed-error sweep on ASO / Sentiment / Reply Kit /
   Competitors.
4. **NEW — audit every remaining `.insert(` / `.update(` for the PGRST204
   class.** `writeWithOptionalColumns` covers onboarding, `/api/apps` and the
   sync status write. Anything else writing a column from a migration ≥012 has
   the same latent failure.
5. Next migration number is **023**.
