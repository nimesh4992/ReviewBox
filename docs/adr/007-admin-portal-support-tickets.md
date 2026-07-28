# ADR 007 — Admin business portal + support tickets

**Date:** 2026-07-27 · **Status:** Accepted · **Backlog:** X12 (admin panel real data), extended with support tickets at founder request ("backend portal to manage the business. customer, tickets etc")

## Context

The founder needs one internal place to run the business: who signed up, what
state each customer is in, and a support inbox that isn't a personal email
thread. `/admin` already exists (customers table + analytics page, gated by
`ADMIN_CLERK_USER_ID`), but it has no overview, no per-customer drill-down, and
no ticket concept at all.

Constraints that shaped the design:

- **D013** — Stripe stays untouched. No billing wiring, no upgrade prompts.
  Revenue shown in admin is *estimated from D002 list prices*, labeled as such.
- **D009 #6** — no real emails to customers. Admin ticket replies are stored in
  the thread only; the founder sends the actual email from
  `hello@tryreviewbox.com` manually.
- **D014** — boutique ceiling (≤50 customers). In-memory grouping and simple
  sequential queries are fine; no pagination machinery, no queues.
- **D006** — schema change ships as a forward-only idempotent migration the
  founder pastes manually (`017_support_tickets.sql`).

## Decision

### Data model (migration 017)

Two tables, service-role-write-only:

- `support_tickets` — one row per request. `workspace_id` nullable (a ticket
  can arrive from email before we know the workspace; workspace deletion sets
  it null rather than destroying support history). `status`:
  `open → pending → resolved/closed` (pending = we replied, waiting on
  customer). `priority` reuses the review vocabulary (`urgent/high/normal/low`).
  `source`: `in_app | email | manual`.
- `support_ticket_messages` — the thread. `author_type` `customer|admin`,
  `is_internal` flag for admin-only notes.

RLS: enabled on both. Customers get SELECT on their own workspace's tickets
(and only non-internal messages) — future customer-facing ticket history uses
this for free. No INSERT/UPDATE/DELETE policies: every write goes through
service-role API routes.

### Access

- Pages: `/admin/*` layout redirects unless `isAdminUser()` (new
  `src/lib/admin-auth.ts`, fail-closed when `ADMIN_CLERK_USER_ID` unset).
- APIs: `/api/admin/tickets*` gate via `requireAdminUser()` → 403.
- `/api/support/tickets` (customer-facing create) requires Clerk auth,
  rate-limited 5/hour/user (D005), registered in the middleware app-route
  matcher so the prod host doesn't bounce it to /dashboard.

### Surfaces

- `/admin` — overview: active workspaces, signups 7d, est. MRR (list price),
  apps, reviews synced, open tickets, AI drafts 7d + recent signups + newest
  open tickets. Stat tiles + tables, no charts.
- `/admin/customers` — existing table, now linked to `/admin/customers/[id]`
  detail: plan/trial state, members with emails (Clerk batch lookup), apps with
  sync health, usage counts, workspace tickets, recent audit-log entries.
- `/admin/tickets` — status-filtered list; `/admin/tickets/[id]` thread view
  with reply box (stored only) + internal notes + status/priority controls;
  `/admin/tickets/new` manual logging for requests that arrive by email.
- Settings → "Contact support" card posts to `/api/support/tickets` so
  customers can file tickets in-app.

### Graceful pre-migration behavior

Every ticket read/write detects Postgres `42P01` (undefined_table) via
`isMissingTableError()` and degrades: admin pages render a "run migration 017"
notice, the customer form returns 503 with the support email fallback. Nothing
500s before the founder applies the migration (same pattern as competitor
tracking / migration 016).

## Alternatives considered

- **Third-party helpdesk (Plain, Intercom, Zendesk).** Violates the zero-cost
  rule and D009 #10 (new paid SaaS needs founder signup) for a volume of
  tickets that D014 caps at trivial. Revisit past ~50 customers.
- **Tickets as emails only (keep founder's inbox).** No state, no workspace
  linkage, invisible to future teammates. The table is ~40 lines of SQL.
- **Admin API routes for reads.** Existing admin pages query Supabase directly
  in server components; kept that pattern (fewer moving parts, gate in one
  layout). Routes exist only for mutations, which need client interactivity.
