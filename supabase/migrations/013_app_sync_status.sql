-- ============================================================
-- Migration 013: Visible sync status on apps
--
-- Sync failures are currently dropped into an in-memory summary.errors
-- array that nobody ever reads. The user sees the "Syncing your reviews…"
-- banner forever even when sync is failing every retry.
--
-- These columns let the worker persist the result of every attempt so
-- the dashboard can show ACTIONABLE errors:
--   "Service account not authorized — invite this email to Play Console"
--   "App Store API key missing — add credentials in Settings"
-- ============================================================

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS last_sync_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_sync_status       TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_error        TEXT,
  ADD COLUMN IF NOT EXISTS last_sync_review_count INTEGER;

COMMENT ON COLUMN public.apps.last_sync_attempted_at IS
  'Most recent sync attempt (regardless of success). Updated BEFORE the
   sync runs so the user can see "we tried 30s ago, still working".';
COMMENT ON COLUMN public.apps.last_sync_status IS
  'success | needs_play_console_access | needs_app_store_credentials |
   store_api_error | no_reviews_found | unknown_error';
COMMENT ON COLUMN public.apps.last_sync_error IS
  'Human-readable error message for the most recent failed sync. Null on success.';
COMMENT ON COLUMN public.apps.last_sync_review_count IS
  'How many reviews were fetched in the most recent successful sync.';
