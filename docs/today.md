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
