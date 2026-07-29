# ReviewBox Audit System

**Purpose:** catch the bugs that pass CI. Every serious defect this product has
shipped — the sync that died after day one, the drafts erased by upserts, the
forever-"Syncing…" banner, two master-breaking merges in one day — was invisible
to strict TypeScript, ESLint, unit tests, and the build. This document is the
standing system that hunts for that class of bug on a schedule, instead of
waiting for the founder to notice symptoms.

**Cadence:** weekly full audit (automated via a scheduled Claude session), plus
a mini-audit (Lens 1 only, on the changed area) inside every non-trivial PR.

---

## The four lenses

Run each lens as its own pass (or its own agent). Findings must cite
`file:line`, state a concrete failure scenario, and be verified against the
actual code — no speculation.

### Lens 1 — State over time ("what happens the SECOND time?")
The killer question for this codebase. For every code path ask:
- What happens the second time this runs? The hundredth?
- What happens if two run at once? (Dashboard self-heal + onboarding trigger +
  daily cron can all fire `syncWorkspace` for the same workspace.)
- What happens if it dies halfway? Is the partial state visible or silent?
- Does a retry duplicate side effects (emails, Slack pings, automation rules,
  Gemini enrichment)? Where is the dedup key, and what's its TTL?
- Fire-and-forget check: grep `void fetch(` in server code. On Vercel the
  lambda freezes when the response is sent — every un-awaited fetch is a bug.
  Use `after()` from `next/server`, or better, call the function in-process.

### Lens 2 — Authorization & tenant isolation
- Every route using `getServiceClient()` (bypasses RLS): does the workspace
  filter come from the SESSION, never from user input?
- Every `/api/admin/*` route individually behind the fail-closed gate in
  `src/lib/admin-auth.ts` — check per file, not per folder.
- Middleware matcher vs the prod host (`app.tryreviewbox.com`) — new API
  namespaces must be registered or they bounce to /dashboard (this has
  silently broken shipped features before; see ROLE_AUDIT).
- Cost abuse: can an authenticated user trigger unbounded scrape/AI work?
  Rate limits on anything that calls a store, Groq, or Gemini.

### Lens 3 — Schema drift (code vs migrations)
- Build the schema from `supabase/migrations/*.sql`; diff every
  `.select/.insert/.update` column list in `src/**` against it.
- Migration file numbers must be sequential and UNIQUE — we have twice had
  duplicate numbers (two 007s in May, two 016s in July). Check first.
- Every 42703/42P01 fallback: does it merely degrade, or does it silently
  DROP data/status? Silent no-ops are findings (the "sync succeeded but did
  nothing" bug was exactly this).
- New tables must enable RLS in the same migration that creates them.
- Maintain the "must be applied in prod" migration list in today.md.

### Lens 4 — Product honesty & UX dead-ends
- Every button/link: does it do something real, and does the target route
  exist? (The dashboard shipped a "Set alert →" link to a nonexistent
  /alerts route.)
- Spinners and empty states: is there a path where the fetch failed but the
  UI says "loading" or "no data yet" forever? Every loading state needs an
  error/timeout exit.
- Swallowed errors: `catch(() => {})` on user actions with no feedback.
- Numbers that lie: lifetime store counts next to synced-window counts,
  "automatic"/"real-time" copy vs a daily cron, etc.

---

## Process rules (learned 2026-07-28, the hard way)

1. **One repair owner.** When master breaks, exactly ONE session owns the
   repair. Others must not "helpfully" fix the same files — three parallel
   sessions repairing the same two files broke master twice and nearly a
   third time. Check open PRs for overlapping files before touching them.
2. **Never resolve merge conflicts in the GitHub web UI** for code files.
   Both master breakages came from web-UI resolutions that kept both sides.
   Resolve locally, run `tsc`, then push.
3. **Branch protection on master requiring green CI** is the only durable
   fix for 1 and 2. Until the founder enables it, every merge is on trust.
4. A finding isn't fixed until the *visibility* is fixed too: if a path can
   fail, it must fail loudly (status column, summary.errors, Sentry, or a
   banner) — never return "success" having done nothing.

## Definition of done for an audit round

- Findings ranked BLOCKER → LOW, each with file:line + failure scenario.
- BLOCKER/HIGH fixes shipped as a PR (plain-English test plan per D000),
  or explicitly parked in the backlog with an ICE score and a reason.
- docs/backlog.md updated; docs/today.md updated with the round's summary.
- The "must-apply migrations" list refreshed.

## Current standing findings (2026-07-28 round, main-loop pass)

| # | Lens | Severity | Finding | Status |
|---|------|----------|---------|--------|
| A1 | 1 | HIGH | Slack `auth.revoke` fired via `void fetch` in settings/slack + gdpr/delete — on Vercel the revoke often never executes; GDPR delete leaves a live Slack token | ✅ Fixed (after()) |
| A2 | 3 | HIGH | Two migrations numbered 016 (publisher_api_connected vs competitor_apps) | ✅ Fixed (renamed to 018) |
| A3 | 4 | MEDIUM | Dashboard "Set alert →" links to nonexistent `/alerts` | ✅ Fixed (→ /settings) |
| A4 | 1 | MEDIUM | Concurrent `syncWorkspace` runs possible (self-heal + onboarding + cron); reviews upsert is race-safe (ignoreDuplicates) but alerts/enrichment rely on Redis dedup only — needs a per-workspace sync lock | 🔲 Backlog AS1 |
| A5 | 2 | OPEN | Deep authz sweep of admin/tickets/competitors routes — agent round interrupted by usage limit, resumes automatically | 🔲 In progress |

The interrupted four-agent deep sweep re-runs automatically; append its
verified findings here when it completes.
