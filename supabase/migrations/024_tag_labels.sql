-- ============================================================
-- 024 — Editable tags: workspace display labels + per-review overrides
-- ============================================================
-- Backlog CM2. Today `reviews.issue_tags` is written by the rules engine from
-- a fixed vocabulary (src/types/review.ts) and is read-only in the product. An
-- operator who calls it "Payment failure" rather than "billing", or who sees a
-- review mis-tagged, has no way to say so.
--
-- Two separate problems, deliberately kept separate:
--
--   1. NAMING. `tag_labels` renames a tag for one workspace, for display only.
--      The stored value stays "billing" so the rules engine, the automation
--      conditions and every historical row keep matching. Renaming the
--      underlying token instead would silently break every automation rule that
--      referenced it, and there would be no way back.
--
--   2. CORRECTNESS. `reviews.issue_tags_override` records what a human says the
--      tags are. Kept in its own column rather than overwriting `issue_tags`
--      so the engine's original answer survives — that is what lets us tell
--      later how often it is wrong, and it means a re-sync cannot quietly
--      discard a human's correction.
--
-- NULL override means "nobody has touched this review"; an empty array means
-- "a human removed every tag", which is a different statement and must not
-- collapse into the first.
--
-- Every statement is idempotent (D006).
-- ============================================================

-- ── 1. Workspace-scoped display labels ───────────────────────────────────────
create table if not exists public.tag_labels (
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  tag           text not null,
  label         text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, tag)
);

comment on table public.tag_labels is
  'Per-workspace display names for the fixed issue-tag vocabulary. The tag token is never renamed; only how it is shown.';

-- ── 2. Human corrections to a single review''s tags ──────────────────────────
alter table public.reviews
  add column if not exists issue_tags_override text[];

comment on column public.reviews.issue_tags_override is
  'Tags as corrected by a person. NULL = untouched, use issue_tags. Empty array = a human cleared every tag.';

-- Partial index: only the corrected rows, which are a small minority.
create index if not exists reviews_issue_tags_override_idx
  on public.reviews using gin (issue_tags_override)
  where issue_tags_override is not null;

-- ── 3. RLS ───────────────────────────────────────────────────────────────────
alter table public.tag_labels enable row level security;

-- Same shape as every other workspace-scoped table: membership is the check,
-- and the service role (used by our server routes) bypasses RLS entirely.
drop policy if exists tag_labels_member_access on public.tag_labels;
create policy tag_labels_member_access on public.tag_labels
  for all
  using (workspace_id in (select public.my_workspace_ids()))
  with check (workspace_id in (select public.my_workspace_ids()));

-- PostgREST caches the schema and answers PGRST204 on a write naming a column
-- it has not seen. Without this the new column is invisible until the next
-- deploy restarts the API.
notify pgrst, 'reload schema';
