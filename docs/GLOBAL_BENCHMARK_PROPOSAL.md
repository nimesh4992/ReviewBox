# Global Multilingual Benchmark — methodology proposal

**Status:** Proposal. Nothing built, nothing collected, nothing labelled.
**Date:** 2026-08-20
**Decides nothing on its own** — this is the input to a founder decision.
**Relates to:** ADR 011 §9/§10.3 · `docs/GOLDEN_SET.md` · D023 §3 · D024 (ICP) ·
ADR 011 §12 (provider and data policy)

---

## 0. Why this exists, in one paragraph

`eval/golden-set-v2.csv` is a census of one workspace: 194 English, 6 Hinglish,
0 native-script. Under the ADR 011 §10.1 rules it yields exactly one eligible
slice, so the bake-off gate closes with outcome 4 — *insufficient corpus
coverage, no engine recommendation*. That corpus cannot be fixed. It is not a
sample that was drawn badly; it is everything that workspace has. A second,
differently-constructed artefact is needed, and this proposes what it should be.

---

## 1. The tension this proposal has to hold, stated first

The instruction was **"do not assume an India-first language list."** D024 says
the ICP is **"India first, then global English."** Both are right, about
different things, and conflating them is how the benchmark goes wrong in either
direction:

| | Question it answers | Correct scope |
|---|---|---|
| **ICP (D024)** | Who do we sell to *this year*? | India first, then global English |
| **Benchmark** | Does the engine work *at all* on human language? | Global, by failure mode |

A benchmark scoped to the current market certifies an engine that breaks on the
first customer from outside it — and we would not find out from a test, we would
find out from a churned customer. Conversely, a benchmark that ignores the ICP
spends effort proving Finnish works while Hinglish, which we will meet in week
one, stays untested.

**Proposed resolution:** coverage is chosen by **failure mode**, and *priority
within that coverage* is chosen by market. India-relevant languages are then
present because Devanagari, romanisation and code-switching are failure modes we
must cover — not because the list started there. Nothing in §2 is included on
market grounds alone.

---

## 2. Coverage — by failure axis, not by language count

Languages do not break clustering engines. **Properties of languages do.** The
axes that actually break things:

| Axis | Why it breaks clustering | Cheapest representative |
|---|---|---|
| **Non-Latin script** | tokenisation, embedding vocabulary coverage, our own detector | Hindi (Devanagari) |
| **Romanisation of a non-Latin language** | same language, different script — the engine must group them | Hindi (Latin) |
| **Code-switching mid-sentence** | no single language label is correct | Hinglish, Taglish, Arabizi |
| **No word-space segmentation** | naive tokenisers produce one token per sentence | Thai, Japanese, Chinese |
| **Right-to-left + rich morphology** | direction, clitics, non-concatenative stems | Arabic |
| **Agglutination** | one word = one sentence; lexical overlap collapses | Turkish, Tamil, Korean |
| **Heavy diacritics** | inconsistent user input, normalisation traps | Vietnamese |
| **Low-resource in embedding models** | model simply has not seen enough of it | Indonesian, Marathi |
| **Latin but not English** | proves "English" was not really "Latin baseline" | Spanish, Portuguese |

**Tier A — required for a decision-grade benchmark** (one representative per
axis, chosen to also be commercially plausible):

| Language | Script | Axes covered |
|---|---|---|
| English | Latin | baseline |
| Hindi | Devanagari | non-Latin script, low-ish resource |
| Hindi (romanised) | Latin | romanisation, code-switching — *same language as above* |
| Spanish **or** Portuguese (BR) | Latin | Latin-but-not-English |
| Arabic | Arabic | RTL, morphology; and Arabizi as its romanised pair |
| Indonesian | Latin | large mobile market, lower-resource, mild agglutination |
| Japanese **or** Chinese (Simplified) | Japanese / Han | no word spaces |

