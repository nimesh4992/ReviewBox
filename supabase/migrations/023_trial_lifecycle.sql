-- ============================================================
-- 023 — Trial lifecycle: expiry, one extension, and per-app claims
-- ============================================================
-- Until now `workspaces.trial_ends_at` was stamped at signup and read by
-- nobody. No cron downgraded an expired trial, and no limit bit, so every
-- trial ran forever and the product could not convert one. This adds the
-- state needed to end a trial, extend it once, and stop the same app
-- trialling repeatedly under new accounts.
--
-- Every statement is idempotent (D006).
-- ============================================================

-- ── How many times this workspace extended its trial ─────────────────────────
-- One extension is allowed (lib/plans.ts MAX_TRIAL_EXTENSIONS). Stored as a
-- count rather than a boolean so the policy can change without a migration.
alter table public.workspaces
  add column if not exists trial_extensions_used smallint not null default 0;

-- When the trial actually ended, for cohort analysis and so support can see
-- whether a downgrade was automatic or manual.
alter table public.workspaces
  add column if not exists trial_ended_at timestamptz;

comment on column public.workspaces.trial_ended_at is
  'Set by the trial-expiry cron when a trial lapsed unpaid. Null while the
   trial is running, or if the workspace converted before it ended.';

-- ── Trial claims ─────────────────────────────────────────────────────────────
-- The unit that gets a trial is the APP, not the account.
--
-- Gating trials on the account gates nothing: email addresses are free and
-- unlimited, so the same person can trial forever with a new address each
-- fortnight. What they cannot change is the store listing they actually want
-- managed. One row per (platform, store_id) records which workspace trialled
-- it first; a later workspace adding the same app starts on `free` instead.
--
-- Note this is a claim, not a ban. The second workspace can still use the
-- product and still add the app — it just doesn't get a second free fortnight.
-- Legitimate collisions are common (an agency handing an app to its client, a
-- customer who deleted a workspace and started again), and every one of those
-- is a person we want to keep, so support can delete a row to release it.
create table if not exists public.trial_claims (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null check (platform in ('google_play', 'app_store')),
  store_id      text not null,
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  claimed_at    timestamptz not null default now(),
  -- Free-text note for support when a claim is released and re-granted.
  released_note text
);

-- One claim per app. The insert is expected to conflict — that IS the check —
-- so callers use `on conflict do nothing` and then read the holder.
create unique index if not exists trial_claims_app_uniq
  on public.trial_claims (platform, store_id);

create index if not exists trial_claims_workspace_idx
  on public.trial_claims (workspace_id);

-- RLS on, no policy: service role only. Nothing in the client should ever read
-- this table — it would tell one customer that another has a given app.
alter table public.trial_claims enable row level security;

-- ── Find trials that need ending ─────────────────────────────────────────────
-- The expiry cron scans for plan='trial' and trial_ends_at in the past. Both
-- columns are on every row, so this index keeps that a range scan rather than
-- a sequential one as the table grows.
create index if not exists workspaces_trial_expiry_idx
  on public.workspaces (plan, trial_ends_at)
  where trial_ends_at is not null;

-- ── Reload PostgREST's schema cache ──────────────────────────────────────────
-- New columns are written by the app; without this the writes fail with
-- PGRST204 even though the columns exist. See CLAUDE.md.
notify pgrst, 'reload schema';
