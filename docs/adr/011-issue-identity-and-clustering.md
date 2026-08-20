# ADR 011 — Issue identity, and how reviews become Issues

**Date:** 2026-08-20
**Status:** **Proposed — recommendation stated, ratification deliberately withheld
pending the bake-off in §9.** No II1 implementation may start until the founder
ratifies (D023).
**Relates to:** `docs/ISSUE_INTELLIGENCE.md` · `docs/II_DELIVERY_PLAN.md` ·
`docs/decisions.md` D023 (constraints) · D024 (buyer) · backlog II0a/II1
**Supersedes no ADR.** First architecture decision of the Issue Intelligence epic.

---

## 1. The question this answers

Not *"how do I generate a nice AI summary?"* but:

> **What constitutes the identity of an Issue?**

Everything else — the schema, the model, the thresholds — follows from that
answer. Get it wrong and the product confidently tells a customer that 24
unrelated complaints are one problem.

## 2. Context

`reviews` today carries `issue_tags[]`, filled by **8 hardcoded English regexes**
in `src/lib/rules-engine.ts`. There is no clustering, no `issues` table, and
`reviews.embedding vector(384)` has existed unused since migration 001
(`docs/ISSUE_INTELLIGENCE.md` §4). The epic needs an entity above the review.

Three constraints bound every option below:

- **D023 §3 — multilingual is P0 architectural.** Our reviews code-switch inside
  a single sentence: *"payment कट गया but ticket nahi aaya"*.
- **The one rule** (CLAUDE.md) — no paid service before a paying customer.
- **Vercel Hobby** — daily cron, serverless functions with cold starts and a
  250MB unzipped bundle ceiling.

---

## 3. Decision 1 — what an Issue *is*

**Three conceptual levels. Two of them are persisted.**

```
Theme      Payments                          ← today's issue_tags[], ~8-20, stable
  └ Issue    "Payment deducted, no ticket"    ← THE PERSISTED UNIT
      └ Review  "paisa cut gaya, ticket nahi" ← evidence
```

So, to the founder's own example: *"Payment failed"*, *"UPI payment failed"* and
*"payment deducted but ticket wasn't generated"* are **separate Issues under one
Payments Theme** — because they are separate failures with separate fixes.

**The identity rule, stated so a human can apply it consistently:**

> **Two reviews belong to the same Issue if the same code change would resolve
> both.**

This rule is the most important sentence in this ADR. It is what makes the
golden set (`docs/II_DELIVERY_PLAN.md` §3) labellable by two different people
with the same answer, and it is what the engine is measured against. It is also
what a PM actually means by "issue", which is why it produces groupings a
customer recognises.

Rejected alternatives: *same words* (fails on Hinglish and on synonyms), *same
tag* (that is today's product), *same sentiment+version* (an artefact, not a
problem).

**Granularity guard.** Too fine and the page is 200 singletons; too coarse and
it is today's eight tags with extra steps. Control:

- a similarity/confidence threshold for attaching (§6), **and**
- a **promotion rule**: a cluster becomes a customer-visible Issue at **≥3
  attached reviews**. Below that it is a candidate, stored but not shown. Three
  is not arbitrary — it is the threshold the existing incident heuristic already
  uses for crash clusters, so the product stays internally consistent.

---

## 4. Decision 2 — storage shape

**Many-to-many. `issue_reviews`, not `reviews.issue_id`.**

Not for theoretical purity — because of a real and common case: *"app crashes on
launch AND my payment failed"* is one review describing two problems. Under the
identity rule those are two Issues (two different fixes). A foreign key on
`reviews` would force us to drop one, and the one we drop is invisible.

```
issues                          issue_reviews
------                          -------------
id                              issue_id      → issues(id) on delete cascade
workspace_id      NOT NULL      review_id     → reviews(id) on delete cascade
app_id                          workspace_id  NOT NULL     (tenant guard, D023)
theme                           confidence    NUMERIC
title                           is_primary    BOOLEAN
description                     assigned_at
status                          assigned_by   'engine' | 'user'
severity                        UNIQUE (issue_id, review_id)
owner
first_detected_at
last_seen_at
review_count
trend
confidence
merged_into_issue_id  → issues(id)
created_at / updated_at
```

Notes that are decisions, not details:

- **`first_detected_at` = `min(store_created_at)` of attached reviews**,
  recomputed on every attach. **Never the row's `created_at`.** Otherwise the
  backfill stamps every Issue "first detected today" — wrong, and it is the most
  customer-visible number on the page.
