-- ============================================================
-- 028 — NOT NULL on the tenant-scoping columns
-- ============================================================
-- Audit finding M-4. Idempotent, and self-checking: it will not fail the
-- transaction if data is in the way — it reports and skips instead, so you can
-- paste the whole thing without worrying about a half-applied migration.
--
-- Migration 001 created the core tables with
--
--   workspace_id uuid references public.workspaces(id) on delete cascade
--
-- and no NOT NULL. Every later migration that added a tenant-scoped table
-- (aso_keywords, automation_execution_logs, competitor_apps) got this right
-- and wrote `not null` — the correct pattern was already known, it was just
-- never retrofitted onto the original eight.
--
-- WHY IT MATTERS
--
-- Every RLS policy in this schema is `workspace_id in (select
-- my_workspace_ids())`. A row with a NULL workspace_id is invisible to every
-- workspace under RLS — `null in (...)` is unknown, never true — while still
-- existing, still occupying space, and still reachable by any service-role
-- query that doesn't filter by workspace. It is an orphan that no tenant owns
-- and no tenant can see.
--
-- Nothing at the database layer currently stops one from being created. This
-- repo is maintained largely by AI agents writing new insert paths; a forgotten
-- `workspace_id` should fail loudly at insert time, which is what this
-- constraint buys. Migration 021 already exists to clean up orphaned reviews
-- after the fact — this is the same problem addressed at the point it happens
-- instead.
--
-- NOT INCLUDED, deliberately:
--   * incidents.app_id — declared `on delete set null`, so NULL is meaningful.
--   * workspace_members.workspace_id — already NOT NULL via the primary key.
-- ============================================================

do $$
declare
  target record;
  null_count bigint;
  applied int := 0;
  skipped int := 0;
begin
  for target in
    select * from (values
      ('apps',              'workspace_id'),
      ('reviews',           'workspace_id'),
      ('reviews',           'app_id'),
      ('automation_rules',  'workspace_id'),
      ('reply_templates',   'workspace_id'),
      ('knowledge_base',    'workspace_id'),
      ('ai_usage',          'workspace_id'),
      ('incidents',         'workspace_id'),
      ('alert_preferences', 'workspace_id')
    ) as v(tbl, col)
  loop
    -- Table absent (migration not applied on this database) — nothing to do.
    if to_regclass('public.' || target.tbl) is null then
      raise notice '028: %.% — table not present, skipped', target.tbl, target.col;
      skipped := skipped + 1;
      continue;
    end if;

    -- Column absent — same.
    if not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = target.tbl
        and column_name  = target.col
    ) then
      raise notice '028: %.% — column not present, skipped', target.tbl, target.col;
      skipped := skipped + 1;
      continue;
    end if;

    -- Already NOT NULL — re-running this migration is a no-op.
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = target.tbl
        and column_name  = target.col
        and is_nullable  = 'NO'
    ) then
      continue;
    end if;

    execute format('select count(*) from public.%I where %I is null', target.tbl, target.col)
      into null_count;

    if null_count > 0 then
      -- Deliberately NOT deleted or back-filled here. An orphaned row is
      -- somebody's data with a broken pointer, and silently destroying it
      -- inside a schema migration is not a decision this file gets to make.
      raise notice '028: %.% — SKIPPED, % existing NULL row(s). Investigate them, then re-run this migration.',
        target.tbl, target.col, null_count;
      skipped := skipped + 1;
      continue;
    end if;

    execute format('alter table public.%I alter column %I set not null', target.tbl, target.col);
    raise notice '028: %.% — set not null', target.tbl, target.col;
    applied := applied + 1;
  end loop;

  raise notice '028: done — % column(s) constrained, % skipped', applied, skipped;
end $$;

-- If anything was skipped for NULL rows, this lists them per table, e.g.:
--
--   select id, created_at from public.reviews where workspace_id is null;
--
-- Reviews specifically can be re-pointed from their app:
--
--   update public.reviews r
--      set workspace_id = a.workspace_id
--     from public.apps a
--    where r.app_id = a.id
--      and r.workspace_id is null;
--
-- then re-run this migration.
