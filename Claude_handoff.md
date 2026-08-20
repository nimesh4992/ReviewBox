# Claude handoff — Issue Intelligence benchmark & evaluation methodology

**Written:** 2026-08-20 · **Session:** benchmark methodology audit
**Master at handoff:** `1346920` (merge of PR #144)
**Open branch:** `claude/reviewbox-architecture-gaps-7w7khb` @ `58058f4` → **PR #145, draft, NOT merged**

> **Read this before touching anything in `src/lib/eval/`, `scripts/eval/`, `eval/`,
> `docs/adr/011-*`, `docs/GOLDEN_SET.md` or `docs/GLOBAL_BENCHMARK_PROPOSAL.md`.**
> §12 lists questions that are already answered — do not re-ask them.
> §17 separates what was empirically verified from what was only inferred.

---

## 1. Current objective

Build the **Issue primitive** (D023) — an entity above the review that groups reviews
by "the same code change would resolve both". Six of the eight Issue-Intelligence
gaps are blocked behind it.

**ADR 011 §9 makes a clustering-engine bake-off a HARD GATE**: no implementation
until results are recorded in §10. The gate is currently **CLOSED** on outcome 4
(*insufficient corpus coverage — no engine recommendation*).

So the live objective is **not** building the engine. It is: *produce an evaluation
methodology strong enough that the engine choice is defensible in production.*
That work reached **verdict B — GO WITH CONDITIONS** and is waiting on four founder
decisions (§14).

---

## 2. Architecture and relevant paths

| Path | Role |
|---|---|
| `src/lib/eval/cluster-metrics.ts` | The scorer. Pairwise metrics, six-slice matrix, eligibility, `compareEngines()`. **Zero production imports** — reachable only from the two eval CLIs and tests. |
| `src/lib/eval/sampling.ts` | Deterministic stratified sampling (FNV-1a hash, no `Math.random`). |
| `src/lib/eval/csv.ts` | RFC 4180 parse/serialise, CRLF-safe, no dependency. |
| `src/lib/eval/env-file.ts` | `.env.local` parsing (CRLF/BOM safe). |
| `src/lib/eval/language-bucket.ts` | Type + `LANGUAGE_BUCKETS` + `isLanguageBucket`. **Deliberately import-free.** |
| `src/lib/language-detect.ts` | `detectScript` / `detectLanguage` / `toEvalBucket` / `classifyLanguageBucket`. 25 Unicode blocks as explicit `\u` escapes. |
| `scripts/eval/export-golden-set.mjs` | Exporter CLI. Workspace-scoped, fail-closed. |
| `scripts/eval/score.mjs` | Bake-off scorer CLI, incl. `--compare a.csv=A b.csv=B`. |
| `eval/golden-set-v2.csv` | The corpus. **Gitignored** (`/eval/*.csv`) — lives only on the founder's machine + this container. |
| `src/eval-cli-import-contract.test.ts` | Fails if a CLI-loaded module gains an `@/` import or extensionless relative value import. |
| `src/eval-exporter-tenant-isolation.test.ts` | 20 tests; workspace scoping. |
| `src/lib/eval/cluster-metrics.readiness.test.ts` | 26 tests; the readiness gates. |

**Toolchain trap, load-bearing:** the eval CLIs load TypeScript via Node
`--experimental-strip-types`. Node **requires** the `.ts` extension on relative
imports; `tsc` **rejects** it (TS5097, `allowImportingTsExtensions` off). So a
`.ts → .ts` **value** import cannot satisfy both. Type-only imports are erased and
are safe. This is why `cluster-metrics.ts` **mirrors** `LANGUAGE_BUCKETS` in a local
`BUCKETS` const with a compile-time `satisfies` + `Exclude<>` exhaustiveness guard
rather than importing it. **Verified empirically** (§16 C4).

---

## 3. Everything discovered during the deep audit

### 3.1 Corpus facts (database, read-only, all workspaces)

| Fact | Value |
|---|---|
| Workspaces total / with live apps | 5 / 3 |
| Apps with reviews | 4 rows, but only **3 distinct apps**, and 2 of those are the same product on two platforms |
| Total eligible reviews (body ≥ 15 chars) **in the entire database** | **641** |
| Reviews containing **any Indic character** | **2** (one review, duplicated across two workspaces) |
| Arabic / CJK / Cyrillic / Thai | **0 / 0 / 0 / 0** |
| Non-ASCII characters present | 42 / 34 / 6 rows — almost entirely **smart punctuation and emoji**, not writing systems |

**The whole customer estate is one product (Mumbai One) belonging to one customer,
plus one scraper fixture (MetroConnect3).**

### 3.2 The bake-off scorer — four demonstrated P0 defects

All reproduced against the **merged** `cluster-metrics.ts`. Scripts in §16.

**P0-1 · Pairwise metrics collapse onto the largest issue.**
Zipfian corpus, 159 reviews / 20 issues, largest issue n=60:
77.1% of all recall signal comes from that one issue; the ten smallest contribute 0.4%.

| Engine | Issues solved | Pairwise F1 | `weightedErrors` | B³ F1 | Macro-per-issue |
|---|---|---|---|---|---|
| A — big issue only | **1 / 20** | **87.1%** | **525** ← wins | 66.4% | 5.0% |
| B — long tail only | **19 / 20** | 37.2% | 1,770 | **77.2%** | **95.0%** |

**The shipped metric picks the engine that finds one problem and misses nineteen.**

**P0-2 · A cross-language slice with zero gold positive pairs reads `usable` and
rewards never linking.** 12 English + 12 Hinglish issues, none spanning both:

| Engine | Cross pairs | **Positive** pairs | Merges | Cross wErr | Status |
|---|---|---|---|---|---|
| X — never links across languages | 5,184 | **0** | 0 | **0** ← wins | `usable` |
| Y — attempts linking | 5,184 | **0** | 144 | 432 | `usable` |

Eligibility counts pairs and reviews but **never checks for positive pairs**. The
benchmark actively penalises the capability the product is sold on.

**P0-3 · The false-merge weight decides the engine and was never calibrated.**
Cautious engine (6/20 issues solved, 140/200 reviews ungrouped) vs bold engine
(14/20 solved, 0 ungrouped):

| Weight | 1 | 2 | 2.1 | **3 (shipped)** | 5 |
|---|---|---|---|---|---|
| Winner | bold | bold | bold | **cautious** | cautious |

D025's *direction* (merges worse than splits) is ratified and right. The
**magnitude** picks the engine and nobody chose it against customer preference.

**P0-4 · Insufficient statistical power at the proposed corpus size.**
Empirical power, 30 simulations/cell, bootstrap resampling **reviews**:

| True gap | n=100 | n=200 | n=400 | n=800 |
|---|---|---|---|---|
| 15 pp | 83% | 100% | 100% | 100% |
| 10 pp | 43% | **80%** | 97% | 100% |
| 5 pp | 27% | 37% | 67% | **90%** |

At the proposed ~420 reviews a 5 pp difference is undetectable. **Pair counts are
not sample size:** at n=200 the naive pair-level 95% half-width is ±0.69 pp; the
correct review-level bootstrap is ±4.19 pp — **6× wider**.

### 3.3 Hidden failure modes

| # | Finding | Basis |
|---|---|---|
| 1 | **Multi-issue reviews are unrepresentable.** `GoldReview.issueId: string`, `PredictedReview.issueId: string \| null` — single-valued. ADR 011 §4 built many-to-many storage *specifically* because *"one review describing two problems"* is real and *"the one we drop is invisible"*. **The harness has exactly the foreign-key shape the ADR rejected.** | Code |
| 2 | **Abstention under-penalised.** Cautious engine: 100% precision, 140/200 ungrouped, wins the comparison. | Demonstrated |
| 3 | **A detection error is already in the corpus.** 1 of 6 Hinglish rows is English prose with a Devanagari prefix (reads as pasted LLM output: `"लिख सकते हैं: \"Very helpful app for daily travel in Mumbai…\""`), classified `hinglish` via `script.mixed`. A second (`"nahin achcha hai"`, ≤5 words) carries no issue signal. **Effective Hinglish n = 4, not 6.** | Demonstrated |
| 4 | **§8 concentration caps are unsatisfiable from existing data** — 3 apps, 1 customer — in any language, English included. | DB |
| 5 | `all singletons` and `attaches nothing` are **indistinguishable** on pairwise stats and `weightedErrors` (both 900). B³ separates them (18.2% vs 0.0%). | Demonstrated |
| 6 | **Macro-per-issue alone is gameable** — all-one-cluster scores 100% on it. Must never be reported alone. | Demonstrated |
| 7 | Noise floor: 15 reviews < 40 chars, 13 of ≤5 words, 0 exact duplicates. | Demonstrated |

### 3.4 Earlier discoveries this session (pre-audit)

- **The first golden set was cross-tenant.** 758 rows across three workspaces, 219 reviews duplicated under two `app_id`s, because the exporter had no workspace filter. Fixed in #143.
- **Two workspaces tracking the same public listing is CORRECT multi-tenancy**, not a data defect. No uniqueness rule was added on `(platform, store_id)` and none should be.
- **The official Google Play Publisher API is language-agnostic** — no `translationLanguage`, no filter. Only the bootstrap scraper (`src/services/bootstrap-reviews.ts:84`) passes `lang: "en"`.

---

## 4. Decisions already made

| ID | Decision |
|---|---|
| **D023** | Issue primitive is the target; ADR before code; multilingual is P0 architectural; choose embedding model before schema; prove value on `issue_tags[]` first; Competitors on ice. |
| **D024** | ICP resolved: `PRODUCT_CONTEXT.md` authoritative — solo founder / small team, 1–5 apps, **India first then global English**, $49/$129. Supersedes D011 and D017. ⚠️ **Now contradicted by the founder's "India will be last priority" — unresolved, see §11.** |
| **D025** | Identity rule ratified verbatim; *"issue equivalence, not implementation equivalence"*; false merges weighted heaviest; *"when uncertain, separate rather than merge"*; bake-off is a hard gate; provider rule explicit in the ADR; six labelled fields. |
| **ADR 011 §3** | **Two reviews belong to the same Issue if the same code change would resolve both.** ACCEPTED. |
| **ADR 011 §4** | Many-to-many `issue_reviews`, not `reviews.issue_id`. |
| **ADR 011 §6** | Merge/split asymmetry; below-threshold reviews left unattached. ACCEPTED. |
| **ADR 011 §9** | Bake-off is a hard gate. **Four** acceptable outcomes (fourth added 2026-08-20). |
| **ADR 011 §10.1** | Six slices always rendered; `N/A — 0 examples`; low-n floors on the **limiting arm**; `weightedErrors` diagnostic-only; a lead is not a recommendation. Thresholds are **policy, not statistical**. |
| **ADR 011 §10.3** | Benchmark standing recorded: English decision-grade, Hinglish low-n, native-script untested (n=0), **recommendation NONE**. Partial measurement, **not multilingual certification**. |
| Session | Exporter is workspace-scoped and fail-closed; `workspace_id` is a CSV column; existing output never overwritten without `--force`. |

---

## 5. Decisions and hypotheses explicitly REJECTED

**Do not revive these without new evidence.**

| Rejected | Why |
|---|---|
| *"The App Store corpus may carry a different language distribution"* | **FALSIFIED.** 117 reviews, 0 Indic, 0 Arabic, 0 CJK, 0 Cyrillic, 0 Thai. I raised this hypothesis; it is withdrawn. |
| *"CM1's premise — ingestion censorship caused the English skew"* | **FALSIFIED.** The official Publisher API is unfiltered. The corpus is genuinely English-dominant. |
| *"The duplicate `com.mmrda` app rows are a data-integrity defect"* | **WRONG.** Legitimate multi-tenancy. The defect was the exporter's missing filter. |
| *"Option 1 (customer-owned apps via official APIs) can supply a multilingual benchmark"* | **FALSIFIED.** 641 eligible reviews yield 1 Devanagari review and zero of everything else. |
| *"`compareEngines` has a hole via `bucketsCovered` when cross slices are low-n"* | **NOT the hole.** Cross slices are automatically eligible whenever both within slices are. The real hole is **zero positive pairs** (P0-2). |
| *"The golden set takes two hours to label"* | **Never measured.** Traces to a different activity (16 Aug live-testing). **No labelling has ever been performed.** |
| India-first language list for the benchmark | Rejected by founder instruction; replaced by **coverage-by-failure-axis**. |
| LLM as second labeller | Explicitly forbidden absent an explicit methodology change. |
| Merging the global benchmark with the customer corpus | Rejected — destroys both artefacts' validity. |
| Synthetic or translated reviews in scored slices | Rejected — `origin` is one-way toward `native`. |
| Augmenting `golden-set-v2.csv` (App Store top-up, cross-workspace merge) | Rejected — re-concentrates on one app/customer. |
| Re-sampling to fix the language mix | **Impossible.** The corpus is a census: 200 requested, 200 eligible. |

---

## 6. PRs #135–#145

All on branch `claude/reviewbox-architecture-gaps-7w7khb` unless noted.

| PR | State | What it changed |
|---|---|---|
| **#135** | merged 08-19 | `docs/ISSUE_INTELLIGENCE.md` — code-level assessment (~25–30% of the differentiated product), **D023**, and three corrections incl. the false `@xenova/transformers` claim (never installed). |
| **#136** | merged 08-20 | **D024** — ICP contradiction resolved; D011/D017 superseded in place; §12 schedule. |
| **#137** | merged 08-20 | `docs/II_DELIVERY_PLAN.md` (8 stages with gates) and **ADR 011** — issue identity and clustering. |
| **#138** | merged 08-20 | **D025** — identity rule ratified; bake-off made a hard gate; provider rule stated. ⚠️ CI was all-red in 2–5s with `runner_id: 0` — diagnosed as the repo having been flipped **private** (Actions minutes). Founder made it public; CI recovered. |
| **#139** | merged 08-20 | **II0b** — golden-set exporter, `docs/GOLDEN_SET.md`, bake-off scorer, `cluster-metrics.ts`. |
| **#140** | merged 08-20 | Determinism hardening; fixed a count bug it exposed (`selectStratifiedSample` returned 11 for `count=10`). |
| **#141** | merged 08-20 | Exporter could not read a Windows `.env.local`. Root cause: `\r` is a JS line terminator, so `(.*)$` failed on every CRLF line and the parser returned `{}` while blaming the file. |
| **#142** | merged 08-20 | **CM1a-1** — global script + language detection replacing the India-only bucket enum. Two bugs caught pre-merge: wrong Unicode ranges written as literals (`khmer` swallowed Thai/Lao/Myanmar), and an `@/` alias import that broke both CLIs while `tsc`/vitest stayed green → now a contract test. |
| **#143** | merged 08-20 `11:08Z` | **Tenant isolation.** Exporter scoped to one workspace; `--list-workspaces`; `workspace_id` CSV column; overwrite guard; 20 regression tests. Reverting either half fails 7 of them. |
| **#144** | merged 08-20 `11:47Z` | **Readiness gates.** Six-slice matrix from `LANGUAGE_BUCKETS`; `N/A — 0 examples`; low-n floors on the limiting arm; `weightedErrors` → `diagnosticOnly`; `compareEngines()`; `--compare` CLI mode; ADR §9 fourth outcome, §10.1/§10.2/§10.3; 26 tests. Each gate deliberately broken once and observed to fail. |
| **#145** | **OPEN, DRAFT, NOT MERGED** | `docs/GLOBAL_BENCHMARK_PROPOSAL.md` — methodology proposal only. CI green on `58058f4`. **Superseded in part by the audit in §3 — do not merge as-is; §8 of the readiness report revises its metrics and §9 revises its sample sizes.** |

---

## 7. Current master commit

```
1346920039b24a89d3f7f01736994c3e4fd13840   Merge pull request #144
```
CI run #290 on master: **success** (all 5 jobs). 809 unit tests / 72 files, `tsc` clean, lint 0 errors.

---

## 8. Current benchmark status

**ADR 011 §9 gate: CLOSED.** Outcome 4 — *insufficient corpus coverage, no engine recommendation.*

| Bucket | Standing | Basis |
|---|---|---|
| English | decision-grade | 194 reviews, 18,721 pairs |
| Hinglish | low-n / exploratory | 6 reviews (**effective 4**, see §3.3.3) |
| Native-script | **untested (n = 0)** | all three slices `N/A` |
| Overall recommendation | **NONE** | 1 of 3 buckets had an eligible slice |

Verified by running the CLI: all six slices render, three `N/A — 0 examples`, two
`low-n / exploratory`, `Winner: NONE` via the **bucket-coverage** rule (not the tie
path — checked deliberately).

**Nothing has been labelled. No bake-off has ever been run.**

---

## 9. Golden-set provenance and hashes

```
File           eval/golden-set-v2.csv         (gitignored via /eval/*.csv)
MD5            34a11345b4679db657cf7ef40cb6c62f
SHA-256        e61abb1f52fcb84db73661122a12a06600d567847db58fcc8c2569a67a91f94c
Rows           200 data rows + header, 16 columns, uniform width
MD5 of sorted review_ids   90ba575aa5ca28fcf307e230d643f485
```

**Provenance.** Workspace `93629c77-146f-4687-92a8-b9377001cee2` ("Mumbai One",
slug `mumbai-one`), single app `199bc6c6-5589-4d84-b6d2-30d08c3a8507`
(`com.mmrda`, google_play). 221 reviews read → **200 eligible → all 200 selected.
This is a census, not a sample.** Composition: english 194 · hinglish 6 ·
native-script 0. Script detection: `{latin: 200}`. Ratings: 1★ 105 (52.5%), 2★ 16,
3★ 17, 4★ 9, 5★ 53. Missing: `app_version` 34 (17%), `country` 74 (37%);
rating/source/text/date 0. Zero duplicate `external_id`s, zero duplicate
`review_id`s, zero cross-workspace contamination.

**Independent verification (non-circular):** Postgres computed
`md5(string_agg(id, ',' order by id))` over its own workspace-joined eligible set
and returned `90ba575aa5ca28fcf307e230d643f485` — byte-identical to the digest Node
computed over the CSV.

> **Caveat, stated once and important:** this container had no service-role key, so
> the export was **reproduced** by fetching the same rows read-only over the Supabase
> MCP and running the exporter's own modules (same classifier, same sampler, same CSV
> writer, header lifted from the merged script at runtime). Because `--count 200`
> consumed the entire eligible pool, sampling never had to choose, making the
> reproduction exact rather than merely deterministic. **What ran was the exporter's
> code over the exporter's data — not the exporter's CLI.**

