# Today — Handoff for next agent

**Last updated:** 2026-06-05
**Branch agent left on:** `fix/launch-bugs` (pushed, open PR at https://github.com/nimesh4992/ReviewBox/pulls)

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (14 things you never do) are critical.
3. **`docs/backlog.md`** — single source of truth for what to build next, ICE-ranked
4. **This file (`docs/today.md`)** — last session's handoff

---

## What shipped this session (2026-06-03 → 2026-06-05)

### `fix/launch-bugs` — **awaiting founder merge** (comprehensive launch-blocker sweep)

Large bug-hunt sweep across sync, onboarding, security, and screens. All 80 unit tests pass.

#### SPINE (first-run blockers)
| Fix | File |
|-----|------|
| Onboarding app search sent `?q=` but route reads `?query=` → search always empty | `onboarding/search-app/route.ts` |
| GP sync wrote empty `external_id` on missing `reviewId` → `onConflict` collapsed all to one row (data loss) | `sync/reviews/route.ts` |
| GP `fetchReviews` capped at 100 reviews → now pages up to 10 pages via `tokenPagination` | `google-play/publisher-api.ts` |
| `review-mapper` clamped NaN/0 rating to NaN → validate finite, fall back to neutral 3 | `lib/review-mapper.ts` |
| `bootstrap` threw `RangeError` on unparseable dates (aborted whole import) → `safeIso()` guard | `services/bootstrap-reviews.ts` |
| Onboarding: rollback orphan workspace if member insert fails (slug burned forever) | `onboarding/complete/route.ts` |
| App idempotency + state lookups now exclude soft-deleted apps | `onboarding/state/route.ts` |

#### SECURITY
| Fix | File |
|-----|------|
| `sync isAuthorized()` fail-CLOSED in production when `CRON_SECRET` unset (was fail-open → anon sync) | `sync/reviews/route.ts` |
| `gdpr/delete`, `settings/workspace`, `apps/[id]` PATCH+DELETE now require owner/admin (any member could erase workspace) | multiple |
| Stripe webhook: explicit 503 when `STRIPE_WEBHOOK_SECRET` unset; subscription events resolve by customer id | `stripe/webhook/route.ts` |
| `test-credentials` route now rate-limited | `apps/[id]/test-credentials/route.ts` |
| Middleware `isAppHost` matches exactly (no `startsWith` host spoof) | `middleware.ts` |

#### CORRECTNESS
| Fix | File |
|-----|------|
| `sentiment/overview` + `aso/mine` selected non-existent `text` column → alias `text:body` | both routes |
| `aso-screen` + `sentiment-screen` resolved `appId` via always-false `typeof` check → `useApps()` name match | both screens |
| `reply-kit` knowledge-base + templates create now guard `res.ok` before pushing (was crashing on failed POST) | both tabs |
| `platform-health` sparkline header guarded against empty array | `dashboard/components/platform-health.tsx` |
| Spike alert email deduped via Redis 24h key (was re-sending every sync) | `sync/reviews/route.ts` |
| `unreplied-alert` cron batched (10) like `weekly-digest`; Clerk client hoisted | `reports/unreplied-alert/route.ts` |
| Reply route guards `JSON.parse` of App Store creds → clean 4xx not 500 | `reviews/[id]/reply/route.ts` |

#### DOCS
- `docs/DESIGN_SYSTEM_AUDIT.md` added to repo (was created 2026-05-29, never committed)

---

## PRs awaiting founder merge (priority order)

| # | Branch | What it does | Priority |
|---|--------|-------------|----------|
| 1 | `fix/launch-bugs` | Launch-blocking bugs: sync data loss, auth bypass, blank screens | 🔴 HIGH — merge first |

Check all open PRs: https://github.com/nimesh4992/ReviewBox/pulls

---

## Untracked artifacts — do NOT commit

Two files left in repo root from cross-verification agent:
- `gen_report.js` — session-specific path, unusable outside original env
- `ReviewBox_Code_Review_Report.docx` — generated artifact

Leave unstaged.

---

## Human actions needed

1. **Merge `fix/launch-bugs` PR** — contains launch-blocking fixes including sync data loss bug
2. **Set `CRON_SECRET` in Vercel** (if not already done)
   - Vercel dashboard → Settings → Environment Variables → `CRON_SECRET`
   - All email crons fail closed without it

---

## What you should pick up next

**Merge `fix/launch-bugs` first (founder job). Then:**

**Top NOW item from backlog: N6 — Stripe test keys + upgrade flow · ICE 80 (HUMAN-REQUIRED)**

This is HUMAN-REQUIRED — founder must add Stripe test keys to `.env.local` first.

**First non-blocked code task: DS1 — Add `--rb-indigo-500/600` tokens (10 min)**

```powershell
cd D:\Projects\Reviews
git checkout master
git pull origin master
git checkout -b claude/ds1-indigo-tokens
```

Adds `--rb-indigo-500` and `--rb-indigo-600` to `src/app/globals.css`, then replaces the 40 hardcoded `#5B5BD6` values in Reply Kit + Automations. See `docs/DESIGN_SYSTEM_AUDIT.md` for full context.

**After DS1: DS4 — Replace 86 raw `<button>` with `<Button>` · ICE 64**

---

## What requires the founder (D009 — never do these yourself)

- **Merge the open PR** above
- **Set `CRON_SECRET`** in Vercel
- **N6** — Add Stripe test keys to `.env.local`

---

## Current test status

- **Unit tests:** 80/80 passing (11 files)
- **Branch:** `fix/launch-bugs` pushed to `origin/fix/launch-bugs`

---

## Lessons learned this session

1. **Parameter name mismatches kill features silently.** `?q=` vs `?query=` — the UI calls the route but gets zero results. Always trace the full param path from UI → API route.
2. **`onConflict` on a nullable column is data loss.** Empty string `external_id` collapsed hundreds of reviews onto one row. Validate required fields before insert.
3. **Fail-closed > fail-open for cron auth.** When `CRON_SECRET` is unset, the only safe default is 401. Fail-open is a mass-action vulnerability.
4. All prior lessons still apply — PowerShell `&&` broken (use `;`), no `gh` CLI on this machine.

---

## Active state of the repo

- **Local branch:** `fix/launch-bugs` (committed and pushed)
- **Master:** clean (last merged: `feat/draft-mode` PR #63)
- **Tests:** 80 unit tests passing

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
