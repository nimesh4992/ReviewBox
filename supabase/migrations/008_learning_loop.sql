-- Migration 008: app category + draft learning loop
-- Run in: Supabase Dashboard → SQL Editor

-- ── workspaces ────────────────────────────────────────────────────────────────
-- app_category: one of the AppCategory enum values from brand-voice-stubs.ts
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS app_category TEXT;

COMMENT ON COLUMN workspaces.app_category IS
  'App category set during onboarding. Used to pre-fill brand_voice stub.
   Values: productivity | health_fitness | finance | gaming | shopping |
           social | education | travel | utility | other';

-- ── reviews ───────────────────────────────────────────────────────────────────
-- Track which tier generated the accepted reply + whether user edited it.
-- Enables learning loop: know which sources produce edit-free replies.
ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS draft_source TEXT,
  ADD COLUMN IF NOT EXISTS draft_edited BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN reviews.draft_source IS
  'Source tier that generated the accepted reply draft.
   Values: reply-kit | template | cache | groq | gemini | composer | manual';

COMMENT ON COLUMN reviews.draft_edited IS
  'True if the user edited the AI draft before publishing.
   NULL = no draft was generated (manual reply or pre-existing).';

-- Index: query edit rate by source for analytics
CREATE INDEX IF NOT EXISTS reviews_draft_source_idx
  ON reviews (workspace_id, draft_source)
  WHERE draft_source IS NOT NULL;
