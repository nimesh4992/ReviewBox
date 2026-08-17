-- ============================================================
-- 027 — Two RLS policies ask the wrong identity system
-- ============================================================
-- Audit finding M-3. Safe to run at any time; idempotent.
--
-- Every workspace-scoped policy in this schema resolves the caller through
-- one helper:
--
--   public.my_workspace_ids()  -- migration 001
--     select workspace_id from workspace_members
--     where clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub'
--
-- Two later migrations did not use it, and hand-wrote this instead:
--
--   where clerk_user_id = (auth.uid())::text
--
--   * 010_automation_execution_log.sql -> automation_execution_logs
--   * 016_competitor_apps.sql          -> competitor_apps
--
-- `auth.uid()` is Supabase-native auth: it reads the JWT `sub` claim and casts
-- it to `uuid`. This product authenticates with Clerk, whose subject is
-- `user_2NNjPq...` — not a uuid. So the comparison is not merely wrong, it is
-- a cast error waiting on a real user token.
--
-- WHY THIS IS LATENT, AND WHY IT STILL MATTERS
--
-- Nothing reaches these policies today: every route uses the service-role
-- client, which bypasses RLS entirely, and `getSupabaseClient()` (the anon-key
-- client RLS depends on) has exactly one reference in src/ — its own
-- definition. So today the policies deny nothing and allow nothing; they are
-- decoration.
--
-- That is precisely the risk. The next PR that adds a client-side or edge
-- function read against either table will trust these policies, and get a
-- confusing 22P02 type-cast error rather than the workspace-scoped rows the
-- policy plainly appears to grant. This repo has been bitten repeatedly by
-- exactly this shape — a check reading a value from the wrong system, sitting
-- quiet until something finally executes it.
--
-- Fixing it now costs nothing (no behaviour changes, because nothing calls it)
-- and removes a trap that only springs once someone is already debugging
-- something else.
-- ============================================================

do $$
begin
  -- automation_execution_logs (migration 010)
  if to_regclass('public.automation_execution_logs') is not null then
    drop policy if exists "workspace_members_read_own_logs"
      on public.automation_execution_logs;

    create policy "workspace_members_read_own_logs"
      on public.automation_execution_logs
      for select
      using (workspace_id in (select public.my_workspace_ids()));

    raise notice '027: reconciled RLS policy on automation_execution_logs';
  else
    raise notice '027: automation_execution_logs not present — skipped';
  end if;

  -- competitor_apps (migration 016)
  if to_regclass('public.competitor_apps') is not null then
    drop policy if exists "workspace_members_read_own_competitors"
      on public.competitor_apps;

    create policy "workspace_members_read_own_competitors"
      on public.competitor_apps
      for select
      using (workspace_id in (select public.my_workspace_ids()));

    raise notice '027: reconciled RLS policy on competitor_apps';
  else
    raise notice '027: competitor_apps not present — skipped';
  end if;
end $$;

-- Verification — every workspace-scoped policy should now read the same way.
-- Anything still mentioning auth.uid() is a policy this migration missed:
--
--   select tablename, policyname, qual
--   from pg_policies
--   where schemaname = 'public'
--     and qual ilike '%auth.uid%';
--
-- Expect zero rows.
