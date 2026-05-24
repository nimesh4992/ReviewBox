-- ============================================================
-- Combined pending migrations: 007_workspace_brand_voice →
-- 007_aso_keywords → 008 → 009 → 010 → 011
--
-- Run ONCE in Supabase Dashboard → SQL Editor
-- Safe: all statements use IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================

-- ── 007_workspace_brand_voice ────────────────────────────────
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS brand_voice   TEXT CHECK (char_length(brand_voice) <= 500),
  ADD COLUMN IF NOT EXISTS support_email TEXT;

COMMENT ON COLUMN workspaces.brand_voice IS
  '1-3 sentences describing team voice injected into AI reply prompts.';
COMMENT ON COLUMN workspaces.support_email IS
  'Public-facing support email shown in AI-generated reply CTAs.';

-- ── 007_aso_keywords ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.aso_keywords (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  app_id          UUID REFERENCES public.apps(id) ON DELETE CASCADE,
  keyword         TEXT NOT NULL,
  current_rank    SMALLINT,
  previous_rank   SMALLINT,
  volume          TEXT,
  difficulty      TEXT,
  tracked_since   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, app_id, keyword)
);

CREATE INDEX IF NOT EXISTS aso_keywords_workspace_idx
  ON public.aso_keywords (workspace_id);
CREATE INDEX IF NOT EXISTS aso_keywords_app_idx
  ON public.aso_keywords (app_id);

ALTER TABLE public.aso_keywords ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'aso_keywords' AND policyname = 'rls_aso_keywords_select'
  ) THEN
    CREATE POLICY "rls_aso_keywords_select" ON public.aso_keywords
      FOR SELECT USING (workspace_id IN (SELECT public.my_workspace_ids()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'aso_keywords' AND policyname = 'rls_aso_keywords_insert'
  ) THEN
    CREATE POLICY "rls_aso_keywords_insert" ON public.aso_keywords
      FOR INSERT WITH CHECK (workspace_id IN (SELECT public.my_workspace_ids()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'aso_keywords' AND policyname = 'rls_aso_keywords_update'
  ) THEN
    CREATE POLICY "rls_aso_keywords_update" ON public.aso_keywords
      FOR UPDATE USING (workspace_id IN (SELECT public.my_workspace_ids()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'aso_keywords' AND policyname = 'rls_aso_keywords_delete'
  ) THEN
    CREATE POLICY "rls_aso_keywords_delete" ON public.aso_keywords
      FOR DELETE USING (workspace_id IN (SELECT public.my_workspace_ids()));
  END IF;
END $$;

-- ── 008_learning_loop ────────────────────────────────────────
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS app_category TEXT;

COMMENT ON COLUMN workspaces.app_category IS
  'App category set during onboarding. Values: productivity | health_fitness |
   finance | gaming | shopping | social | education | travel | utility | other';

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS draft_source TEXT,
  ADD COLUMN IF NOT EXISTS draft_edited BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS reviews_draft_source_idx
  ON reviews (workspace_id, draft_source)
  WHERE draft_source IS NOT NULL;

-- ── 009_workspace_default_tone ───────────────────────────────
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS default_tone TEXT DEFAULT 'professional'
  CHECK (default_tone IN ('professional', 'empathetic', 'casual', 'direct', 'enthusiastic'));

-- ── 010_automation_execution_log ─────────────────────────────
CREATE TABLE IF NOT EXISTS automation_execution_logs (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id    UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_id         UUID        NOT NULL,
  rule_name       TEXT        NOT NULL,
  review_id       TEXT        NOT NULL,
  review_rating   SMALLINT,
  review_snippet  TEXT,
  action          TEXT        NOT NULL,
  status          TEXT        NOT NULL DEFAULT 'success'
                              CHECK (status IN ('success', 'error')),
  error_message   TEXT,
  executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS automation_execution_logs_workspace_idx
  ON automation_execution_logs (workspace_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS automation_execution_logs_rule_idx
  ON automation_execution_logs (rule_id, executed_at DESC);

ALTER TABLE automation_execution_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'automation_execution_logs'
    AND policyname = 'workspace_members_read_own_logs'
  ) THEN
    CREATE POLICY "workspace_members_read_own_logs"
      ON automation_execution_logs FOR SELECT
      USING (
        workspace_id IN (
          SELECT workspace_id FROM workspace_members
          WHERE clerk_user_id = (auth.uid())::text
        )
      );
  END IF;
END $$;

ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS action_config TEXT;

-- ── 011_slack_webhook ────────────────────────────────────────
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;

COMMENT ON COLUMN public.workspaces.slack_webhook_url IS
  'Slack Incoming Webhook URL for this workspace. Null = not connected.';
