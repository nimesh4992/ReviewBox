# Product Readiness — the reconciled scorecard

**Date:** 2026-08-21 · **Sources reconciled:** a ChatGPT assessment (founder-supplied,
2026-08-21) and a Claude code-level assessment of the same date.
**Relates to:** `docs/MARKET_READINESS_AUDIT.md` (the commercial audit of record) ·
`docs/ISSUE_INTELLIGENCE.md` §1 (the differentiated-product score) ·
`docs/PRODUCT_CONTEXT.md` (ICP) · `docs/decisions.md` D024
**Supersedes:** neither of the two inputs. It replaces both as the number to quote.

---

## 0. Why this file exists

Two assessments of the same repository, on the same day, disagreed by **six points**
on the row that matters most (the analysis engine: 9/10 vs 4/10). A product cannot be
steered off a scorecard that swings that far, so this file resolves each disputed row
against evidence in the code and records **which claim the number rests on**.

**The rule applied to every row below** — the same one `CLAUDE.md`'s ⚠️ block states:

> A passing test proves code compiles and a pure function returns what it was told to.
> It never proves the feature exists, and it never proves a human watched it work.
> **Score the artefact, cite the path.**

Where the two inputs disagreed, the tie was broken by running the check, not by
splitting the difference. Where they agreed, the row is marked *agreed* and moves on.

---

## 1. The reconciled scorecard

| Dimension | ChatGPT | Claude | **Reconciled** | Evidence the number rests on |
|---|---:|---:|---:|---|
| Per-review analysis (sentiment, priority, escalation, reply) | 9 | 4 | **5** | Real and walked: `rules-engine.ts`, Gemini ambiguous-sentiment, 3-tier reply. Half the engine — **per-review is shipped, aggregate does not exist** |
| Issue identity / clustering / scoring | 9 | 3 | **3** | Identity rule ratified (ADR 011 §3); harness built (`src/lib/eval/`); **no engine, no `issues` table** — 0 grep hits in `supabase/` and `src/`. Bake-off gate **CLOSED** (ADR §10.3) |
| Architecture & backend | 8.5 | 8.5 | **8.5** | *Agreed.* RLS, tenant-isolation tests, sync lock with Lua CAS release, 62 routes authenticated |
| Data ingestion / regional + language handling | 8 | — | **6.5** | ▼▲ 2026-08-22, revised same day. Ingestion is fixed and pinned (P0-2 storefront, P1-2 language detector). One real fidelity defect stands: Play version **names are reused and non-monotonic** and we store no version code (**RV1**). The split-app claim that also justified this downgrade was **wrong** and is withdrawn (§9.1) — hence 6.5, not 6. Multilingual *understanding* still untested — 0 native-script in the corpus |
| Testing / verification | 8.5 | 8.5 | **8.5** | ▲ 2026-08-22. 975 tests / 85 files; two new contract suites, both mutation-verified (5/5 and 4/4 caught), plus a pricing contract that fails if any sold row has no code behind it. Still docked for **e2e executing zero specs in CI** (BUG-037) |
| Product UX / dashboard | 7 | — | **6.5** | ▼ 2026-08-22. Two honesty defects visible on real screens: Sentiment shows **"Positive share 0%" beside "41% five-star"**, and **four** places claim clustering that does not exist (§9.2, §9.3). Design-system debt unchanged |
| Store coverage (Google Play + App Store) | 5 | 8 | **8** | Both stores sync **and** post replies; SPINE 8/8 walked 2026-08-19. The 5 scored a 17-platform target that is not this product — see §2 |
| Billing / packaging | 5 | 5 | **5** | ◆ 2026-08-22, evidence changed, **score unchanged**. W5A is decided (ADR 009 → `ACCEPTED`, Option B) and the quota is now a soft cap that reports instead of withholding. That removes a defect; it does not add the ability to take money. Stripe still gated off by decision (D013), keys unset → the row is still 5 |
| Customer acquisition | 3 | — | **3** | *Agreed.* Marketing site + SEO plan exist; no channel has produced a signup |
| Positioning / ICP clarity | 6 | — | **8** | **Raised.** D024 ratified one ICP and superseded D011 + D017. Internally this is decided and documented — what is unproven is whether the market agrees, which is the row below, not this one |
| Production deployment / ops | 7 | — | **7** | *Agreed.* Vercel Pro, git integration ships master, Sentry + PostHog live. No deploy gate in CI; status page not live |
| **Actual customer validation** | 2 | 1 | **1** | **Zero non-founder users.** SPINE 8/8 and the golden-set corpus are both the founder's own app (workspace "Mumbai One"). A 2 implies some external signal; there is none |