**A predecessor file, `eval/golden-set.csv`, is the contaminated first export**
(758 rows, three tenants, 219 duplicated). It exists only on the founder's machine.
**Preserve it as evidence; never overwrite it.**

---

## 10. ADR 011 decisions (consolidated)

- **§3 identity rule — ACCEPTED.** *"Two reviews belong to the same Issue if the same code change would resolve both."* Plus: issue equivalence ≠ implementation equivalence. **Carries two claims:** (i) objectivity — *"labellable by two different people with the same answer"*; (ii) construct validity — *"produces groupings a customer recognises"*. **Claim (i) is currently unverifiable (one annotator). Claim (ii) is untested by any proposed method.**
- **§4** many-to-many storage; `first_detected_at = min(store_created_at)`; `merged_into_issue_id` never DELETE; `workspace_id` NOT NULL on both tables.
- **§5** incremental assignment, not batch re-clustering.
- **§6 — ACCEPTED.** Confidence threshold; below it, leave unattached. *"When uncertain, separate rather than merge."*
- **§7–§8** approach recommendation — **still Proposed**.
- **§9** hard gate; **four** outcomes; per-language reporting, never averaged.
- **§10.1/§10.2/§10.3** as in §4 above.
- **§12** provider and data policy: public store review text for internal evaluation is not blocked; author names stripped. **This does NOT cover collecting at scale from listings we don't own, nor redistribution.**

