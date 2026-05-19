# Today — Handoff for next agent

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
