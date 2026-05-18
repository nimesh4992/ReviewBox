# Supabase — Migrations

Forward-only SQL migrations. One file per schema change. Never edit a committed migration; add a new one.

## Filename convention

```
NNN_short_snake_name.sql
```

`NNN` is a zero-padded sequential number. Use the next number after the highest existing file. Do not use timestamps — they fight git merge ordering.

## Workflow

1. **Write the migration** — add a new file under `supabase/migrations/`.
2. **Apply to dev** — paste into Supabase SQL editor for the dev project, or `supabase db push` if using the CLI.
3. **Commit + push** the migration file to the repo.
4. **Apply to prod** — paste into prod Supabase SQL editor as part of the release.

## Rules

- **Idempotent**: every migration should be safely re-runnable. Use `if not exists`, `drop ... if exists`, `update ... where plan = 'old'`.
- **No data destruction without a follow-up grace window**: don't drop columns immediately; rename → backfill → drop in a later migration.
- **One concern per file**: keep migrations focused so they're easy to read and revert in their own commit.
- **RLS lives with the table**: when you add a new table, add its RLS policies in the same migration.

## Current schema state

- `001_initial_schema.sql` — baseline. workspaces, members, apps, reviews, automation_rules, reply_templates, knowledge_base, ai_usage, incidents, alert_preferences. RLS on all tables. pg_cron keepalive. Updated_at triggers.
- `002_plan_vocabulary.sql` — replaced `'free'` with the new plan states (`trial`, `past_due`, `canceled`). Required by middleware + Stripe webhook.
