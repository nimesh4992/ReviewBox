# Issue Intelligence — the target product, and how far the code is from it

**Status:** the target. Agreed by the founder in-session on 2026-08-19, in
response to a code-level gap assessment of the same date.
**Decisions locked in:** `docs/decisions.md` **D023** (and D022, which sequenced
this epic behind SPINE — that gate is now open).
**Buildable breakdown:** `docs/backlog.md` → "STRATEGIC — Issue Intelligence
pivot" (II1–II11).
**Keystone next step:** the II1 ADR. Not implementation. See §7.

---

## 1. The verdict

> **ReviewBox is not 70–75% of the way to the product we want. It is roughly
> 25–30% of the way to the *differentiated* product.**

Read that precisely, because the obvious misreading is wrong:

| This is true | This is NOT what it says |
|---|---|
| ~25–30% of the **differentiated** product exists | "the product is 25% built" |
| The Collect / Display / Reply infrastructure is substantial and real | "the existing work was wasted" |
| The **foundation** is there | "we need to start over" |
| The **core differentiation** is not built yet | "the UI needs work" |

Scored honestly:

| | Score | Why |
|---|---|---|
| UI / surface today | ~8/10 | Not the bottleneck. Do not spend the next week polishing the dashboard. |
| Differentiated product today | **~6/10** | The intelligence layer is what's missing, not the screens. |
| After II1–II11 properly implemented | ~8.5–9/10 | |
| After 10–20 paying customers validate the workflow | 9+/10 | Because at that point we stop guessing what the market values. |

The assessment behind this was read out of the codebase, not off the product
surface. That distinction matters here more than usual: this repo has a long
record of documentation describing a system that isn't the one running (see §4,
and the ⚠️ block at the top of `CLAUDE.md` about what ✅ means).

---

## 2. The architectural bottleneck

> **There is no `issues` table, no `issue_id` on `reviews`, and nothing that
> groups reviews.**

That single sentence is the whole gap. Everything discussed —

```
Review → Theme → Issue → Prioritize → Release → Incident → Resolution
```

— depends on an **entity above the individual review**, and it does not exist.

### What we have today

```
Review
 ├── rating
 ├── sentiment
 ├── tags[]            ← 8 fixed English regexes
 ├── version
 ├── platform
 ├── priority
 └── escalation_state
```

The atomic unit is one review row. `reviews.issue_tags[]` is filled at sync time
by **8 hardcoded English regexes** in `src/lib/rules-engine.ts` (`crash`,
`billing`, `login`, `performance`, `release-regression`, `feature-request`,
`support-delay`, `localization`). Workspaces can *rename* those labels
(migration 024, `/api/tags`) but cannot add categories.

That is a fixed taxonomy, not clustering. It can never discover "scanner not
reading tickets", because nobody wrote that regex.

### What we need

```
Review
   │
   └──── Issue
           ├── title
           ├── description
           ├── severity
           ├── priority
           ├── trend
           ├── frequency
           ├── first_detected
           ├── affected_versions
           ├── affected_platforms
           ├── status
           ├── owner
           └── reviews[]
```

This is the fundamental product evolution. Six of the eight gaps in §3 read or
write through this missing entity, which is why they are all blocked behind the
same thing and why no amount of UI work moves them.

---

## 3. Where the code actually stands

Ten items: the founder's eight gaps, plus alerting and the AI layer. Percentages
are judgement, not measurement — the file paths are the evidence.

