# Today — 2026-08-19 (SPINE 8/8, and the target is now written down)

> Two things happened today. The morning: **SPINE reached 8/8** and the feature
> freeze lifted (below). The evening: **the target for what comes next was
> assessed against the code and documented** — read this part first, because it
> changes what the next session should start on.

---

## The Issue Intelligence target — documented, and it moved the estimate

**New: `docs/ISSUE_INTELLIGENCE.md` is the target. `docs/decisions.md` D023 holds the
constraints.** Both are in the every-session reading list in `CLAUDE.md` now.

The founder asked how far the code is from the product discussed in the II1–II11
critique. Answered by reading the codebase rather than the product surface, and the
number moved a long way:

| | |
|---|---|
| Earlier, screenshot-based estimate | ~70–75% of the differentiated product |
| **Code-level assessment** | **~25–30%** |

**Not** "the product is 25% built" — the Collect/Display/Reply infrastructure is
substantial and the UI is ~8/10. The differentiating intelligence layer is what does
not exist. As a differentiated product: **~6/10 today**, ~8.5–9/10 after II1–II11.

**The bottleneck, in one sentence:** there is no `issues` table, no `issue_id` on
`reviews`, and nothing that groups reviews. Six of the eight gaps read or write
through that missing entity, which is why no amount of UI work moves them.

### Three documented claims turned out to be false in the code

Each was being planned against. All three are now corrected at source in `CLAUDE.md`
and `docs/backlog.md`:

1. **`@xenova/transformers` is not installed and never was** — not in `package.json`,
   absent from `src/`. "Sentiment already runs local topic clustering" was false;
   `/sentiment`'s "topics" are counts of **8 hardcoded English regexes**.
   **II1 is green-field, and the $0 clustering assumption is unproven.**
2. **`reviews.embedding vector(384)`** + ivfflat index have existed since migration
   001 and are **never read or written**. Real groundwork, no pipeline.
3. **"Incidents already does spike-detection"** — half true. `review-sync.ts`
   emails/Slacks a spike; it does **not** create an incident. Only a human does.

### What the next session should start on

**Not II1's implementation.** Per D023:

1. **II0a — the II1 ADR, architecture only.** The keystone. 13 questions, ≥3
   approaches evaluated, recommendation for an India-first SaaS
   (`docs/ISSUE_INTELLIGENCE.md` §7). The framing is *"what constitutes the identity
   of an issue?"*, not *"how do I generate a nice AI summary?"*. **No II1 code until
   this exists.**
2. **II0 — Phase 0 release-regression** on today's `issue_tags[]`
   ("Payment +375% 🔴 in v1.5 vs v1.4"). Small vertical slice, ships the story
   without waiting for clustering. Can run in parallel with the ADR.

### The ICP contradiction is resolved — D024

Three documents described three different customers, and the epic could not scope its UI or its
pricing tier until one won. **`docs/PRODUCT_CONTEXT.md` wins; D011 and D017 are superseded**
(both marked in place, log stays append-only).

Decided on evidence, not preference — every superseded claim is contradicted by something already
shipped: D011 still carries its own uncarried-out instruction *"[FOUNDER: edit this paragraph
today]"*; D017's **$200–500/mo** is contradicted by the live **$49 / $129** in `plans.ts` and on the
pricing page; "English-first" is the assumption behind the `country: "us"` bug and is contradicted
by CM1 sitting top of NOW; and "technical indie dev" is contradicted by the search-by-name and
Draft Mode onboarding we actually built.

**Consequence for the epic:** it does *not* re-target the product. Our buyer is the support,
product and engineering team all at once — which is why the Issue layer helps them. So `owner` is a
label not a Jira integration, **II9 stays P2**, and Issue Intelligence ships in **Pro**, no new tier.

> ⚠️ **One founder-only item.** The pricing page's feature matrix says *"Topic clustering across
> your reviews — Pro ✅"* and there is no clustering. The comment above that matrix states the rule
> it breaks: a row "must be something a customer can do today. A pricing page is a contract."
> Reword it, or ship II1 and make it true. **D009 reserves pricing-page edits to you.**

### How long the epic takes — estimated against measured throughput

`docs/ISSUE_INTELLIGENCE.md` §12. Short version: **~8–12 weeks for all of II1–II11**, **~3 weeks to
the point where the pitch changes**, at the current near-daily cadence (PRs #78–#135 merged in four
days). Evenings-and-weekends cadence multiplies by ~3. Agent build time is only 10–15 sessions —
the calendar is set by your decisions, manual migrations, walked verification, and in two cases the
customer's own release cycle: **II6/II10 are built in days but cannot be *proven* for 4–8 weeks
after a real fix ships.** Largest variance is multilingual clustering quality (±3 weeks), which is
empirical and only answerable by running it on the fixture app.

### Three constraints that are now decisions, not opinions

- **Multilingual is P0 architectural**, not a side note. India-first ICP, review text
  code-switches mid-sentence ("payment कट गया but ticket nahi aaya"). The engine must
  work on semantic similarity, not keywords.
- **Choose the embedding model first, then adapt the schema.** The dormant
  `vector(384)` column is groundwork, not a constraint.
