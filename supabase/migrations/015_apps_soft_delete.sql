-- ============================================================
-- Migration 015: App soft-delete
--
-- Adds deleted_at to the apps table so individual apps can be
-- soft-deleted while preserving their review history. Mirrors the
-- pattern used for workspaces in migration 005.
--
-- The DELETE /api/apps/[id] route was already written to use this
-- column but the column was missing — deleting an app silently failed.
-- GET /api/apps already filters .is("deleted_at", null); this migration
-- makes that filter work correctly.
--
-- Safe to run multiple times (ADD COLUMN IF NOT EXISTS).
-- ============================================================

ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS apps_deleted_at_idx
  ON public.apps (deleted_at)
  WHERE deleted_at IS NOT NULL;

COMMENT ON COLUMN public.apps.deleted_at IS
  'Soft-delete timestamp. Null = active. Set by DELETE /api/apps/[id].
   Reviews are preserved. Hard-delete can be triggered via GDPR route.';
