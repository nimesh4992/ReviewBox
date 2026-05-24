-- ============================================================
-- Migration 014: Apps soft-delete
--
-- DELETE /api/apps/[id] now sets deleted_at instead of hard-
-- deleting, preserving review history. Apps with deleted_at set
-- are filtered from all GET /api/apps queries and review syncs.
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS apps_deleted_at_idx
  ON public.apps(deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN public.apps.deleted_at IS
  'Soft-delete timestamp. NULL = active. Non-null = deleted by user.
   Review history is preserved. Hard-delete via GDPR flow only.';