Seven slices, six languages, five scripts — and critically **one language in two
scripts**, which is the sharpest single test in the whole benchmark (§4).

**Tier B — decision-grade if reachable, exploratory otherwise:** Russian
(Cyrillic), Korean (Hangul), Thai (Thai script, no spaces), Turkish
(agglutinative Latin), Vietnamese (diacritics), Tamil or Telugu (Brahmic +
agglutinative), German (compounding), French.

**Tier C — record, do not chase:** everything else. A language enters Tier B only
when it introduces an axis Tier A does not already cover, or a real customer
brings it.

> **The governing rule:** *add a language when it adds an axis or a customer,
> never to make the list look global.* Twelve languages covering four axes is a
> worse benchmark than six covering nine.

---

## 3. How much data makes a slice decision-grade

### 3.1 The criterion should be sensitivity, not a round number

ADR 011 §10.1 already concedes the current 10-review / 30-pair floors are
**policy thresholds, not statistical ones** — no power analysis, no confidence
level. Rather than pick larger round numbers, propose a criterion that can
actually be checked:

> **A slice is decision-grade when relabelling any single review changes that
> slice's F1 by less than 5 percentage points.**

This is computable from the labels themselves — move each review to its
next-best issue, recompute, take the worst case. It is honest (it claims
robustness, not significance), it is the property we actually care about, and it
scales automatically with how the issues happen to be distributed.

Why it matters concretely: at today's Hinglish n=6, one relabelled review can
move F1 from 0% to 100%. That is the whole problem, expressed as a number.

### 3.2 Counts that typically satisfy it — planning guidance, not the gate

| Standing | Reviews | Distinct issues | Gold same-issue pairs | Issues with ≥3 reviews |
|---|---|---|---|---|
| **Decision-grade** | ≥ 60 | ≥ 8 | ≥ 100 | ≥ 6 |
| **Exploratory** | ≥ 20 | ≥ 4 | ≥ 20 | ≥ 3 |
| **Anecdote — report as N/A** | < 20 | — | — | — |

Sanity check on the decision-grade row: 60 reviews across 8 issues averages 7.5
per issue, giving ≈195 same-issue pairs. Moving one review touches roughly 7–15
of them — under 8% of the denominator, comfortably inside the 5-point rule.
40 reviews across 8 issues gives only ≈80 pairs and fails it, which is why the
floor is 60 and not 40.

**Both the sensitivity rule and the counts must hold.** The counts catch a
degenerate shape the sensitivity rule alone would pass (e.g. two enormous issues
where no single review matters but the slice measures almost nothing).

---

## 4. Language, script, romanisation — three facts, not one enum

The current three-way bucket (`english` / `native-script` / `hinglish`) was
right for an India-first pilot and does not survive going global: it has no room
for Spanish, and it names the Latin baseline "english". `src/lib/language-detect.ts`
already separates script from language internally; the benchmark should carry
that separation all the way through to the slice key.

**Proposed model — four independent fields:**

| Field | Example | Notes |
|---|---|---|
| `language` | `hi` | BCP-47 primary subtag. `null` is legal and means undetermined |
| `script` | `Deva` / `Latn` / `Arab` | ISO 15924. Determined by character inspection, near-certain |
| `romanised` | `true` | derived: language's conventional script is non-Latin **and** `script = Latn` |
| `languages_present` | `["hi","en"]` | ≥2 entries ⇒ code-switched |

**Slice key becomes `(language, script)`** — so `hi-Deva` and `hi-Latn` are two
slices of one language, and `en-Latn`, `es-Latn`, `id-Latn` are three slices that
a single "english/Latin" bucket would have fused.

Three consequences worth stating:

- **Romanisation is a property, not a bucket.** "Hinglish" stops being a
  category and becomes `hi-Latn` + `languages_present ⊇ {hi,en}`. Arabizi is
  `ar-Latn` under the identical rule, with no new code path.
