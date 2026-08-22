-- ============================================================
-- 031 — Play version code on reviews (backlog RV1)
-- ============================================================
-- Found 2026-08-22 in Mumbai One's Play Console, and our own data cannot show
-- it: Play version NAMES are reused and non-monotonic.
--
--   version code 59 -> name "1.5"    Jun 17 2026
--   version code 51 -> name "1.4.1"  May  1 2026
--   version code 50 -> name "1.4.1"  Apr 23 2026
--   version code 49 -> name "1.5"    Apr  2 2026
--   version code 48 -> name "1.4.1"  Mar 20 2026
--
-- "1.4.1" is three separate uploads over six weeks; "1.5" is two, three months
-- apart; and 1.5 shipped BEFORE 1.4.1. We store only `app_version` (the name),
-- so /releases and the release-regression comparison merge distinct builds into
-- one row and call it a release.
--
-- Nullable on purpose, and no backfill:
--   * App Store reviews have no Play version code, and never will.
--   * Rows synced before this column existed cannot be given one after the
--     fact — Play does not serve history that far back.
--   * So `version_code IS NULL` is a permanent, legitimate state meaning "we
--     do not know which build this was", NOT missing data to be repaired.
--
-- Reading code must therefore keep falling back to `app_version`, and must not
-- treat a null as an error. Until the sync populates it this column is inert:
-- adding it changes no behaviour and breaks nothing.
-- ============================================================

alter table public.reviews
  add column if not exists version_code integer;

-- Bucketing releases is always per-app: version identifiers are unique only
-- WITHIN an app, which is the bug release-versions.ts exists to prevent.
create index if not exists reviews_app_version_code_idx
  on public.reviews(app_id, version_code);

comment on column public.reviews.version_code is
  'Google Play versionCode for the build this review was left on. NULL for App Store reviews and for rows synced before migration 031 — a legitimate permanent state, not missing data. Fall back to app_version when null.';
