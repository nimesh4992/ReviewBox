-- Migration 011: Slack webhook URL per workspace
-- Run in Supabase SQL editor

alter table public.workspaces
  add column if not exists slack_webhook_url text;

comment on column public.workspaces.slack_webhook_url is
  'Slack Incoming Webhook URL for this workspace. Null = not connected.';
