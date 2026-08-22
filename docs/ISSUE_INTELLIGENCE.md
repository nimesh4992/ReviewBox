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

> **Written 2026-08-20 — `docs/adr/011-issue-identity-and-clustering.md`, status
> Proposed, awaiting founder ratification.** It answers the questions below and
> then declines to ratify itself: §9 defines a bake-off that measures all three
> approaches against a labelled golden set before the decision is made. **How it
> all gets built solidly is `docs/II_DELIVERY_PLAN.md`.** The section below is
> kept as the mandate the ADR was written against.

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
**English-only regex**.

> **This section used to argue from an invented sentence — "payment कट गया but
> ticket nahi aaya". It no longer has to.** On 2026-08-22 the fixture app's own
> reviews were read against the live database. Three real reviews, all describing
> the same "money taken, ticket not issued" bug:

| Review (verbatim, Mumbai One) | Tagged | Sentiment |
|---|---|---|
| "har time ticket nikal te waqt account se **payment** cut hota fir **transaction** fail" | `billing` | critical |
| "isase **mera paisa kat gya ticket aaya nhi**" | **none** | critical |
| "kabhi kabhi **paise cut jaate Hain Magar ticket nahin aati hai**" | **none** | ⚠️ **positive** |

The first is tagged only because *payment* and *transaction* are English
loanwords that happen to match an English pattern. The second is the invented
example above, almost word for word, arriving in real life — and invisible.

**The third is worse than invisible.** It is five stars, so it is untagged *and*
scored `positive`: a user reporting the flagship bug is counted in the positive
share the customer reads as a health metric. That is not a coverage gap, it is a
wrong number.

Across English, Hindi, Gujarati, Marathi, Hinglish, transliterated Hindi and
code-switching within a single sentence. **A keyword system misses the
relationship entirely** — now demonstrated rather than predicted. Full working:
`docs/PATH_TO_9.md` §10.

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

> **⚠️ The premise of this section was false, corrected 2026-08-21.** It read
> "Vercel Hobby caps cron at daily, so **sync runs once per day**." **Confirmed by the founder 2026-08-21: the ReviewBox project is on the Vercel PRO plan.**
> Pro allows once-per-minute crons, and **sync now runs every 3 hours** (P1-1,
> shipped on `fix/p0-commercial-readiness`). A 6-hour window IS now detectable.

**The honesty rule below still stands — only the number moved.** Do not build UI,
or make marketing claims, that promise something the pipeline can't do. What the
pipeline can now do is a **~3-hour** cadence with a 4-hour worst-case freshness
guarantee, not real-time.

The launch claim on record is:

> **Daily feedback intelligence**

**That claim is now more conservative than the pipeline.** Whether to restate it
is a **founder decision, not an agent's** — it is a marketing claim, and D023
point 6 fixed it deliberately. An agent must not widen it unilaterally. Flagged
for the founder; until they rule, keep making no claim beyond "daily".

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

## 11. Who this is for — resolved

