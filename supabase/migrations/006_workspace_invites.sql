-- ============================================================
-- 006 — Workspace invites
-- ============================================================
-- Pending invitations sent by owners/admins. The invitee receives a
-- link with the token; they sign up (or sign in) and POST it to
-- /api/account/accept-invite which adds them as a workspace member
-- and skips onboarding.
-- ============================================================

create table public.workspace_invites (
  id            uuid primary key default uuid_generate_v4(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  email         text not null,
  role          text not null default 'member' check (role in ('admin', 'member')),
  token         text not null unique,                                -- random 32-byte hex
  invited_by    text not null,                                       -- Clerk user ID
  expires_at    timestamptz not null default (now() + interval '14 days'),
  accepted_at   timestamptz,
  accepted_by   text,                                                -- Clerk user ID of accepter
  created_at    timestamptz not null default now(),
  -- Email + workspace must be unique while pending so we don't spam
  unique (workspace_id, email, accepted_at)
);

create index workspace_invites_token_idx       on public.workspace_invites(token);
create index workspace_invites_workspace_idx   on public.workspace_invites(workspace_id, accepted_at);
create index workspace_invites_email_idx       on public.workspace_invites(lower(email));

alter table public.workspace_invites enable row level security;

create policy "rls_workspace_invites_select" on public.workspace_invites
  for select using (workspace_id in (select public.my_workspace_ids()));

create policy "rls_workspace_invites_insert" on public.workspace_invites
  for insert with check (workspace_id in (select public.my_workspace_ids()));

create policy "rls_workspace_invites_delete" on public.workspace_invites
  for delete using (workspace_id in (select public.my_workspace_ids()));
