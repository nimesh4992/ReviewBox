# Today — Handoff for next agent

**Last updated:** 2026-07-28
**Branch agent left on:** `claude/playstore-data-scraping-signup-o0sm75` (PRs #66-#70 merged; final repair + sync-visibility PR open)

> ⚠️ **Coordination warning:** TWO Claude sessions were repairing master
> concurrently. PR #70 (this branch) fixed the broken #68 merge; PR #69
> (`claude/product-market-readiness-zcfowh`) merged AFTER it and re-broke
> the same two files by layering the old #68 content back on top. If that
> other session is still live, do not both touch `dashboard/page.tsx` /
> `api/apps/route.ts` at once. Canonical versions = this branch's.

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (never-do list) are critical.
3. **`docs/backlog.md`** — ICE-ranked queue
4. **This file (`docs/today.md`)** — last session's handoff

---

## What happened this session (2026-07-28)

Founder reported: **"Every time I log in the dashboard is empty"** — the
"Syncing Mumbai One…" banner spins forever, every KPI is zero.

The 2026-07-25 session (merged as PR #66) fixed the scraper *logic* (BUG-024:
public scrape now runs on every sync). But the dashboard is still empty
because **the sync never gets triggered at all**. Four trigger-path bugs,
all fixed on this branch:

1. **First-sync trigger was a fire-and-forget HTTP self-fetch** in
   `/api/onboarding/complete`. On Vercel the lambda freezes the moment the
   response is sent, so the request usually died on the floor. And when it
   did fire with `CRON_SECRET` unset in production, the sync route rejected
   the cookieless server-to-server call with a 401 (fail-closed by design).
   → Sync logic extracted to **`src/services/review-sync.ts`** and called
   **in-process via `after()`** (Next 15). No HTTP hop, no auth hop.
2. **The daily cron coordinator fanned out workers with the same
   fire-and-forget fetch** — same freeze problem, so even the scheduled
   daily sync could silently do nothing.
   → Fanout now wrapped in `after()` + `Promise.allSettled`.
3. **`POST /api/apps` ("Connect app" button) did nothing after the insert** —
   no metadata scrape, no sync trigger, blank row until the next cron.
   → Now fetches public store metadata (icon, lifetime rating, review count)
   before insert and triggers a first sync via `after()`.
4. **The dashboard never self-healed** — it polled every 10s while an app
   had never synced, but never actually kicked a sync.
   → Dashboard now fires one Clerk-authenticated `/api/sync/reviews` call
   per mount when any app has `last_sync_attempted_at === null`. This also
   rescues already-stuck workspaces (like the founder's) on next login.

Plus the product ask on top:

5. **New "Connect Play Console" banner** — when a Google Play app is synced
   from public data only, the dashboard now says so and offers "Connect
   Play Console" (opens the existing setup modal) instead of pretending
   everything is fully connected. Backed by a new
   `apps.publisher_api_connected` column, written by every sync (true when
   the Publisher API responds; false only on permission-shaped errors —
   `isGpPermissionError()` in `src/lib/sync-writes.ts`, unit-tested) and by
   the "Verify connection" button.
   **Migration `018_publisher_api_connected.sql` — founder must run it.**
   All code tolerates the column being absent until then (42703 fallbacks).

**Verification:** `tsc` 0 errors · 97 unit tests green (3 new) · lint 0
errors · production build passes. Live scrape not testable from this sandbox
(egress proxy blocks play.google.com) — verify on the Vercel preview.

---

### ⚠️ Merge-conflict repair (same session, second PR)

PR #68 was merged together with a `master` merge commit whose conflict
resolution broke the build: `dashboard/page.tsx` ended up containing BOTH the
old per-app `SyncBanners` body AND the new `WorkspaceStatusStrip` from PR #67
(mashed into one function, syntax errors), and `POST /api/apps` contained two
stacked metadata-fetch + sync-trigger implementations. `master` is therefore
red (build + type-check fail) — Vercel keeps serving the last green deploy,
but nothing new can ship until the repair PR merges. The repair:

- Adopts PR #67's single `WorkspaceStatusStrip` and folds the
  "public data — connect Play Console" state in as its lowest-priority tier
  (errors > syncing > quiet > AI prep > connect nudge).
- Unifies `POST /api/apps` on PR #67's metadata style + this branch's
  in-process `after()` sync (their fire-and-forget HTTP trigger re-introduced
  the exact bug this branch fixes — removed).
- Repairs this file's merged-in duplicate headers.

### Follow-up: "Sync is not working" — silent no-op paths made visible

After production started serving the fixed build the founder still reported
sync not working. Three ways `syncWorkspace()` could do NOTHING silently,
all fixed on the final PR:

1. The apps select used `.is("deleted_at", null)` with **no 42703 fallback**
   — if migration 015 isn't applied in prod, the query errors, the error was
   discarded, and the sync returned "success" having synced nothing.
   Now falls back tier-wise and reports select failures in `summary.errors`.
2. **Apps with an empty `store_id`** (onboarding manual-entry with just an
   app name) were filtered out in SQL — nothing to scrape, no status, banner
   spins forever. Now stamped `missing_store_id` with a plain-English
   `last_sync_error` telling the user to add the package name in Settings;
   the dashboard error strip surfaces it.
3. **`/api/onboarding/setup`** (added by #67, used by the live wizard's step
   3) still triggered its bootstrap with the fire-and-forget HTTP self-fetch.
   Now `after()` + in-process `syncWorkspace()`, like the other routes.

Diagnosis aid: `/api/debug/sync-status` (signed-in) shows per-app sync state
and a next_action string — first thing to check when "sync doesn't work".

## Founder actions needed

1. **Merge the open repair PR** for
   `claude/playstore-data-scraping-signup-o0sm75` — master is red (again)
   until then; #69's merge re-broke it.
2. Run `supabase/migrations/018_publisher_api_connected.sql` in the Supabase
   SQL editor (also run 016_competitor_apps + 017_support_tickets from PR #67
   if not yet applied).
3. **Set `CRON_SECRET` in Vercel env vars** (any long random string) — without
   it the daily cron coordinator refuses to run in production.
4. After deploy: log in — the dashboard kicks a sync itself; public rating +
   reviews should appear within ~30s.
5. **Enable branch protection on `master` requiring CI** — PR #68 merged with
   a red Build + type-check, which is how master broke. This has been on the
   checklist since May.

---

## What happened last session (2026-07-27)

Founder asked: *"start build a backend portal to manage the business. customer,
tickets etc"*. One slice shipped to PR #67 — the **admin business portal**
(backlog X12, extended with support tickets). ADR: `docs/adr/007-admin-portal-support-tickets.md`.

### /admin — overview (new)
- Real KPIs from Supabase: active workspaces (+ plan breakdown + deleted count),
  signups last 7d, **est. MRR from D002 list prices** (clearly labeled — Stripe
  stays untouched per D013), apps connected, reviews synced (+7d), AI drafts 7d.
- Recent-signups and needs-a-reply ticket snapshots, both linked through.

### /admin/customers — list upgraded + detail page (new)
- List: full D002 plan vocabulary badges (incl. past_due/canceled), review
  counts (PostgREST `reviews(count)` with graceful fallback), trial-end dates,
  deleted badge, rows link to detail.
- Detail (`/admin/customers/[id]`): members with real emails (Clerk batch
  lookup), apps with sync health + lifetime rating, usage stats (reviews,
  needs-reply, AI calls 30d), workspace tickets, last 8 audit-log events,
  Stripe customer id if present.

### Support tickets (new system)
- **Migration `017_support_tickets.sql`** — `support_tickets` +
  `support_ticket_messages`, RLS on (customers can read their own workspace's
  non-internal thread; all writes service-role only). Idempotent.
- Customers file tickets in-app: Settings → **Contact support** card →
  `POST /api/support/tickets` (Clerk auth, rate-limited 5/h, audited).
- Founder works them at `/admin/tickets`: status-filter tabs, thread view,
  reply box + **internal notes**, status/priority dropdowns (auto "pending"
  when a public reply lands on an open ticket), `/admin/tickets/new` to log
  email-arrived requests (auto-links workspace via Clerk email lookup).
- **D009 #6 respected:** admin replies are stored in the thread only — nothing
  is emailed. UI says so explicitly.
- Everything degrades gracefully until migration 017 is applied (42P01 →
  setup notice / 503 with email fallback), same pattern as migration 016.

### Plumbing
- `src/lib/admin-auth.ts` — shared fail-closed admin gate (layout + API routes).
- `src/lib/support-tickets.ts` — vocab, validation, row mappers.
- audit.ts: `ticket.create|update|message` actions + `ticket` target type.
- middleware: `/api/support(.*)` registered as an app route (prod host would
  otherwise bounce it to /dashboard).
- 32 new unit tests (admin gate, ticket validation/mappers) → **127 total**.

**Verification:** tsc 0 · lint 0 errors · 127 unit tests green · production
build green.

### Also this session: full user-role & access-control audit (report only, no fixes)

Founder asked for a thorough per-page/per-section role audit. Two exhaustive
sweeps (all 67 API routes + every page/component) → **`docs/ROLE_AUDIT.md`**.
Headline: tenant isolation is clean (zero cross-workspace holes — A-), but
internal owner/member roles are enforced in only 6 of 67 routes and ZERO UI
components (C-). Standouts: any member can GDPR-export the tenant including
store credentials; Slack OAuth callback bypasses the admin-only webhook gate;
members can enable auto-reply; `stripe/portal` binds by email not workspace;
and a middleware matcher gap leaves `/api/import|competitors|auth/slack|cron`
unreachable on the prod app host (shipped features silently broken). Backlog
items **R1–R3** added (ICE-scored). Next agent: R1 is a 30-min functional fix
— do it first.

### Also this session: IA restructure phase 1 ("de-vibe-code" pass)

Founder: "features/screens feel vibe-coded — move things around, categorise,
fine-tune." Shipped (see `docs/IA_RESTRUCTURE.md` for the full plan):
- **Releases page rebuilt on real data** — groups synced reviews by
  `app_version` (count, avg ★, delta vs prior, first seen → links to the real
  detail page). Fabricated 4-version table + rollout bars + 2 dead buttons
  deleted (`release-health-table.tsx`, `releaseHealth` mock removed).
- **Automations honest** — mock-rule seed removed (zero-rule workspaces saw
  fake rules forever; toggling fired the API with fake ids). Starts empty,
  real empty state shows.
- **Reply Kit Tags** — now shows the real 8-tag rules-engine vocabulary;
  dead Import/Add-tag/Try-it controls removed.
- **Dead buttons removed** — Settings "Manage access", Automations header
  "Add rule".
- **Nav re-categorized** — Inbox first-class (real unreplied badge; was keyed
  to the /reviews redirect), groups: Automate / Monitor / Grow.
Phase 2 (merges/cuts: Reply Kit→Automations, Incidents→Inbox, Reports trim,
ASO rename) is written up in the doc and **awaits founder verdict**.

### Also this session: fix — apps added from Settings never synced

Founder report: "app connected, basic data not scraped." Root cause candidates
found (couldn't read prod DB from the sandbox; Play Store is blocked by the
sandbox egress proxy, so live scrape testing was inconclusive):
1. **Fixed:** `POST /api/apps` (Settings → Add app) did neither the metadata
   fetch nor the first-sync trigger that onboarding does — the app sat empty
   until the 8am cron. Now mirrors onboarding: `fetchAppMetadata` before
   insert (42703 fallback) + fire-and-forget `/api/sync/reviews` trigger, and
   logs loudly when CRON_SECRET is missing in prod.
2. **Founder must verify:** `CRON_SECRET` env var exists in Vercel. Without
   it, the daily cron AND all server-side sync triggers are rejected in prod
   (sync/reviews `isAuthorized` fails closed) — only the manual "Sync now"
   button works. Not visible from the repo.
3. Remaining suspect if 1+2 check out: Google 403-blocking Vercel egress IPs —
   the truth is in `apps.last_sync_error` (visible in Settings → Apps and
   /admin customer detail). Ask founder for the exact status text.

1. Merge the draft PR for `claude/playstore-data-scraping-signup-o0sm75`.
2. Run `supabase/migrations/018_publisher_api_connected.sql` in the Supabase
   SQL editor (safe to re-run; without it the connect-banner state just
   stays conservative — nothing breaks).
3. **Set `CRON_SECRET` in Vercel env vars** (any long random string) —
   without it the daily cron coordinator refuses to run in production.
4. After deploy: just log in. The dashboard kicks a sync itself; Mumbai
   One's public rating + reviews should appear within ~30s.

## What you should pick up next

1. Verify the first-sync flow end-to-end on the Vercel preview (fresh
   sign-up → app search → dashboard shows data without touching anything).
2. BUG-020 founder decision still open — US-only scrape vs global counts.
3. Spine e2e test (sign in → sync → draft → mark replied → sync again →
   reply survived).
4. BUG-022 — move sync off the 24h Vercel Hobby cron to Supabase `pg_cron`.

## Open risk to watch

The public Google Play scrape is the single point of failure for Draft Mode
(G-3 in `docs/MARKET_READINESS_AUDIT.md`). Google rate-limits datacenter
IPs; Sentry alerts on sync failure — **watch it.** A Google-side block is a
total outage, not a degradation.

---

## Founder's context (stable)

- Solo founder, marketing-strong, non-coder
- Autopilot loop: Claude ships PRs on branches → founder verifies on Vercel preview → founder merges
- Goal: take on AppFollow ($49 vs $399) + AI-first + modern UX
- Works in pockets around a full-time job
- No `gh` CLI installed — give GitHub web PR URLs

---

## Final reminders

- Never push to `master`. PR only.
- Never merge PRs. Founder merges.
- Never run migrations against prod Supabase. Founder runs them.
- Never send real emails. Drafts only.
- Always write PR descriptions as plain-English 5-minute test plans.
- Always update this file at end of session.
- Always ICE-score new backlog items added to `docs/backlog.md`.

---

## Update 2026-07-28 (later session) — R1 middleware fix + master repair

Two things landed on branch `claude/product-market-readiness-zcfowh` (PR #69),
cut fresh from master after PR #67 merged:

1. **R1 (role-audit P0-5)** — `src/middleware.ts`: `/api/import`,
   `/api/competitors`, `/api/auth/slack` added to the app-route matcher and
   `/api/cron/(.*)` to the public matcher, so `app.tryreviewbox.com` stops
   redirecting them to `/dashboard` before auth runs. Fixes AppFollow import,
   Competitors add/remove, Slack OAuth, and the trial-nudge cron in prod.

2. **⚠️ Repaired a broken master.** PR #68's "Merge branch master into
   claude/playstore…" commit (`56aae7f`) botched its conflict resolution and
   shipped code that does **not** type-check — `src/app/api/apps/route.ts`
   (duplicate insert keys, a malformed double-`if`, two competing sync
   triggers) and `src/app/(app)/dashboard/page.tsx` (a component boundary
   spliced into a props type). It merged to master as `f684de1`, so
   **master/production has been broken since PR #68 merged**. This PR restores
   both files to #68's last clean tip (`56aae7f^1`) — #68's intended
   `after(syncWorkspace)` sync + Connect-Play-Console banner — reconciled with
   current master. tsc 0 · lint 0 · 129 tests · build green.

**Founder:** merging PR #69 fixes production. If you can, still confirm
`CRON_SECRET` is set in Vercel (the sync trigger depends on it).
