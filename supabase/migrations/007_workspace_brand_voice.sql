-- Migration 007: workspace brand voice + support email
-- Run in: Supabase Dashboard → SQL Editor
-- Safe to run multiple times (IF NOT EXISTS guards)

-- brand_voice: up to 500 chars, describes the team's tone/personality
-- Used by AI reply generation to produce brand-consistent drafts.
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS brand_voice   TEXT        CHECK (char_length(brand_voice) <= 500),
  ADD COLUMN IF NOT EXISTS support_email TEXT;

-- Index for persona cache invalidation queries (optional, low cardinality)
-- No index needed — workspace lookup is always by primary key.

COMMENT ON COLUMN workspaces.brand_voice IS
  '1-3 sentences describing the team voice injected into AI reply prompts.
   e.g. "We''re a friendly fitness app for beginners. We reply warmly and avoid jargon."';

COMMENT ON COLUMN workspaces.support_email IS
  'Public-facing support email shown in AI-generated reply CTAs.
   Falls back to the ReviewBox default if not set.';
