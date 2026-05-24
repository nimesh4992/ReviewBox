# Today — Handoff for next agent

**Last updated:** 2026-05-18 (end of long session)
**Founder is switching Claude accounts** — this file is your only source of state.

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

Don't skip. Even if you think you remember:

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — 13 IMMUTABLE rules. D000 (non-coder contract) and D009 (14 things you never do) are the most important
3. **`docs/backlog.md`** — single source of truth for what to build next, ICE-ranked
4. **This file (`docs/today.md`)** — last session's handoff

After that, the work begins.

---

## What shipped this past session (2026-05-18)

Five PRs merged to `master` and live on production:

1. `fix-onboarding-stuck-checking` — slug-check timeout safety so users can't get trapped on step 1
2. `hotfix-viewport-meta` — `<meta name="viewport">` so mobile renders at proper scale (no more "squeezed to fit")
3. `n2-notification-panel-empty-state` — replaced hardcoded "Crash spike v2.4.1" bell items with proper empty state
4. `n8-auth-pages-redesign` — split-screen `AuthShell` for sign-in/sign-up with brand panel; dropped the custom "Before we start" terms gate

Two PRs are **awaiting founder merge** (created at end of session):

5. `docs-claudemd-refresh` — updates CLAUDE.md to reflect the autopilot system
6. `n7a-landing-mobile-responsive` — closes the entire N7 (marketing site responsive) item via `globals.css` overrides + `rb-marketing` class on `MarketingShell`

Check these first — they may have merged while the founder was switching accounts.

---

## What you should pick up next

**Top non-blocked NOW item: `N5 — /compare/appfollow with real teeth` · ICE 81**

This is the founder's #1 inbound conversion asset for taking on AppFollow. Currently the `/compare` route exists but is a stub. Make it the page that closes deals.

### N5 scope — Done when:

1. **Hero strip** — clear headline (e.g., "AppFollow at 1/4 the price. Same reviews. Better AI.") + sub-headline + one CTA "Start 14-day trial — no card."
2. **Feature comparison table** — 12+ rows. Each row: feature name, AppFollow column with ✓ / ✗ / dash, ReviewBox column. Topics to include:
   - Entry price ($399/mo vs $49/mo)
   - 14-day trial without card
   - Self-serve onboarding (≤5 min)
   - AI reply pipeline (built-in 3-tier vs add-on)
   - Auto-translate review text
   - Slack integration (note: still on backlog as X1)
   - Bulk operations
   - Saved views
   - Audit log
   - GDPR export self-serve
   - Modern UI
   - Founder-led support
