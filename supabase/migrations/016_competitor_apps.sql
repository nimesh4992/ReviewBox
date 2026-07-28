-- ============================================================
-- Migration 016: Competitor tracking
--
-- The Competitors screen previously showed three hard-coded
-- "illustrative" rows. This table lets a workspace track real
-- competitor apps: the user searches the store (same flow as
-- onboarding), we store the app's identity here, and rating /
-- review-count metadata is scraped on read through the existing
-- 6-hour Redis cache (store-search.ts fetchAppMetadata).
--
-- The API and UI ship BEFORE this migration is applied and fall
-- back to the old illustrative rows until the table exists
-- (Postgres error 42P01 is caught), so running this is safe at
-- any time — and nothing breaks if it hasn't run yet.
--
-- Safe to run multiple times (IF NOT EXISTS everywhere).
-- ============================================================

CREATE TABLE IF NOT EXISTS competitor_apps (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform     TEXT        NOT NULL CHECK (platform IN ('google_play', 'app_store')),
  store_id     TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  icon_url     TEXT,
  developer    TEXT,
  added_by     TEXT,                 -- clerk user id of the member who added it
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, platform, store_id)
);

CREATE INDEX IF NOT EXISTS competitor_apps_workspace_idx
  ON competitor_apps (workspace_id, added_at);

ALTER TABLE competitor_apps ENABLE ROW LEVEL SECURITY;

-- Workspace members can read their own competitors (service role writes)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'competitor_apps'
      AND policyname = 'workspace_members_read_own_competitors'
  ) THEN
    CREATE POLICY "workspace_members_read_own_competitors"
      ON competitor_apps
      FOR SELECT
      USING (
        workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE clerk_user_id = (auth.uid())::text
        )
      );
  END IF;
END $$;

COMMENT ON TABLE competitor_apps IS
  'Competitor apps tracked per workspace (max 5 enforced in the API).
   Metadata (rating, review count) is scraped on read with a 6h cache —
   only identity is stored here.';