---

## 11. Open questions

| # | Question | Type |
|---|---|---|
| Q1 | Tier A language/script coverage | **Blocked** on Q-India + Q3 |
| Q2 | Adopt one-review-sensitivity as the decision-grade criterion? | Methodology — answerable now |
| Q3 | **Which corpus source is permissible?** | **Founder/legal** — gates all collection |
| Q5 | Effort acceptance | Unanswerable until Q1 + §10.1 land |
| Q-India | **"India will be last priority" contradicts D024 and D023 §3.** Does it re-scope the product or only the benchmark? | **Founder/product** |
| Q-§10.1 | Path A (keep inter-annotator agreement, gate stays shut) vs Path B (blinded test–retest) | **Methodology** |
| Q-Audit-1 | Adopt the corrected metric set (B³ + macro guard + weight stability + bootstrap CI + positive-pair eligibility + coverage floor)? | **Methodology — new** |
| Q-Audit-2 | Accept the power reality: slices detect catastrophic failure; only the pooled corpus ranks, and only at ≥10 pp; ties broken on cost | **Methodology — new** |

---

## 12. Questions ALREADY ANSWERED — do not re-ask

| Question | Answer | Evidence |
|---|---|---|
| Is a second human labeller available? | **Unavailable.** | Sole GitHub collaborator; sole human in 200 commits; `GOLDEN_SET.md` written in second-person singular; `II_DELIVERY_PLAN.md` says "founder-led, agent-assisted"; `.claude/agents/*` are AI roles |
| Can the language mix of `golden-set-v2.csv` be improved by re-exporting? | **No.** It is a census — 200 requested, 200 eligible. | §9 |
| Does the App Store corpus have other languages? | **No.** 117 reviews, zero non-Latin. | §16 S2 |
| Do we have Arabic / CJK / Cyrillic / Thai reviews anywhere? | **No. Zero.** Across all 641 eligible reviews. | §16 S2 |
| Does the official Play API filter by language? | **No.** Only the bootstrap scraper does (`lang: "en"`). | Code read |
| Are the duplicate `com.mmrda` rows a bug? | **No** — multi-tenancy. | §5 |
| Is `weightedErrors` safe as a comparison number? | **No.** Diagnostic-only; `compareEngines()` refuses to read it. | §3.2 P0-3 |
| Has anything ever been labelled? | **No.** `golden-set-v2.csv` reports 0/200 labelled. | §16 C5 |
| Is `src/lib/eval/` production code? | **No.** Zero imports from `src/app`, `src/services`, `src/features`, `src/components`, `src/hooks`. | §16 C3 |
| Can `cluster-metrics.ts` import `LANGUAGE_BUCKETS`? | **No** — toolchain contradiction. Mirrored with compile-time guards instead. | §16 C4 |
| Why is Vercel "Ignored" on PRs? | Previews deliberately disabled via `ignoreCommand`. Expected, not a defect. | `vercel.json` |