3. **ROI calculator widget** — interactive. User enters their #reviews/month and #apps. We compute the AppFollow cost vs ReviewBox cost and show savings ($X/year). Pure client-side, no backend.
4. **"How a switch works" timeline** — 4 steps: Sign up → Connect store → Import (CSV from AppFollow) → Done. Each step ≤ 2 min.
5. **3 customer-style quotes** — placeholder quotes are fine for v1 (we don't have real customers yet — but the page is ready when we do). Mark them as "Placeholder — replace once we have real customers" in a code comment so future you sees it.
6. **Final CTA** — "Start your trial" or "Talk to a founder" (mailto:hello@tryreviewbox.com).
7. **Mobile responsive** — the N7 CSS overrides should make this work automatically since `/compare` uses `MarketingShell`. Verify at 375px after building.

### N5 implementation notes

- **File:** `src/app/compare/page.tsx`
- **Must use** `MarketingShell` wrapper (existing pattern in landing, pricing, etc.) — gives you the responsive overrides for free
- **Design system:** brand blue `#0A84FF` only; rest via `--rb-*` tokens (see CLAUDE.md "CSS Design Tokens")
- **Effort estimate:** 3h. Keep the page server-side rendered (no need for `"use client"`) except for the ROI calculator widget, which should be its own client component in `src/components/marketing/roi-calculator.tsx`
- **Architect ADR required?** No — this is a content-and-layout change, no new patterns, no schema impact, no security concerns. Skip ADR.
- **Tests required?** Add 1 Playwright smoke test in `tests/e2e/smoke.spec.ts` confirming `/compare` loads and contains key strings ("ReviewBox", "AppFollow", "Start trial"). Don't snapshot test — the page is content-heavy.

### How to start (literal commands)

```powershell
cd D:\Projects\Reviews
git checkout master
git pull origin master
git checkout -b claude/n5-compare-appfollow-rewrite
```

Then implement, lint+test+build, commit with a marketer-friendly PR description (see `.github/PULL_REQUEST_TEMPLATE.md`), push, give founder the GitHub PR URL.

---

## What you should pick after N5

Per ICE order in the NOW section of `docs/backlog.md`:

1. **N3 — Detail pages** (`/incidents/[id]`, `/releases/[version]`). ICE 64. ~2h.
2. **N4 — Remove or wire dead buttons** across competitors/aso/reports/settings. ICE 56. ~3h.

These are smaller and lower-impact. Group them or do separately depending on session length.

---

## What requires the founder (don't try to do these alone — D009)

These are HUMAN-REQUIRED items in the backlog:

- **N1** — Apply Supabase migrations 002–006 to production via Supabase SQL editor (5 min). Until done, several recent code changes (audit log writes, workspace soft-delete, team invites, webhook dedup) will throw at runtime in production.
- **N6** — Add Stripe test keys to `.env.local` (see `.env.example` for the list). Until done, billing flow can't be tested end-to-end.

If the founder hasn't done these and you're tempted to add them yourself — **stop**. File a blocker, ask the founder.

---

## Lessons learned this session (avoid repeating)

1. **`test-play-api.ts` lint patch.** This file has a pre-existing `error: any` that fails the new CI lint check. Every branch you create off master needs to include the patch (`error: any` → `error: unknown` with typed cast) until master itself has it. Check master after merges — if N5 branch off master and `npm run lint` is clean, the patch already landed and you don't need to repeat.

2. **PowerShell quirks (Windows founder).**
   - `&&` does NOT work in PS 5.1. Use `;` to chain, or run as separate commands.
   - `gh` may not be installed — give the founder GitHub web URLs (printed by `git push`) instead of `gh pr create`.
   - `npm` may need to be `npm.cmd` in PS.
   - When the build OOMs, prefix with `NODE_OPTIONS=--max-old-space-size=6144`.

3. **Stale `.next/` cache after branch switching** causes weird `MODULE_NOT_FOUND` errors during build. Run `rm -rf .next` (or `Remove-Item -Recurse -Force .next` in PS) and rebuild. This happens reliably on Windows.

4. **`@clerk/types` is NOT installed as a separate package.** If you need the `Appearance` type, declare a local structural type. See `src/components/auth/clerk-appearance.ts` for the pattern.

5. **The founder is a non-coder.** Every PR description must be a 5-minute behavior test plan in plain English. No type-system jargon. If a PR can't be described that way, it's too big — split it. See `.github/PULL_REQUEST_TEMPLATE.md`.

6. **Vercel preview URLs occasionally need env vars set explicitly.** If the founder hits a 500 on a preview URL with `MIDDLEWARE_INVOCATION_FAILED`, the cause is almost always missing `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` or `CLERK_SECRET_KEY` in Vercel's Preview-scope env vars.

7. **CI workflow file.** The repo's `.github/workflows/ci.yml` runs build, type-check, lint, unit tests, e2e tests, security audit. If a PR's CI is red, look at the GitHub Actions log — usually lint or build. Fix on the branch, push again, CI re-runs.

---

## Active state of the repo right now

- **On branch:** `claude/n7a-landing-mobile-responsive` (committed, pushed, awaiting founder merge)
- **Master:** has 5 merged PRs from this session
- **Local branches still around:** `claude/docs-claudemd-refresh`, `claude/n7a-landing-mobile-responsive` (others were deleted after merge)
- **Dev server:** assume it's not running locally; founder may have stopped it

---

## Founder's stated context

- Solo founder, marketing-strong, never written a line of code
- 12 years marketing experience — instincts are trustworthy
- Full-time job during the day; works on this in pockets
- Wants the autopilot loop: I ship PRs on branches, founder verifies on Vercel preview, founder merges
- Goal: take on AppFollow. ReviewBox wins on price ($49 vs $399), AI-first replies, modern UX, speed of iteration

---

## If you finish N5 fast and have session time left

Pick **N3** next (detail pages). Independent PR. Same workflow:

```powershell
git checkout master
git pull
git checkout -b claude/n3-detail-pages
```

Implement `/incidents/[id]` and `/releases/[version]`. Check what's already in those route files (likely stubs). Wire to existing data sources. Mobile responsive (the N7 overrides will handle it if you use `MarketingShell`-equivalent for the app shell, but these are auth'd app pages — use `AppShell`).

---

## Final reminders

- Never push to `main`. PR only.
- Never merge PRs. Founder merges.
- Never run migrations against prod Supabase. Founder runs them.
- Never send real emails. Drafts only.
- Always write the PR description as a plain-English test plan.
- Always update this file (`docs/today.md`) at end of session.
- Always ICE-score new backlog items.

You've got this. Good luck.
**Last updated:** 2026-05-19 (end of session)
**Founder is switching Claude accounts** — this file is your only source of state.

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

Don't skip. Even if you think you remember:

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (14 things you never do) are the most important
3. **`docs/backlog.md`** — single source of truth for what to build next, ICE-ranked
4. **This file (`docs/today.md`)** — last session's handoff

After that, the work begins.

---

## What shipped this session (2026-05-19)