- **`merged_into_issue_id`, never `DELETE`.** Merges are additive so an Issue a
  customer has looked at never vanishes.
- **`review_count` is denormalised** and recomputed on write. The impact score
  reads it on every list render; counting a join per row per render is the
  obvious way this page gets slow.
- **`workspace_id` on both tables, NOT NULL, RLS on.** Migration 028 made this
  the house rule for exactly this reason.
- `reviews` is **not altered**. Rollback for the whole engine is "drop two
  tables".

---

## 5. Decision 3 — incremental assignment, not batch re-clustering

Per new review: normalise → find candidate Issues → decide → attach or create.

**Why not "find themes in these 5,000 reviews" periodically:**

1. It breaks `first_detected_at`, which is a customer-facing claim. A re-cluster
   that regroups reviews changes the date we told the customer last week.
2. It is non-deterministic across runs — the Issues list reshuffles for no
   visible reason, which destroys trust faster than being slightly wrong.
3. It cannot run inside a daily cron on Vercel Hobby at any real volume.

**The known weakness of incremental, stated honestly:** the first review to
arrive defines the cluster, so early noise anchors it. Mitigations: recompute
the centroid/description as reviews attach, and an **offline merge pass** that
*proposes* merges for a human, never silently rewriting history.

---

## 6. Decision 4 — confidence, and what happens below it

Every attach stores a confidence. Below the ratified threshold the review is
**left unattached**, not attached weakly.

This is a product decision, not a tuning knob. Review counts drive the impact
score, which drives what the customer works on that morning. An unattached
review is visible and countable ("18 reviews not yet grouped"); a wrongly
attached one is invisible and inflates a number someone will act on.

**Bias the threshold toward precision over recall.** Missing a review is a gap;
merging two unrelated problems is a lie.

---

## 7. The three approaches

### A. Local embeddings in-process (`@xenova/transformers` + pgvector)

The path the docs assumed existed. `all-MiniLM-L6-v2` is 384-dim, which is where
the dormant column's dimension came from.

- ➕ $0 forever, no external dependency, deterministic, uses existing pgvector.
- ➖ **`all-MiniLM-L6-v2` is English-only.** Its multilingual sibling
  (`paraphrase-multilingual-MiniLM-L12-v2`) is also 384-dim but materially
  larger; quantised it is still ~100MB+ of model to either bundle (against a
  250MB unzipped function ceiling, with the app already in there) or fetch on
  every cold start.
- ➖ **The specific failure that matters:** multilingual encoders are trained on
  native-script Hindi. **Transliterated Hinglish in Latin script is
  out-of-distribution** — "nahi aaya" is not "नहीं आया" to the tokenizer. This is
  precisely our review corpus, and it is why "$0 forever" was never as free as
  it looked.
- **Verdict:** plausible as a *retrieval* stage, high risk as the identity
  decision, and awkward on Hobby serverless. Its multilingual quality is
  measurable, not arguable — §9.

### B. Hosted embedding API + pgvector

Gemini embeddings, using the **`GEMINI_API_KEY` already configured and already
used** for sentiment and ASO.

- ➕ Strong multilingual quality; no cold-start weight; already-wired key means
  **plausibly no new paid dependency** — the decisive point against the one rule.
- ➕ Cheap per call, and embeddings are computed once per review, ever.
- ➖ Dimension is not 384 → the dormant column changes. Fine: D023 §4 says pick
  the model first and adapt the schema.
- ➖ A network call on the sync path; needs the budget ceiling and kill switch
  from `docs/II_DELIVERY_PLAN.md` §4.6.
- ➖ Free-tier rate limits are the real constraint at backfill volume, not price.
- **Verdict:** the strongest pure-vector option. **Do not quote per-token prices
  from this ADR** — verify current pricing and free-tier limits at implementation
  time; stale numbers stated as fact are how this repo has been wrong before.

### C. LLM assignment into an open taxonomy

Give the model the review plus the workspace's current Issue titles; it returns
*attach to #N with confidence*, or *propose a new Issue with this title*. Groq
(Llama 3.3 70B) is already wired, free to 6K requests/day.

- ➕ **Handles code-switching natively.** An LLM reads "payment कट गया but ticket
  nahi aaya" without difficulty; this is the one requirement D023 calls P0 and
  the one where A is weakest.
- ➕ Produces the **title and description for free** — which B and A do not; a
  vector cluster has no name, and naming it is a second problem.