| # | Gap | Standing | What exists | What's missing |
|---|---|---|---|---|
| 1 | **Issues / Themes** | **~15%** | 8 regex tags applied at sync (`src/lib/rules-engine.ts`); renameable labels (migration 024); per-tag count / share / trend / net-sentiment + top-3 reviews on `/sentiment` (`src/app/api/sentiment/overview/route.ts`) | The `issues` table; review→issue relationship; open-vocabulary discovery; per-issue first-detected, affected version, affected platform, trend |
| 2 | **Prioritization** | **~25% per review, 0% per issue** | `priority` (urgent/high/normal/low) from rating + tags + text; `urgentCount` on the dashboard | Any aggregate score. No frequency, growth rate, recurrence or breadth — all require #1 |
| 3 | **Product-team workflow** | **~30% — cheapest of the eight** | `reviews.escalation_state` already carries the exact vocabulary (`none / support / product / engineering / incident`); automations write it (`src/lib/automation-executor.ts`); `incidents` has status + owner + severity + `detected_at` / `resolved_at`, with a detail page | Status lives on a *review*, not a theme. 3 incident statuses, not 6. No Jira/Linear. **Incidents are 100% manually created** |
| 4 | **Resolution tracking** | **~5%** | `incidents.resolved_at` exists | Nothing reads it. No before/after rate, no rating movement. Blocked on #1 and #3 |
| 5 | **"What changed" / release regression** | **~40% — closest of the eight** | `/releases` derives every version from reviews: count, avg rating, **rating delta vs the previous version of the same app**, first-seen (`src/lib/release-versions.ts`). `/releases/[version]` gives rating distribution, sentiment split, top tags | The join. No per-tag complaint comparison between v1.4 and v1.5, no "+375%", no regression flag, no alert |
| 6 | **Segmentation** | **~20% raw material, 0% feature** | Every review carries version, device, country, language, source, rating, sentiment, tags | No cross-tab anywhere. Nothing computes a conditional rate ("Android on v1.5 is 4.2× more likely") |
| 7 | **Competitive review intel** | **~10%, and the ceiling isn't effort** | `competitor_apps` (migration 016); add by store URL; name / icon / rating / review-count via a 6h cached scrape | **Zero competitor reviews are fetched.** `/api/competitors` deliberately returns `null` for their reviews/week and reply rate rather than invent them. Comparing complaint mix needs their review *text*; Play's API only serves apps you own, so this means scraping public listings at volume — a ToS / cost / reliability decision, not a sprint. **On ice — see D023.** |
| 8 | **Outcome measurement** | **~35% of the inputs, 0% of the artifact** | Rating trend + delta, reviews-week delta, avg reply minutes, unreplied count, positive share vs prior period | No single place showing before→after across a customer's lifetime. Resolution time needs #4; recurring-complaint trend needs #1 |
| + | **Alert philosophy** | **~30%** | Spike detection on every sync (≥5 reviews ≤2★, same version, 24h) → email + Slack with Redis dedup (`src/services/review-sync.ts`); 5 alert types; Slack OAuth built | Every trigger is an **absolute-count threshold**, never a rate of change. And see the ingestion constraint in D023: **sync runs once daily**, so "up 184% in the last 6 hours" is physically undetectable today regardless of code |
| + | **AI layer** | **~20%** | 3-tier reply generation; a 2–3 sentence dashboard summary (200 tokens, 1h cache); Gemini for ambiguous sentiment | The diagnose chain. **Note: 4 of the 6 questions (what / why / how serious / who) are SQL over the issues table, not prompts.** Building II11 as a bigger prompt would be the wrong move |

---

## 4. Three documented claims that are false in the code

Each of these would materially mis-plan this epic, and each was believed while
planning it. **Do not size II1 against any of them.**

| # | The claim | Where | Reality |
|---|---|---|---|
| 1 | *"Sentiment already runs local topic clustering (`@xenova/transformers`) — this is an extension, not a green-field build"* | `docs/backlog.md`, `CLAUDE.md` | **`@xenova/transformers` is not in `package.json` and appears nowhere in `src/`.** There is no clustering. II1 is green-field |
| 2 | pgvector groundwork implies a working embedding pipeline | implied by migration 001 | `reviews.embedding vector(384)` and its ivfflat index have existed since migration 001 and are **never read or written**. The column is real; the pipeline does not exist |
| 3 | *"Incidents already does spike-detection"* | `docs/backlog.md` | Half true. Spike detection exists in `review-sync.ts`, but it **sends an email/Slack message — it does not create an incident**. The only thing that inserts an incident is a human hitting `POST /api/incidents`. The M3 item "auto-detect incident from crash cluster" never shipped |