### N1 — Supabase migrations 002–006 applied to production ✅
Founder ran all 5 pending migrations in Supabase SQL Editor.
- 002: plan vocabulary constraint (required custom fix — existing rows had non-conforming values, normalized to `trial` before adding constraint)
- 003: audit_log table + RLS
- 004: webhook_events dedup table
- 005: workspace soft-delete + pg_cron 30-day hard-delete job
- 006: workspace_invites table + RLS

### N5 — /compare/appfollow rewrite ✅
Branch: `claude/n5-compare-appfollow-rewrite` — **awaiting founder merge**

Full rewrite of `src/app/compare/page.tsx`:
- Strong hero: "Same reviews. Better AI. At a quarter of the price." with dual CTA
- Price callout: $149 AppFollow (strikethrough) vs $49 ReviewBox
- 42-row feature comparison table across 7 categories
- Interactive ROI calculator (`src/components/marketing/roi-calculator.tsx`) — sliders for #apps and #reviews/mo → annual savings
- 4-step "Switch in an afternoon" timeline with time badges
- 3 placeholder customer quotes (marked with code comment for replacement)
- Final CTA: Start trial + mailto:hello@tryreviewbox.com
- Fixed metadata title encoding bug (â€" → –)
- MarketingShell wrapper gives mobile responsive for free

---

## PRs awaiting founder merge

1. `claude/n5-compare-appfollow-rewrite` — N5 compare page (created this session)
2. `claude/n7a-landing-mobile-responsive` — N7 marketing mobile responsive (from prior session)
3. `claude/docs-claudemd-refresh` — CLAUDE.md autopilot system docs (from prior session)

Check these first — they may have merged while the founder was switching accounts.

---

## What you should pick up next

**Top non-blocked NOW item: N3 — Detail pages · ICE 64**

`/incidents/[id]` and `/releases/[version]` both exist as dynamic routes (they appeared in the build output), but need proper detail content. Users will click these from the incident list and release health table — a blank or 404 page kills trust.

### N3 scope — Done when:
1. `/incidents/[id]` — shows incident title, severity badge, description, owner, detected-at, timeline of status changes. Wire to mock data for now (real Supabase query is N3b / later sprint).
2. `/releases/[version]` — shows version, rollout %, rating delta, complaint delta, status badge, list of reviews tagged for that version.
3. Both pages use `AppShell` (authenticated shell, not MarketingShell).
4. Both pages have a back link ("← Incidents" / "← Releases").
5. Mobile responsive — AppShell handles this.

### N3 implementation notes
- **Files:** `src/app/(app)/incidents/[id]/page.tsx`, `src/app/(app)/releases/[version]/page.tsx`
- Check what's currently in those files — they appeared in the build as dynamic routes so stubs may already exist
- Use mock data from `src/features/incidents/` and `src/features/releases/` — don't create new mock files, extend what exists
- Server components by default
- No ADR required — layout change only, no new patterns or schema

### How to start
```powershell
git checkout master
git pull origin master
git checkout -b claude/n3-detail-pages
```

---

## What requires the founder (don't try to do these alone)

- **N6** — Add Stripe test keys to `.env.local`. Until done, billing flow can't be tested.
- **Merge pending PRs** — N5, N7a, docs-claudemd-refresh are all ready.

---

## Lessons learned this session

1. **Migration 002 constraint fix.** When adding a `CHECK` constraint to an existing table, always normalize existing rows to valid values BEFORE adding the constraint — even if the migration script only updates one known bad value. The safe pattern: `UPDATE ... SET col = 'default' WHERE col NOT IN (valid_values)` before `ADD CONSTRAINT`.

2. **PowerShell `tail` not available.** Use `Select-Object -Last N` instead of `| tail -N`.

3. **Pre-existing sidebar.tsx lint warning** (`react-hooks/exhaustive-deps` on useEffect in sidebar). This is a warning not an error — it doesn't block CI. Don't fix it unless the task specifically covers sidebar work.

4. All other lessons from prior session still apply (PowerShell quirks, stale .next cache, @clerk/types not a separate package, etc.).

---

## Active state of the repo right now

- **On branch:** `claude/n5-compare-appfollow-rewrite` (committed, pushed, awaiting founder merge)
- **Master:** clean, all prior session PRs merged
- **Build:** passing — 0 errors, 1 pre-existing warning

---

## Founder's context (stable)

- Solo founder, marketing-strong, non-coder
- Autopilot loop: Claude ships PRs on branches → founder verifies on Vercel preview → founder merges
- Goal: take on AppFollow on price + AI + UX
- Works in pockets around a full-time job

---

## Final reminders

- Never push to `master`. PR only.
- Never merge PRs. Founder merges.
- Never run migrations against prod Supabase. Founder runs them.
- Always write PR descriptions as plain-English test plans (see `.github/PULL_REQUEST_TEMPLATE.md`).
- Always update this file at end of session.
- Always ICE-score new backlog items.
