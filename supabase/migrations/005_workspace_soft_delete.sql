-- ============================================================
-- 005 — Workspace soft-delete
-- ============================================================
-- Grace-period deletion. When a user cancels their account we set
-- workspaces.deleted_at = now(). A daily pg_cron job hard-deletes
-- rows whose deleted_at is older than 30 days. Within the grace
-- window the user can contact support to restore.
-- ============================================================

alter table public.workspaces
  add column if not exists deleted_at timestamptz;

create index if not exists workspaces_deleted_at_idx
  on public.workspaces(deleted_at)
  where deleted_at is not null;

-- Daily cron: hard-delete soft-deleted workspaces older than 30 days.
-- The cascade (workspaces → apps → reviews → ai_usage → ...) is handled
-- by the on-delete-cascade foreign keys defined in 001_initial_schema.
select cron.schedule(
  'workspaces-hard-delete',
  '0 3 * * *',
  $cron$
    delete from public.workspaces
    where deleted_at is not null
      and deleted_at < now() - interval '30 days';
  $cron$
);
