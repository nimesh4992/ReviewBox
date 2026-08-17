# ADR 008 — Plan vocabulary: `free` stays, `team` retires, one source of truth

**Date:** 2026-08-17
**Status:** Accepted
**Founder decision:** in-session, 2026-08-17 — "keep free post trial state"
**Supersedes:** the plan list in D002 (see docs/decisions.md)

## Context

`workspaces.plan` carried a CHECK constraint from migration 002 allowing:

```
('trial', 'starter', 'pro', 'team', 'past_due', 'canceled')
```

The application moved in both directions afterwards and the constraint was
never updated:

1. **`free` was reintroduced** as the resting state for a lapsed trial, and as
   the fail-closed default in `resolvePlan()` (plan-enforcement.ts) and
   `isPlanName()` (rate-limit.ts). `PLAN_AFTER_TRIAL = "free"` is written to
   the column by `/api/cron/trial-expiry` (daily, every lapsed trial) and by
   `/api/onboarding/setup` (trial-abuse downgrade).
2. **`team` was retired** and replaced by `enterprise` — quote-only, assigned
   by hand — which the constraint never allowed.

Both writes were rejected by Postgres with 23514 (check_violation) on every
attempt. In the cron the error was caught but pushed into a `summary.errors`
array returned in a response body nothing reads; in onboarding the result was
never inspected at all.

**Consequence: no trial has ever ended.** Every lapsed trial kept full Pro
allowances (1,500 AI drafts, 10 apps, 1,500 published replies/month)
indefinitely — the entire trial-to-paid revenue loop — and the trial-abuse
defence silently did nothing. 136 green unit tests gave no signal, because
they asserted the TypeScript side only and TypeScript cannot see a SQL
constraint.

Found by the 2026-08-17 architecture audit as finding C-1 (Critical).

## Decision

**One canonical vocabulary, expressed in two layers that are asserted equal.**

`src/lib/plans.ts` is the source of truth:

- `PLAN_LIMITS` keys (`PlanName`) — tiers that have allowances:
  `free`, `trial`, `starter`, `pro`, `enterprise`
- `BILLING_STATES` — values the column holds that have no allowances of their
  own and resolve to `free`: `past_due`, `canceled`
- `WORKSPACE_PLANS` (`WorkspacePlan`) — the union of both, i.e. every value
  `workspaces.plan` may legally hold
- `ENTITLED_PLANS` — the subset that entitles billed routes:
  `trial`, `starter`, `pro`, `enterprise`

Migration `025_plan_vocabulary_reconcile.sql` widens the CHECK constraint to
exactly `WORKSPACE_PLANS` and retires `team` (mapping any row to `pro`, not
`free` — a vocabulary cleanup must never be a customer downgrade; `team` sat
above `pro`, and Stripe has never been live so this is expected to match zero
rows).

`free` is deliberately **not** entitled to billed routes: it is a usable
resting state (1 app, 10 AI drafts, 25 published replies/month) so a lapsed
customer keeps access to the reviews and replies they put in, but it does not
grant the paid feature set.

### Why `free` rather than `canceled`

The founder chose to keep `free`. It is the option the product is already
built around — `PLAN_LIMITS.free`, `PLAN_PRICING.free` with its own pricing
card, and the two fail-closed defaults all assume a real, usable free tier —
and locking a lapsed customer out of data they entered turns a slow purchase
decision into a refund request. `canceled` remains in the vocabulary as a
distinct billing state for genuine cancellation.

## Enforcement

The failure mode here was drift between two layers, so the fix is a check that
sees both:

- **`src/lib/plans.test.ts` parses `supabase/migrations/*.sql`**, extracts the
  plan list from the last migration that defines `workspaces_plan_check`, and
  asserts it equals `WORKSPACE_PLANS`. Changing either side alone fails
  `npm run test`. Verified by deliberately removing `free` from the migration:
  three tests fail with explicit messages.
- **A compile-time assertion** in plans.ts (`PlanName extends WorkspacePlan`)
  fails `tsc` if a tier is added to `PLAN_LIMITS` but not to the column
  vocabulary.
- **`middleware.ts` now imports `isEntitledPlan()`** instead of re-declaring a
  bare string-literal `Set`. That copy was the one place where adding a tier
  and forgetting to update it would lock a paying customer out of every billed
  route, with nothing in CI to catch it.
- **Both write paths now surface failure** — the cron logs and reports to
  Sentry when any downgrade fails, and onboarding checks the update result
  instead of assuming it landed.

## Consequences

- Migration 025 **must be applied to production** before the trial lifecycle
  works. Until then, trial expiry continues to fail (loudly now, via Sentry).
- The first cron run after the migration will downgrade every trial that has
  already lapsed — possibly a batch, since none have ever been processed. This
  is correct, but expect a burst rather than a trickle.
- D002's plan list is superseded by this ADR.
