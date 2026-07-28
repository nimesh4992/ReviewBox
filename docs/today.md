# Today — Handoff for next agent

**Last updated:** 2026-07-28
**Branch agent left on:** `claude/playstore-data-scraping-signup-o0sm75` (pushed, draft PR open)

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
   **Migration `016_publisher_api_connected.sql` — founder must run it.**
   All code tolerates the column being absent until then (42703 fallbacks).

**Verification:** `tsc` 0 errors · 97 unit tests green (3 new) · lint 0
errors · production build passes. Live scrape not testable from this sandbox
(egress proxy blocks play.google.com) — verify on the Vercel preview.

---

## Founder actions needed

1. Merge the draft PR for `claude/playstore-data-scraping-signup-o0sm75`.
2. Run `supabase/migrations/016_publisher_api_connected.sql` in the Supabase
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