---

## 13. Known defects vs deliberately accepted behaviour

**Defects (open, unfixed):** P0-1 largest-issue collapse · P0-2 zero-positive-pair
slices · P0-3 uncalibrated merge weight · P0-4 insufficient power · multi-issue
unrepresentable · abstention under-penalised · 1 misclassified + 1 uninformative
Hinglish row in the corpus.

**Deliberately accepted — do NOT "fix":**

| Behaviour | Why it is correct |
|---|---|
| Two workspaces tracking one `store_id` | Legitimate multi-tenancy |
| `weightedErrors` still computed | Retained as `diagnosticOnly` for diagnosis |
| `overall` still computed | Labelled *NOT a headline*, `status: "aggregate"`, never eligible |
| Exporter refuses without `--workspace` | Fail-closed by design; exits 1 |
| Exporter refuses to overwrite `--out` | Preserves the contaminated first export as evidence |
| Adding a 4th language bucket breaks the build in `cluster-metrics.ts` | Intentional — the exhaustiveness guard |
| E2E job green while running zero specs | Known (BUG-037); the skip is right, the *claim* was the defect |
| `--rb-fg-4` fails contrast | Decoration only; founder call pending |
| Corpus is 97% English | A **finding** about the customer, not a corpus defect |

---

## 14. Current blockers

