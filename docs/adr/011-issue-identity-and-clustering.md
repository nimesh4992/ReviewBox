# ADR 011 — Issue identity, and how reviews become Issues

**Date:** 2026-08-20
**Status:** **Split, deliberately.**
- §3 **identity rule — ACCEPTED**, ratified by the founder 2026-08-20, wording preserved.
- §6 **merge/split asymmetry — ACCEPTED** the same day, as a product safety property.
- §7–§8 **approach recommendation — still Proposed.** The bake-off in §9 is a
  **hard gate**: implementation may not begin until its results are recorded in §10.
- §12 **provider and data policy — stated, not assumed**, at the founder's direction.
  The Gemini question in §11.4 is **deliberately not decided here**.
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

**Nuance that prevents a future ambiguity (founder, 2026-08-20):** the rule
describes **issue equivalence, not implementation equivalence.** Two Issues may
end up fixed in the same release, by the same engineer, in adjacent lines of the
same file, and still be two Issues. The question is not *"were these fixed
together?"* but *"would fixing one, by itself, resolve the other?"*

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

**The asymmetry, ratified 2026-08-20 — this is policy, not tuning:**

> **When uncertain, separate rather than merge.**

The two errors are not equally bad and must never be traded off as if they were:

| Error | What the customer sees | Cost |
|---|---|---|
| **False split** — one problem becomes two Issues | Two similar cards near each other | Annoying. Visible. Self-correcting — a human merges them |
| **False merge** — three unrelated problems become one "Payment Issue" | One confident card: *"Payment failures · 47 reviews · Critical"* | **Dangerous.** Invisible. The product has made a confidently wrong recommendation, and the customer spends their week on it |

A false split costs a click. A false merge costs trust in the entire product,
and it is the specific failure this epic must not ship. So: bias the threshold
toward precision, weight the bake-off accordingly (§9), and when the engine
cannot tell, it creates a new Issue rather than attaching to an existing one.

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

## 9. The bake-off — a hard gate

**Ratified as a hard gate by the founder, 2026-08-20.** The sequence this
exists to prevent:

```
choose Groq → build engine → discover Groq isn't good enough → rewrite engine
```

The sequence required instead:

```
                    ~200 labelled reviews
                           │
             ┌─────────────┼─────────────┐
             ↓             ↓             ↓
        Groq / LLM     Embeddings      Lexical
             │             │             │
             └─────────────┼─────────────┘
                           ↓
                  score, by language bucket
                           ↓
                    quality + cost
                           ↓
                   ADR decision (§10)
                           ↓
                     implementation
```

**No implementation may begin until §10 below is filled in.** That is the gate.

### What gets measured

Not "accuracy". Accuracy hides exactly the failure we care about.

| Metric | Why |
|---|---|
| Assignment **precision** | of the reviews put in an Issue, how many belong |
| Assignment **recall** | of the reviews that belong, how many were found |
| **False merges** | unrelated problems fused into one Issue — **weighted heaviest** (§6) |
| **False splits** | one problem scattered across several Issues |
| **Unknown / new-issue detection** | does it correctly open a *new* Issue rather than forcing a bad fit? |
| **Latency** per review | it runs inside the sync path |
| **Cost at 5k / 50k / 500k** reviews | measured on the funnel (§8), not extrapolated per-review |

### Reported per language bucket, never averaged

| Bucket | |
|---|---|
| English | |
| Native-script Indian languages | Hindi, Marathi — Devanagari |
| **Hinglish / code-switching** | Latin-script Hindi, mixed sentences |

The failure mode this prevents, in the founder's words: reporting

> English 91% · Hindi 89% · **Hinglish 42%** · **Overall 86%**

and celebrating the 86%. For an India-first product the Hinglish column is not
a detail of the result — for a large share of our customers' reviews, it *is*
the result. **A weighted average may not be reported as the headline score.**

### Three outcomes, all acceptable

- The recommendation holds → proceed, B stays the scale valve.
- B is close and much cheaper at volume → B primary, C for naming only.
- **All three score badly on Hinglish** → the most valuable outcome, found in
  week one rather than week six. Fallback: keep Theme-level grouping (today's
  tags, which work) and ship II0/II4 release-regression, which need no
  clustering at all.

This is the ±3 week variance in `docs/ISSUE_INTELLIGENCE.md` §12, converted from
a risk into a scheduled experiment.

## 10. Measurements

*Empty. To be filled by the bake-off (§9) before this ADR moves to Accepted.*

### 10.1 What may fill this section, and what may not

Added 2026-08-20 after the readiness review of the first clean golden set. §9
says the result is "reported per language bucket, never averaged"; that was
policy in prose and nothing enforced it. `src/lib/eval/cluster-metrics.ts` now
does, and these are the rules this section is filled in under.

**All six slices are always reported.** Three within-bucket and three
cross-bucket, derived from `LANGUAGE_BUCKETS`, never from the data. A slice with
no examples prints `N/A — 0 examples`. It is not omitted, because a report that
silently drops the buckets it could not test reads as complete — and that is how
a bake-off certifies English and gets filed as if it had certified everything.

**A slice may only decide if it is `usable`.** Thresholds, both required:

| Floor | Value | Why |
|---|---|---|
| reviews on the **smaller** side of the slice | `MIN_SLICE_REVIEWS` = 10 | |
| pairs in the slice | `MIN_SLICE_PAIRS` = 30 | |

The first floor is deliberately on the *limiting arm*, not on the total. On the
first clean census `cross:english×hinglish` had **1,164 pairs generated by six
Hinglish reviews** — each appearing in ~194 of them. Pairs are not independent
observations, and a slice that looks well-powered by pair count while resting on
six judgements is the most dangerous number in the report.