- **Code-switching is orthogonal to both** and must be a separate flag. A review
  can be code-switched in one script (`hi-Latn` mixing Hindi and English words)
  or across two (`hi-Deva` with Latin brand names).
- **Undetermined is a real value.** A five-word review may have no language
  signal. `language: null` must be labellable and reportable, never coerced to
  the majority.

---

## 5. Testing cross-language clustering

The identity rule — *"two reviews belong to the same Issue if the same code
change would resolve both"* — makes no reference to language. So the same Issue
**should** span languages, and whether it does is the capability the product is
sold on. Four things this requires:

**5.1 Attested parallel issues, never translated ones.** The benchmark needs
issues genuinely described in ≥2 languages by ≥2 native reviewers — real reviews
of a real app, found independently. A translated pair tests the translator, not
the engine. Target: **≥6 issues attested in ≥2 languages**, of which ≥2 span
different scripts.

**5.2 The same-language-two-scripts pair is the priority test.** `hi-Deva ×
hi-Latn` holds meaning constant and varies only script. If an engine fails
there, it cannot possibly do cross-language, and the diagnosis is unambiguous.
Every other cross-slice confounds script with language. **Propose this pair be
decision-grade before any cross-*language* slice is trusted.**

**5.3 Negative controls are mandatory, and are the part most likely to be
skipped.** Multilingual embedding models cluster by *topic* far more readily
than by *fix*. Without controls, an engine that fuses every payment complaint on
earth scores beautifully. So the benchmark must contain, per language pair,
**topically adjacent issues that are NOT the same issue** — "payment deducted,
no ticket" vs "payment page takes 30 seconds to load" — labelled as distinct.
Target: **≥4 negative-control pairs per Tier-A language pair.**

**5.4 Cross-slices obey the limiting-arm rule** already implemented: a cross
slice's power is the smaller side, however many pairs it produces.

---

## 6. What gets balanced

Short answer: **floors on reviews and issues, caps on concentration, no attempt
to equalise pair counts, and balance is a reporting property — never achieved by
deleting real data.**

| Dimension | Treatment | Why |
|---|---|---|
| **Reviews per slice** | **floor**, not equality | equalising caps every slice at the smallest; a floor raises the weakest |
| **Issues per slice** | **floor (≥8)** | the one most often missed — 60 reviews in 2 issues measures almost nothing |
| **Pair counts** | **never balanced** | quadratic in n; equalising pairs would mean wildly unequal review counts |
| **Languages** | **covered, not balanced** | see §2 — axes, not headcount |
| **Scripts** | **covered, not balanced** | script is a consequence of language choice |
| **Apps / customers** | **capped** | see §8 |

**Report per-slice `n` on every row, always.** A balanced-looking table with
hidden n is worse than an unbalanced one with visible n.

---

## 7. Sources, provenance and licensing

This is the weakest-footed section and I would rather say so than write it
confidently. **I am not qualified to give the licensing answer**, and it is a
founder decision with real exposure.

What is settled: ADR 011 §12.3 establishes that using public store reviews for
*internal evaluation* is not blocked, because the text is already public and the
exporter strips author names. That reasoning covers evaluating. It does **not**
automatically cover **collecting at scale from listings we don't own**, or
**redistributing** a curated corpus.

**Sources, ranked by provenance strength:**

| Rank | Source | Provenance | Practical limit |
|---|---|---|---|
| 1 | **Apps our customers own**, via the official Publisher / App Store Connect API with their authorisation | strongest — authorised, attributable, terms-clean | limited to customers we have; language mix is theirs, not ours |
| 2 | **Openly licensed public research corpora** of app reviews (explicit CC-style reuse terms) | strong — licence stated by publisher | **availability and language coverage unverified — a research task, not an assertion** |
| 3 | **Public store listings, collected manually at small scale** | text is public; ToS position on automated collection is the open question | slow; the ToS question does not disappear because it is manual |
| 4 | **Scraped listings at scale** | weakest | **founder + legal decision, not an agent's** |