1. **Q3 source/licensing** — founder/legal. Blocks all collection. Option 1 is falsified, so every remaining option carries a licensing question.
2. **Q-India vs D024/D023 §3** — founder/product. Blocks Tier A composition.
3. **Q-§10.1 Path A vs B** — methodology. Blocks decision-grade status for *any* benchmark including the existing one.
4. **Q-Audit-1 / Q-Audit-2** — methodology. Without them the bake-off can ship the wrong engine (P0-1 demonstrated).

Not blockers: master is green; PR #145 is green; no CI or deploy issues outstanding.

---

## 15. Exact next recommended action

**Do not write code, collect reviews, label, or merge #145.** The audit reached
**verdict B — GO WITH CONDITIONS**; the founder has not yet approved the resulting
methodology, and the standing instruction is that nothing proceeds until they do.

**Next action: wait for the founder's answer on the four decisions in §14.**

When they answer:

- **If Q-Audit-1 approved** → implement the corrected metric set in `src/lib/eval/cluster-metrics.ts` + `scripts/eval/score.mjs` only. Benchmark-only, zero production blast radius. Add B³, macro-per-issue, attachment coverage, positive-pair eligibility, weight-stability sweep, review-level bootstrap CIs. **Note: metric changes do not invalidate labelling — labels are metric-agnostic.**
- **If Q3 resolves to option 1 only** → the global benchmark is **impossible**; stop and record it. Do not proceed down Q1/Q5.
- **If Q-§10.1 → Path B** → also decide whether ADR 011 §3's *"two different people"* sentence is amended or explicitly marked unverified.
- **Then, and only then**, revise `docs/GLOBAL_BENCHMARK_PROPOSAL.md` (§8 metrics, §9 sample sizes) before merging #145.