- ➕ Explainable: it can return *why*, which is what II11 needs later.
- ➕ Zero new dependencies. No collision with the one rule.
- ➖ Non-deterministic — recoverable: temperature 0, plus a tenant-scoped SHA-256
  verdict cache keyed on (review text + issue-list version), exactly the pattern
  `src/lib/reply-cache.ts` already uses.
- ➖ Prompt drift across model versions: pin the model, re-run the eval on change.
- ➖ **Scale.** One call per review is fine for daily sync at our ICP's volume;
  it is impossible for a 500k-review AppFollow backfill against 6K/day.
- ➖ The Issue list must fit in context — not binding below a few hundred Issues,
  binding eventually.

---

## 8. Recommendation

**Primary: C (LLM assignment), with a two-stage funnel for backfill, and B added
later only if volume demands it.**

Reasoning, in the order that decided it:

1. **Multilingual is the P0 requirement, and it eliminates A on its own terms.**
   Our corpus is Latin-script Hinglish; that is the exact weak spot of the
   encoder family whose dimension the schema was built around.
2. **C introduces no new dependency**, so it cannot collide with the one rule.
   That is worth a great deal at this stage — it is the constraint most likely
   to stall the epic (`docs/ISSUE_INTELLIGENCE.md` §12).
3. **C names the Issue.** A and B produce an unnamed cluster; the page needs a
   title, and generating one is otherwise a second LLM call anyway.
4. **Determinism is recoverable** by caching, and the cache pattern already
   exists in this codebase and is already tested.

**Scale answer — the funnel.** Both daily sync and backfill use the same shape,
with different first stages:

```
daily sync (tens-to-hundreds/day):   review → [cheap dedup] → LLM assign → attach
backfill  (thousands-to-500k):       reviews → cheap lexical/vector pre-group
                                             → LLM assigns ONE representative
                                               per pre-group
                                             → whole pre-group inherits, each
                                               member re-checked only if it
                                               disagrees on tag/version
```

This keeps LLM calls proportional to the number of *distinct problems*, not the
number of reviews — which is the property that makes 500k tractable. It is also
the natural place B slots in later: the pre-group stage becomes vector-based
without changing the identity decision.

**Cost shape (orders of magnitude, to be measured not assumed):** daily sync at
ICP volume sits inside Groq's free tier. Backfill cost scales with distinct
problems, which for a single app is dozens-to-hundreds, not thousands. If a real
backfill disproves that, B replaces the pre-group stage.

**What this recommendation costs us:** the engine's identity decisions are made
by a model we do not control, so a Groq model deprecation is a re-validation
event, not a no-op. Pin the model id; the eval harness is what makes
re-validation a one-command answer instead of an argument.

---

## 9. Why this ADR does not ratify itself

Every claim in §7 about multilingual quality is a **prediction**. The honest
version of this decision is a measurement, and the measurement is cheap:

**The bake-off.** Build the golden set and harness
(`docs/II_DELIVERY_PLAN.md` §3), then score **A, B and C on the same ~200
labelled reviews**, broken out by language bucket. Record precision, recall and
F1 per approach in a §10 appended to this ADR, with the commit they were
measured at. Then ratify.

Three outcomes, all fine:
- C wins as predicted → proceed, B stays the scale valve.
- B is close and much cheaper at volume → B primary, C for naming only.
- **All three score badly on Hinglish** → the most valuable outcome, discovered
  in week one for a few hours of work rather than in week six after a schema,
  a backfill and a UI have been built on it. Fallback: keep Theme-level grouping
  (today's tags, which work) and ship II0/II4 release-regression, which need no
  clustering at all.

This is the ±3 week variance in `docs/ISSUE_INTELLIGENCE.md` §12, converted from
a risk into a scheduled experiment.

---

## 10. Measurements

*Empty. To be filled by the bake-off (§9) before this ADR moves to Accepted.*

---

## 11. What the founder is being asked

1. **Ratify the identity rule (§3)** — *same fix resolves both*. This is a
   product judgement, not a technical one, and it is the one thing here an agent
   genuinely cannot decide.
2. **Confirm the bake-off before implementation (§9)** rather than building on
   the recommendation directly.
3. **Book ~2 hours to label the golden set.** It is the only founder-blocking
   input, and nothing downstream is trustworthy without it.
4. **Note for later:** if the bake-off says B, that is a hosted embedding call —
   confirm whether the already-configured Gemini key keeps it inside the one
   rule, or whether it counts as a new paid service.
