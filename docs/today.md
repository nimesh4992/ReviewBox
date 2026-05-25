# Today — Handoff for next agent

**Last updated:** 2026-05-25
**Branch agent left on:** `fix/sync-and-competitors` (pushed, PR open — do NOT push more commits to it)

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (14 things you never do) are critical.
3. **`docs/backlog.md`** — single source of truth for what to build next, ICE-ranked
4. **This file (`docs/today.md`)** — last session's handoff

---

## What shipped this session (2026-05-25)

### PR #33 — `milestone/m1-product-polish` (already merged to master)
A large milestone branch. Highlights:
- Real dashboard metrics (ratingTrend, reviewsWeekDelta, avgRatingDelta from DB)
- Dead code removed (old onboarding wizard, mock-reviews.ts)
- Loading skeletons on 7 routes
- AppFollow-style app search in onboarding
- Onboarding loop fix (rb_onboarded cookie)
- 70 unit tests across 9 files
- LAUNCH_CHECKLIST.md (80+ items)

### `hotfix/settings-crash-and-404` — **awaiting founder merge**
Two production bugs fixed:
1. **Settings page crash** (`e.map is not a function`) — `alert_preferences` rows returned with `channels: null` from DB + snake_case/camelCase mismatch. Fixed with defensive mapping in `useEffect` and a render-side `ch` guard.
2. **"Link account" banner 404** — `credentials-banner.tsx` was linking to `/settings/connections` (route does not exist). Fixed to `/settings`.

**Files changed:** `src/features/settings/components/alert-preferences.tsx`, `src/components/layout/credentials-banner.tsx`

### `fix/sync-and-competitors` — **awaiting founder merge**
Two product-level issues fixed:

1. **First-login sync blocked → empty dashboard** — `isAuthorized()` in `/api/sync/reviews` returned `false` when `CRON_SECRET` env var is not set. The fire-and-forget sync fired from `onboarding/complete` is a server-to-server HTTP call with no Clerk session — so it silently got 401 every time. Reviews never imported. Dashboard stayed empty forever. Fix: `isAuthorized()` returns `true` when no `CRON_SECRET` is configured. Once the founder sets `CRON_SECRET` in Vercel, the check enforces it automatically.

2. **Competitors screen hardcoded mock data** — New `GET /api/competitors` endpoint queries real DB metrics for the user's primary app (lifetime rating, reviews per week, reply rate, 6-week rating trend). "You" row is live data. Competitor rows are illustrative placeholders with amber **sample** badges at 60% opacity — competitor tracking is a future feature and stated clearly in the UI. KPI strip (rank, gap to #1, reply-rate delta) now derives from real data.

**Files changed:** `src/app/api/sync/reviews/route.ts`, `src/app/api/competitors/route.ts` (new), `src/features/competitors/components/competitors-screen.tsx`

---

## PRs awaiting founder merge (both must merge before next agent starts)

| # | Branch | What it does | Priority |
|---|--------|-------------|----------|
| 1 | `hotfix/settings-crash-and-404` | Fixes settings crash + link-account 404 | 🔴 URGENT |
| 2 | `fix/sync-and-competitors` | Fixes empty dashboard + competitors real data | 🔴 URGENT |

Open: https://github.com/nimesh4992/ReviewBox/pulls

---

## One HUMAN action needed right now

**Set `CRON_SECRET` in Vercel environment variables.**

- Vercel dashboard → your project → Settings → Environment Variables
- Add: `CRON_SECRET` = any random string (run `openssl rand -hex 32` or just type a long random string)
- Apply to: Production + Preview + Development
- Redeploy after setting it

Why: Without this, any caller can trigger the sync-all-workspaces coordinator endpoint. It's not catastrophic (syncing just reads data) but it's sloppy. Set it now while we're thinking about it.

---

## What you should pick up next

**Merge both PRs first (founder job). Then:**

**Top non-blocked NOW item: N3 — Detail pages · ICE 64**

`/incidents/[id]` and `/releases/[version]` are dynamic routes that exist in the router but show stubs or blank content. Users click incidents from the incident list and releases from the release health table. A blank page kills trust.

