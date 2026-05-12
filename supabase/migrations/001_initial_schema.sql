-- ============================================================
-- Revi — Initial Schema
-- Run: supabase db push  (or paste into Supabase SQL editor)
-- ============================================================

-- Enable extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector";          -- pgvector for semantic search
create extension if not exists "pg_cron";         -- keep project awake + sync jobs

-- ── Users / Workspaces ──────────────────────────────────────

create table public.workspaces (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  plan        text not null default 'free' check (plan in ('free', 'starter', 'pro', 'team')),
  stripe_customer_id   text,
  stripe_subscription_id text,
  trial_ends_at        timestamptz,
  created_at  timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid references public.workspaces(id) on delete cascade,
  clerk_user_id text not null,
  role         text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at   timestamptz not null default now(),
  primary key (workspace_id, clerk_user_id)
);

-- ── Apps ────────────────────────────────────────────────────

create table public.apps (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  name            text not null,
  platform        text not null check (platform in ('google_play', 'app_store')),
  store_id        text not null,           -- package name or bundle ID
  icon_url        text,
  -- OAuth tokens (encrypted at rest via Supabase Vault in production)
  access_token    text,
  refresh_token   text,
  token_expires_at timestamptz,
  last_synced_at  timestamptz,
  created_at      timestamptz not null default now(),
  unique (workspace_id, platform, store_id)
);

-- ── Reviews ─────────────────────────────────────────────────

create table public.reviews (
  id                uuid primary key default uuid_generate_v4(),
  app_id            uuid references public.apps(id) on delete cascade,
  workspace_id      uuid references public.workspaces(id) on delete cascade,
  -- Store identifiers
  external_id       text not null,
  source            text not null check (source in ('google_play', 'app_store')),
  -- Review content
  author            text not null,
  rating            smallint not null check (rating between 1 and 5),
  body              text not null,
  app_version       text,
  device            text,
  country           char(2),              -- ISO 3166-1 alpha-2
  language          char(5),              -- BCP 47 e.g. en-US
  -- Timestamps
  store_created_at  timestamptz not null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- AI enrichment (populated async)
  sentiment         text check (sentiment in ('critical', 'negative', 'mixed', 'positive')),
  priority          text check (priority in ('urgent', 'high', 'normal', 'low')),
  issue_tags        text[] default '{}',
  embedding         vector(384),          -- @xenova/all-MiniLM-L6-v2 dimensions
  -- Reply state
  reply_status      text not null default 'needs_reply'
                    check (reply_status in ('needs_reply', 'draft_ready', 'replied', 'waiting')),
  escalation_state  text not null default 'none'
                    check (escalation_state in ('none', 'support', 'product', 'engineering', 'incident')),
  has_ai_suggestion boolean not null default false,
  -- Store reply
  reply_text        text,
  replied_at        timestamptz,
  unique (app_id, external_id)
);

create index reviews_workspace_id_idx    on public.reviews(workspace_id);
create index reviews_app_id_idx          on public.reviews(app_id);
create index reviews_sentiment_idx       on public.reviews(sentiment);
create index reviews_priority_idx        on public.reviews(priority);
create index reviews_reply_status_idx    on public.reviews(reply_status);
create index reviews_store_created_at_idx on public.reviews(store_created_at desc);
create index reviews_rating_idx          on public.reviews(rating);
create index reviews_issue_tags_idx      on public.reviews using gin(issue_tags);
-- pgvector cosine similarity index (ivfflat, 100 lists — tune after 100K rows)
create index reviews_embedding_idx       on public.reviews
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ── Automation Rules ────────────────────────────────────────

create table public.automation_rules (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  name            text not null,
  description     text,
  enabled         boolean not null default true,
  conditions      jsonb not null default '[]',   -- AutomationCondition[]
  action          text not null,                 -- AutomationAction
  action_config   jsonb not null default '{}',   -- action-specific params
  apps_scope      text not null default 'all',   -- 'all' | app_id
  priority        smallint not null default 0,
  times_run       integer not null default 0,
  last_run_at     timestamptz,
  created_at      timestamptz not null default now()
);

create index automation_rules_workspace_idx on public.automation_rules(workspace_id);

-- ── Reply Templates ─────────────────────────────────────────

create table public.reply_templates (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  name            text not null,
  content         text not null,
  tags            text[] default '{}',
  rating_min      smallint default 1,
  rating_max      smallint default 5,
  language        char(5) default 'en',
  usage_count     integer not null default 0,
  created_at      timestamptz not null default now()
);

