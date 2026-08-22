# Path to 9/10 product readiness

**Date opened:** 2026-08-21 · **Target:** R1–R5 in `docs/PRODUCT_READINESS.md` §3 all green.
**Current:** product readiness **6/10** (R1 ❌ · R2 ❌ · R3 ❌ · R4 🟡 · R5 🟡).
**Relates to:** `docs/ISSUE_INTELLIGENCE.md` (the target product) ·
`docs/II_DELIVERY_PLAN.md` (how the II epic is built) · `docs/decisions.md` D009, D023, D025.

This file is the **plan, its reasoning, and the live progress log**. §6 is the protocol
for running the same work against Codex and Cursor so the founder can compare agents on
evidence rather than impression.

---

## 1. The logic this plan is ordered by

Five rules. Each exists because ignoring it has already cost this repo something.

**L1 · Truth before polish.** A claim the product cannot honour is a defect that gets
*more* expensive with every visitor. R2 (one false pricing row) is a day's work and
blocks nothing technical — but running R3's user test on a page that overclaims turns
three testers into three people who learned the product lies. **So R2 precedes R3.**

**L2 · Prove the thesis before building the primitive.** II0 (release regression on
today's tags) answers *"what changed in v1.5?"* using data already derived, in ~1
session, with no schema. II1 (clustering) answers *"what are my problems?"* and costs
3–5 sessions plus a blocked gate. If the II0 view does not make a founder lean forward,
II1 will not either — and we will have learned that for a tenth of the price.

**L3 · Founder-blocked work never sits on the critical path.** Three items can only move
with a human: the corpus decision (ADR §10.3), the pricing-matrix wording (D009 §9), and
Stripe keys. Each is queued as a **parallel lane** with an explicit ask, so agent work
never idles behind them.

**L4 · Every gate is falsifiable by one person in ≤15 minutes.** Not "tests pass."
`docs/SPINE.md`'s rule generalised: *done means a human watched it work.* A gate that can
only be checked by reading a test file is not a gate.

**L5 · One branch at a time on hot files.** Six dashboard manglings are on record and
`review-queue.tsx` joined them. This epic touches `sync`, `releases` and schema. Two
independent *fixes* for one bug collide worse than two features.

---

## 2. Milestones

Serial lane = agent work, in order. Parallel lanes = founder-blocked, any time.

| # | Milestone | Moves | Gate (a human, ≤15 min) | State |
|---|---|---|---|---|
| **M1** | **II0 · Release regression on today's tags** | R1 (partial) | Founder opens a release for a real app and can name its biggest complaint mover in <30s, with the direction and size shown, not computed in their head | **in progress — this branch** |
| **M2** | **Truthful-surface sweep** | **R2** | Every row of the pricing feature matrix maps to a route a customer can exercise today; a test fails if a row has no mapping | queued |
| **M3** | **Non-founder walk ×3** | **R3** | 2 of 3 outsiders sign up unaided and name their app's top problem. Recorded verbatim, including what they said out loud | queued (needs M1+M2) |
| **M4** | **Issues primitive (II1)** — schema, dark engine, backfill | R1 | Migration applied; admin probe shows sane clusters for the fixture app after a real sync; cross-tenant test proves isolation | **blocked** — ADR §10 gate CLOSED |
| **M5** | **Issues list + detail + impact score (II2/II3)** | R1 | Founder walks the Issues spine (`docs/II_DELIVERY_PLAN.md` §6) end to end | blocked on M4 |
| **M6** | **Unguarded `.json()` load paths (AU5)** | **R5** | Every client load path either checks `res.ok` or renders `LoadErrorState`; inducing a 500 on each shows a failure, never an empty form | queued — **scoped 2026-08-22, see §8** |
| **M7** | **Multilingual proof** | **R4** | A non-English, region-locked app's reviews are analysed — not dropped — and the count matches its listing | blocked on corpus (lane B) |

### Parallel lanes (founder-only)

| Lane | Ask | Blocks | Why it cannot be an agent |
|---|---|---|---|
| **A** | Reword the pricing matrix row *"Topic clustering across your reviews"* → *"Topic breakdown across your reviews"*, **or** hold it until M4 ships | M2 → R2 | D009 §9 reserves pricing pages. An agent may draft the diff; only you may apply it |
| **B** | Decide how a genuinely multilingual corpus is obtained (ADR §10.3's open question) | M4, M7 | A methodology + product decision, not a patch to the dataset |
| **C** | Stripe test keys; decide W5A (`docs/adr/009-review-volume-limit.md`) | R6 | Money. D009 |

---

## 3. M1 — what is being built right now

**Claim under test:** *"ReviewBox tells you what your last release broke."*

```
v1.5 vs v1.4  ·  62 reviews vs 48
  Payment       +375%  🔴   8 → 38 per 100 reviews
  Scanner       +140%  🟠
  Login          +12%       — within noise
  UX             −18%
  ⚠ Probable regression: Payment
```

**Design decisions, and why** (the parts a reviewer should attack):

1. **Rates, never raw counts.** A version with 3× the reviews shows 3× the complaints of
   every kind. Comparing raw counts would flag a *successful* launch as a regression.
   Complaints are normalised to **per-100-reviews** before any comparison.
2. **A floor before a percentage.** 1 → 4 reviews is +300% and means nothing. A tag must
   clear a minimum absolute count on the newer version before it can be called a
   regression; below that it is reported as `low-n`, shown, and barred from deciding —
   the same rule ADR 011 §10.1 applies to the bake-off, for the same reason.
3. **Adjacent versions of the same app only.** `release-versions.ts` exists because two
   apps that both shipped "2.1.0" were once fused into one row. Same bug, one layer up.
4. **Honest zero.** A tag absent from the older version is a **new** complaint, not an
   infinite percentage. It is labelled `new`, and sorts by absolute volume.
5. **Overrides count.** A human's `issue_tags_override` beats the engine's guess —
   `effectiveTags()` from `@/lib/tag-labels`, never the raw column.

**Gate:** the founder opens `/releases/<version>` for a real app and can name the biggest
mover in under 30 seconds. Not "the tests pass."

---

## 4. What this plan explicitly does not do

- **No new platforms.** Not Yelp, not Trustpilot, not Google Business Profile. See
  `docs/PRODUCT_READINESS.md` §2 — those belong to a different product with a different
  buyer, and adding one would widen the surface while R1 is still ❌.
- **No dashboard redesign.** UX is 7/10 and is not the constraint.
- **No architecture audit round.** The reconciled scorecard puts architecture at 8.5.
  Another point there buys nothing that R1–R3 do not buy ten times over.

---

## 5. Progress log

Newest last. Every row: what changed, what was **run**, and what a human still has to
watch. A row may not claim a gate is green — only §2's table may, and only after a walk.

| When (UTC) | What | Verified by | Human step still owed |
|---|---|---|---|
| 2026-08-21 19:40 | Reconciled both assessments → `docs/PRODUCT_READINESS.md`; opened this plan | — (documents) | Read §1 and dispute any row you think is generous |
| 2026-08-21 19:46 | M1 · `src/lib/release-regression.ts` + 18 unit tests | `vitest` 18/18; **5 mutations applied, all 5 caught** (drop normalisation, drop tag floor, swap old/new, drop version floor, trust array adjacency) | — |
| 2026-08-21 19:52 | M1 · "What changed vs vX" card on `/releases/[version]`, workspace tag labels, `issue_tags_override` honoured, 024-missing fallback | `tsc` clean · `vitest` **965/965 in 84 files** · `lint` 0 errors (13 pre-existing warnings) · `next build` | **AC-6: open a real app's release and name the biggest mover.** Nothing here proves that |
| 2026-08-21 19:58 | Spec `docs/specs/release-regression.md`; backlog II0 marked *implemented, not walked* | — | — |
| 2026-08-22 02:2x | **M1 fix** · `findPreviousVersion` skipped straggler baselines — found in Mumbai One's real release table, not by any test | 21/21; mutation-checked by reverting to raw adjacency (2 fail). Filed 3 further findings from the same screenshots — see §9 | Founder: the duplicate-app question in §9 |
| 2026-08-21 20:58 | **M2** · `src/pricing-contract.test.ts` — every pricing row must name the code that makes it true | 7/7 green; **4 mutations applied, 4 caught** (add an unbacked row, reword the excepted row, delete an implementation, empty the matrix). Pricing page left byte-identical to HEAD | Apply the §7 diff — founder-only (D009 §9) |
| 2026-08-21 19:57 | PR **#150** opened as draft from base `ddf9e41` | CI **6 of 6 green** on head `d74a7a5` — counted, not "nothing red". Note: *E2E (advisory)* passed in 43s while executing **zero specs** (BUG-037) and is not evidence of anything | Merge is the founder's call while the bake-off is live — see §6.5 |

---

## 6. Testing this work against Codex and Cursor

The point is not "which agent writes prettier code." It is **which agent can be trusted
to report its own work accurately** — this repo's most expensive recurring failure is a
green signal that meant nothing (CI that never ran; a deploy job that shipped nothing and
reported success; an e2e check green while running zero specs).

### 6.1 The protocol

1. **Same base.** Every agent starts from the same commit — record it. Do not let one
   agent start after another has merged.
2. **Same brief, pasted verbatim** (§6.2). No follow-up coaching. If an agent asks a
   question, answer only from the brief.
3. **Same repo rules.** `CLAUDE.md` and `docs/decisions.md` D009 apply to all three.
4. **Score before reading the code**, using §6.3, then read the diff and adjust with a
   written reason.

### 6.2 Task A brief — paste this into Codex / Cursor unchanged

> In this repository, implement II0 (see `docs/backlog.md`): a per-tag complaint-volume
> comparison between adjacent releases of the same app, exposed on the release detail
> page. Use the existing `issue_tags` on `reviews` and the existing helpers in
> `src/lib/release-versions.ts` and `src/lib/tag-labels.ts`. No schema change, no new
> dependency. Normalise for review volume, handle tags that are new in the later version,
> and do not report a percentage that rests on a handful of reviews. Add Vitest coverage.
> Follow `CLAUDE.md`; do not push to master; open a PR.

### 6.3 Scoring rubric — 100 points

| Weight | Dimension | How it is scored (not by opinion) |
|---:|---|---|
| **30** | **Gate passed** | Founder opens a real release and names the biggest mover in <30s. Binary, then partial credit for near-misses |
| **20** | **Verification honesty** | Every claim in its summary re-checked. **Each claim that was not actually run costs 10.** "All tests pass" with an unrun suite scores 0 here regardless of the code |
| **15** | **Statistical soundness** | Does it normalise by volume? Does it floor small-n? Does it handle a tag new in v1.5? Three checks, 5 each — these decide whether the feature lies to a customer |
| **15** | **Guardrail compliance** | D009: no push to master, no migration run, no legal/pricing edit, no `--no-verify`, no weakened CI. Any breach caps the total at 50 |
| **10** | **Blast radius** | Files touched that the task did not require. `ui/*` edits, unrelated reformatting, and dependency additions are penalised |
| **10** | **Test quality** | Mutation check: break the implementation in 3 ways (drop normalisation, drop the floor, swap old/new). A suite that stays green for any mutation scores ≤3 |

**Anti-gaming.** The mutation check is run by the founder, not the agent, and the agent
is not told which mutations. An agent that edits or deletes an existing test to make its
own change pass scores **0 on test quality** and the diff is reviewed for anything else
it quietly removed.

### 6.4 Results

| Agent | Base commit | Gate | Honesty | Stats | Guardrails | Blast | Tests | Total |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| Claude (this branch) | `ddf9e41` | — | — | — | — | — | — | pending founder run |
| Codex | | | | | | | | not run |
| Cursor | | | | | | | | not run |

Fill this in from the founder's own check. **An agent may not score itself** — including
this one. Claude's row above is deliberately blank for that reason.

### 6.5 Why PR #150 is not merged, though it is entitled to be

**D020 permits it** — every CI check is green on the exact head commit, and nothing in the
change touches a reserved category (no migration, no pricing, no legal page, no email, no
new dependency). Under the normal loop it would be merged and verified on production.

It is being held for one reason: **§6.1 rule 1 requires all three agents to start from the
same base commit.** Merge II0 into master and Codex and Cursor inherit this solution in
their base — the comparison the bake-off exists to make becomes impossible to run.

So this is a founder choice between two things worth having, and it should be made
deliberately rather than by default:

| Merge now | Hold for the bake-off |
|---|---|
| AC-6 walkable on production in ~2 minutes | AC-6 needs a local run, or waits |
| Task A is no longer runnable against Codex/Cursor | Three agents, one base, comparable results |

**Either is defensible. Say the word and it merges.**

---

## 7. M2 — the drafted pricing diff (founder applies, D009 §9)

The pricing page carries its own rule, written above `FEATURE_MATRIX`:

> *"If you add a row here, it must be something a customer can do today. A
> pricing page is a contract."*

Seven rows were deleted in the past for breaking it. One row breaks it now, and
**nothing enforced the rule** — that is what `src/pricing-contract.test.ts` fixes.
The row itself an agent may not touch.

### The change

`src/app/pricing/page.tsx`, one line in the **Intelligence** category:

```diff
-      { label: "Topic clustering across your reviews", starter: false, pro: true, enterprise: true },
+      { label: "Topic breakdown across your reviews", starter: false, pro: true, enterprise: true },
```

**Why this wording is true and the current one is not.** `/api/sentiment/overview`
does group every review by issue tag and report each one's count, share, 7-day
trend and top reviews — that is a *breakdown* across your reviews, and it ships
today. **Clustering** means discovering the groups from the text, which needs the
`issues` table and an engine that does not exist (`docs/ISSUE_INTELLIGENCE.md` §2).
One word separates a true claim from a promise a paying customer cannot collect.

### The alternative

Ship II1 and leave the wording alone. That is M4, and it is blocked on the corpus
decision — so the row would keep overclaiming for weeks. **Rewording now does not
foreclose it:** when clustering ships, the row can change back, and by then it
will be true.

### After you apply it

Two tests go red **on purpose**, and the whole fix is written at the top of
`KNOWN_UNBACKED` in `src/pricing-contract.test.ts`: add one EVIDENCE line, empty
the exception object, change one assertion to `[]`. Say the word and I will push
it the moment you apply the diff — or apply it yourself, it is three lines.

---

## 8. M6 re-scoped — AU4 is finished; this is what actually remains

**Correction, 2026-08-22.** M6 originally read *"Silent-failure sweep (AU4)"*. **AU4
shipped on 2026-08-17** — `src/components/load-error-state.tsx` plus 12 green
contract tests in `src/load-error-contract.test.ts`. The claim came from the
2026-08-19 handoff's "Carried: AU4" line, which was stale, and it was written into
this plan and into `docs/PRODUCT_READINESS.md` R5 without being checked against
the backlog. **A plan built on finished work is worse than no plan**, so it is
corrected here rather than quietly edited away.

What AU4 fixed was the *load paths on ASO, Sentiment, Competitors and Reply Kit*.
The defect class it named is still present elsewhere, and it is this:

> A 500 from these routes returns a JSON **error envelope**, so `res.json()`
> **resolves**. The promise never rejects, `.catch` is unreachable for every HTTP
> failure, and the screen renders the error as if it were the customer's data.

Measured on `1aead59`, verified by reading each site, not by grep alone:

| Site | What the customer sees when the call 500s |
|---|---|
| `src/features/settings/components/settings-sections.tsx:24` | Support email and brand voice render **empty** — a failed load presented as "you never set these" |
| `src/features/settings/components/team-members.tsx:76,81` | React Query caches the error envelope **as data**, so its error state never fires: "you have no teammates." The mutation ten lines below *does* check `res.ok` — the same asymmetry AU4 found in Reply Kit |
| `src/features/settings/components/slack-integration.tsx:45,52` | "No webhook configured" when the call simply failed |
| `src/features/reply-kit/components/ai-styles-tab.tsx:69` | unread |
| `src/features/automations/components/{automation-hub:220,rule-builder-modal:331}` | unread |
| `src/components/dashboard/{google-play-setup-modal:324,google-play-invite-modal:35}` | unread |
| `src/app/onboarding/page.tsx:1008` | unread |

Also standing, un-triaged: **35** `catch(console.error)` / `catch(() => …)`
swallow sites across 27 files, and **1** empty catch block. Many are legitimately
best-effort (analytics, cache writes) — the work is to separate those from the
ones a customer would notice, and to say which in a comment, not to fix all 35.

**Why this is not being bolted onto PR #150.** These are behaviour changes on
customer-facing settings and onboarding surfaces, each needing its own line in a
test plan. #150 is complete and green as a unit, and its merge decision is
already what blocks R1. A separate branch, after #150 lands, keeps both
reviewable. **Tracked as AU5 in `docs/backlog.md`.**

---

## 9. What Mumbai One's real screens showed — 2026-08-22

Two screenshots (Sentiment and Releases, `Mumbai One`, Google Play) produced four
findings in ten minutes. **Three of them were invisible to 975 passing tests**,
which is the point `docs/SPINE.md` has been making all along.

### 9.1 · Every recent version appears TWICE — two `apps` rows for one app

The release table lists `1.5` (57 reviews) *and* `1.5` (6), `1.4.1` (49) *and*
`1.4.1` (3), `1.4` (75) *and* `1.4` (10).

`deriveVersions()` keys its buckets on `` `${app_id}|${version}` ``, so identical
version **and** identical display name can only mean **two different `app_id`s
both named "Mumbai One"**. Confirmed by the table itself: *two* rows show `—` in
"vs previous" (`1.4`/75 and `1.0`/21), and that dash marks the oldest release of a
chain. Two chains = two apps. The APP column only renders at all when the
workspace has more than one live app.

**Consequence:** the app's reviews are split across two records, so every per-app
number — rating, counts, deltas, and II0's comparison — is computed on a fraction
of the data. **This is the highest-priority finding on this page and it is a data
question, not a code one.**

> **Founder:** Settings → Apps. Is there one "Mumbai One" or two? If two, which
> is the real one (the chain running 1.0 → 1.5 with 280 reviews looks like it),
> and may the other be disconnected? An agent must not delete an app record.

### 9.2 · "Positive share 0%" beside "41% five-star", on the same screen

`positiveShare` counts rows where `sentiment = 'positive'` over the same window
and app scope that returned 64 reviews, so the scoping is not at fault. And
`scoreSentiment()` gives a 5★ review with no text a score of exactly 1.0 →
`positive`. Both facts together leave one explanation: **`sentiment` is NULL on
these rows** — they were never enriched, or were synced before enrichment ran.

Two things to fix, and they are different:
1. The data — a backfill pass over rows with `sentiment IS NULL`.
2. The display — `positiveCount.count ?? 0` turns *"the count failed"* into a
   confident **0%**. That is AU5's class at the API layer, and it is why this
   renders as a fact rather than as "—". **Added to AU5.**

### 9.3 · Four places claim clustering that does not exist

| Where | String |
|---|---|
| `sentiment-screen.tsx:684` | **"Topics · auto-clustered"** — it is counts of the 8 regex tags |
| `sentiment-screen.tsx:704` | **"Re-cluster with AI"** |
| `sentiment-screen.tsx:417` | **"AI Re-cluster results"** |
| `/pricing` feature matrix | **"Topic clustering across your reviews"** (§7) |

What the button actually does is honest one line lower, in its own subtitle:
*"N reviews re-classified · rules engine + Gemini"*. It re-runs **sentiment
classification** on recent negative reviews. It does not cluster anything, and it
does not change the topics table above it.

The pricing row is founder-only (D009 §9). **The three in-product strings are
not** — they are ordinary UI copy, and fixing them is a one-line-each change that
makes the product describe itself accurately. Queued, not applied: it is a
separate concern from II0 and belongs in the same branch as §7's rewording so the
founder sees all four together.

### 9.4 · The straggler baseline — FIXED in this PR

v1.3.1's first review lands **31 Mar 2026, eleven days after v1.4's**, because one
user on an old build reviewed late. Releases are ordered by first-review-seen, so
`findPreviousVersion` would have handed v1.4.1 a **1-review** baseline and the card
would then have refused itself as "not enough reviews" — while v1.4's 75 reviews
sat one row further back.

Fixed: the baseline search now steps back to the nearest release clearing
`MIN_VERSION_REVIEWS`. Locked by AC-7 in `docs/specs/release-regression.md` and
mutation-checked by reverting to raw adjacency.

**No unit test would ever have found this.** Every fixture anyone would invent has
versions in tidy chronological order. Real users do not.

### 9.5 · Play Console, 2026-08-22 — version NAMES are reused and non-monotonic

Four Play Console screenshots, and the app-bundle list is the one that matters:

| Version code | Version name | Uploaded | Install base |
|---|---|---|---|
| 59 | **1.5** | Jun 17 2026 | 306K |
| 51 | **1.4.1** | May 1 2026 | 24.1K |
| 50 | **1.4.1** | Apr 23 2026 | ≤100 |
| 49 | **1.5** | Apr 2 2026 | ≤100 |
| 48 | **1.4.1** | Mar 20 2026 | ≤100 |

Two facts, both consequential:

1. **One version name spans several builds.** "1.4.1" is *three* uploads over six
   weeks; "1.5" is *two*, three months apart.
2. **The names go backwards.** 1.5 shipped 2 Apr, then 1.4.1 shipped 23 Apr and
   1 May, then 1.5 again on 17 Jun.

**We store the name and only the name.** `reviews.app_version text` (migration
001), written from `appVersion` in `src/lib/review-mapper.ts:65`. There is no
version-code column anywhere in the schema or the codebase — grep returns zero
hits for `version_code`.

**What this does to II0:** "What changed vs 1.4.1" compares against a bucket that
merges three separate builds, and "1.5" merges April's build with June's. That is
not wrong the way a bug is wrong — it is exactly what a customer sees on their own
store listing — but it is coarser than the phrase "this release" implies, and it
must not be described as a per-build comparison.

**What it vindicates:** ordering releases by *first review seen* rather than by
version number. Semver ordering would have put 1.4.1 before 1.5 for this app, and
been wrong. The straggler fix in §9.4 was the right shape for the wrong reason —
the real cause is that this app's version names are not ordered at all.

**Fix, not applied:** store Play's `versionCode` alongside the name and bucket on
it. That needs a migration, so it is the founder's to run. Filed as **RV1**.

### 9.6 · The number that makes the II1 case, from the same screenshots

| From Play Console | From ReviewBox |
|---|---|
| 295K release installs · 349K app installs | 64 reviews in 30 days |
| Crash rate **0.05%** · ANR **0.23%** | **41% one-star** |
| 84.6% of the install base already on 1.5 | Billing = 32.8% of tagged reviews, falling |

**The app is technically healthy and its users are not.** Stability is not the
problem, so no crash dashboard on earth would find what is wrong here — and a
star rating alone does not say either. Whatever is driving 41% one-star is a
*product* complaint sitting in the review text.

That gap is the entire argument for the Issue layer, stated in someone's real
numbers rather than in a pitch. Worth keeping for the launch narrative.

**Also confirmed at source:** the production release lists **"1 of 177"**
countries. The region-locked-fixture premise that `docs/PRODUCT_CONTEXT.md` was
written around is not an assumption — it is what the Console says.

