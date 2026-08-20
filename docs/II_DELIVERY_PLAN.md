# Issue Intelligence — delivery plan

**What this is.** `docs/ISSUE_INTELLIGENCE.md` says *what* we are building and
*why*. This says *how we build it so it is actually solid*, and what "done"
means at each stage. `docs/decisions.md` D023/D024 hold the constraints.

**Status:** active. Stage 0 in progress (ADR 011).

---

## 1. What "robust" has to mean here, specifically

Generic engineering rigour is not the point. This repository has a documented
record of *particular* ways work goes wrong, and every mechanism below exists to
close one of them.

| What went wrong before | What this plan does about it |
|---|---|
| 136 green tests defended a live bug — a SQL `CHECK` rejected values the app wrote, and TypeScript cannot see a SQL constraint (PR #97) | Every schema invariant gets a **contract test** and a row in the schema probe (§5) |
| Documentation claimed a system that did not exist (`@xenova/transformers`) and the epic was sized against it | **No claim ships unlocked.** Anything this epic asserts about its own behaviour is asserted by a test that can fail |
| "E2E tests (advisory)" was green while running zero specs; the deploy job was green while shipping nothing | **Every gate must be able to fail.** Each new gate ships with a deliberate-failure check proving it is wired |
| `country: "us"` worked perfectly for a US app and silently broke every Indian one | **Every stage is verified against the region-locked fixture app**, not only an English one |
| Six merge corruptions on hot files; two independent fixes for one bug fused | **One branch at a time on this epic.** Small PRs. Never "Update branch" auto-merge on a file this epic touches |
| Pending-migration fallbacks written against the wrong PostgREST error code were unreachable for months | Use `isMissingColumnError()` / `writeWithOptionalColumns()` from `@/lib/db-errors`. Never compare codes directly |
| A sync trigger that bypassed the workspace lock | The engine runs **inside `syncWorkspace()`**. No fifth trigger, no unlocked path |

And one that has not happened yet but is the obvious way this epic fails:

> **A clustering engine that is confidently wrong is worse than no clustering at
> all.** Today the product says "7 urgent reviews", which is dull but true.
> Tomorrow it will say "Payment failures — 24 reviews — Critical", and the
> customer will act on it. If those 24 reviews are not actually the same
> problem, we have not built intelligence, we have built a liar with a
> confident voice. Everything in §3 exists for this.

---

## 2. Stages, and the gate each one must pass

Each stage is a PR (or a small series). **No stage starts before the previous
stage's gate is green.**

| # | Stage | Gate |
|---|---|---|
| **0** | **ADR 011 — issue identity + clustering** | Founder ratifies a recommendation. No II1 code before this (D023) |
| **0.5** | **Golden set + eval harness** (§3) | Harness scores all three candidate approaches on the same labelled data; numbers published in the ADR; founder ratifies the winner on evidence |
| **1** | **II0 · Phase 0 release-regression** on today's `issue_tags[]` | Founder sees "Payment +375% in v1.5 vs v1.4" for a real app. Ships value while Stage 0.5 runs |
| **2** | **Schema** — `issues`, `issue_reviews`, migration, RLS, probe rows | Migration applied by founder; probe reports every column present; cross-tenant test proves isolation |
| **3** | **Engine** — assignment on new reviews, inside `syncWorkspace()`, **dark** (no UI) | Eval score ≥ ratified threshold on the golden set; admin probe shows sane clusters for the fixture apps after a real sync |
| **4** | **Backfill** — resumable cursor job over existing reviews | Runs to completion on the largest real workspace without timing out; re-running it creates zero duplicates |
| **5** | **II2/II3 · Issues list + detail + impact score** | Founder walks the Issues spine (§6) end to end |
| **6** | **II4/II5 · Release correlation + workflow** | Spec'd, tested, walked |
| **7** | **II6/II7 · Resolution tracking + issue alerts** | Alert fires once, for a real change, and does not fire twice |

**Stage 1 runs in parallel with Stage 0.5** — it touches no new schema and is
the demo that justifies the rest.

---

## 3. The centrepiece: you cannot unit-test "did it cluster correctly"

Everything else in this plan is ordinary discipline. This is the part that
decides whether the epic works.

**The problem.** `expect(cluster).toEqual(...)` is meaningless for clustering.
The output is a judgement, and the only authority on whether two reviews
describe the same problem is a human who knows the product.

**The mechanism — a golden set.**

1. **~200 real reviews** pulled from the fixture apps in
   `docs/PRODUCT_CONTEXT.md`, deliberately including the region-locked one.
   Composition is not optional: English, Hindi and Marathi in native script,
   **Hinglish and transliterated Hindi in Latin script**, and code-switched
   sentences ("payment कट गया but ticket nahi aaya"). If the set is 90% English,
   it will certify an engine that fails for most of our customers.
2. **Labelled by hand** — founder-led, agent-assisted — using the identity rule
   from ADR 011 (*two reviews are the same issue if the same code change would
   resolve both*). The rule matters more than the labels: without one, two
   labellers produce two different answers and the score means nothing.

   **Each review gets six fields, not one** (founder, 2026-08-20):

   ```
   Review
    ├── theme            Payments / Ticketing / Crashes / …
    ├── issue_id         the grouping key — same id = same underlying problem
    ├── issue_title      what the problem actually is, in plain words
    ├── is_actionable    could a team act on this, or is it noise/opinion?
    ├── severity         critical / high / medium / low
    └── language_bucket  english / native-script / hinglish
   ```

   **Author names are stripped at export.** The evaluation needs review text
   only, so no personal data enters the golden set (ADR 011 §12.3).

3. **Because those are two different evaluation problems**, and the product
   claim depends on the harder one:

   | Question | What it measures |
   |---|---|
   | *"Did ReviewBox put this review in the right Issue?"* | **classification** — easier, and not what we sell |
   | *"Did ReviewBox discover the right Issues at all?"* | **discovery** — the actual claim: "identifies the issues customers are actually experiencing" |

   `is_actionable` and `severity` exist so the impact score (II3) can be
   evaluated later against the same labelled data instead of needing a second
   labelling round.
4. **Scored by an eval harness** (`npm run eval:issues`) reporting the full
   metric set in ADR 011 §9 — precision, recall, **false merges (weighted
   heaviest)**, false splits, new-issue detection, latency, cost — **broken out
   by language bucket, never averaged into a headline number.**
5. **Run against every candidate approach** — the bake-off that decides ADR 011,
   and the regression gate for every later change to the engine.

**Two rules about the harness itself:**

- **It is a threshold gate, not an equality assertion.** Clustering output will
  drift; the question is whether it drifts below the ratified score.
- **It is not in the blocking CI job at first.** It needs API keys and real
  data. It runs on demand, and its last score is recorded in the ADR with the
  commit it was measured at. Promote it to CI only once it is stable and cheap.

### The acceptance test this all serves

Discipline is not the goal; a working product is. However sophisticated the
architecture gets, the test stays brutally simple (founder, 2026-08-20):

> Give ReviewBox 200 real reviews. Can it produce:
>
> > **Payment deducted but ticket not issued**
> > 17 reviews · Critical · first detected Aug 3
> > ↑ 241% after v1.5 · 82% Android · 3.1× baseline
>
> — and when you click it, do **all 17 reviews genuinely describe the same
> underlying problem?**
>
> If yes, the most important product threshold has been crossed and everything
> else builds on it. **If the architecture is getting more sophisticated
> without moving this test, stop and re-read this box.**

**The golden set is a founder-blocking input.** No agent can label it, because
labelling it *is* the product knowledge. Two hours of your time here is worth
more than two weeks of ours.

---

## 4. Engineering invariants

Non-negotiable properties of the engine. Each one gets a test.

1. **Deterministic.** Same review + same candidate issues → same assignment.
   The LLM path runs at temperature 0 and caches its verdict by SHA-256 of
   (review text + issue-list version), exactly as `src/lib/reply-cache.ts`
   already does for replies — including that cache key being **tenant-scoped**
   (the cross-tenant cache leak is on record; do not re-open it).
2. **Idempotent.** Re-running assignment over the same reviews creates no
   duplicate issues and no duplicate links. Enforced at the database by a unique
   constraint on `(issue_id, review_id)`, not by application logic.
3. **Never silently low-confidence.** Below the ratified threshold, a review is
   *not* attached — it is left unassigned and countable. An unattached review is
   visible; a wrongly attached one corrupts the review count, which drives the
   impact score, which drives what the customer works on that day.
4. **Tenant-isolated from the first migration.** `workspace_id NOT NULL` on both
   tables, RLS on, and a test that a read scoped to workspace B returns nothing
   for an issue in workspace A (migration 028 precedent).
5. **Additive and reversible.** `issues` and `issue_reviews` can be dropped
   without touching `reviews`. **No destructive change to `reviews` at any
   point in this epic.** Rollback for stages 2–4 is "drop two tables".
6. **Budgeted, with a kill switch.** A per-workspace call/cost ceiling per sync,
   and an env flag that disables the engine. Degraded mode is today's product:
   tag counts, which still work.
7. **`first_detected` is `min(store_created_at)` of the attached reviews** —
   never the row's `created_at`. Get this wrong and the backfill stamps every
   issue "first detected today", which is both wrong and the most
   customer-visible number on the page.
8. **Merges are additive.** Merging issue B into A writes `merged_into_issue_id`
   and keeps B. Never delete an issue a customer may have looked at.

---

## 5. Verification stack

| Layer | What it catches | Where |
|---|---|---|
| Unit tests (Vitest) | pure logic: scoring, thresholds, date math | `src/**/*.test.ts` |
| **Contract tests** | invariants TypeScript cannot see — schema shape, documented claims | `src/*-contract.test.ts` (existing pattern) |
| **Schema probe** | a migration the founder has not run yet | add rows to `/api/admin/probe/schema` |
| **Eval harness** | clustering quality, per language | `npm run eval:issues` (§3) |
| **Store probe** | region-locked app behaviour | `GET /api/admin/probe/stores` |
| **The Issues spine** | that a human watched it work | `docs/SPINE_ISSUES.md` (§6) |

---

## 6. The Issues spine — done means a human watched it

`docs/SPINE.md` is the only artefact in this repository that ever established
the product works, and it took eleven weeks to be walked once. This epic gets
its own, written **before** the code, and it is the definition of done for
stages 5–7:

1. A real app's reviews sync, and the Issues page lists issues — not tags.
2. The top issue is a problem the founder recognises as real.
3. Opening it shows the reviews that belong to it, and they genuinely belong.
4. Its affected version and platform breakdown match what the reviews say.
5. A review in Hinglish is grouped with its English equivalents.
6. The impact score ranks the issue a human would have ranked first, first.
7. Marking an issue "fixed" records the before-state.
8. After the next sync, the issue's counts update and nothing regresses.

Steps 5 and 6 are the ones that decide whether this was worth building.

---

## 7. Working agreement for this epic

- **One branch at a time.** This epic touches schema, sync and the dashboard —
  all hot files with a corruption history.
- **Small PRs, one stage each**, each with a plain-English test plan (D000).
- **Never merge on red.** CI green is the only pre-merge gate (previews are off).
- **Migrations:** the agent writes the SQL and the runbook; the **founder runs
  it** against production Supabase (D009). Never the agent.
- **Every stage updates `docs/specs/`** with its Given/When/Then in the same PR.
- **No new paid dependency** without the founder (the one rule). ADR 011 must
  state plainly whether its recommendation needs one — that is the single most
  likely place this epic collides with policy.

---

## 8. Open, and who closes it

| Item | Owner | Blocks |
|---|---|---|
| Ratify ADR 011's recommendation | Founder | Stage 2 onward |
| Label the golden set (§3) | Founder (agent-assisted) | Stage 0.5, and honest ratification |
| Decide if a paid embedding service is acceptable, should it come to that | Founder | Stage 3 |
| Run each migration against production | Founder | Stages 2, 6, 7 |
| Pricing-page row *"Topic clustering across your reviews"* — reword or ship II1 | Founder (D009 reserves pricing pages) | Nothing technical; it is a live claim we do not meet |