create index reply_templates_workspace_idx on public.reply_templates(workspace_id);

-- ── Knowledge Base ───────────────────────────────────────────

create table public.knowledge_base (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  title           text not null,
  content         text not null,
  category        text not null check (category in ('product', 'known_issue', 'faq', 'roadmap')),
  embedding       vector(384),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── AI Usage Tracking (anti-exploit) ────────────────────────

create table public.ai_usage (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  clerk_user_id   text not null,
  action          text not null,       -- 'draft_reply' | 'semantic_tag' | 'sentiment'
  model           text,                -- 'template' | 'pgvector' | 'groq' | 'claude'
  tokens_used     integer default 0,
  created_at      timestamptz not null default now()
);

-- Daily usage summary view for rate-limit checks
create index ai_usage_workspace_day_idx on public.ai_usage(workspace_id, created_at);
create index ai_usage_user_day_idx      on public.ai_usage(clerk_user_id, created_at);

-- ── Incidents ───────────────────────────────────────────────

create table public.incidents (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  app_id          uuid references public.apps(id) on delete set null,
  title           text not null,
  description     text,
  severity        text not null check (severity in ('critical', 'high', 'medium')),
  status          text not null default 'active' check (status in ('active', 'investigating', 'resolved')),
  owner           text,
  detected_at     timestamptz not null default now(),
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- ── Alert Preferences ───────────────────────────────────────

create table public.alert_preferences (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  type            text not null,
  enabled         boolean not null default true,
  channel_email   boolean not null default true,
  channel_slack   boolean not null default false,
  slack_webhook_url text,
  schedule_time   text,           -- HH:MM UTC
  schedule_dow    smallint,       -- 0=Sun..6=Sat
  schedule_dom    smallint,       -- 1-31
  created_at      timestamptz not null default now(),
  unique (workspace_id, type)
);

-- ── Row-Level Security ───────────────────────────────────────

alter table public.workspaces          enable row level security;
alter table public.workspace_members   enable row level security;
alter table public.apps                enable row level security;
alter table public.reviews             enable row level security;
alter table public.automation_rules    enable row level security;
alter table public.reply_templates     enable row level security;
alter table public.knowledge_base      enable row level security;
alter table public.ai_usage            enable row level security;
alter table public.incidents           enable row level security;
alter table public.alert_preferences   enable row level security;

-- Helper: get workspace IDs the current user belongs to
create or replace function public.my_workspace_ids()
returns setof uuid language sql stable security definer as $$
  select workspace_id from public.workspace_members
  where clerk_user_id = current_setting('request.jwt.claims', true)::json->>'sub';
$$;

-- Generic workspace-scoped policy macro (workspaces table is special)
create policy "workspace_members_select" on public.workspace_members
  for select using (workspace_id in (select public.my_workspace_ids()));

create policy "workspaces_select" on public.workspaces
  for select using (id in (select public.my_workspace_ids()));

-- For all other tables: workspace_id must be in user's workspaces
do $$ declare t text; begin
  foreach t in array array[
    'apps', 'reviews', 'automation_rules', 'reply_templates',
    'knowledge_base', 'ai_usage', 'incidents', 'alert_preferences'
  ] loop
    execute format(
      'create policy "rls_%s_select" on public.%I for select using (workspace_id in (select public.my_workspace_ids()));',
      t, t
    );
    execute format(
      'create policy "rls_%s_insert" on public.%I for insert with check (workspace_id in (select public.my_workspace_ids()));',
      t, t
    );
    execute format(
      'create policy "rls_%s_update" on public.%I for update using (workspace_id in (select public.my_workspace_ids()));',
      t, t
    );
    execute format(
      'create policy "rls_%s_delete" on public.%I for delete using (workspace_id in (select public.my_workspace_ids()));',
      t, t
    );
  end loop;
end $$;

-- ── Keep Supabase Awake (prevent auto-pause on free tier) ───

-- Runs every 15 min: lightweight heartbeat query
select cron.schedule(
  'supabase-keepalive',
  '*/15 * * * *',
  $cron$ select count(*) from public.workspaces limit 1 $cron$
);

-- ── Updated_at triggers ──────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create trigger knowledge_base_updated_at
  before update on public.knowledge_base
  for each row execute function public.set_updated_at();
