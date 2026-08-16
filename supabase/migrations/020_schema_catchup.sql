-- ============================================================
-- 020 — Schema catch-up: columns the code uses that no migration creates
-- ============================================================
-- Several columns were added by hand in the Supabase dashboard during the
-- 2026-05-21 audit and the SQL was never committed. The result is that
-- `supabase/migrations/` can no longer rebuild production: a fresh database
-- (local dev, staging, or a disaster-recovery restore) 42703s on the routes
-- below, while prod happens to work.
--
-- Every statement is idempotent (D006), so this is safe to run against
-- production even where the column already exists.
--
--   alert_preferences.label / description / channels / schedule_day_of_week /
--     schedule_day_of_month   → used by /api/settings/alerts
--   automation_rules.action_label → used by /api/automations/rules
--
-- Also enables RLS on webhook_events — see the note at the bottom.
-- ============================================================

-- ── alert_preferences ────────────────────────────────────────────────────────
-- 001 created channel_email / channel_slack / schedule_dow / schedule_dom.
-- The route writes a JSONB `channels` object and the *_day_of_* names instead.
alter table public.alert_preferences
  add column if not exists label                 text,
  add column if not exists description           text,
  add column if not exists channels              jsonb not null default '{"email": true, "slack": false}'::jsonb,
  add column if not exists schedule_day_of_week  smallint,
  add column if not exists schedule_day_of_month smallint;

-- ── automation_rules ─────────────────────────────────────────────────────────
-- Human-readable label for the configured action ("AI reply", "Apply tag …").
alter table public.automation_rules
  add column if not exists action_label text;

-- ── webhook_events: enable RLS ───────────────────────────────────────────────
-- 004 deliberately left RLS off, reasoning that "nothing in the client should
-- ever read this table". In Supabase that has the opposite effect: the anon
-- and authenticated roles hold table grants by default, and RLS is the only
-- thing that withholds them. With RLS off, anyone holding the public anon key
-- could read, insert into, or DELETE this table — and deleting rows re-arms
-- Stripe webhook replay, since dedup works by unique-violation on insert.
--
-- Enabling RLS with no policy denies every non-service-role caller, which is
-- exactly the intent. The service role bypasses RLS, so the webhook handler
-- is unaffected.
alter table public.webhook_events enable row level security;
