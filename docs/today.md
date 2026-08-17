# Today — 2026-08-16 (session 3)

All work is on `claude/dashboard-rating-bug-lf7pkl` → **PR #93** (open).
Typecheck clean, 362 unit tests passing (24 new), lint 0 errors.

---

## ⚠️ Founder actions, in order of cost-if-skipped

| # | Action | What breaks without it |
|---|---|---|
| 1 | **Merge PR #93** once CI is green — production deploys FAIL until it lands | Master is unbuildable; every merge ships nothing and the app serves the last good build |
| 2 | After it deploys: **Settings → Apps → Sync now**, reload the dashboard | The store rating (3.1★ for Mumbai One) only appears once a sync heals `lifetime_rating` |
| 3 | If the rating still doesn't appear: `GET /api/admin/probe/stores` → `google-metadata-regional` | Distinguishes "our bug" from "Google refusing our servers" (A8) |
| 4 | **Never merge while Build + type-check is red** | With previews off, CI is the only gate; merging red is how master broke twice today (#87, #91) |
| 5 | Set `NEXT_PUBLIC_APP_URL=https://app.tryreviewbox.com` in Vercel (carried) | Every link in every email points at the marketing site |
| 6 | Run migrations `024`, `023`, `021` (carried) | Tag editing answers MIGRATION_PENDING; trial cron dead; orphaned reviews linger |

---

## 1. The reported bug: dashboard showed 2.53, Play Console shows 3.1

`apps.lifetime_rating` was null and could never heal:

- **`refreshAppMetadata()` only ever queried the persisted `store_country`.** An app pinned to the wrong storefront fetched nothing on every sync, forever — while reviews kept arriving via the Publisher API, so the sync looked healthy. A dead or placeholder storefront now triggers a full re-probe and persists the correction.
- **The metadata write was all-or-nothing.** One missing column (PGRST204) voided the whole write, rating included. Now `writeWithOptionalColumns()`, and `metadata_refreshed_at` is finally stamped.
- **Failure-shaped scrapes were cached 6h**, pinning the failure across onboarding and every retry.

Decision logic in `src/lib/app-metadata.ts` with tests.

## 2. Master broken by the FIFTH dashboard mangling — repaired

PRs #90 and #91 both rewrote `PortfolioSparkline`; the auto-merge fused both
function bodies and #91 was merged ~1 min after opening, before CI could turn
red. Repair keeps #90's architecture (hero = store rating only, HTML axis
labels, non-scaling stroke) + #91's fixed 1–5 star axis. The "We haven't read
your store listing yet" copy in the founder's screenshot was #90's hero,
already live — not a foreign build.

## 3. Branch previews disabled (founder decision)

`vercel.json` `ignoreCommand` skips every ref except `master`. Rationale and
consequences in CLAUDE.md → Known Issues. PR template, agent docs and the
`docs/decisions.md` contract line updated: test plans run on production right
after merge; **CI green is the only pre-merge gate.** Verified live — branch
builds now report "Ignored".

## 4. The dashboard ignored the app selector (founder-reported)

`/api/dashboard/metrics` never accepted an app filter, so a two-app workspace
saw one review-count-weighted blend dominated by whichever app had more store
reviews, and switching apps changed nothing. Now `?appId=` under the
`/api/reviews` contract, keyed per app client-side, with the hero naming its
scope ("As shown on Google Play" only when the figure IS one listing's).

## 5. Audit: the same bug class everywhere else

Three sweeps (client selector gaps, server over-broad queries, cache-key
scope). ~20 instances fixed across four commits.

### The serious one — cross-tenant reply cache
`reply-cache.ts` keyed on `SHA-256(review text | rating | tone)`, but the
cached value is **raw model output** and the prompt bakes in the workspace's
sign-off, brand voice, KB snippet and char limit. Short negative reviews are
byte-identical across thousands of apps, so workspace B could be served
workspace A's draft — signed with A's team name, quoting A's private KB — and
publish it to the store. Key now carries workspace + app + full system prompt;
`buildCacheKeyRaw` is exported and tested so a refactor that drops the tenant
boundary fails a test, not a customer. The prompt build moved above the cache
read; the AI quota is still charged only before a real provider call.

### Emails quoting numbers the product contradicts
`unreplied-alert` and `weekly-digest` aggregated every app and stamped the
total with an arbitrary app's name ("App A has 127 waiting" when 117 were App
B's) — both now send one alert per app. Same for `send-now` (which also
honours the sidebar selection), `trial-nudge` and `trial-expiring`.