- **The launch claim is "daily feedback intelligence."** Vercel Hobby caps cron at
  daily, so "up 184% in the last 6 hours" is *physically undetectable* today. Build no
  UI and make no claim beyond what the pipeline can do.

**On ice per D023:** competitor review scraping, advanced segmentation, enterprise BI,
Jira/Linear. **And the standing instruction:** don't spend the next week polishing the
dashboard — build the engine that makes it worth opening.

---

# Earlier today — SPINE 8/8 — the launch gate is clear

**State of master:** `a1b57b2`. `tsc` clean, **649 unit tests in 63 files**,
lint 0 errors, CI green on the merge commit.

**The founder walked all eight SPINE steps against a real app on production and
reported every one working.** That is the first completed walk in the eleven
weeks since `docs/SPINE.md` was written, and it is the only evidence this
repository holds that the product actually works. Every ✅ in `CLAUDE.md` means
"compiles and unit tests pass" — a different and much weaker claim.

No agent verified any of this. None could: the walk needs a human, a real app,
and a real store listing.

---

## What 8/8 means for the plan

| | |
|---|---|
| **Feature freeze** | **Lifted.** `docs/SPINE.md` froze new feature work until 8/8. That condition is met. |
| **Next epic** | **Issue Intelligence (II1–II11)**, per D022, which sequenced SPINE ahead of it. Startable now, in ICE order. |
| **Launch** | Still a founder call. 8/8 clears the gate; it does not pull the trigger. |

The two defects that would have produced a false ❌ on steps 7 and 8 were fixed
the same morning in **#131** and are locked by
`src/spine-draft-mode-contract.test.ts` (7 mutation-verified tests), so the walk
met a product that had just been repaired rather than one that happened to work.

---

## ⚠️ The one thing 8/8 does not yet cover — step 8 overnight

Step 8 is defined as "status persists after page reload", and that passed. What a
single-day walk cannot establish is that a replied review is **still replied after
the next sync**. A review that reads `replied` tonight and `needs_reply` tomorrow
is the failure that erased people's work before.

The code defends it: `review-sync.ts` refuses a blanket upsert precisely because
`reply_status` and `reply_text` are user-owned, and the promote-to-replied update
is filtered `.eq("reply_status", "needs_reply")`. Asserted in
`docs/specs/review-sync.md`. **That is a code guarantee, not a walked one** —
exactly the distinction this whole file exists to keep.

**Action:** after the 08:00 UTC daily sync, re-open the review that was marked
replied and confirm it still reads replied. If it flipped back, SPINE step 8
drops to ❌ and nothing else matters until it is fixed.

---

## Founder actions still open (none block the epic)

| # | Action | Why |
|---|---|---|
| 1 | **Step 8 overnight re-check** (above) | The only unverified part of the core loop. |
| 2 | **Disclose Slack on `/sub-processors`** | The page lists ten processors and omits Slack, while `src/lib/slack.ts:198` sends a reviewer's name and a 120-char review snippet there. Third-party personal data to an undeclared processor. **D009 point 9 forbids an agent editing legal pages** — only the founder can close this. The only open item with real legal exposure. |
| 3 | **Decide W5A** — the review-volume limit | ADR waiting at `docs/adr/009-review-volume-limit.md`. Gates Stripe going live. |
| 4 | **`ADMIN_CLERK_USER_ID`** in Vercel production | `requireAdminUser()` is fail-closed, so `/api/admin/probe/stores` 403s without it. |
| 5 | Stripe test keys (**N6**) | Agent verifies checkout → webhook → Supabase once keys exist. |
| 6 | **LT2 / LT3** | Clerk preview keys; whether app deletion is recoverable. |

---

## Open code work

No open PRs. Carried: **AU4** (swallowed-error sweep), **AS2** (finish the
interrupted audit round), **R2/R3** (role enforcement — R2 gates selling a Team
plan), **CM1** (multi-language), **CM2**, **CM4**, **DS2/DS4**, **LT1** (the
PGRST204 sweep).

`auto_reply` stays out of `SELECTABLE_AUTOMATION_ACTIONS`. AS1's sync lock
**fails open** when Redis is unreachable, and publishing un-reviewed model output
to a live public listing needs an answer for "what happens when Redis is down" —
a lock alone is not that answer. 8/8 does not change this.

---

## A flaky test, unidentified

While verifying this change the unit suite failed **once** — `1 failed | 648
passed` — on a run that took 14s against a normal 6s, i.e. under load. Four
subsequent runs were 649/649 clean. The failing test's name was not captured
before the output rolled, so it is not yet known which one it is.

Recording it rather than dismissing it: a suite that fails one run in five and
passes on retry is exactly how a green check stops meaning anything, which is
this repository's oldest and most expensive habit. If it recurs, capture the
name (`npx vitest run --reporter=verbose`) before rerunning.

## Note for the next session

Two claims made confidently from code inspection this session turned out to be
wrong, both corrected the same day: that the e2e check was "a real signal" (it
still executes zero specs), and that two composer fixes existed in no branch
(they were on `claude/spine-draft-mode-fixes`, merged as #131). The second came
from running `git branch -r` in a clone holding 3 of 80+ refs. **Run
`git fetch origin --prune` before concluding anything about what exists.**
