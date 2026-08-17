# Migration runbook — pending SQL to paste into Supabase

**Who runs this:** the founder. Claude never runs SQL against production
(`docs/decisions.md` D009 point 5), so these are always hand-applied.

**Where:** Supabase dashboard → SQL Editor → paste → Run.

**As of 2026-08-17**, migrations `020`, `022`, `023`, `024` may or may not be
applied — several earlier ones were applied by hand and the SQL was never
committed, so the file list is not a record of what production has. That is
fine: **all four are idempotent** (D006). Running one that is already applied
does nothing and cannot break anything. So do not spend time working out which
are live — just run them in order.

`021` is the exception and is handled separately at the bottom, because it
**deletes rows**.

---

## Part 1 — the four safe ones, in this order

Run each file top-to-bottom, one at a time, in this order. Wait for each to
report success before starting the next.

| # | File | What it unblocks if it is missing |
|---|---|---|
| 1 | `supabase/migrations/020_schema_catchup.sql` | Settings → Alerts and Automations rules (columns hand-applied in prod but never committed, so a rebuilt DB lacks them). Also enables RLS on `webhook_events`, without which the anon key can delete Stripe dedup rows and re-arm webhook replay. |
| 2 | `supabase/migrations/022_app_column_catchup.sql` | **Onboarding.** This is the one that made every new signup 500 at Step 3. Restates every `apps` and `workspaces` column the code writes. |
| 3 | `supabase/migrations/023_trial_lifecycle.sql` | The trial expiry cron. Without it `trial_ends_at` is stamped at signup and read by nobody, so every trial runs forever and cannot convert. |
| 4 | `supabase/migrations/024_tag_labels.sql` | Tag editing. Until this runs, renaming a tag or correcting a review's tags answers `MIGRATION_PENDING` in the UI. |

**Why each ends with `notify pgrst, 'reload schema';`** — and why you should not
delete that line. A column can exist in Postgres and still be missing from
PostgREST's cached copy of the schema. In that state *reads* succeed and every
*write* fails with `PGRST204`, which looks exactly like the column not existing.
Supabase normally reloads the cache on DDL, but misses it if the connection
drops or the change is made outside the SQL editor.

### Checking it worked

`GET /api/admin/probe/schema` on production reports, column by column, what the
live database actually has and which migration each one comes from. It is
read-only. Auth is a platform-admin session or `Bearer CRON_SECRET`.

That probe is the authority here — not this file, and not the migrations
directory. Only the live database knows.

---

## Part 2 — `021`, the destructive one. Do this last.

`supabase/migrations/021_orphaned_review_cleanup.sql` **deletes review rows**.
It is bounded to reviews whose app is already soft-deleted, and reviews of live
apps are untouched — but it is a `DELETE`, so treat it as one.

`docs/decisions.md` D015 names app disconnect as a valid reason to delete review
data, so this is sanctioned rather than a retention-policy change.

**Step 1 — look before you delete.** Run this on its own first:

```sql
select a.id as app_id, a.name, a.deleted_at, count(r.id) as orphaned_reviews
from public.apps a
join public.reviews r on r.app_id = a.id
where a.deleted_at is not null
group by a.id, a.name, a.deleted_at
order by orphaned_reviews desc;
```

**Step 2 — read the result.** Every app listed should be one you actually
disconnected. If an app you still use appears here, **stop** — that means its
`deleted_at` was set wrongly, and deleting would destroy live data. Say so
rather than proceeding.

**Step 3** — if the list looks right, run the `delete` at the bottom of the
file.

### What this fixes

Deleting an app soft-deleted the `apps` row and left its reviews behind. Every
reviews query filtered on `workspace_id` alone, so those rows kept counting in
Sentiment, the dashboard KPIs and the inbox — a workspace with no connected apps
still reported ~200 reviews and a 4.32 average, with no way for the customer to
see where the number came from or get rid of it. The delete route now removes an
app's reviews as part of deleting it; this clears rows orphaned before that fix
existed.

---

## After you finish

Reload the app. Tag renaming should work, and Settings → Apps → "Sync now"
refreshes the dashboard against the corrected schema.

If something still misbehaves, run `GET /api/admin/probe/schema` before
debugging anything else — four separate incidents have now turned out to be a
column the code expected and production did not have, each one costing a
round-trip of screenshots and guesswork.
