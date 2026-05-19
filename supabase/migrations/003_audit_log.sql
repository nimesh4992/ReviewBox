-- ============================================================
-- 003 — Audit log
-- ============================================================
-- Append-only record of every meaningful state change in the
-- product. Used for:
--   • dispute resolution ("did your platform send that reply?")
--   • compliance / SOC2 prep
--   • debugging customer issues
-- ============================================================

create table public.audit_log (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid references public.workspaces(id) on delete cascade,
  actor_user_id text,                                -- Clerk user ID (null = system/cron)
  action        text not null,                      -- e.g. 'reply.publish', 'rule.create'
  target_type   text,                               -- 'review' | 'rule' | 'template' | 'kb' | 'app'
  target_id     text,
  payload       jsonb not null default '{}',        -- arbitrary extra context
  ip            inet,
  user_agent    text,
  created_at    timestamptz not null default now()
);

create index audit_log_workspace_idx on public.audit_log(workspace_id, created_at desc);
create index audit_log_actor_idx     on public.audit_log(actor_user_id, created_at desc);
create index audit_log_action_idx    on public.audit_log(action);

alter table public.audit_log enable row level security;

-- Read scoped to workspace members; no insert/update/delete from client.
-- Writes go through the service-role key from API routes.
create policy "rls_audit_log_select" on public.audit_log
  for select using (workspace_id in (select public.my_workspace_ids()));