**Recommendation:** design the schema and the rules now (this document), and
treat source selection as a separate gated decision. Do not let the benchmark's
design depend on which source wins — every rule below is source-agnostic.

**Provenance fields are mandatory on every row, with no defaults.** A missing
value is a validation failure, not an empty string:

- `source` — which of the four above
- `licence` — explicit identifier, or `unlicensed-public`
- `collection_method` — `publisher_api` / `connect_api` / `dataset` / `manual`
- `collected_at`, `source_ref` (URL or API endpoint)
- `redistributable` — boolean, **conservative default is false**

**When `redistributable = false`, ship labels not text.** `docs/GOLDEN_SET.md` §6
already anticipates exactly this: distribute `review_id, issue_id, …` keyed by a
stable hash, and let anyone holding the text reconstruct the corpus. The
benchmark's *value* is in the labels.

**Personal data.** Author names are never collected — the existing exporter rule
holds. Separately, **reviewers put personal data in review bodies** (their own
name, order IDs, phone numbers). A durable, possibly-shared artefact needs a PII
scrub pass, plus a rule for when scrubbing would destroy the issue signal: in
that case **drop the review**, never keep a mangled one, because a mangled
review silently becomes a hard negative nobody intended.

---

## 8. Preventing one app or customer from dominating

The failure mode is concrete: an engine that learns *"reviews from this app are
about trains"* scores well on a train-app benchmark and generalises to nothing.
App-specific vocabulary is confounded with issue identity, and nothing in the
current metrics would show it.

**Proposed caps, enforced as slice eligibility — a breach makes the slice
ineligible, exactly like a low-n breach:**

| Rule | Threshold |
|---|---|
| Largest app's share of any one slice | **≤ 25%** |
| Largest app's share of the whole benchmark | **≤ 20%** |
| Largest workspace/customer's share of the benchmark | **≤ 30%** |
| Distinct apps per decision-grade slice | **≥ 3** |
| Distinct app categories per decision-grade slice | **≥ 2** |

**Report concentration next to `n` on every slice** — largest-app share, and app
count. A slice at n=80 drawn from one app is weaker than n=60 from four, and the
report should make that visible without anyone having to ask.

---

## 9. Keeping synthetic and translated text out

**Provenance is the defence; detection is not.** Machine-translated text cannot
be reliably identified after the fact, so the rule has to bind at creation time.

**9.1 `origin` is required, has no default, and is one-way.**

| Value | May enter a decision-grade slice? |
|---|---|
| `native` — written by a real reviewer in the language recorded | **yes** |
| `machine_translated` | no |
| `human_translated` | no |
| `synthetic` — generated by any model, including ours | no |

Translated and synthetic rows may exist in a clearly separated **`probe`
partition** for smoke-testing tooling, and are excluded from every scored slice
by construction rather than by filter. **`origin` may never be changed toward
`native`** — a schema-level, one-way constraint.

**9.2 The store-served-translation trap, which is specific and real.** Google
Play displays reviews *machine-translated into the viewer's locale* with a
"Translated by Google" affordance. A collector that takes what the page renders
will silently capture English translations of Hindi reviews and file them as
English natives — poisoning the English slice *and* emptying the Hindi one, with
no error anywhere. Two required fields: `store_served_translation` (boolean) and
`original_text_captured` (boolean). **A row where the original was not captured
cannot be `native`.**

**9.3 Contamination is already observed, not hypothetical.** The current
200-review corpus contains a row beginning `"लिख सकते हैं: \"Very helpful app
for daily travel in Mumbai…\""` — Devanagari instructional framing wrapped
around fluent English marketing copy. That reads as LLM output pasted into a
review box. One row in 200 that nobody was looking for. A benchmark assembled
without an origin discipline will contain more.