The dormant column in #2 is **good news, carefully handled**: the database
groundwork is there, so the likely direction is
`Review → Embedding → pgvector similarity → candidate issues → assignment`
rather than a new architecture. But see D023: **choose the model first, then
adapt the schema.** 384 dimensions is a fact about a model nobody has chosen
yet, not a constraint to design around.

---

## 5. The build sequence

Ordered so that value is proven before the expensive primitive is built, and so
that the irreversible decision (the ADR) is made before any code depends on it.

### Phase 0 / Sprint 1 — prove the intelligence, using what exists

**A. Release regression, on today's `issue_tags[]`.** A small vertical slice,
not a separate feature project. Compare tag counts across adjacent versions of
the same app and flag the delta:

```
v1.5 vs v1.4
  Payment       +375%  🔴
  Scanner       +140%  🟠
  Login          +12%
  UX             -18%

  ⚠ Potential regression detected
```

This ships a compelling product story **without waiting for clustering**, and it
reuses data already derived in `src/lib/release-versions.ts`. Best ratio of
demonstrated value to work in the whole epic.

**B. Write the II1 ADR** (§7). In parallel with A, before any of Sprint 2.

### Sprint 2 — build the missing primitive

Roughly:

```
issues                        issue_reviews
------                        -------------
id                            issue_id
workspace_id                  review_id
title                         confidence
description                   assigned_at
status
severity
priority
first_detected_at
last_seen_at
review_count
trend
confidence
created_at / updated_at
```

**Do not put `issue_id` directly on `reviews`** if one review can belong to more
than one issue ("payment deducted but ticket not generated" is plausibly both a
payment issue and a ticketing issue). **Whether the relationship is genuinely
many-to-many is an ADR question, not an implementation detail.** Don't
over-engineer it — but don't foreclose it in a migration either.

### Sprint 3 — Issue intelligence

The Issues list, ranked by impact:

```
Payment failures          24 reviews   ↑43%   Critical
Ticket scanning           18 reviews   ↑28%   High
Login problems            13 reviews   →      Medium
Performance               11 reviews   ↓12%   Low
```

And the Issue detail: 24 reviews · first detected Aug 3 · last seen Aug 19 ·
affected versions v1.5 · Android 81% / iOS 19% · trend · severity → **Create
incident**.

### Sprint 4 — connect the loop

```
Review → Issue → Priority → Release correlation → Incident
      → Owner → Resolution → Before/After measurement
```

At this point the dashboard becomes dramatically more valuable **without a
redesign**, because the thing underneath it finally has something to say.

---

## 6. What is explicitly NOT being built now

Deferred by D023, so a future session doesn't pick them up as "quick wins":

- **Competitive review intelligence (II8)** — on ice. The navigation and
  infrastructure exist; do not spend engineering time scraping competitor
  reviews before our own review intelligence works.
- **Advanced segmentation (II9)**, enterprise BI surfaces, Jira/Linear
  integration, complex team workflows, further ASO depth.

---

## 7. The keystone: the II1 ADR

**Write the ADR first. Do not implement II1 yet.** This is the decision that
turns the rest of the epic from product speculation into an engineering
sequence.

The framing that matters is **not** "how do I generate a nice AI summary?" It is:

> **What constitutes the identity of an issue?**

Concretely — is "Payment failed" one issue? What about "payment deducted but
ticket wasn't generated" and "UPI payment failed"? One issue, parent/child
issues, or separate issues under a Payment theme? **You need the ontology before
the model.**

The ADR must answer, at minimum:

1. **Issue ontology** — the question above, answered with examples.
2. **Creation pipeline.** The proposed shape is per-review incremental
   assignment, not a periodic "find themes in these 5,000 reviews" LLM call,
   which is far less robust:
   ```
   New review → normalize → embedding → candidate retrieval → similarity
              → existing issue?  ── yes → attach
                                 └─ no  → create
              (optional) → LLM validation → attach / reject
   ```