Anything below a floor is labelled `low-n / exploratory`. It is published, and
it is not evidence.

**Two numbers may never choose an engine.** `overall` (already labelled *not a
headline* under D025) and `safety.weightedErrors`. The second is the one that
nearly got through: it is the only single figure in the report, it is documented
"lower is better", and on a corpus that is 97% one language it is that
language's number wearing a global label. Measured on 2026-08-20 against the
real distribution — an engine with perfect English and **total Hinglish
failure** scored **207**; one with perfect Hinglish and mildly sloppy English
scored **300**. The number ranked the Hinglish failure first. It is retained as
`diagnosticOnly` and `compareEngines()` refuses to read it.

**A lead is not a recommendation.** `compareEngines()` reports a `winner` only
when every language bucket had at least one eligible slice. Otherwise it reports
a `leader` and an explicit null winner. This rule exists because the low-n gate,
on its own, made the choice *easier*: with Hinglish and native-script excluded,
English became the only slice that counted, so the engine that failed Hinglish
completely led everything it was allowed to be judged on. Excluding weak
evidence must raise the bar, never lower it.

### 10.2 Known limitation of the corpus this ADR will be decided on

The first clean golden set (`eval/golden-set-v2.csv`, workspace `93629c77…`,
2026-08-20) is **200 reviews: english 194 · hinglish 6 · native-script 0** — the
entire eligible population of the workspace, so this is a census and no
re-sampling changes it. Script detection reports `{latin: 200}`: not one
non-Latin character in the corpus.

Under the rules above, that corpus yields **one eligible slice,
`within:english`**. Both Hinglish slices are `low-n`; all three native-script
slices are `N/A`. So a bake-off run on it **cannot produce a §10 recommendation**
— by design, and the tooling will say so rather than return an English answer.

**When this section is filled in, it must record which buckets were untested.**
"English certified" and "certified" are different claims, and only one of them
is available from this corpus.

---

## 11. What the founder was asked, and answered (2026-08-20)

| # | Ask | Answer |
|---|---|---|
| 1 | Ratify the identity rule (§3) | **Yes**, wording preserved, plus the equivalence nuance now in §3 |
| 2 | ~2 hours to label the golden set | **Yes** — named the highest-value use of that time |
| 3 | Bake-off before implementation | **Yes, as a hard gate** — §9 rewritten accordingly |
| 4 | Gemini key for hosted embeddings | **Deliberately not decided.** "State the rule explicitly rather than letting an implementation decision quietly establish it" → §12 |

**Still open, and founder-only:** the sub-processor purpose lines (§12.3).

---

## 12. Provider and data policy — stated, not assumed

Written at the founder's direction, because two different rules were being
referred to by one name and they impose materially different constraints.

### 12.1 The cost rule — what it actually says

> **CLAUDE.md:** *"Do not add a paid service until a customer pays first. Every
> tool has a free tier that covers 0–20 customers."*
> **D009 point 10 (IMMUTABLE):** I will refuse to *"add a new paid SaaS
> dependency. (Founder signs up + adds keys.)"*

This is a **cost and vendor-count rule**, not a data rule. It is satisfied by
any provider already configured with a free tier that covers our volume.
**Groq and Gemini both satisfy it today** — both keys are set, both are used in
production, neither is billed.

### 12.2 The data rule — where it actually lives

There is no sentence anywhere in the repo saying "review text may not leave
provider X". The operative constraint is **disclosure**, and it lives in a
public legal page:

> **`/sub-processors`** lists every processor with the data it receives.
> **D009 point 9** forbids an agent editing legal pages without founder approval.

So the real rule, stated plainly for the first time:

> **Any provider that receives customer review text must appear on
> `/sub-processors` with an accurate purpose line, and only the founder may
> write that line.**

That this is the live rule is not an interpretation — it is why the Slack
omission (`src/lib/slack.ts:198` sends a reviewer name and a 120-char snippet to
an undisclosed processor) has been carried as an open founder-blocking item.

### 12.3 What that means for this epic — including for the recommended option

Both providers are **already disclosed**, and review text already reaches both:

| Processor | Disclosed purpose today | Disclosed data today |
|---|---|---|
| **Groq** | "AI inference for reply drafting" | "Review text and your reply templates and knowledge-base entries, at the moment a draft is generated" |
| **Google (Gemini API)** | "AI inference for sentiment analysis and keyword suggestions" | "Review text submitted for classification" |

**So no option in §7 crosses a new provider boundary.** But note what this
*does* catch, which the narrow "is Gemini allowed?" question would have missed:

> **Neither disclosed purpose covers issue clustering.** "Reply drafting" is not
> "grouping reviews into issues"; "sentiment analysis and keyword suggestions"
> is not either. **The recommended option (C, Groq) needs a purpose-line update
> exactly as much as option B (Gemini) does.**

Consequences, in order:

1. **The bake-off (§9) is not blocked.** It is internal evaluation over reviews
   that are already public on the store listings, and the exporter strips author
   names so no personal data is in the golden set at all.
2. **Shipping the engine to customers IS blocked** on the founder updating the
   purpose line for whichever provider wins. One sentence on one page — but it
   is a legal page, so an agent may not write it (D009 point 9).
3. **The §11.4 question stays open on purpose.** Under 12.1 Gemini is fine.
   Under 12.2 Gemini is fine *and so is Groq*, provided the disclosure is
   corrected. If the founder's intent is a stricter boundary than what
   `/sub-processors` currently implies, that is a new rule and belongs in
   `docs/decisions.md`, not in this ADR.