**9.4 Verification, since rules alone are not evidence.** Sample **≥5% of each
import** and manually confirm against the live listing that the text matches and
the language is as recorded. Record the audit result in the manifest. Unaudited
imports are exploratory, whatever their size.

---

## 10. Decision-grade benchmark vs exploratory benchmark

Slice-level standing (§3) is necessary but not sufficient. The **benchmark as a
whole** is decision-grade only when all of the following hold:

| # | Condition |
|---|---|
| 1 | Every **Tier-A axis** (§2) has at least one decision-grade slice |
| 2 | ≥ **5 distinct scripts** and ≥ **6 distinct languages** represented |
| 3 | The **`hi-Deva × hi-Latn` same-language pair** is decision-grade (§5.2) |
| 4 | ≥ **6 cross-language attested issues**, ≥2 crossing scripts (§5.1) |
| 5 | **Negative controls** present for every Tier-A language pair (§5.3) |
| 6 | **Concentration caps** met at both slice and benchmark level (§8) |
| 7 | **100% `origin = native`** in every scored slice, with ≥5% audited (§9) |
| 8 | **Inter-annotator agreement measured** and above threshold (§10.1) |
| 9 | The **manifest** records every one of the above as a computed value, not a claim |

Anything less is **exploratory**: publishable, directional, and explicitly unable
to close ADR 011 §10 — which is ADR 011 §9's fourth outcome doing its job.

### 10.1 The gap nobody has flagged yet: one labeller

The current method has a single labeller (the founder). Nothing measures whether
the identity rule is being applied *consistently* — and ADR 011 §3 justifies that
rule specifically on the grounds that "two different people [get] the same
answer". That claim is currently untested.

**Proposal: a 10% overlap sample, labelled independently by a second person**,
reporting pairwise agreement on the same-issue/different-issue judgement.
Below the agreed threshold, the labels are not decision-grade **at any n** —
because a large corpus labelled inconsistently is a precise measurement of
nothing. This is cheap (≈20 reviews at benchmark scale) and it is the only
check on the assumption the whole method rests on.

I flag it as a genuine gap rather than a formality: it may be the single highest-
value addition in this document, and it applies to the existing corpus too.

### 10.2 A gate is not a training set

If the same benchmark is used to *choose* thresholds, *tune* prompts, and then
*report* the result, it is overfit and the number is decoration. Propose two
partitions from the start:

- **`dev`** — freely re-runnable, used while building and tuning
- **`gate`** — **sealed**, run at most a small counted number of times, with each
  run recorded in the manifest

Once `gate` has been run against a given engine configuration more than a handful
of times, it has become a dev set and must be replaced. Recording run count in
the manifest is what makes this observable rather than aspirational.

---

## 11. Coexistence with the real-customer corpus

Two artefacts, two different questions, **never merged**:

| | `eval/golden-set-v2.csv` | Global benchmark |
|---|---|---|
| Question | Does it work for *this customer's* reviews? | Does it work across human language? |
| Construction | census of one workspace | engineered coverage |
| Distribution | real, therefore skewed | deliberately unrepresentative |
| Language skew | a **finding**, not a defect | a **defect**, by definition |
| Changes | re-exported as reviews accrue | curated, slow, changelogged |

**Merging them destroys both.** The customer corpus's value is that it is
*exactly* what a real customer's data looks like — 97% English included. Diluting
it with curated multilingual data would make it representative of nothing. And
appending a real skewed corpus to a balanced benchmark reintroduces the
concentration the caps in §8 exist to prevent.

**Proposed shipping gate — both, independently:**

1. **Global benchmark decision-grade on Tier A** → the engine works across
   languages.
2. **Customer corpus shows no regression on its own distribution** → the engine
   still works for the customer we actually have.

Reported side by side, never averaged. A weighted blend of the two would be a
new version of the same aggregation mistake ADR 011 §9 already forbids.

---

## 12. Proposed schema

