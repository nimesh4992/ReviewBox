# Today — 2026-08-16 (session 3, updated after the #91 merge broke master)

Work landed in **PR #91** (merged) and the follow-up PR from
`claude/dashboard-rating-bug-lf7pkl` (repair + deploy-process change).
Build clean, 344 unit tests passing, lint 0 errors.

---

## ⚠️ Founder actions, in order of cost-if-skipped

| # | Action | What breaks without it |
|---|---|---|
| 1 | **Merge the open PR** (master repair + previews-off) — production deploys are FAILING until it lands | Every merge to master since #91 ships nothing; production serves the last good build |
| 2 | After it deploys: **Settings → Apps → Sync now**, then reload the dashboard | The store rating (3.1★ for Mumbai One) only appears after a sync heals `lifetime_rating` |
| 3 | If the rating still doesn't appear: `GET /api/admin/probe/stores` → `google-metadata-regional` | Distinguishes "our bug" from "Google refusing our servers" (A8) |
| 4 | From now on: **merge only when Build + type-check are green** | With previews disabled, CI is the only gate left; merging red is how master broke twice today (#87, #91) |
| 5 | Set `NEXT_PUBLIC_APP_URL=https://app.tryreviewbox.com` in Vercel (carried) | Every link in every email points at the marketing site |
| 6 | Run migrations `024`, `023`, `021` (carried) | Tag editing answers MIGRATION_PENDING; trial cron dead; orphaned reviews linger |

---

## What happened today (session 3)

### 1. Store-rating pipeline fixed (PR #91, merged)
`apps.lifetime_rating` could never heal for a region-locked app:
- sync only ever queried the persisted `store_country` — wrong/stale value =
  null result on every sync, forever, while reviews kept flowing via the
  Publisher API. Now re-probes all storefronts and persists the correction.
- the metadata write was all-or-nothing (PGRST204 class, LT1) — now
  `writeWithOptionalColumns()` + finally stamps `metadata_refreshed_at`.
- failure-shaped scrapes (no rating AND no count) were cached 6h — no longer.
Logic extracted to `src/lib/app-metadata.ts` with tests.

### 2. Master broken by the FIFTH dashboard mangling — repaired
PR #90 (parallel session) and PR #91 both rewrote `PortfolioSparkline`.
GitHub's "Update branch" auto-merge fused the two bodies; #91 was merged
~1 min after opening, before CI could turn red; every production deploy then
failed ("Deployment failed"). Repair keeps #90's architecture (hero = store
rating only, HTML axis labels, non-scaling stroke) + #91's fixed 1–5 star
axis with integer ticks. Mystery solved along the way: the "STORE RATING /
We haven't read your store listing yet" copy the founder screenshotted was
#90's hero, already live on production.

### 3. Dashboard now follows the sidebar app selector
With two apps connected, the dashboard blended everything into one number —
the store rating was a review-count-weighted average dominated by the newer
app, and switching apps changed nothing, because `/api/dashboard/metrics`
never accepted an app filter. It now takes `?appId=` under the same contract
as `/api/reviews` (honoured only for the workspace's own live apps), the
hook keys its cache per app, and the hero says which scope it is showing:
"As shown on Google Play" only when the number IS one listing's figure,
"Weighted across your N apps" otherwise. `AiSummaryPanel` remains
workspace-wide (no app filter yet) — follow-up if it grates.

### 4. Branch previews disabled (founder decision, this session)
`vercel.json` `ignoreCommand` skips every git ref except `master`: nothing
deploys until code merges to master, which then deploys straight to
production. Rationale + consequences recorded in CLAUDE.md → Known Issues
("Branch/preview deployments are intentionally DISABLED"). PR template,
agent docs and the non-coder contract line in `docs/decisions.md` updated to
match: test plans now run on production right after merge; CI green is the
only pre-merge gate. Re-enabling previews later = remove `ignoreCommand`
AND do LT2 (Clerk preview keys) first.

---

## Still open (code, no founder dependency)

1. **A8** — if Google refuses the public scrape from Vercel's IPs, nothing
   can read the listing rating; probe tells you. Play Developer Reporting
   API would be the credentialed source — needs an ADR.
2. **AS1** — no per-workspace sync lock (spec AC-5 gap).
3. **LT1** — remaining all-or-nothing DB writes (4 converted so far).
4. **CM1 multi-language**, **AU4** error surfacing, **CM2 remainder** — carried.

---

## Notes for the next session

- `dashboard/page.tsx` and `review-queue.tsx` are the two auto-merge
  casualties. Before touching the dashboard hero/sparkline, check open PRs
  for a competing rewrite (that's what bit today), merge three-way locally,
  and run `npx tsc --noEmit` before pushing.
- With previews off, a PR's "How to test" section describes production
  right after merge; keep the rollback line in every PR.
- The Supabase/Vercel MCP accounts connected to Claude sessions belong to
  the founder's other products, NOT ReviewBox — prod DB/deploys cannot be
  inspected from a session.
