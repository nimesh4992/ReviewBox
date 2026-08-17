-- ============================================================
-- 025 — Reconcile workspaces.plan with the application vocabulary
-- ============================================================
-- Migration 002 narrowed this constraint to:
--   ('trial', 'starter', 'pro', 'team', 'past_due', 'canceled')
--
-- The application has since moved in both directions and the constraint was
-- never updated, so two live write paths were rejected by Postgres (23514)
-- on every attempt:
--
--   1. `free` was reintroduced as the post-trial resting state.
--      /api/cron/trial-expiry writes plan='free' for every lapsed trial, and
--      /api/onboarding/setup writes it for the trial-abuse downgrade. Both
--      were rejected, so NO TRIAL HAS EVER ENDED — every lapsed trial kept
--      full Pro allowances indefinitely, and the trial-abuse defence silently
--      did nothing.
--
--   2. `team` was retired and replaced by `enterprise` (quote-only, assigned
--      by hand). `enterprise` could never be persisted to this column.
--
-- Founder decision (2026-08-17): `free` stays as the post-trial resting state.
-- Recorded in docs/adr/008-plan-vocabulary.md and docs/decisions.md D002.
--
-- The canonical list below must stay in sync with WORKSPACE_PLANS in
-- src/lib/plans.ts. src/lib/plans.test.ts parses THIS FILE and asserts they
-- match, so drifting one without the other fails CI.
-- ============================================================

-- `team` was never sellable (Stripe has never been live, and it was removed
-- from the app's plan list before any checkout existed), so this is expected
-- to match zero rows. Mapped to `pro` rather than `free` on the principle that
-- a downgrade must never be a side effect of a vocabulary cleanup: `team` sat
-- above `pro`, so `pro` is the closest tier that loses the customer nothing.
update public.workspaces set plan = 'pro' where plan = 'team';

alter table public.workspaces
  drop constraint if exists workspaces_plan_check;

alter table public.workspaces
  add constraint workspaces_plan_check
  check (plan in ('free', 'trial', 'starter', 'pro', 'enterprise', 'past_due', 'canceled'));

-- Default stays 'trial' (set in 002). New workspaces start on a trial; `free`
-- is where they land afterwards, never where they begin.