---

## 16. Commands and SQL used to verify important facts

**S1 — workspaces and live apps**
```sql
select w.id, w.name, w.slug, count(a.id) filter (where a.deleted_at is null) as live_apps
from workspaces w left join apps a on a.workspace_id = w.id
group by w.id, w.name, w.slug order by w.created_at;
```

**S2 — language/script census across the entire database** *(the decisive one)*
```sql
select a.name, a.platform, a.workspace_id,
  count(r.id) filter (where length(btrim(coalesce(r.body,''))) >= 15) as eligible,
  count(r.id) filter (where r.body ~ '[ऀ-ॿ]') as devanagari,
  count(r.id) filter (where r.body ~ '[؀-ۿ]') as arabic,
  count(r.id) filter (where r.body ~ '[一-鿿ぁ-ヿ가-힣]') as cjk,
  count(r.id) filter (where r.body ~ '[Ѐ-ӿ]') as cyrillic,
  count(r.id) filter (where r.body ~ '[ก-๿]') as thai
from apps a join reviews r on r.app_id = a.id
where a.deleted_at is null group by 1,2,3 order by eligible desc;
```

**S3 — non-circular corpus verification**
```sql
with eligible as (
  select r.id::text as id from reviews r join apps a on a.id = r.app_id
  where a.workspace_id = '93629c77-146f-4687-92a8-b9377001cee2'
    and a.deleted_at is null and length(btrim(coalesce(r.body,''))) >= 15)
select count(*), md5(string_agg(id, ',' order by id)) from eligible;
-- → 200, 90ba575aa5ca28fcf307e230d643f485
```

