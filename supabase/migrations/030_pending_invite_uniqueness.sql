-- ============================================================
-- 030 — Make the "one pending invite per email" rule real
-- ============================================================
-- Audit finding L-2. Idempotent, and self-checking: if duplicates already
-- exist it reports and skips rather than failing, so pasting it can never
-- leave the schema half-changed.
--
-- Migration 006 declared:
--
--   -- Email + workspace must be unique while pending so we don't spam
--   unique (workspace_id, email, accepted_at)
--
-- The comment is wrong. Postgres treats every NULL as distinct for uniqueness,
-- and `accepted_at` is NULL for every *pending* invite — which is the only
-- case the constraint was written to cover. So the constraint fires for
-- accepted invites (where accepted_at has a value) and never for pending ones.
-- It is precisely inverted.
--
-- Nothing has gone wrong because the API deletes any prior unaccepted invite
-- before inserting the new one (`/api/team/invites` POST). That covers the
-- normal path but not two admins inviting the same person at the same moment:
-- both DELETEs match nothing, both INSERTs succeed, and the invitee gets two
-- emails with two valid tokens. Whichever they click wins; the other stays live
-- until it expires.
--
-- A partial unique index expresses the actual rule. `lower(email)` matches how
-- the API stores addresses — it lowercases on the way in — so the index and the
-- delete agree on what "the same email" means.
-- ============================================================

do $$
declare
  dupes bigint;
begin
  if to_regclass('public.workspace_invites') is null then
    raise notice '030: workspace_invites not present — skipped';
    return;
  end if;

  select count(*) into dupes from (
    select workspace_id, lower(email)
    from public.workspace_invites
    where accepted_at is null
    group by workspace_id, lower(email)
    having count(*) > 1
  ) d;

  if dupes > 0 then
    -- Not resolved automatically: each duplicate is a live invite token
    -- somebody may be holding, and picking which one to revoke is a decision,
    -- not a migration step. See the query at the bottom.
    raise notice '030: SKIPPED — % (workspace, email) pair(s) already have multiple pending invites. Resolve them, then re-run.', dupes;
    return;
  end if;

  create unique index if not exists workspace_invites_one_pending_idx
    on public.workspace_invites (workspace_id, lower(email))
    where accepted_at is null;

  -- The original constraint stays. It is useless rather than harmful (it
  -- prevents two invites to the same email accepted at the exact same
  -- microsecond), and dropping a constraint is a bigger change than this
  -- finding warrants. The comment above it in 006 is what was wrong.
  raise notice '030: pending-invite uniqueness enforced';
end $$;

-- If the migration reported duplicates, this lists them newest-first. Keep the
-- most recent token per pair and delete the rest:
--
--   select workspace_id, lower(email) as email, id, token, created_at
--   from public.workspace_invites
--   where accepted_at is null
--     and (workspace_id, lower(email)) in (
--       select workspace_id, lower(email)
--       from public.workspace_invites
--       where accepted_at is null
--       group by workspace_id, lower(email)
--       having count(*) > 1
--     )
--   order by workspace_id, email, created_at desc;
--
-- Verify afterwards — expect one row:
--
--   select indexname from pg_indexes
--   where tablename = 'workspace_invites'
--     and indexname = 'workspace_invites_one_pending_idx';
