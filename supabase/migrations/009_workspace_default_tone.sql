-- Migration 009: Add default_tone column to workspaces
-- Stores the workspace's preferred AI reply tone.
-- Sourced from the AI Styles tab in Reply Kit.
-- Defaults to 'professional' for all existing workspaces.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS default_tone TEXT DEFAULT 'professional'
  CHECK (
    default_tone IN ('professional', 'empathetic', 'casual', 'direct', 'enthusiastic')
  );
