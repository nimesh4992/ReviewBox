# Today — Handoff for next agent

**Last updated:** 2026-06-05
**Branch agent left on:** `master` (clean — all recent PRs merged)

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (14 things you never do) are critical.
3. **`docs/backlog.md`** — single source of truth for what to build next, ICE-ranked
4. **This file (`docs/today.md`)** — last session's handoff

---

## Recent merges (all now on master)

| PR | Branch | What it did |
|----|--------|-------------|
| #64 | `fix/launch-bugs` | Launch-blocking sweep: sync data loss, auth bypass, blank screens, onboarding search param fix, GP pagination |
| #63 | `feat/draft-mode` | Draft mode features |
| #62 | `docs/launch-spine` | Launch spine documentation |
| #61 | `hotfix/onboarding-build` | Onboarding build fix |
| #60 | `docs/spine-launch-plan` | Spine launch plan docs |

Master is clean. Vercel deploys automatically on merge.

---

## What requires the founder before code work can resume

| Action | Why |
|--------|-----|
| **Set `CRON_SECRET` in Vercel** (if not already done) | All email crons (`weekly-digest`, `unreplied-alert`, `trial-nudge`) fail closed without it |
| **N6 — Add Stripe test keys** to `.env.local` | Required before billing work can proceed |
| **X1 — Create Slack app** at api.slack.com, add `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` / `NEXT_PUBLIC_SLACK_CLIENT_ID` to Vercel | Slack integration is fully built, just needs credentials |

---

## What you should pick up next

No new branch was started this session — founder was asked to pick from these options:

### Option A: DS4 · Replace raw `<button>` with `<Button>` · ICE 35

Accessibility fix. 39 raw `<button>` elements in `review-queue.tsx` (22) and `aso-screen.tsx` (17) need to become `<Button variant="ghost" size="sm">`. These have no focus rings or keyboard-nav semantics.

```powershell
git checkout master; git pull origin master
git checkout -b claude/ds4-button-accessibility
```

**Done when:** Both files use `<Button>` throughout. All 80 tests still pass.

### Option B: X6 · Real competitor tracking · ICE 48

Competitors screen shows placeholder data. Wire to real store data: let users manually add competitor app IDs, fetch public store ratings via the existing scraper, store in `competitor_apps` table.

```powershell
git checkout master; git pull origin master
git checkout -b claude/x6-competitor-tracking
```

**Done when:** Competitors screen shows real public ratings for user-added competitor apps.

### Option C: DS2 · Type scale tokens · ICE 35

Define `--rb-text-*` tokens in `globals.css`, wire as Tailwind utilities, replace arbitrary `text-[Npx]` in top 5 files.

---

## Current test status

- **Unit tests:** 80/80 passing (verified 2026-06-05)
- **Master:** clean, all recent PRs merged
- **No open PRs** as of 2026-06-05

---

## Untracked artifacts — do NOT commit

Two files left in repo root from cross-verification agent:
- `gen_report.js` — session-specific, unusable outside original env
- `ReviewBox_Code_Review_Report.docx` — generated artifact

Leave unstaged.

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