### Deleted apps' data leaking
Reviews of soft-deleted apps stayed in the table, so `workspace_id`-only
queries counted phantom data: CSV export (including review bodies and reply
text, plus any appId accepted → whole-corpus export), `sentiment/overview`
(ten aggregates through one unscoped helper), `aso/mine`,
`onboarding/progress`, `debug/sync-status`.

New **`src/lib/live-apps.ts`** is the single way to resolve a workspace's live
apps and honour a client appId; it fails **closed** on lookup error.

### Screens that ignored the selector
Dashboard "Export CSV" (every KPI beside it was scoped), Reports export +
"Send now", Sentiment's "Re-cluster with AI" (app A's reviews under app B's
heading), the inbox's server-side search (3+ chars dropped the app filter),
the sidebar's Inbox badge (12 vs the inbox's 4), `InboxRouter`.
The sidebar also fetched `/api/apps` by hand into local state — a second
source of truth that `["apps"]` invalidation never reached, so a new app
didn't appear until a page reload. It uses `useApps()` now.

### Structural
- **Releases** keyed version buckets on the version STRING, so two apps' "2.1.0"
  merged into one row with a blended average and a delta computed between
  unrelated products. Now `(app_id, version)` via tested
  `src/lib/release-versions.ts`; detail page honours `?appId=`.
- **Incidents**: `app_id` existed since migration 001 and was never written.
  POST records it now; GET returns the app's incidents **plus** workspace-level
  ones (filtering on `app_id` alone would hide every pre-existing row).
- **Competitors**: "your app" was `.limit(1)` with no ORDER BY — non-deterministic.

### Caches outliving their data
App delete now SCAN+DELs `ai_summary_text:*` / `aso_suggest:*` / `persona:*`
(`lib/cache-bust.ts`); publishing a reply invalidates `dashboard-metrics`;
the AI summary's Refresh actually refreshes (`?refresh=1`, still rate-limited);
the translation cache carries a body fingerprint so an edited review isn't
served its old translation for 7 days.

---

## Still open (code, no founder dependency)

1. **A8** — if Google refuses the public scrape from Vercel's IPs, no code path
   reads the listing rating. Play Developer Reporting API would be the
   credentialed source — needs an ADR.
2. **AS1** — no per-workspace sync lock (spec AC-5 gap).
3. **LT1** — more of the `PGRST204` class is still latent.
4. **plan-enforcement `checkReviewLimit`** counts reviews by workspace only,
   deliberately left alone: whether a deleted app's synced reviews should keep
   consuming monthly quota is a billing decision, not a bug. Note it is
   asymmetric with `canAddApp` directly above it, which excludes deleted apps.
5. **Automations execution log** shows other apps' activity when one app is
   selected (rules themselves are workspace config — defensible).
6. **CM1 multi-language**, **AU4** error surfacing, **CM2 remainder** — carried.

---

## Notes for the next session

- `dashboard/page.tsx` and `review-queue.tsx` are the two auto-merge casualties.
  Before touching the dashboard hero/sparkline, check open PRs for a competing
  rewrite (that is what broke master today), merge three-way locally, and run
  `npx tsc --noEmit` before pushing.
- `src/lib/live-apps.ts` is now the canonical scoping helper. New reviews
  queries should go through it rather than filtering on `workspace_id` alone.
- The Supabase/Vercel MCP accounts connected to Claude sessions belong to the
  founder's other products, NOT ReviewBox — prod DB/deploys cannot be inspected
  from a session.