### Rolled up

| | ChatGPT | **Reconciled** |
|---|---:|---:|
| Engineering readiness | 8.5 | **8** |
| Product readiness | 7 | **6** |
| Commercial readiness | 5 | **4** |
| Market validation | 2 | **1** |
| **Overall market readiness** | **7** | **5.5** |

> **Re-scored 2026-08-22 03:00 UTC.** Three rows moved and the rollups did not:
> testing ▲, ingestion ▼, UX ▼. II0 shipped but **was not raised**, because §4's rule
> says a row moves when a human exercises the thing or a gate flips — not when a
> suite goes green. That is the rule working, not the plan stalling.

**On the arithmetic.** "Overall market readiness" cannot exceed its binding constraint.
With validation at 1 and commerce at 4, a 7 can only be reached by averaging the rows
that do not gate anything. The engineering rows are strong and they are **not** what
market readiness measures. 5.5 is "ready to demo, not ready to sell" — which is exactly
where `docs/MARKET_READINESS_AUDIT.md` landed independently a month ago.

---

## 2. The one structural correction

The ChatGPT assessment's Phase 1 and Phase 3 describe **local-business reputation
management** — Google Business Profile, Yelp, Trustpilot, G2, TripAdvisor, franchises,
multi-location, agencies. That is the Birdeye / Podium / ReviewTrackers market.

**ReviewBox is app-store review operations for mobile teams.** `grep -ri` for
`yelp|trustpilot|tripadvisor|business profile|g2` across `src/` and
`docs/PRODUCT_CONTEXT.md` returns **zero hits** — not "not yet", never in scope. The
ratified ICP (D024) is a solo founder or 1–5-app mobile team, India first, competing
with AppFollow at $399/mo on a $49 / $129 price.

The likely origin of the drift is **"Google Play" read as "Google reviews" read as
"Google Business Profile."** Three different products with three different buyers.

**Consequence, and it is the expensive one:** run the 10–20-business validation
experiment against local SMBs and it will fail for a reason that says nothing about
ReviewBox. Same experiment, mobile app teams, is the single highest-value thing
available. **The experiment is right. The audience in it was wrong.**

Everything else in the ChatGPT assessment's strategic half stands, and this file adopts
it: the bottleneck is no longer engineering, and another architecture audit buys less
than ten real users.

---

## 3. What "9/10 product readiness" means — stated so it can be failed

A score is useless unless someone can prove it wrong. Product readiness is **9/10 when
R1–R5 are green**; R6 is commercial readiness and is tracked separately.

