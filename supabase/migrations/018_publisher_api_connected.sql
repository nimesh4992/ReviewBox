-- ============================================================
-- Migration 016: Track Play Console / Publisher API connection
--
-- Draft Mode (D018) syncs public scraped data with zero credentials,
-- so "sync works" no longer implies "the customer connected their
-- Play Console". This column records whether the official Publisher
-- API responded for this app — i.e. the customer actually invited our
-- service account — and drives the dashboard banner:
--
--   "You're seeing public data. Connect your Play Console to reply
--    to reviews and unlock full sync."
--
-- Written by:
--   * every sync    (true when the Publisher API returns data;
--                    false only on permission-shaped failures —
--                    transient store errors leave it untouched)
--   * verify button (POST /api/apps/[id]/test-credentials)
--
-- NULL = never determined (pre-migration rows, or no sync yet).
-- Code tolerates the column being absent until this is applied.
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS publisher_api_connected BOOLEAN;

COMMENT ON COLUMN public.apps.publisher_api_connected IS
  'Whether the official store API (Google Play Publisher API) works for
   this app, i.e. the customer granted ReviewBox access. NULL = unknown.
   Drives the "connect your Play Console" dashboard banner.';
