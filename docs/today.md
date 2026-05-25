# Today — Handoff for next agent

**Last updated:** 2026-05-25
**Branch agent left on:** `fix/audit-round-1` (pushed, PR at https://github.com/nimesh4992/ReviewBox/pull/new/fix/audit-round-1)

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (14 things you never do) are critical.
3. **`docs/backlog.md`** — single source of truth for what to build next, ICE-ranked
4. **This file (`docs/today.md`)** — last session's handoff

---

## What shipped this session (2026-05-25 continued)

### `fix/audit-round-1` — **awaiting founder merge**

Two-commit branch containing 35+ security and correctness fixes across 35 API routes.
Found via two consecutive audit passes.

**Round 1 (commit 945316e) — 25 fixes:**
- H1–H4: reply-kit templates/KB — field allowlists, rateLimit, audit, .maybeSingle()
- H5–H7: apps routes — apiError, no more error.message leaks
- H9: unreplied-alert — .single()→.maybeSingle() on owner lookup
- M1: bulk-action audit action corrected ("reply.publish"→"review.bulk_update")
- M4/M6: settings/workspace — appCategory allowlist + apiError
- M5: reports/export — rateLimit(10/hr) added
- M7/M8/M9: dashboard/accept-invite/restore — apiError + correct audit actions
- M11/L2/L3: incidents routes — apiError + audit(incident.create/update) + severity allowlist
- L4–L6: aso/keywords, automations/rules, automations/logs — apiError throughout

**Round 2 (commit 7de8419) — 16 more fixes:**
- reviews/route.ts — captureAndError for Sentry capture
- settings/alerts POST — input validation (type/channels/enabled allowlists) + audit
- automations/rules/[id] — apiError throughout PATCH+DELETE, description capped
- aso/keywords/[id] — apiError + .single()→.maybeSingle() (was 500 on missing row)
- reply/draft — reviewBody capped at 5000 chars, tags capped at 20, captureAndError
- demo/reply — reviewBody capped at 1000 chars (Groq quota protection)
- stripe/webhook — no longer leaks error.message to caller
- competitors route — all 4 review queries now include workspace_id scope guard
- debug/sync-status — select("*") replaced with safe columns (no credentials exposed)
- gdpr/delete — rateLimit(3/24h) added (most destructive route was unprotected)
- weekly-digest + unreplied-alert — isAuthorized returns false when CRON_SECRET unset
  (was true = anyone could trigger mass emails in staging)

---

## PRs awaiting founder merge

| # | Branch | What it does | Priority |
|---|--------|-------------|----------|
| 1 | `hotfix/settings-crash-and-404` | Fixes settings crash + link-account 404 | 🔴 URGENT |
| 2 | `fix/sync-and-competitors` | Fixes empty dashboard + competitors real data | 🔴 URGENT |
| 3 | `fix/audit-round-1` | 35 security + correctness fixes across all API routes | 🔴 HIGH |

Open: https://github.com/nimesh4992/ReviewBox/pulls

---

## One HUMAN action needed right now

**Set `CRON_SECRET` in Vercel environment variables.**

- Vercel dashboard → your project → Settings → Environment Variables
- Add: `CRON_SECRET` = any random string (run `openssl rand -hex 32` or just type a long random string)
- Apply to: Production + Preview + Development
- Redeploy after setting it

Why: The weekly-digest and unreplied-alert crons now require this to run. Without it they return 401 (good for security, but means the crons won't fire). The sync route stays open intentionally (no auth needed for the per-workspace worker).

---

## What you should pick up next

**Merge all PRs first (founder job). Then:**

**Top non-blocked NOW item: N3 — Detail pages · ICE 64**

`/incidents/[id]` and `/releases/[version]` are dynamic routes that exist in the router but show stubs or blank content. Users click incidents from the incident list and releases from the release health table. A blank page kills trust.

### N3 scope — Done when:
1. `/incidents/[id]` — shows: incident title, severity badge, description, owner, detected-at timestamp, status chip (open/investigating/resolved), timeline.
2. `/releases/[version]` — shows: version number, rollout % bar, rating delta, complaint delta, status badge, list of reviews tagged for that version (query from DB by `app_version` field).
3. Both pages have a back link.
4. Both pages use `AppShell`.
5. Mobile usable.

### Start
```powershell
cd D:\Projects\Reviews
git checkout master
git pull origin master
git checkout -b claude/n3-detail-pages
```

---

## After N3: N4 — Remove or wire dead buttons · ICE 56

Dead buttons across the app:
- `aso-screen.tsx` — "Export" and "Suggest keywords" buttons
- `reports-screen.tsx` — "Run report" and "Configure" buttons
- Settings sections — any "Save" buttons that don't actually save

For each dead button: either wire it to real behavior, or `disabled` with tooltip "Coming soon", or remove entirely.

---

## What requires the founder (D009 — never do these yourself)

- **Merge the 3 open PRs** above
- **Set `CRON_SECRET`** in Vercel (see above)
- **N6** — Add Stripe test keys to `.env.local`
- **Migrations** — Check if migrations 007–011 are applied in production

---

## Lessons learned this session

1. **Second audit found critical gaps even after 25 fixes.** Two-pass audits always pay off. BLOCKERs found in pass 2: GDPR delete with no rate limit, Stripe leaking internal error message, demo route burning Groq quota with uncapped input, weekly-digest cron open to the world.

2. **PowerShell `git stash pop` can fail silently** if any tracked file has modified content. Fix: `git checkout <conflicting-file>` then re-run `git stash pop stash@{0}`.

3. **`select("*")` on apps table includes `access_token`/`refresh_token`** (App Store private key). Always be explicit about columns when a table has credentials.

4. **`.single()` on an ownership check throws if row doesn't exist.** Always use `.maybeSingle()` for lookups that might return 0 rows. The difference: `.single()` → Supabase error → 500. `.maybeSingle()` → `null` → explicit 404.

5. All prior lessons still apply — PowerShell `&&` broken (use `;`), no `gh` CLI on this machine.

---

## Active state of the repo

- **Local branch:** `fix/audit-round-1` (committed and pushed)
- **Master:** `hotfix/settings-crash-and-404` + `fix/sync-and-competitors` still pending merge
- **Build:** TypeScript clean (0 errors)
- **Tests:** 70 unit tests (unchanged this session)

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
