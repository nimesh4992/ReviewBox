# ADR 009 — The advertised review-volume limit

**Date:** 2026-08-17 · **Decided:** 2026-08-22
**Status:** **ACCEPTED — Option B (soft cap).** Founder decision, 2026-08-22. Implemented the same day.
**Relates to:** audit finding M-6 · `src/lib/plan-enforcement.ts` · `docs/decisions.md` D009

---

## Decision, and the detour it corrects

**Option B. Ingestion never stops; the customer is told and asked.**

Shipped 2026-08-22:

- `checkReviewLimit()` is **deleted**, not merely unwired. It returned an error
  string, which is an invitation to `return` early on it — and someone did. Its
  replacement, `getReviewUsage()`, returns a report with no error in it, so a
  future gate would have to write the comparison in the open.
- The early return is gone from `syncWorkspaceApps()`, with the reasoning in a
  comment at the exact line it occupied.
- `GET /api/billing/usage` reports usage; `<ReviewQuotaBanner />` renders it on
  the dashboard at **≥80%** and again when over — which also makes true, for the
  first time, the sentence `/pricing` and `/faq` have both been carrying:
  *"We'll notify you when you hit 80% of your quota."*
- `/api/sync/reviews` no longer answers **402 REVIEW_LIMIT_REACHED**.

### What went wrong before the decision, recorded because the shape recurs

Between 2026-08-17 and 2026-08-22, **Option A shipped** — the option this
document says, in the sentence under its heading, *"Do not do this."* Commit
`fc53682` wired `checkReviewLimit()` into the sync while this ADR still read
`Status: Proposed — needs a founder decision`.

Three details are worth keeping:

1. **The customer-facing effect was the exact one predicted below.** Over the
   count, every app in the workspace stopped syncing on every scheduled run
   until the 1st — and the cron path pushed the message into `summary.errors`
   and discarded it. No email, no banner, no `last_sync_error`; the app row
   still read healthy while reviews silently stopped arriving.
2. **A safety test was inverted into cover.** `plan-enforcement.test.ts` carried
   a test asserting the function had *no callers*, whose stated purpose was to
   keep this decision from being forgotten. It was rewritten to assert the
   opposite. A guard repurposed to defend the thing it guarded against is worse
   than no guard, because it reads as diligence.
3. **The gap was found by reading the ADR against the code**, not by any test,
   any type, or any review. Nothing in the repository could have detected it —
   which is why the replacement guards assert the *absence* of a gate rather
   than the presence of a report.

**The counter-rule:** an ADR whose status is `Proposed` is not a menu. If an
option is implemented, its status changes in the same PR, or the implementation
is not authorised.

---

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

## Recommendation *(as written 2026-08-17 — adopted)*

**B**, scheduled before M2 goes live — not after. Once money is changing hands,
the gap between what `/pricing` says and what the product does stops being a
tidiness problem.

Whichever option is chosen, delete the "is still not wired" test in
`plan-enforcement.test.ts` as part of the same change; it exists only to keep
this decision from disappearing.

## Consequences of the decision

**Accepted 2026-08-22.** What this costs and what it leaves open:

- **Supabase row volume is unbounded per workspace.** That was already true
  while the limit was unenforced, and it is the price of B. A workspace that
  ingests far past its plan is a commercial conversation, not a technical stop.
- **The pricing copy is now an understatement, and must be corrected.**
  `/pricing` still says *"new reviews will pause syncing until you upgrade or
  the next cycle resets."* Under B nothing pauses. An understatement carries no
  legal exposure — the customer receives more than promised — but it is wrong,
  and it is a pricing-page edit reserved to the founder under D009 §9. Drafted
  in `docs/LAUNCH_READINESS_2026-08-22.md`; tracked as **QT1**.
- **The email in B is not built.** B reads "surface a banner … and, if it
  persists, an email." The banner ships; the email needs a dedup key and a
  cadence that does not collide with the digest crons, so it is filed rather
  than guessed at. **QT1** carries it.
- **`reviewsPerMonth` is now honestly describable** as an allowance the product
  measures and reports, which is what the number means on most SaaS pricing
  pages and what the page can defensibly say once reworded.
- **W6B(D) is unblocked.** ADR 010's fourth question — "does retention replace
  the `reviewsPerMonth` cap?" — was entangled with a live gate. It no longer is:
  there is nothing to remove, only a report to keep or drop.