**C1 — the readiness CLI**
```bash
npm run eval:score -- --labels eval/golden-set-v2.csv --check
npm run eval:score -- --labels L.csv --compare a.csv=A b.csv=B
```

**C2 — corpus integrity**
```bash
md5sum eval/golden-set-v2.csv && sha256sum eval/golden-set-v2.csv
```

**C3 — prove `src/lib/eval` is benchmark-only**
```bash
grep -rln "cluster-metrics\|lib/eval" src/app src/services src/features src/components src/hooks
# → no output
```

**C4 — prove the `.ts` extension trap empirically**
```bash
# dep.ts + user.ts (extensionless import) + run.mjs
node --experimental-strip-types run.mjs   # → ERR_MODULE_NOT_FOUND
npx tsc --noEmit                          # → TS5097 if the extension IS added
```

**C5 — confirm nothing is labelled**
```bash
python3 -c "import csv,io;r=list(csv.DictReader(io.open('eval/golden-set-v2.csv',encoding='utf8')));print(any((x['issue_id'] or '').strip() for x in r))"
# → False
```

**Experiment scripts** (scratchpad, ephemeral — **recreate from §3.2 if needed**):
`exp-metrics.mjs` (E1, E6) · `exp-gaming.mjs` (E2, E3) · `exp-gaming2.mjs` (E3b, E2b) ·
`exp-power.mjs` (E7, E7b) · `exp-power2.mjs` (E7c). All import the merged
`cluster-metrics.ts` and touch no repo file. Seeded LCG (`s=12345` / `s=987654321`).