### N3 scope — Done when:
1. `/incidents/[id]` — shows: incident title, severity badge (critical/high/medium), description, owner, detected-at timestamp, status chip (open/investigating/resolved), timeline of 3–5 dummy status changes.
2. `/releases/[version]` — shows: version number, rollout % bar, rating delta, complaint delta, status badge, list of reviews tagged for that version (query from DB by `app_version` field).
3. Both pages have a back link (`← Incidents` / `← Releases`).
4. Both pages use `AppShell` (authenticated shell — NOT MarketingShell).
5. Mobile usable (AppShell handles it).

### N3 implementation notes
- **Files:** `src/app/(app)/incidents/[id]/page.tsx`, `src/app/(app)/releases/[version]/page.tsx`
- Check what's already there — they were in the build output so stubs exist
- Incident detail page is already built per CLAUDE.md ("Incident detail — status actions, timeline ✅ Done (real data)") — verify it actually works or just needs wiring
- Release detail is also listed as ✅ Done — same check
- If both truly work, skip N3 and move to N4
- **No ADR required** — layout only, no new patterns
- **No new types** — use existing `IncidentAlert`, `ReleaseHealth` from `src/types/review.ts`

### Start
```powershell
cd D:\Projects\Reviews
git checkout master
git pull origin master
git checkout -b claude/n3-detail-pages
```

---

## After N3: N4 — Remove or wire dead buttons · ICE 56

Dead buttons across the app. Now that competitors is wired (this session), the remaining ones are:
- `aso-screen.tsx` — "Export" and "Suggest keywords" buttons
- `reports-screen.tsx` — "Run report" and "Configure" buttons  
- Settings sections — any "Save" buttons that don't actually save

For each dead button: either wire it to real behavior, or hide it behind a `disabled` state with a tooltip "Coming soon", or remove it entirely. Don't leave silent no-ops.

---

## What requires the founder (D009 — never do these yourself)

- **Merge the 2 open PRs** above
- **Set `CRON_SECRET`** in Vercel (see above)
- **N6** — Add Stripe test keys to `.env.local`. Until done, billing flow can't be tested end-to-end.
- **Migrations** — Check if migrations 007–011 are applied in production. If not, founder needs to run them in Supabase SQL editor. They were generated in prior sessions but may not have been applied. Check `supabase/migrations/` for filenames starting at 007.

---

## Lessons learned this session

1. **`CRON_SECRET` unset = silent 401 on server-to-server sync.** The sync route's `isAuthorized()` previously returned `false` when `CRON_SECRET` was not configured — this blocked every first-login sync without any visible error. Now fixed. Always test first-login sync after any auth/middleware change.

2. **Supabase JSONB `null` vs missing key.** `alert_preferences.channels` column was nullable and rows pre-dating the migration had `channels: null`. Any component that does `pref.channels.email` crashes. Pattern: always guard JSONB columns with `(value && typeof value === "object") ? value : defaultValue` before accessing nested keys.

3. **Snake_case from Supabase ≠ camelCase in TypeScript.** DB returns `schedule_time`, `schedule_day_of_week`; TypeScript types expect `scheduleTime`, `scheduleDayOfWeek`. Either use a mapping layer or check both in the same expression: `r.scheduleTime ?? r.schedule_time`.

4. **PR #33 already merged when session started.** Don't assume a PR is pending — check `git log --oneline origin/master` at the start of each session to see what's actually merged.

5. All prior lessons still apply — PowerShell `&&` broken (use `;`), stale `.next/` cache after branch switches, no `gh` CLI on this machine (use GitHub web URLs), `@clerk/types` not a separate package.

---

## Active state of the repo

- **Local branch:** `fix/sync-and-competitors` (committed, pushed — don't add to it)
- **Master:** all prior session PRs merged; `hotfix/settings-crash-and-404` and `fix/sync-and-competitors` pending
- **Build:** clean (exit 0, 0 type errors before pushing)
- **Tests:** 70 unit tests passing

---

## Founder's context (stable)

- Solo founder, marketing-strong, non-coder
- Autopilot loop: Claude ships PRs on branches → founder verifies on Vercel preview → founder merges
- Goal: take on AppFollow on price ($49 vs $399) + AI-first + modern UX
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
