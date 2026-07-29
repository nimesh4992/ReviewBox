-- ============================================================
-- Migration 019: Remember which storefront an app lives in
--
-- Every store call was hardcoded to the US storefront. For a
-- region-locked app (e.g. an India-only transit app) that means:
--   * it never appears in onboarding search results, and
--   * even when added by package name, the public review scrape
--     asks the US storefront and gets ZERO reviews — forever.
--     The sync "succeeds", the dashboard stays empty.
--
-- We now search several storefronts, remember the one that
-- actually carries the app, and use it for that app's reviews
-- and metadata from then on.
--
-- NULL = not yet determined; the sync discovers and backfills it
-- on the next run. Code tolerates the column being absent
-- (42703 fallbacks), so applying this is safe at any time.
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS store_country TEXT;

COMMENT ON COLUMN public.apps.store_country IS
  'ISO-3166 alpha-2 storefront this app was found in (e.g. "in", "us").
   Used for review scraping and metadata refresh. NULL = undetermined;
   sync backfills it by probing the configured storefronts.';
