# Today — Handoff for next agent

**Last updated:** 2026-08-15
**Branch agent left on:** `claude/product-audit-testing-toum42` (PR open — audit round + fixes)

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/PRODUCT_CONTEXT.md`** — who the customer is; an audit without it can only find inconsistency
3. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (never-do list) are critical.
4. **`docs/backlog.md`** — ICE-ranked queue
5. **This file (`docs/today.md`)** — last session's handoff

---

## ⚠️ Do this first

**One founder action is genuinely blocking, and it is a 30-second SQL query.**

`supabase/migrations/pending_combined.sql` and `007_aso_keywords.sql` both
create `aso_keywords` with **different columns**, both with
`CREATE TABLE IF NOT EXISTS`. Whichever was pasted into Supabase first silently
won, and nothing in the repo can tell us which. Run this in the Supabase SQL
editor and paste the result into this file:

```sql
select column_name from information_schema.columns where table_name = 'aso_keywords';
```

- If you see `volume_estimate` / `trend_data` → matches the code, nothing to do.
- If you see `volume` / `difficulty` → **every ASO keyword route is 500ing in
  production right now** and needs a migration to reconcile.

**Migration 020 is ready to apply** (`supabase/migrations/020_schema_catchup.sql`).
It is idempotent and safe to paste as-is. It adds columns the code already uses
but that no migration ever created (so the repo currently cannot rebuild prod),
and enables RLS on `webhook_events`.

---

## What this session did (2026-08-15)

Mandate: "audit the entire code, act like a real user, test every use case
starting from signup". Ran the full five-lens system from `AUDIT_SYSTEM.md` as
four parallel agents, plus a real browser walkthrough of all 20 screens.

**27 verified defects found, 25 fixed.** Full table with file:line evidence is
in `docs/AUDIT_SYSTEM.md` under "2026-08-15 round". The headlines:

### Two blockers — features that were 100% dead, silently

- **Every automation rule was a no-op.** Sync passed the store's `external_id`
  as the review id, but automation actions update `reviews` by uuid primary
  key — so every write was a 22P02 no-op. The execution log's `review_id` is
  TEXT, so the log happily recorded **"success"** for work that never happened.
  Auto-reply threw "review not found" on every single fire. This is why the
  Run history looked healthy while no draft ever appeared.
- **Abandoning onboarding stranded the user permanently.** Only `/complete`
  stamped the trial, and steps 4-5 include a forced ~10s wait. Close the tab
  there and you came back to: no plan in Clerk → `/api/reply/draft` defaulted a
  *missing* plan to `free` → 0 AI drafts/day → "AI draft limit reached for your
  plan", forever — while `/api/onboarding/state` said you were onboarded and
  refused to re-run the wizard. Recovery required Clerk dashboard surgery.

### The security one

`POST /api/gdpr/export` had **no owner gate** and used `apps.select("*")`,
which includes `access_token`/`refresh_token` — for App Store Connect that is
the **.p8 signing key** plus keyId/issuerId. Any invited teammate could
download the ability to post replies as the owner, outside ReviewBox, forever.

### Data-integrity: two ways reviews were being corrupted or refused

- App Store Connect sends **alpha-3** territories ("IND") into
  `reviews.country char(2)`. Postgres 22001 fails the **whole insert batch**,
  not the row — so connecting App Store Connect broke sync entirely. Now
  normalised through `toAlpha2()` (`src/lib/country-codes.ts`, 6 tests).
- AppFollow re-import was a blanket upsert that **reset reply_status and
  reply_text** on every already-imported review. Worse, rows without an ID
  column were keyed on their **position in the file**, so importing a second
  CSV overwrote unrelated reviews row-by-row. Now `ignoreDuplicates` + a
  content hash.

### The UI was lying about state in eight places

The pattern throughout: a failed fetch rendered as *empty data*, and a failed
write rendered as *success*.

- `use-apps` turned any error into `[]`, and the dashboard renders "zero apps"
  as the **first-run welcome screen** — so one transient 500 told an
  established customer their workspace was gone. (Watched this happen live in
  the browser before fixing it.)
- `use-review-queue` computed `isError` and then **didn't return it**, so a
  failed inbox fetch showed "No reviews · Connect an app in Settings" to
  someone whose app was already connected.
- Automations fabricated success outright: a rejected POST inserted a
  client-only `temp-…` rule that showed the green "Installed" state, never
  fired, and vanished on reload. `makeTemp()` is gone.
- Alert preferences always said "Preferences saved" without checking the
  response — and the route **silently dropped `slackWebhookUrl`**, the field
  the UI has a dedicated input for.

Both dashboard and inbox error states were **verified rendering in a real
browser**, not just type-checked.

### Also fixed

Settings → Team 500'd on every open (`joined_at` exists in no migration);
`trial_ends_at` was never written so day-5/day-12 trial emails have **never
sent**; onboarding told customers to invite a **made-up service-account
address**; the rating-spike alert burned its 24h dedup key *before* sending, so
any failure lost the alert for a day with no retry; five un-awaited side
effects inside `syncWorkspace` that Vercel freezes; `/api/apps` returning 200
with an empty list on DB errors; brand voice stored as raw JSON in the AI
prompt; the day-15 Stripe dead-end ("Invalid plan." on every plan).

## Verified stale — close, don't re-fix

**Backlog R1** says four API namespaces are missing from the middleware
matcher. All four are present (`src/middleware.ts:36, 89-91`). R1 is done.
`/api/reports/send-now` was the one route genuinely missing, now added.

## What's next

1. Founder: run the `aso_keywords` column check above, and apply migration 020
2. `ai_usage` is read by four dashboards and **written by nothing** — every "AI
   drafts" number in the product and the admin panel is permanently 0
3. Same swallowed-error class as above still present on ASO, Sentiment,
   Reply Kit reads, and Competitors — lower traffic, same fix shape
4. `pending_combined.sql` should be deleted once prod's real schema is known;
   keeping a file that disagrees with the numbered migrations is a trap
5. Migration numbering hit its **third** duplicate (`007` + `007a`). Next
   number is **021**.
