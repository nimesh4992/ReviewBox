-- ============================================================
-- 002 — Plan vocabulary update
-- ============================================================
-- The middleware/Clerk source of truth uses these plan states:
--   trial, starter, pro, team, past_due, canceled
-- The workspaces.plan column (used by admin panel + reporting)
-- must match. The old default was 'free' which we no longer use.
-- ============================================================

alter table public.workspaces
  drop constraint if exists workspaces_plan_check;

alter table public.workspaces
  add constraint workspaces_plan_check
  check (plan in ('trial', 'starter', 'pro', 'team', 'past_due', 'canceled'));

alter table public.workspaces
  alter column plan set default 'trial';

-- Migrate any existing 'free' rows
update public.workspaces set plan = 'trial' where plan = 'free';
