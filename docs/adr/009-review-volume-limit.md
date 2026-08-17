# ADR 009 — The advertised review-volume limit is not enforced

**Date:** 2026-08-17
**Status:** Proposed — **needs a founder decision before M2 (Stripe live)**
**Relates to:** audit finding M-6 · `src/lib/plan-enforcement.ts` · `docs/decisions.md` D009

## Context

`PLAN_LIMITS` (`src/lib/plans.ts`) gives every plan a `reviewsPerMonth`:

| plan | reviews / month |
|---|---|
| free | 1,000 |
| starter | 5,000 |
| trial · pro | 50,000 |
| enterprise | 999,999 |

That number is shown to customers in two places — `/pricing` and the in-app
Billing page — as a plan-differentiating feature.

`checkReviewLimit(workspaceId, plan)` is fully implemented: it resolves the
plan, counts the workspace's reviews for the calendar month, and returns an
upgrade message when the count is at or over the limit.

**It has zero call sites.** It is not called from the sync pipeline, from any
API route, or from anywhere else in `src/`. The other two functions in the same
module — `canAddApp` and `canPublishReply` — *are* correctly wired in.

So the limit is advertised and never enforced. Nothing errors, nothing looks
broken, and there is no screen on which the gap could be noticed; it simply
never fires. A lapsed-trial workspace on `free` can ingest unlimited review
volume.

`src/lib/plan-enforcement.test.ts` carries a test that asserts the function
still has no callers, so the gap stays visible rather than being forgotten.
That test is a placeholder for this decision, not a substitute for it.

## Why this is not being decided unilaterally

`docs/decisions.md` D009: *"Don't change pricing or billing logic without an
ADR + founder approval."* Enforcing an advertised limit is a gating change and
changing the copy is a pricing-page change. Both are the founder's call. This
ADR exists to make the choice concrete, not to make it.

## Options

### A. Enforce at sync time — hard stop

Call `checkReviewLimit()` in `syncWorkspace()` and stop ingesting when the
workspace is over.

**Do not do this.** Review ingestion is the product. Stopping it means a paying
Starter customer who has a good month stops seeing their own reviews —
including the 1★ ones they bought the tool to catch — because of a cap they
have no in-product warning about. The failure is silent and looks like the
product breaking, which is the worst possible form of an upsell.

### B. Soft cap — ingest everything, prompt to upgrade (recommended)

Keep syncing without limit. When a workspace passes its `reviewsPerMonth`,
surface a banner ("You're over your plan's monthly review volume — upgrade to
keep full history") and, if it persists, an email. Nothing is ever withheld;
the customer is asked.

This is what the number actually means in practice for most SaaS, it makes the
advertised limit true in a defensible sense, and it cannot break anyone's
workflow. It is roughly a day's work: the check, a banner component, and a
threshold state so it isn't shown on every page load.

### C. Drop the claim

Remove `reviewsPerMonth` from `/pricing` and Billing, and delete
`checkReviewLimit()`. Honest and cheap (an hour), but it gives up a real
differentiator between Starter and Pro right before Stripe goes live, so it is
only right if the answer to "will we ever meter this?" is no.

## Recommendation

**B**, scheduled before M2 goes live — not after. Once money is changing hands,
the gap between what `/pricing` says and what the product does stops being a
tidiness problem.

Whichever option is chosen, delete the "is still not wired" test in
`plan-enforcement.test.ts` as part of the same change; it exists only to keep
this decision from disappearing.

## Consequences of leaving it as-is

No customer is harmed today — the limit is unenforced in the customer's favour.
The cost is Supabase row volume on the free tier and a claim on the pricing
page that the product does not implement. Neither is urgent. Both get worse the
moment a paid plan exists to be compared against.
