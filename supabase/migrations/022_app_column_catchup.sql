-- ============================================================
-- 022 — Every column the app code writes to `apps`, plus a schema-cache reload
-- ============================================================
-- On 2026-08-16 every new signup 500'd at Step 3 of onboarding. Vercel:
--
--   [onboarding/setup] app insert: {
--     code: 'PGRST204',
--     message: "Could not find the 'store_country' column of 'apps' in the
--               schema cache"
--   }
--
-- `apps.store_country` comes from migration 019, which production never got.
-- The route has a "retry without the metadata columns" fallback, but it was
-- gated on Postgres error 42703 — and a write never produces 42703. PostgREST
-- validates an INSERT payload against its own cached copy of the schema before
-- it builds any SQL, and rejects it itself with PGRST204. Postgres never sees
-- the statement. So the fallback could not fire and onboarding dead-ended.
--
-- The code fix (src/lib/db-errors.ts) makes every such fallback recognise both
-- codes, so a pending migration degrades instead of blocking. This migration
-- removes the reason to degrade at all.
--
-- Every statement is idempotent (D006) — safe to run against a database that
-- already has some or all of these columns.
-- ============================================================

-- ── apps: metadata + sync-status columns (migrations 012, 013, 015, 018, 019) ──
-- Re-stated here as one idempotent block because the individual migrations
-- were applied unevenly by hand and production is missing at least 019. A
-- column that already exists is skipped; nothing is dropped or retyped.
alter table public.apps
  add column if not exists icon_url               text,
  add column if not exists developer              text,
  add column if not exists lifetime_rating        numeric,
  add column if not exists lifetime_review_count  integer,
  add column if not exists metadata_refreshed_at  timestamptz,
  add column if not exists last_sync_attempted_at timestamptz,
  add column if not exists last_sync_status       text,
  add column if not exists last_sync_error        text,
  add column if not exists last_sync_review_count integer,
  add column if not exists publisher_api_connected boolean not null default false,
  add column if not exists deleted_at             timestamptz,
  add column if not exists store_country          text;

comment on column public.apps.store_country is
  'ISO-3166 alpha-2 storefront this app was found in (e.g. "in", "us").
   Used for review scraping and metadata refresh. NULL = undetermined;
   sync backfills it by probing the configured storefronts.';

-- ── workspaces: onboarding columns (migrations 001, 007a, 008) ────────────────
alter table public.workspaces
  add column if not exists trial_ends_at timestamptz,
  add column if not exists app_category  text,
  add column if not exists brand_voice   text,
  add column if not exists support_email text;

-- ── Reload PostgREST's schema cache ──────────────────────────────────────────
-- The second half of the failure mode, and the half that is invisible in the
-- table definitions: a column can exist in Postgres and still be absent from
-- PostgREST's cache, in which case reads succeed and every write to it fails
-- with PGRST204. Supabase reloads the cache automatically on DDL, but that
-- signal is missed if the connection drops or the change is made outside the
-- SQL editor. This makes it explicit.
--
-- GET /api/admin/probe/schema reports which of the two states you are in.
notify pgrst, 'reload schema';
