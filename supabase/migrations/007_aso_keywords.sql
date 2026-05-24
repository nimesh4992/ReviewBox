-- Migration 007: ASO keyword tracker
-- Stores per-workspace/per-app keyword rank snapshots.
-- Rank numbers are populated by a future cron job; null = not yet tracked.

create table if not exists aso_keywords (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references workspaces(id) on delete cascade,
  app_id         uuid references apps(id) on delete cascade,
  keyword        text not null,
  current_rank   int,
  previous_rank  int,
  volume_estimate int,          -- rough monthly search volume (user-entered, nullable)
  trend_data     int[],         -- last 6 rank snapshots newest-last (lower = better)
  added_at       timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique(workspace_id, app_id, keyword)
);

alter table aso_keywords enable row level security;

create policy "workspace members manage their keywords"
  on aso_keywords for all
  using (
    workspace_id in (
      select workspace_id from workspace_members
      where clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

create index if not exists aso_keywords_workspace_idx
  on aso_keywords(workspace_id, app_id);
