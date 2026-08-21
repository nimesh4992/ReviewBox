# P1-1 review — sub-daily review synchronization

**Reviewed 2026-08-20/21. Verdict: PASS WITH CHANGES.** Changes applied and
verified.

> **This is the review working note. The document of record is
> `docs/MARKET_READINESS_AUDIT.md` **Part 6**, which carries the P0 item-by-item
> record, the final verified numbers, and the external blockers.** Read that
> first; this file is kept for the reasoning behind the cadence defect and the
> per-finding detail. Where the two disagree, Part 6 wins.

Full report (verdict, cadence diagram, findings, verification):
https://claude.ai/code/artifact/04c21459-eb96-458f-81ff-0001e24468a1

## ~~The one thing waiting on the founder~~ — RESOLVED, and it was never real

**Corrected 2026-08-21. Nothing is waiting on the founder here.**

This section reported that `0 */3 * * *` could not deploy, because "Vercel Hobby
rejects any cron that fires more than once per day, at deploy time" and "every
doc in this repo records this project as Hobby". The first half is true of Hobby.
The second half was the error: **the founder confirmed the project is on Vercel
Pro**, which allows once-per-minute crons and per-minute precision. The cron
deploys as shipped. No upgrade, no `pg_cron` job, no decision.

The reasoning failure is worth keeping even though the finding is void: the
Hobby claim was verified against **Vercel's public docs** — carefully, and the
docs were quoted correctly — but never against **this account**. Confirming what
a plan *would* do is not confirming which plan you are *on*. Ten documents
repeated the wrong premise, and it had propagated far enough to fix the launch
marketing claim at "daily" in `docs/decisions.md` D023 point 6.

The cron was deliberately NOT reverted to daily, which turned out to be the right
call for a second reason: reverting would have destroyed a working feature to
satisfy a constraint that did not apply.

## The cadence defect, and the rule that prevents it recurring

**Cron interval and staleness threshold compound. They are not independent.**

    worst-case interval between two syncs of one workspace = C + h

where C = cron interval, h = staleness threshold. Shipped as C=3, h=2 → **5h**,
breaching the 4h objective. Triggered by any off-cycle sync landing 1–3h after a
tick — onboarding's inline sync, Settings → "Sync now", or the dashboard
self-heal kick. A cron-only workspace was always fine at 3h, which is why it
would not surface in casual testing.

`SUB_DAILY_CADENCE_HOURS` is now **derived**, not chosen:

    SUB_DAILY_CADENCE_HOURS = max(0, FRESHNESS_OBJECTIVE_HOURS - SYNC_CRON_INTERVAL_HOURS)

Change the cron and the threshold follows. `src/subdaily-sync.test.ts` parses
`vercel.json`'s cron expression and fails if the declared interval and the code
constant disagree; `src/lib/sync-candidate.test.ts` simulates a week of ticks
across every 5-minute off-cycle offset and fails if any gap exceeds the
objective. That simulation is what caught the 5h breach.

## Three defects found in the surrounding P0 work (all fixed)

1. **`/api/sync/reviews` was in NEITHER middleware matcher.** P0 correctly
   removed it from `isPublicRoute` but never added it to `isAppRoute`, so on the
   prod app host it was 307'd to `/dashboard` — HTML to a `fetch()` expecting
   JSON. "Sync now" and the self-heal kick were broken **in production only**;
   localhost is not `isProd`. **Sixth occurrence of this bug class** in this repo.
   Fixed: `"/api/sync(.*)"` added to `isAppRoute`, pinned by 6 behavioural tests.
