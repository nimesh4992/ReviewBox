-- ============================================================
-- 014 — Slack OAuth connection per workspace
-- ============================================================
-- Stores the OAuth access token and selected channel metadata.
-- The webhook URL for delivery continues to live on
-- workspaces.slack_webhook_url (migration 011).
-- ============================================================

create table if not exists public.workspace_slack (
  id                 uuid primary key default uuid_generate_v4(),
  workspace_id       uuid not null references public.workspaces(id) on delete cascade,
  slack_team_id      text not null,
  slack_team_name    text,
  slack_channel_id   text not null,
  slack_channel_name text not null,
  access_token       text not null,
  scope              text not null,
  installed_by       text not null,   -- Clerk user ID of the installer
  connected_at       timestamptz not null default now(),
  unique (workspace_id)               -- one Slack connection per workspace
);

create index if not exists workspace_slack_workspace_idx
  on public.workspace_slack(workspace_id);

alter table public.workspace_slack enable row level security;

-- Members can read their own workspace's connection status
create policy "rls_workspace_slack_select" on public.workspace_slack
  for select using (workspace_id in (select public.my_workspace_ids()));

-- Only service role may insert/update/delete (no anon/authed write policies)
