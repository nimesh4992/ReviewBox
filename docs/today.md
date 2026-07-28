# Today — Handoff for next agent

**Last updated:** 2026-07-27
**Branch agent left on:** `claude/product-market-readiness-zcfowh` (pushed, draft PR #67 open, production domain currently serves this branch's build)

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (never-do list) are critical.
3. **`docs/backlog.md`** — ICE-ranked queue
4. **This file (`docs/today.md`)** — last session's handoff

---

## What happened this session (2026-07-27)

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

---

## What you should pick up next

1. **FOUNDER: run migration 017** (`supabase/migrations/017_support_tickets.sql`)
   — switches on the ticket system. Also **016** if still not run.
2. **FOUNDER: review + merge PR #67** (it now carries 7 slices; preview link
   in the PR). Homepage verdict still gates Website slice 2 (Pricing + Compare).
3. **Website slice 3 — the cut** (approved): delete /customers +
   /customers/acme-banking (410), /careers → 301 /about, /status → 301
   /help, merge the two contradictory refund pages (**founder must pick
   which text survives**), update sitemap.ts + robots.ts.
4. **DS-003 gray sweep** — ~1,000 raw gray-* utilities remain outside the
   redesigned screens. Mechanical, low-risk. (New admin pages intentionally
   match the existing admin gray style — internal tooling, out of scope.)
5. **BUG-037** — founder adds Clerk test secrets → make E2E blocking.

## Standing watch

- PR #67 has an hourly self check-in armed (send_later). All pushes get
  Vercel previews. Production domain points at this branch's build —
  **don't push to master until #67 merges** or prod regresses.
- Ahrefs MCP: "insufficient plan" — don't invent keyword volumes.
  SEO plan lives in `docs/SEO_CONTENT_PLAN.md` (Phase 0 shipped).

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
- Honesty rule: no fabricated metrics, testimonials, logos, or numbers —
  anywhere, ever. "Show, don't claim."