---

## 17. Inferred vs empirically verified

**Empirically verified — reproduced by running code or querying data:**
all four P0 defects (§3.2) · degenerate-engine floors · multi-issue unrepresentability
(from the type declarations) · the corpus language census · the non-circular md5 match ·
Hinglish misclassification and the ≤5-word row · zero duplicates · length distribution ·
`src/lib/eval` has no production imports · the `.ts` extension contradiction ·
all six readiness gates fail when deliberately broken · CI states and merge SHAs.

**Strong inference — reasoned from verified facts, not directly demonstrated:**
that a Zipfian issue distribution is the normal shape of real review data (the
mechanism is demonstrated; that our future corpora will be Zipfian is inference) ·
that the founder's labels would show the same skew (no labels exist) · that option 2
(open corpora) exists with adequate coverage (**unverified — a research task**) ·
that a second labeller is unobtainable rather than merely unbudgeted.

**Methodology proposals — not facts:** every number in the readiness report's §8–§12
(B³-primary, positive-pair floor of 30, weight sweep {1,2,3,5}, 70% coverage floor,
ARI ≥ 0.80, 14-day delay, tie-break rule). The **power table is measured**; the
**thresholds derived from it are proposals**.

**Requires founder/legal decision:** corpus source and licensing · India priority vs
D024/D023 §3 · Path A vs B on §10.1 · whether ADR 011 §3's objectivity sentence is
amended · whether an external labeller triggers ADR 011 §12.2 sub-processor disclosure.

**Explicitly NOT established:** the real labelling rate · whether two people would
agree under the identity rule · whether the identity rule produces groupings a
customer recognises (ADR 011 §3 claim (ii), untested by any proposed method) ·
the true difference between candidate engines.
