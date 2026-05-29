# Today — Handoff for next agent

**Last updated:** 2026-05-26
**Branch agent left on:** `fix/audit-round-3` (pushed, PR at https://github.com/nimesh4992/ReviewBox/pull/new/fix/audit-round-3)

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (14 things you never do) are critical.
3. **`docs/backlog.md`** — single source of truth for what to build next, ICE-ranked
4. **This file (`docs/today.md`)** — last session's handoff

---

## What shipped this session (2026-05-26)

### `fix/audit-round-3` — **awaiting founder merge** (9 fixes)

Cross-verification audit by a third-party review agent found bugs missed in the prior two passes. All 9 fixed in one commit (`e59d0cf`).

| ID | File | Fix |
|----|------|-----|
| C-02 | `cron/trial-nudge/route.ts` | `isAuthorized()` now fail-closed — was `return true` when `CRON_SECRET` unset, allowing anyone to fire mass trial emails |
| H-01 | `onboarding/complete` + `onboarding/slug-check` | Slug regex fixed — `(?:...)?` optional group allowed 1-char slugs; now requires min 3 chars |
| H-02 | `cron/trial-nudge/route.ts` | Dedup Redis key now written BEFORE sending email (both day5 + day12 loops) |
| H-03 | `account/accept-invite/route.ts` | Invite email check iterates all `emailAddresses`, not just `[0]` |
| H-05 | `reviews/[id]/reply/route.ts` | Server-side char limit before store submit (Google Play: 350, App Store: 5950) |
| H-06 | `gdpr/export/route.ts` | Removed `export const GET = handler` — CSRF vector |
| M-01 | `reports/export/route.ts` | `days` param clamped 1-365; NaN/negative now default to 30 |
| C-03 | `reviews/route.ts` | PostgREST `.or()` search param strips `,().'"\` before interpolation |
| M-03 | `sync/reviews/route.ts` | `notifyWorkspaceOwner` `.single()` → `.maybeSingle()` |
| L-01 | `google-play/service-account/route.ts` | Uses `apiError("UNAUTHORIZED", 401)` not raw `NextResponse.json` |

Also added `REPLY_TOO_LONG` to `ApiErrorCode` union in `src/lib/api-response.ts`.

**TypeScript:** 0 errors.

---

## PRs awaiting founder merge (priority order)

| # | Branch | What it does | Priority |
|---|--------|-------------|----------|
| 1 | `fix/audit-round-3` | 9 security + correctness fixes | 🔴 HIGH |

Check all open PRs: https://github.com/nimesh4992/ReviewBox/pulls

---

## Untracked artifacts — do NOT commit

Two files in repo root from cross-verification agent:
- `gen_report.js` — session-specific path, unusable outside original env
- `ReviewBox_Code_Review_Report.docx` — generated artifact

Leave unstaged.

---

## One HUMAN action needed right now

**Set `CRON_SECRET` in Vercel environment variables.**

- Vercel dashboard → your project → Settings → Environment Variables
- Add: `CRON_SECRET` = `e61b2c02c385535daa15e71d533dde895b8dcdf396c825841fa59ac1dbeb4480`
- Apply to: Production + Preview + Development
- Redeploy after setting it

Why: `weekly-digest`, `unreplied-alert`, AND `trial-nudge` all fail closed without this. None of the email crons fire until this is set.

---

## What you should pick up next

**Merge all PRs first (founder job). Then:**

**Top non-blocked NOW item: N3 — Detail pages · ICE 64**

`/incidents/[id]` and `/releases/[version]` show stubs or blank content. Users click from lists and hit nothing — trust killer.

### N3 scope — Done when:
1. `/incidents/[id]` — shows: title, severity badge, description, owner, detected-at, status chip, timeline.
2. `/releases/[version]` — shows: version, rollout % bar, rating delta, complaint delta, status badge, reviews tagged for that version.
3. Both have a back link and use `AppShell`.
4. Mobile usable.

### Start
```powershell
cd D:\Projects\Reviews
git checkout master
git pull origin master
git checkout -b claude/n3-detail-pages
```

---

## After N3: N4 — Remove or wire dead buttons · ICE 56

Remaining dead buttons:
- `aso-screen.tsx` — "Export" and "Suggest keywords"
- `reports-screen.tsx` — "Run report" and "Configure"
  (note: dead "+ New report" already removed on branch `claude/n3-n4-detail-pages-and-dead-buttons` — cherry-pick or re-apply that one change)

---

## What requires the founder (D009 — never do these yourself)

- **Merge the open PR** above
- **Set `CRON_SECRET`** in Vercel (see above)
- **N6** — Add Stripe test keys to `.env.local`

---

## Lessons learned this session

1. **Cross-verification catches bugs after two audit passes.** A fresh agent found 9 more real bugs. Run a secondary audit after major security work — it always pays.

2. **Dedup-before-send is the correct order.** Write the idempotency key BEFORE firing the side effect. Safer failure: missed email (retryable) > double-send (trust damage).

3. **All email crons must fail closed.** Sync route stays open intentionally (onboarding sync). Email crons (weekly-digest, unreplied-alert, trial-nudge) must all return 401 when CRON_SECRET unset.

4. **`(?:...)?` ≠ required group.** The trailing `?` makes the whole group optional, silently allowing 1-char slugs despite "3-40 chars" in the error message.

5. All prior lessons still apply — PowerShell `&&` broken (use `;`), no `gh` CLI on this machine.

---

## Active state of the repo

- **Local branch:** `fix/audit-round-3` (committed and pushed)
- **Master:** clean
- **Build:** TypeScript clean (0 errors)
- **Tests:** 70 unit tests (unchanged this session)

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
