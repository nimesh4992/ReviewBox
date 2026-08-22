# Today — 2026-08-21 (the scorecard got reconciled, and R1 started moving)

> Two things happened. **The readiness question was settled against evidence**
> (`docs/PRODUCT_READINESS.md`), and **the first thing that reads across reviews
> instead of listing them was built** — II0, "what changed in this release".
>
> Previous session's handoff (SPINE 8/8, the II epic target, D024/D025) is not
> repeated here: it is in `docs/ISSUE_INTELLIGENCE.md`, `docs/decisions.md` and
> `docs/II_DELIVERY_PLAN.md`, all still current.

---

## 1. Two assessments disagreed by six points. They are now one number.

A ChatGPT assessment and a Claude code-level assessment of the same repo, on the
same day, scored the analysis engine **9/10 and 4/10**. `docs/PRODUCT_READINESS.md`
reconciles every row against evidence and replaces both.

| | ChatGPT | **Reconciled** |
|---|---:|---:|
| Engineering readiness | 8.5 | **8** |
| Product readiness | 7 | **6** |
| Commercial readiness | 5 | **4** |
| Market validation | 2 | **1** |
| **Overall market readiness** | **7** | **5.5** |

**The row that moved most, and why it matters:** *issue identity / clustering*
scored 9 on the strength of a passing test suite. What is tested is the
**measuring instrument** — `src/lib/eval/`, the golden-set exporter, the scorer.
There is no engine for it to score: still zero `issues` rows, zero
`issue_reviews`, and `reviews.embedding` referenced **0 times** in `src/`. This
is the repo's oldest failure shape (green means verified) and it inflated the
one row the whole differentiation story rests on.

**The strategic half of the ChatGPT assessment is adopted, with one correction.**
Its Phase 1/3 described Yelp, Google Business Profile, Trustpilot, franchises,
multi-location agencies — **local-business reputation management**, which is a
different product with a different buyer. ReviewBox is app-store review ops for
mobile teams (D024). The validation experiment it proposes is the right next
move; run it against **mobile app teams**, not local SMBs.

**"9/10 product readiness" now has a definition that can be failed** —
`docs/PRODUCT_READINESS.md` §3, gates R1–R5. Today: R1 ❌ R2 ❌ R3 ❌ R4 🟡 R5 🟡.

---

## 2. What shipped — II0, on `claude/review-issue-schema-kn2ayd`

**`src/lib/release-regression.ts`** — per-tag complaint movement between adjacent
releases of the same app, plus a "What changed vs v1.4" card on
`/releases/[version]`.

```
v1.5 vs v1.4 · 150 reviews now · 50 in v1.4
  ⚠ Probable regression: Payment
  Payment    +375%   8 → 38 per 100     Regression
  Scanner    +140%   5 → 12 per 100     Regression
  Login      New in this release        Watch
  Crash      too few to judge           —
```

Four ways this could have lied to a customer, and what stops each: rates not raw
counts (a bigger release is not a worse one); a small-n floor (1 → 2 reviews is
not "+100%"); `new` instead of dividing by zero; and previous-version chaining
**within one app id**, because version numbers are unique only within an app.

**Verified:** `tsc` clean · **965/965 tests in 84 files** · lint 0 errors ·
`next build` · and the new suite was **mutation-tested — 5 mutations applied,
5 caught**. Spec: `docs/specs/release-regression.md`.

**Not verified, and it is the only thing that counts:** AC-6 — *a founder opens
a real app's release and names the biggest mover in under 30 seconds*. The
backlog box stays unchecked until that happens.

---

## 3. The plan to 9/10 — `docs/PATH_TO_9.md`

Ordered by five rules, each of which this repo has already paid for ignoring.
Two worth knowing:

- **Truth before polish.** R2 is one false pricing row — *"Topic clustering
  across your reviews — Pro ✅"* when there is no clustering. Running the
  user test on a page that overclaims turns three testers into three people who
  learned the product lies. **So R2 precedes R3.**
- **Prove the thesis before building the primitive.** II0 (1 session, no schema)
  before II1 (3–5 sessions, blocked gate). If the II0 view does not make a
  founder lean forward, II1 will not either.

Milestones: **M1** II0 *(built, awaiting walk)* → **M2** truthful-surface sweep →
**M3** three non-founder walks → **M4/M5** the Issues primitive and its screens
(blocked) → **M6** silent-failure sweep → **M7** multilingual proof.

§6 is a **bake-off protocol for Codex and Cursor**: same base commit, same brief
pasted verbatim, and a 100-point rubric where **20 points are verification
honesty** and any D009 breach caps the score at 50. Claude's own row is
deliberately blank — an agent may not score itself.

---

## 4. What we need from you

| # | Ask | Blocks | Why only you |
|---|---|---|---|
| 1 | **Walk AC-6** — open a real app's release, name the biggest mover | M1 → R1 | No agent can do this; it is the entire definition of done |
| 2 | **Reword the pricing matrix row** *"Topic clustering"* → *"Topic breakdown"*, or hold it until II1 ships | M2 → R2 | D009 §9 reserves pricing pages. The diff is one word |
| 3 | **Decide the corpus question** (ADR 011 §10.3) — how a genuinely multilingual golden set is obtained | M4, M7 | Methodology + product call, not a patch to the dataset |
| 4 | Stripe test keys · **W5A** (`docs/adr/009-review-volume-limit.md`) | R6 | Money. D009 |
| 5 | Carried: `ADMIN_CLERK_USER_ID` in Vercel prod · **Slack on `/sub-processors`** | admin probe; legal exposure | Unchanged from 2026-08-19 |

---

## 5. Notes for the next session

- **The II0 tag ceiling is real and must not be oversold.** The eight tags are
  English regexes, so a Hinglish payment complaint may carry no tag and move no
  bar. Describe this feature as "how these tags moved", never as "what your
  users are complaining about". That sentence is the difference between a true
  claim and the pricing-page problem in §4.2.
- **The release detail page's own review list is capped at 100 rows** (it always
  was). The comparison runs its own query up to 5,000 and discloses truncation.
  The page's "Reviews" stat still reads from the capped slice — pre-existing,
  logged here rather than fixed inside an unrelated PR.
- `npm ci` was needed in this session: the clone arrives without `node_modules`.