3. **Embedding model**, chosen on: multilingual quality, dimensionality,
   inference cost, latency, Vercel runtime compatibility, storage, retrieval
   quality. **Then adapt the schema — do not let the existing `vector(384)`
   column dictate the model.**
4. **Multilingual strategy** — a P0 requirement, not a constraint (D023).
5. **Storage / relationship shape**, including whether many-to-many is needed.
6. **Assignment algorithm and confidence threshold.**
7. **Re-clustering strategy** — what happens to existing assignments when the
   model or threshold changes.
8. **`first_detected` semantics** — does it survive a re-cluster? It is a
   customer-facing claim, so it must.
9. **Issue merge / split behaviour.**
10. **Backfill strategy** for existing reviews.
11. **Vercel runtime constraints** — cold starts, execution limits, WASM weight.
12. **Cost at 5k / 50k / 500k reviews.**
13. **Deterministic vs probabilistic behaviour and reproducibility.**

**Evaluate at least three approaches and make a recommendation for an
India-first SaaS.**

Known candidates, none pre-selected: (a) local WASM embeddings — the assumed-free
path, but the library isn't installed and WASM in a serverless function means
slow cold starts on a 5,000-review backfill; (b) hosted/batch LLM labelling into
an open taxonomy — cheap but not free, and non-deterministic across runs, which
fights a stable "first detected Aug 3"; (c) lexical clustering — cheapest and
weakest, and fails §5's multilingual bar outright.

---

## 8. Multilingual is P0, not a side constraint

Our ICP is India-first (`docs/PRODUCT_CONTEXT.md`). The current tagging system is
**English-only regex**. Real review text looks like:

> "payment कट गया but ticket nahi aaya"

Across English, Hindi, Gujarati, Marathi, Hinglish, transliterated Hindi and
code-switching within a single sentence. **A keyword system misses the
relationship entirely.**

Therefore the issue engine must operate on **semantic similarity, not keyword
matching** — which is exactly what makes the embedding decision in §7 the
consequential one, and which is why this is elevated from a note to an
architectural requirement in D023.

Related: **CM1** (multi-language reviews + replies, ICE 60) is the top NOW item
in `docs/backlog.md`. Build II1 blind to it and we build a theme layer that
cannot see most of our customers' feedback — the same shape as the US-storefront
bug, one layer up.

---

## 9. Ingestion honesty

Vercel Hobby caps cron at daily, so **sync runs once per day**. Real-time
incident intelligence is not merely unbuilt — it is **physically undetectable**
with the current ingestion architecture.

So do not build UI, or make marketing claims, that promise something the
pipeline can't do. For launch the claim is:

> **Daily feedback intelligence**

Moving to Vercel Pro, or the `pg_cron` + `pg_net` path already noted in
`CLAUDE.md`, is what would later earn:

> **Near-real-time monitoring**

Stating the weaker true claim beats pretending. This is the same discipline as
`docs/SPINE.md`'s "done means a human watched it work".

---

## 10. The launch product, stated in full

```
ReviewBox — turn app reviews into product intelligence.

  Connect      → App Store / Google Play
  Understand   → sentiment + semantic issues
  Prioritize   → frequency + growth + severity + affected users/platforms
  Investigate  → review clusters + versions + release correlation
  Act          → reply / escalate / create incident
  Measure      → did the issue actually improve?
```

That is enough. It is a narrower product than the current navigation implies,
and a much stronger one.

---

## 11. Keeping this document honest

The percentages in §3 are a snapshot of 2026-08-19 and will rot. The file paths
won't. When updating this file:

- **State what was verified and how**, exactly as `CLAUDE.md` requires. A ✅ here
  means the same weak thing it means there unless the entry says otherwise.
- **Re-check §4 against the code before trusting it in either direction.** Those
  three claims were all confidently documented and all wrong; the sentence
  "this is an extension, not a green-field build" cost a whole planning round.
- When an item in §3 ships, move its evidence into `docs/specs/` as a
  Given/When/Then spec. This document is the target; a spec is the contract.
