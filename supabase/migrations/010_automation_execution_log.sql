-- Migration 010: Automation execution log
-- Records every time an automation rule fires against a review.
-- Used to power the Run history panel in the AutomationHub UI.

CREATE TABLE IF NOT EXISTS automation_execution_logs (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_id         UUID        NOT NULL,  -- soft ref: rule may be deleted
  rule_name       TEXT        NOT NULL,
  review_id       TEXT        NOT NULL,
  review_rating   SMALLINT,
  review_snippet  TEXT,                  -- first 120 chars of review text
  action          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'success'
                              CHECK (status IN ('success', 'error')),
  error_message   TEXT,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup: latest logs per workspace (used by the UI panel)
CREATE INDEX IF NOT EXISTS automation_execution_logs_workspace_idx
  ON automation_execution_logs (workspace_id, executed_at DESC);

-- Fast lookup: logs per rule (used by per-rule drill-down)
CREATE INDEX IF NOT EXISTS automation_execution_logs_rule_idx
  ON automation_execution_logs (rule_id, executed_at DESC);

ALTER TABLE automation_execution_logs ENABLE ROW LEVEL SECURITY;

-- Workspace members can read their own logs (service role writes)
CREATE POLICY "workspace_members_read_own_logs"
  ON automation_execution_logs
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE clerk_user_id = (auth.uid())::text
    )
  );

-- Also add action_config column to automation_rules if missing
-- (stores which tag to apply, or which template ID to use)
ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS action_config TEXT;