2. **`ci.yml` gated a job-level `continue-on-error` on `secrets`.** GitHub does
   not allow the `secrets` context there — it is a workflow *validation* error,
   so **no job in the file starts**. With CI green as the only pre-merge gate, a
   PR with zero checks reads as "nothing red" (how #95 merged on 1 of 6 checks).
   Fixed by moving the conditional to step level, where `secrets` is allowed.
   `src/ci-contract.test.ts` now forbids the job-level form.
3. **`ci-contract.test.ts` had silently stopped guarding anything.** Its regex
   grabbed the first whitespace token, so once the Clerk key became a `${{ … }}`
   expression it captured `"${{"` — no placeholder marker, so the guard decided
   CI had real keys and both honesty assertions passed vacuously. Resolver fixed.

Also fixed: the coordinator discarded the error from its own new `apps` query
(on failure every workspace looked app-less → queued nothing → reported "all up
to date": a total sync outage reading as success). It now fails **open**, which
is exactly pre-P1-1 behaviour and so cannot be a regression.

## What held up

Idempotency (guaranteed twice over — `unique (app_id, external_id)` plus
`planSyncWrites()` never downgrading reply state), quota placement (before the
fetch loop, per-workspace, uncircumventable by the coordinator), tenant safety,
provider load (two DB queries per tick; no provider contacted for a
non-candidate), and P0-2 country propagation (verified US + IN at runtime — and
this branch genuinely *fixed* App Store rows landing with `country: null`).

## Known gaps left open deliberately

- **CORRECTED 2026-08-21 — the local half of this was fixed, not left open.**
  This bullet originally read "the e2e suite executes nothing, in any
  environment", and that is no longer true locally. Two separate causes were
  conflated:
  - *In CI:* still executes zero specs, by design, until Clerk test secrets
    exist (BUG-037). Unchanged.
  - *Locally:* `playwright.config.ts` never loaded `.env*`, so the gate saw no
    Clerk variables and skipped everything. It now calls `loadEnvConfig()`, and
    the gate no longer treats "no keys at all" as a placeholder — Clerk's
    keyless development mode is a real, working instance. **Measured on the
    final tree: 20 passed · 4 skipped · 0 failed.**

  `tests/e2e/spine-flow.spec.ts` is now **collected and skipped**, not
  undiscovered — it needs an authenticated browser session and nothing can
  create one (see below). It has still never executed.
- **`CRON_SECRET` is now load-bearing.** The P0 middleware change means an unset
  secret in production bounces the cron *and* its whole worker fan-out through
  Clerk — nothing syncs. Backlog says it is set (N-CRON, 2026-05-26); the
  failure mode is silent, so confirm it in Vercel.
- **No backoff for permanently failing apps.** `last_synced_at` only advances on
  success (correct — dropping them would strand the customer), so a delisted app
  is now retried 8×/day instead of once. Harmless at this scale.
- **Quota-exhausted workspaces are still fanned out 8×/day**, each worker doing
  two queries and returning 402. Correct but wasteful.
- **Local `next build` OOMs at Node's default ~2GB heap**; needs
  `NODE_OPTIONS=--max-old-space-size=6144`. Local Windows condition, not a code
  defect — no application code was changed for it.

## Verification

**Re-run 2026-08-21 on the final tree** (the numbers below supersede the
mid-review figures of 868/868 across 80 files and "24 skipped / 0 executed",
both of which predate the last round of fixes):

`tsc --noEmit` clean · `vitest run` **886/886 across 81 files** · `lint` 0
errors (13 pre-existing warnings) · `next build` passing, 96/96 static pages ·
`test:e2e` **20 passed / 4 skipped / 0 failed** · CI-contract mutation test
**9/9 caught**.

The 4 skipped specs are skipped, **not** passed: three mocked-inbox specs plus
the browser-level spine, all needing an authenticated session that no
implemented mechanism can create.

One anomalous run reported all 80 files failing to load with `no tests` — not
reproduced across the 8 runs before and after it, including the identical
compound command. Almost certainly a Windows file-lock or Vite-cache hiccup, not
a code fault, but recorded here rather than omitted: if CI ever shows this shape,
it has been seen once locally.

Every new guard was **falsified before being trusted** — each fix was reverted
and the tests confirmed red. `docs/today.md` was deliberately NOT overwritten:
it still carries the SPINE 8/8 and Issue Intelligence narrative, and destroying
that unattended was the wrong trade.