Four artefacts. Text and labels are deliberately separable so the corpus can be
shared as labels-only when `redistributable = false` (§7).

**`benchmark_reviews`** — one row per review, provenance-complete:

| Field | Type | Notes |
|---|---|---|
| `review_id` | string | stable hash of (source, source_ref, original text) |
| `text` | string \| null | null when not redistributable |
| `text_sha256` | string | always present; the join key when text is absent |
| `language` | BCP-47 \| null | null = undetermined, a real value |
| `script` | ISO 15924 | `Latn`, `Deva`, `Arab`, … |
| `romanised` | bool | derived; see §4 |
| `languages_present` | string[] | ≥2 ⇒ code-switched |
| `origin` | enum | `native` \| `machine_translated` \| `human_translated` \| `synthetic` — **required, one-way** |
| `store_served_translation` | bool | §9.2 |
| `original_text_captured` | bool | false ⇒ may not be `native` |
| `source` | enum | §7 |
| `collection_method` | enum | `publisher_api` \| `connect_api` \| `dataset` \| `manual` |
| `licence` | string | explicit, or `unlicensed-public` |
| `redistributable` | bool | conservative default false |
| `source_ref` | string | URL or endpoint |
| `collected_at` | ISO 8601 | |
| `app_ref` | string | pseudonymous, stable — enables §8 caps without naming customers |
| `app_category` | string | for the ≥2-categories rule |
| `platform` | enum | `google_play` \| `app_store` |
| `pii_scrubbed` | bool | §7 |
| `partition` | enum | `dev` \| `gate` \| `probe` — §10.2 |

**`benchmark_labels`** — one row per (review, labeller); shareable alone:

`review_id` · `issue_id` · `theme` · `is_actionable` · `severity` ·
`labeller_id` · `labelled_at` · `labeller_confidence`

Two rows for the same `review_id` from different `labeller_id`s is not a
duplicate — it is the §10.1 agreement sample.

**`benchmark_issues`** — the cross-language and control structure:

`issue_id` · `canonical_title` · `languages_attested[]` · `scripts_attested[]` ·
`is_cross_language` · `negative_control_of` (nullable `issue_id`, §5.3)

**`benchmark_manifest`** — every §10 condition as a **computed** value:

`version` · `built_at` · per-slice `{language, script, n, issues, same_issue_pairs,
one_review_sensitivity, largest_app_share, app_count, category_count, standing}` ·
origin composition · audit coverage · inter-annotator agreement ·
`gate_run_count` · changelog ref

> The manifest is the point. Every condition in §10 is a number the manifest
> computes, not a claim someone writes. That is the difference between this and
> the situation that produced ADR 011 §10.3 — where the report looked complete
> because the untested buckets simply weren't printed.

---

## 13. What I am not recommending

- **Not** translating the existing corpus to manufacture coverage (§9).
- **Not** generating synthetic multilingual reviews (§9).
- **Not** merging the App Store listing of the same app into the benchmark —
  it re-concentrates on one app (§8) and one customer.
- **Not** starting collection before the source/licensing decision (§7).
- **Not** any change to `golden-set-v2.csv`, the exporter, ingestion, CM1a-2 or
  the scoring implementation.

## 14. The decisions this asks the founder for

1. **Coverage:** accept Tier A as proposed, or amend the axis list?
2. **Thresholds:** accept the one-review-sensitivity criterion as the definition
   of decision-grade, with the counts in §3.2 as guidance?
3. **Source:** which of the four in §7 is permissible — this gates everything
   downstream and is not an agent's call.
4. **Second labeller (§10.1):** is one available? If not, decision-grade may be
   unreachable at any corpus size, and that should be known now rather than
   after the labelling effort.
5. **Effort:** Tier A at 60 reviews × 7 slices ≈ 420 labelled reviews. At the
   observed labelling rate that is materially more than the two hours the
   current golden set was scoped at. Worth deciding before, not during.
