-- ============================================================
-- 021 — Remove reviews belonging to already-deleted apps
-- ============================================================
-- Deleting an app soft-deleted the `apps` row and left its reviews in place.
-- Nothing downstream excludes them: every reviews query filters on
-- workspace_id alone, so those rows kept counting in Sentiment, the dashboard
-- KPIs and the inbox. A workspace with no connected apps still reported 200
-- reviews and a 4.32 average, with no way for the customer to see where the
-- number came from or to get rid of it.
--
-- The route now removes an app's reviews as part of deleting it
-- (src/app/api/apps/[id]/route.ts). This clears the rows orphaned before that
-- fix existed.
--
-- docs/decisions.md D015 names app disconnect as one of the three valid
-- reasons to delete review data, so this is sanctioned rather than a
-- retention-policy change.
--
-- SAFETY: bounded to reviews whose app is soft-deleted. Reviews belonging to
-- live apps are untouched. Run the SELECT first if you want to see the count
-- before committing to the DELETE.
-- ============================================================

-- Preview — how many rows this will remove, and for which apps:
--
--   select a.id as app_id, a.name, a.deleted_at, count(r.id) as orphaned_reviews
--   from public.apps a
--   join public.reviews r on r.app_id = a.id
--   where a.deleted_at is not null
--   group by a.id, a.name, a.deleted_at
--   order by orphaned_reviews desc;

delete from public.reviews r
using public.apps a
where r.app_id = a.id
  and a.deleted_at is not null;