**The open question this epic used to carry ("which of four buyers is this
for?") is answered. `docs/decisions.md` D024 holds the decision; it supersedes
D011 and D017.**

**One buyer, unchanged by this epic:** a solo founder or small mobile team
(1–5 apps) with no dedicated support staff, non-technical to semi-technical,
**India first** then global English-speaking, paying **$49 Starter / $129 Pro**.
That is `docs/PRODUCT_CONTEXT.md`'s ICP, and it is now the only one.

**Issue Intelligence does not re-target the product — it serves the same person
better.** The founder's critique frames Issues around a company with a support
team, a product team and an engineering team to route between. Our buyer *is*
all three. That is precisely why the Issue layer helps them: nobody else is
going to triage 200 reviews into "these three problems matter today". Read the
epic that way and two things follow:

- **`owner` is a label, not a routing integration.** "Product" / "Engineering"
  on an issue is how one person tags their own week. Jira/Linear stays on ice
  (D023 §6) — it is the enterprise-shaped half of II5.
- **II9 (segmentation) stays P2 and stays suspect.** It is the most
  enterprise-flavoured item on the list. Build it only if a real customer asks.

**Tier: Issue Intelligence is Pro.** Not a new tier, not Starter. The shipped
pricing page already gates its whole "Intelligence" category to Pro and tells
customers "Pro adds the intelligence and collaboration layer", so this epic is
the thing that finally makes the $129 tier worth its price rather than a
feature-count difference.

> ⚠️ **Founder decision waiting.** That same feature matrix carries the row
> *"Topic clustering across your reviews" — Pro ✅*. There is no clustering
> (§2, §4). The comment directly above the matrix says a row "must be something
> a customer can do today. A pricing page is a contract." This row is currently
> outside that rule. Either it is reworded to what the product does today
> ("Topic breakdown across your reviews"), or II1 ships and makes it true.
> **D009 reserves pricing-page changes to the founder, so no agent may fix it.**

---

## 12. How long this takes

Estimated 2026-08-19 against this repo's measured throughput: PRs #78–#135
merged over four days (2026-08-16 → 08-19), ~14 PRs/day with the founder
actively driving.

**Two clocks, and the second one governs.** Agent build time for the whole
epic is roughly **10–15 working sessions**. Calendar time is set by four things
no agent can compress: founder decisions, manual migrations against production
Supabase (D009), *walked* verification (a green build is not a working feature —
see the ⚠️ block atop `CLAUDE.md`), and in two cases the customer's own release
cycle.

| Stage | Agent build | Founder time | Calendar |
|---|---|---|---|
| **II0 · Phase 0 release-regression** | ~1 session | verify against a real app | **2–3 days** |
| **II0a · The ADR** | ~1 session | read + decide the embedding approach | **3–5 days** |
| **Sprint 2 · `issues` + `issue_reviews` + assignment + backfill** | 3–5 sessions | run the migration; verify clusters are *right*, not merely present | **2–3 weeks** |
| **Sprint 3 · Issues list, detail page, impact score** | 2–3 sessions | mostly UI — fast to verify | **1–2 weeks** |
| **Sprint 4 · Release correlation, workflow, alerts (II4/II5/II7)** | 3–4 sessions | migration + alert verification | **2–3 weeks** |
| **II6 / II10 · Resolution + outcome** | 1–2 sessions | — | **built in days, provable in 4–8 weeks** |

**Headline: ~8–12 weeks to all of II1–II11 at the current cadence. ~3 weeks to
the point where the pitch changes** (Phase 0 + ADR + the issues primitive with a
working Issues list).

This assumes near-daily sessions, same-day merges and decisions answered within
a day. **At evenings-and-weekends cadence, multiply by about three.** The
cautionary data point is in this repo: `docs/SPINE.md` waited eleven weeks to be
walked once, and walking it was eight steps of clicking, not code.

### The part no engineering compresses

**II6 and II10 are gated by the customer's release cycle, not by us.**
"Detected Aug 3 → fixed Aug 15 → complaints fell 1.8/day → 0.3/day" needs an
issue found, a customer's team to actually ship the fix, and then weeks of real
reviews to arrive. The measurement is a couple of days' work; the *proof* cannot
exist until a customer has shipped at least once after we flagged something.
Budget 4–8 weeks after the first real fix. This is the strongest part of the
pitch and it is structurally the last thing to become true — plan the launch
narrative around that, don't discover it in month three.

### Three things that would blow the estimate out

1. **Multilingual clustering quality is empirical.** No spec can tell you
   whether a given model groups "payment कट गया but ticket nahi aaya" with
   "UPI payment failed". You find out by running it against the fixture app's
   real reviews. Budget 2–3 model iterations — **the single largest variance in
   the plan, roughly ±3 weeks.**
2. **The embedding decision may collide with the one rule.** If local WASM is
   too slow on Vercel and the honest answer is a hosted embedding API, that is a
   paid dependency before a paying customer — a founder-only call, and stalling
   on it stalls Sprint 2 entirely. Surfacing that collision early is a large part
   of what the ADR is for.
3. **Parallel sessions on the same files.** Six dashboard manglings are on
   record, and this repo's own lesson is that two independent *fixes* for one bug
   collide worse than two features. Sprint 2 touches schema and sync, both hot.
   **One branch at a time on this epic.**

### What compresses it

The buyer question, now closed by D024 (§11), was worth about a week: an Issues
page for a solo Indian founder and one for a head of product are different
screens, and building the wrong one is rework in Sprint 3 and 4.

---

## 13. Keeping this document honest

The percentages in §3 are a snapshot of 2026-08-19 and will rot. The file paths
won't. When updating this file:

- **State what was verified and how**, exactly as `CLAUDE.md` requires. A ✅ here
  means the same weak thing it means there unless the entry says otherwise.
- **Re-check §4 against the code before trusting it in either direction.** Those
  three claims were all confidently documented and all wrong; the sentence
  "this is an extension, not a green-field build" cost a whole planning round.
- When an item in §3 ships, move its evidence into `docs/specs/` as a
  Given/When/Then spec. This document is the target; a spec is the contract.