| # | Gate | Green when | Today |
|---|---|---|---|
| **R1** | **It says what to fix first** | The product names the top problems and what changed, not a list of reviews a human must read | ❌ ranked list of reviews only |
| **R2** | **Every shipped claim is true** | Each pricing-matrix row maps to a shipped route a customer can exercise today | 🟡 **the stated condition is met; the gate's own title is not.** The clustering row is reworded, `KNOWN_UNBACKED` is empty, and `pricing-contract.test.ts` fails if any sold row loses its code. But searching for *claims* rather than *rows* found more: **$199/month for a Team plan that does not exist, in the Terms of Service**, auto-publish sold on four pages for a feature `automation-actions.test.ts` asserts is deliberately absent, and a five-tone list for a four-tone engine (**CP1**, **CP2**). The gate as written can be green while its title is false — that is a defect in the gate, and it stays 🟡 until CP1/CP2 close |
| **R3** | **A stranger reaches value unaided** | 2 of 3 non-founder testers sign up and name their top problem without help | ❌ never attempted |
| **R4** | **The numbers are right off-US, off-English** | A region-locked, non-English app shows counts matching its listing, and its reviews are analysed not dropped | 🟡 ingestion fixed; analysis unproven (0 native-script in corpus) |
| **R5** | **Nothing fails silently** | No spinner that never resolves, no success on a no-op, every failure names a next action | 🟡 **the code condition is met and enforced; nobody has watched it.** AU5 shipped 2026-08-22: eleven load paths, two of which were data-loss (an empty brand-voice form you could save over your real one; a fixture file rendered as your saved alert settings). The eternal spinner is gone. `au5-load-error-contract.test.ts` sweeps the tree for `fetch(...).then(r => r.json())` and **its allowlist is empty**. Per §4 this cannot be green on a suite: it needs someone to induce a 500 on each surface and look |
| **R6** | **Money can be taken** *(commercial, not product)* | Stripe live, W5A decided, one real checkout completes | ❌ **W5A is now decided** (2026-08-22, ADR 009 Option B, shipped). Stripe keys still unset by decision — one of three conditions met |

**R1 is the only one that needs a new engine. R2 is a sentence of copy. R3 needs three
people.** That ordering is the whole plan — see `docs/PATH_TO_9.md`.

> **R2 turned out not to be a sentence of copy.** It was a sentence of copy *plus*
> three more untrue claims that nobody had looked for, because the gate was written
> against the pricing matrix and the matrix was not where the worst one lived. The
> lesson generalises: **a gate phrased as a test of one artefact will be satisfied by
> fixing that artefact**, whatever its title says.

---

## 3.1 · Re-score, 2026-08-22 (afternoon) — three PRs merged and deployed

`ee67c0d` (#153) · `bac7323` (#154) · `d6f85b8` (#155), all `READY` on production,
verified at Vercel rather than inferred from a green merge.

**What moved, and what deliberately did not:**

| Row / gate | Change | Why |
|---|---|---|
| Billing / packaging **5** | evidence rewritten, **score held** | W5A decided and the harmful gate removed. Removing a defect is not the same as gaining the ability to charge |
| **R2** ❌ → 🟡 | partial | Its stated condition is met and now test-enforced; its title is not (CP1/CP2) |
| **R5** 🟡 → 🟡 | evidence rewritten, **state held** | AU5's eleven sites are fixed and the sweep is clean, but §4 forbids flipping a gate on a passing suite |
| **R6** ❌ → ❌ | one of three conditions met | W5A decided; Stripe keys still unset |
| Product UX **6.5** | **held** | Both defects it was lowered for are fixed (clustering copy in #150/#154, "Positive share 0%" in #151) — but neither was fixed by a human exercising the screen, so §4 does not permit raising it. It moves when someone walks it |
| Testing **8.5** | **held** | 1,040 tests in 91 files, four new mutation-verified contract suites. A suite going green is explicitly not grounds to raise a row |
| Everything else | untouched | No artefact changed |

**Rollups do not move.** Overall market readiness stays **5.5**: it is bound by
validation at 1 and commerce at 4, and neither was touched. A day of removing defects
does not create a customer.

**One new defect class was closed rather than scored.** Writing #155 reintroduced the
middleware-matcher gap it had just fixed elsewhere — `/api/billing/usage` landed in
neither matcher, which on the production host serves HTML to a `fetch()` with
`res.ok === true`. Seventh instance on record.
`src/middleware.api-coverage-contract.test.ts` now checks every API route, allowlist
empty. That belongs in the architecture row's evidence eventually; it is noted here
rather than scored, because nothing has yet been observed working because of it.

---

## 4. Keeping this honest

- Re-score a row **only** with the artefact that changed and the check that was run.
- A row may not be raised because a test suite went green. It may be raised because a
  human exercised the thing, or because a gate in §3 flipped.
- When R1–R5 are all green, this file's headline becomes a claim about the product, and
  at that point it must be walked the way `docs/SPINE.md` is walked — by a person.
