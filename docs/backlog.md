# Backlog

Single source of truth for what we build next. Agents work top-down.

Scoring: **ICE = Impact (1-10) × Confidence (1-10) ÷ Effort (1-10)**
Higher = do sooner.

Status legend: `[ ]` queued · `[~]` in progress · `[x]` shipped · `[!]` blocked · `[-]` deferred

---

## 🔵 STRATEGIC — "Issue Intelligence" pivot (founder input, 2026-08-19) — QUEUED AFTER SPINE

**Sequencing decided:** see `docs/decisions.md` D022. The founder chose to finish SPINE first — no
work starts on II1–II11 below until `docs/SPINE.md` is 8/8 verified against a real app.

**That condition was met on 2026-08-19: SPINE is 8/8, walked by the founder against a real app.**
The gate this section waited behind is open, so II1–II11 are now startable in ICE order.

**Source:** founder product critique, delivered directly in-session 2026-08-19, preserved in full
in the session transcript. This section is the ICE-scored, buildable breakdown of it.

**The thesis:** ReviewBox today is `Collect → Display → Analyze → Reply`. The proposal is
`Collect → Understand → Prioritize → Investigate → Act → Measure → Learn` — treating a **cluster of
reviews describing the same underlying problem** ("an Issue"), not an individual review, as the
atomic unit the rest of the product organizes around.

**Conflicts with the current top NOW item — resolved, see D022.** `docs/SPINE.md` freezes new
feature work until the 8-step core loop is verified end-to-end ("features frozen until 8/8 verified
against a real app") — specifically because past feature pushes ahead of a proven core loop caused
real production incidents (`docs/MARKET_READINESS_AUDIT.md`; the 2026-08-16 live-testing round).
This epic is unambiguously new feature surface, and the founder chose to finish SPINE first
(`docs/decisions.md` D022). SPINE reached 8/8 on 2026-08-19, so that precondition is satisfied —
the reasoning is kept here because it is why this epic waited, not because it still blocks.

**Also worth weighing before committing to the full scope:** several later items (customer
segmentation, competitive review-level intelligence, a full outcome/ROI dashboard) pull toward the
more senior "Head of Product" buyer the founder's own message names in its closing section — in
tension with `docs/PRODUCT_CONTEXT.md`'s India-first, non-technical solo-founder ICP and the
explicit refusal (`docs/COMPETITIVE_MAP.md`) to chase agent-performance dashboards and deep
enterprise BI surfaces. Not a reason not to build it — but worth deciding *which buyer* this epic
is primarily for before P2/P3 are scoped, since it changes the UI and which pricing tier it lands
in. `docs/PRODUCT_KNOWLEDGE.md` §2 has the fuller context on this tension.

**⚠️ CORRECTED 2026-08-19 against the code. The three bullets this section used to carry were
false, and sizing II1 against them cost a planning round.** Full assessment and evidence:
**`docs/ISSUE_INTELLIGENCE.md`** — that document is the target for this epic, and
`docs/decisions.md` **D023** carries the constraints on how it gets built. Read both before
starting anything below.

**What actually exists to build on:**
- `Release Health` computes **avg-rating delta per version** of the same app
  (`src/lib/release-versions.ts`), and `/releases/[version]` gives rating distribution, sentiment
  split and top tags. This is real, and "release regression" genuinely is mostly rewiring it —
  ~40% there, the closest of the eight gaps.
- `reviews.escalation_state` already carries the exact workflow vocabulary the epic wants
  (`none / support / product / engineering / incident`), and automations write it. Issue workflow
  (II5) is the cheapest item here.
- `reviews.embedding vector(384)` + an ivfflat index have existed since migration 001 — real
  groundwork, **never read or written**. Per D023, choose the model first and adapt the schema;
  do not let a dormant column pick the architecture.
- `Competitors` table (migration 016) exists. **On ice per D023** — competitor *reviews* are not
  fetched at all and getting them is a ToS/cost decision, not a sprint.

**What does NOT exist, despite prior claims here:**
- ❌ *"`Sentiment` already runs local topic clustering (`@xenova/transformers`, $0/forever)"* —
  **`@xenova/transformers` is not in `package.json` and appears nowhere in `src/`.** There is no
  clustering. What `/sentiment` shows is counts of **8 hardcoded English regexes** from
  `src/lib/rules-engine.ts`. **II1 is green-field, and the zero-cost assumption is unproven.**
- ❌ *"`Incidents` already does spike-detection"* — half true. `review-sync.ts` detects a rating
  spike and **emails/Slacks** it. It does not create an incident. Only `POST /api/incidents`
  inserts one, i.e. a human.
- ❌ *"this is an extension, not a green-field build"* — for II1 specifically, it is green-field.

### Breakdown — effort is order-of-magnitude, needs an architect pass before any of this is built

#### P0 — the foundation everything else depends on

**Sequencing per D023: Phase 0 and the ADR come before II1's implementation.** See
`docs/ISSUE_INTELLIGENCE.md` §5.

- [ ] **II0 · Phase 0 — release-regression comparison on today's `issue_tags[]`** · ICE ~30 (7×8÷1.8)
  **Done when:** a version comparison shows per-tag complaint-volume change between adjacent
  versions of the same app ("Payment +375% 🔴, Scanner +140% 🟠, Login +12%, UX −18%") and flags a
  probable regression. **Uses the existing 8 tags — does not wait for clustering.** A small
  vertical slice, not a separate feature project. Best value-to-work ratio in the epic and the
  demo that proves the thesis before the expensive primitive is built.
  **Status 2026-08-21: implemented, not walked.** `src/lib/release-regression.ts` (+18 unit tests,
  5 mutations caught) and the "What changed vs vX" card on `/releases/[version]`, on branch
  `claude/review-issue-schema-kn2ayd`. Spec: `docs/specs/release-regression.md`. **The box stays
  unchecked until a founder opens a real app's release and names the biggest mover (AC-6)** — a
  green suite is not this item's definition of done.
- [x] **II0a · The II1 ADR — architecture only, no implementation** — WRITTEN 2026-08-20,
  **awaiting founder ratification.** `docs/adr/011-issue-identity-and-clustering.md`.
  Identity rule: *two reviews are the same Issue if the same code change would resolve both*.
  Storage: many-to-many `issues` + `issue_reviews`. Assignment: incremental, not batch.
  Recommends **LLM assignment (Groq, already wired)** over local or hosted embeddings, on
  multilingual grounds — and **deliberately does not ratify itself**: §9 defines a bake-off that
  scores all three on the same labelled data first. Delivery plan: `docs/II_DELIVERY_PLAN.md`.
- [ ] **II0b · Golden set + eval harness** · blocking, **founder-blocking input**
  **Done when:** ~200 real reviews from the fixture apps — English, Hindi, Marathi, **Hinglish and
  transliterated Latin-script**, code-switched — are labelled into expected Issue groups using the
  ADR's identity rule, and `npm run eval:issues` scores an approach's precision/recall/F1 **broken
  out by language bucket**. **This is what decides ADR 011** (§9) and it is the regression gate for
  every later engine change. No agent can label it — labelling it *is* the product knowledge.
- [ ] **II1 · Issue/Theme clustering engine** · ICE ~14 (10×7÷5)
  **Done when:** reviews describing the same underlying problem group into a persisted `issues`
  record (title, severity, first-detected date, affected version(s)/platform(s), review count,
  trend), with an `issue_id` join on `reviews`. Built on existing local-ML clustering.
  **Why P0:** every item below reads or writes through this table.
- [ ] **II2 · Issue detail page** · ICE ~24 (8×8÷2.7)
  **Done when:** `/issues/[id]` shows the issue's reviews, trend chart, and affected
  version/platform breakdown. Mostly UI once II1 exists.
- [ ] **II3 · Impact/priority score** · ICE ~20 (8×7÷2.8)
  **Done when:** each issue gets a computed score from frequency, rating, sentiment, growth rate,
  affected-version breadth and recurrence — replacing "7 urgent reviews" with "these 3 problems
  matter most today." Needs an architect pass on the formula before implementation — a
  confidently-wrong score is worse than today's raw urgent-count.

#### P1 — connects Issues to the rest of the product

- [ ] **II4 · Issue → Release correlation ("what changed")** · ICE ~28 (8×7÷2)
  **Done when:** a new release version shows before/after complaint-volume comparison per issue and
  flags a probable regression.
- [ ] **II5 · Issue workflow (status, owner, related release/reviews)** · ICE ~18 (7×6÷2.3)
  **Done when:** an issue has status (new/investigating/planned/in progress/fixed/closed) and owner
  (product/engineering/support/marketing) — turns ReviewBox into part of the team's operating
  workflow, not just a read-only signal.
- [ ] **II6 · Resolution tracking** · ICE ~21 (7×6÷2)
  **Done when:** marking an issue "fixed" captures before/after negative-review-rate and rating, so
  ReviewBox can show "detected → team fixed it → sentiment improved" — the strongest retention/
  expansion story in this epic.
- [ ] **II7 · Smart alerts on issues, not just reviews** · ICE ~24 (8×6÷2)
  **Done when:** "Payment complaints up 184% in 6 hours" / "v1.5 generated 3.4× more scanner
  complaints than v1.4" fire proactively (email/Slack). Extends the existing rating-spike Redis
  dedup pattern to issue-level trends.

#### P2 — deepens the story once P0/P1 are proven

- [ ] **II8 · Competitive review-level intelligence** · ICE ~12 (6×6÷3)
  **Done when:** the Competitors screen (currently placeholder, X6) compares *what customers
  complain about*, not just star rating. Depends on X6 shipping real competitor data first.
- [ ] **II9 · Customer segmentation** · ICE ~10 (6×5÷3)
  **Done when:** issue breakdown by platform/version/rating is queryable ("Android users on v1.5
  are 4.2× more likely to report payment problems"). Most "enterprise BI"-flavored item on this
  list — check against the ICP note above before building.
- [ ] **II10 · Outcome / Feedback Health score** · ICE ~16 (7×6÷2.6)
  **Done when:** one customer-facing score (rating trend, negative-review rate, response time,
  unreplied count, resolution time, recurring-complaint trend) proves ReviewBox's value over time.
  Depends on II6 existing first.

#### P3

- [ ] **II11 · AI layer redesign: diagnose, not just draft** · ICE ~9 (6×5÷3.3)
  **Done when:** the AI panel answers what's happening / why / how serious / what to do / who owns
  it / what to tell customers — not just "generate a reply." Depends on II1 and II3 (needs issues
  and impact scores to reason over); sequenced last because it has the least standalone value until
  the data model under it exists.

**The strategic question this epic carried is ANSWERED — `docs/decisions.md` D024 (2026-08-19),
which supersedes D011 and D017.** `docs/PRODUCT_CONTEXT.md`'s ICP is the only one: solo founder or
small mobile team, 1–5 apps, no support staff, non-technical to semi-technical, India first, at
$49 Starter / $129 Pro. **The epic does not re-target the product** — our buyer *is* the support,
product and engineering team at once, which is exactly why an Issue layer helps them. Consequences:
`owner` is a label not a Jira integration; **II9 stays P2** and is built only on customer request;
Issue Intelligence ships in **Pro**, no new tier. Reasoning in `docs/ISSUE_INTELLIGENCE.md` §11.

---

## 🔴 NOW — this week

These are the next items to ship. Don't skip; don't reorder without thinking.

### [ ] CM1 · Multi-language reviews + replies · ICE 60 (9×8÷1.2)
**Added 2026-07-29 by `docs/COMPETITIVE_MAP.md`. Blocked on the core sync loop being proven.**
**Effort:** 1.5d.
**Done when:** review scrape is not restricted to `lang: "en"`; each review stores its detected language; the inbox shows the original with an optional translation; AI drafts reply in the review's language (brand voice preserved). Verified against a Hindi/Marathi-heavy fixture app.
**Why now:** our ICP is India-first (`docs/PRODUCT_CONTEXT.md`) and we currently show a fraction of their feedback and would answer it in the wrong language. This is the same class of blind spot as the US-storefront bug, one layer up — invisible in a feature comparison because the row exists on both sides.

### [~] CM2 · Bulk reply + user-editable tag rules · ICE 32 (8×8÷2)
**Added 2026-07-29 by `docs/COMPETITIVE_MAP.md`. Tag half SHIPPED 2026-08-16 (PR #89).**
**Shipped:** workspace-scoped tag renaming (`tag_labels`, Settings → General) and
per-review tag correction (`reviews.issue_tags_override`, editable chips in the
review pane). Renaming is display-only so automation rules keep matching; the
engine's original tags are preserved alongside the human correction. Renamed
tags carry through to the digest emails. **Needs migration 024.**
**Still open:** bulk reply across selected reviews, and user-defined auto-tag
*conditions* (text / rating / language / length) — this shipped the ability to
correct and rename tags, not to author new tagging rules.
**Why now:** our buyer is a team of one — leverage is the product.

### [ ] CM3 · Enforce workspace roles before the Team plan is sold · ICE 30 (see R2)
**Duplicate-guard:** overlaps backlog R2; keep R2 as the implementation item and treat CM3 as the commercial gate. Do not sell Team until R2 ships.

### [ ] CM4 · Competitors screen on real data · ICE 24 (6×8÷2)
**Added 2026-07-29. Table already exists (migration 016) — this is UI + scrape wiring only.**

### [x] AU2 · Resolve the `aso_keywords` schema ambiguity — CLOSED 2026-08-16
Production has `volume_estimate` / `trend_data` / `added_at` / `updated_at`, matching `007_aso_keywords.sql` and the code. `pending_combined.sql` deleted.

### [!] W6B · Answer ADR 010's four questions before retention is built · HUMAN-REQUIRED
**Added 2026-08-17 from the live-testing round.** See `docs/adr/010-review-history-and-retention.md`.
The platform limit is settled and verified: Google's API has no way to request older reviews, and AppFollow holds 272 for the same app where Play Console reports 2,064 — this is universal, not a ReviewBox gap. The founder's answer is a retention product: capture whatever the store exposes at connect time (10 or 500, never a promised number), then keep new reviews 365 days on paid plans.
**Needs answering:** (A) hide or delete at 365 days — *recommend hide, deletion destroys the archive that is the selling point*; (B) free/trial behaviour — *recommend retain, restrict view*; (C) 365 days from capture date or review date — *recommend capture*; (D) does this replace the `reviewsPerMonth` cap — *recommend yes, which resolves W5A*.
**Note:** retention is packaging, not cost. The `embedding vector(384)` column that would have dominated storage is never populated, so a review is ~0.5–1KB and a year of 50/day is 10–18MB per app.

### [x] W6C · Storefront: close the onboarding short-circuit · SHIPPED 2026-08-17
*`resolveAppMetadata` fetched the search's storefront hint and returned the moment it answered, so `findAppAcrossStorefronts` — and the most-reviews-wins ranking shipped in #109 — **never ran for a newly connected app**. Onboarding always supplies a hint, and search tries `us` first, so the ranking was unreachable on the one path that decides an app's storefront for life. That is how Mumbai One was pinned to `us`: it IS listed in the US, the US listing answered, and nobody looked at India.*

*The hint is now a candidate, not a verdict — probed first (so it still wins a tie, and still wins when it's the only storefront carrying the app), then the rest, ranked. Ordering extracted as the pure `storefrontProbeOrder()` so the control flow is testable without a network layer.*

***Also corrected a stale claim of my own:*** *#109's comments and `store-search.pick-home.test.ts` said Google Play never yields a review count, so the ranking would be inert there. Wrong — generalised from one throttled fetch, and from AppFollow's rendering rather than Google's HTML. The India listing returned 2,945 exactly.*

**Still open from this item:** show the detected storefront on the onboarding confirmation step ("Found on the India store · change") — confirm, don't ask. Deliberately not bundled: it touches the onboarding wizard, which is a critical path, and it wanted its own PR rather than riding along with a backend fix.

### [ ] W6D · The iOS 200-review ceiling is ours, not Apple's · ICE 42 (6×7÷1)
**Added 2026-08-17 while documenting the Google Play history limit.** **Effort:** ~2h.
`fetchReviews()` in `src/services/app-store/connect-api.ts` defaults to `limit = 200`, and `syncAppStore()` (`review-sync.ts:341`) passes no override. App Store Connect's `customerReviews` endpoint paginates properly via `links.next`, so unlike Google Play there is **no platform wall here** — an App Store customer's history depth is capped by our own default.
**Done when:** the initial import for a newly connected App Store app goes deeper than 200 (paged, with a serverless time budget like the one in `/api/apps`), and steady-state syncs stay cheap by stopping early once they reach reviews already stored.
**Why it matters beyond depth:** it is the exact wrong-layer mistake this codebase keeps making — an in-house limit read as an upstream one. The customer-facing copy in `/help/review-history` says so explicitly rather than hiding behind "the stores only give us ~200", so shipping this also settles a promise already in public.
**Careful:** deeper paging on first connect competes with `maxDuration` on the same routes as W5's app-create retry. Budget it; don't just raise the number.

### [x] W5A · Review-volume limit — DECIDED and SHIPPED 2026-08-22 (ADR 009 Option B, soft cap)

**Founder decision 2026-08-22: Option B.** Ingestion never stops; the customer
is told and asked. `docs/adr/009-review-volume-limit.md` is now `ACCEPTED` and
carries the full record, including the detour it corrects.

What shipped:
- `checkReviewLimit()` **deleted**, not just unwired. It returned an error
  string, which is an invitation to `return` early on it — and someone did.
  `getReviewUsage()` replaces it and returns a report with no error in it.
- The early return is gone from `syncWorkspaceApps()`, with the reasoning left
  as a comment at the line it occupied.
- `GET /api/billing/usage` + `<ReviewQuotaBanner />` on the dashboard, at
  **≥80%** and again when over.
- `/api/sync/reviews` no longer answers 402 `REVIEW_LIMIT_REACHED`.

**The guards assert an absence, deliberately.** `plan-enforcement.test.ts`
fails if the name `checkReviewLimit` returns anywhere in `src/`, or if the sync
so much as imports the usage report; `review-sync.quota.test.ts` — which
previously proved the hard stop at runtime — now proves an over-limit workspace
still reaches the provider on every run. Three mutations applied, three caught;
reintroducing the gate fails six tests.

**Between 2026-08-17 and 2026-08-22 Option A was live** — the option the ADR
says not to build — shipped by commit `fc53682` while the ADR still read
`Proposed`. The safety test that existed to keep the decision visible had been
inverted to assert the wiring. The counter-rule is in the ADR: an ADR whose
status is `Proposed` is not a menu.

### [~] QT1 · The 80% quota notice — banner SHIPPED 2026-08-22, email and copy still open · ICE ~40 (8×5÷1)

**Found 2026-08-22 while reading W5A against the code.** `/pricing` said *"We'll
notify you when you hit 80% of your quota"* and `/faq` said the same. Grepping
`src/` for any threshold check, email or banner returned **only those two
sentences.**

**✅ The banner half shipped with W5A.** `<ReviewQuotaBanner />` renders on the
dashboard at ≥80% of the monthly review allowance, and again, differently, when
over. The 80% figure lives in `REVIEW_USAGE_NOTICE_PERCENT` with a comment
saying it is a promise being kept rather than a tuning knob.

**🔲 Two halves remain, and both need a human.**

1. **The pricing and FAQ copy is now an understatement.** Both pages still say
   *"new reviews will pause syncing until you upgrade or the next cycle
   resets."* Under the soft cap nothing pauses. No legal exposure — the customer
   gets more than promised — but it is wrong, and D009 §9 reserves pricing-page
   edits. `/faq` additionally says *"AI drafts similarly pause after the **daily**
   limit resets at midnight UTC"*; `lib/plans.ts` says in capitals that drafts
   are metered **per MONTH**, and explains why. Drafted wording:
   `docs/LAUNCH_READINESS_2026-08-22.md`.
2. **The email.** ADR 009's Option B reads "surface a banner … and, if it
   persists, an email." The banner ships; the email needs a dedup key and a
   cadence that does not collide with the weekly digest and the unreplied
   nudge. Filed rather than guessed at.

### [x] W6A · Apply migration 030 · DONE 2026-08-17 (founder ran)
Verified by query: `workspace_invites_one_pending_idx` exists, and the pre-check found zero duplicate pending pairs, so nothing was skipped. The partial unique index now expresses the rule migration 006's comment only claimed: `unique (workspace_id, email, accepted_at)` fires for *accepted* invites and never for pending ones, because Postgres treats every NULL as distinct and `accepted_at` is NULL for exactly the case the rule was written for.

### [x] W5B · Apply migrations 026–029 · DONE 2026-08-17 (founder ran)
Verified by query, not assumed:
- **027** — `pg_policies` returns **zero** rows mentioning `auth.uid()`.
- **028** — all nine tenant columns report `is_nullable = NO`. The pre-check found zero NULL rows, so nothing was skipped. All 12 insert/upsert sites on those tables were confirmed to set `workspace_id` before applying.
- **029** — the diagnostic returned **zero rows**: no review had ever been stored as `replied` with blank text on this database. Section A was a no-op and Section B never applied. The PR #101 code fix stands; there was simply nothing persisted to repair.
- **026** — the four dead `alert_preferences` columns dropped.

### [x] LT1 · Sweep every write for the PGRST204 class · ICE 72 — SHIPPED 2026-08-17
*Every write touching a column added to an already-existing table now states what happens when that column is unavailable, and `src/schema-write-contract.test.ts` fails the build if a new one doesn't.*

***This item's "Done when" was wrong, and following it literally would have caused a bug.*** *It said to route every such write through `writeWithOptionalColumns()`. That helper DROPS the column and continues — correct when the column is enrichment (a synced app is still a synced app without `store_country`), and catastrophic when the column IS the write. Dropping `deleted_at` from "cancel my account" leaves the account live while the API reports it cancelled; dropping `slack_webhook_url` from "connect Slack" recreates M-8 exactly. Of the write sites found, **one** wanted the retry helper (`draft_source`/`draft_edited` on the reply save, where the analytics columns were taking the customer's reply down with them); the rest needed to fail loudly, via the new `migrationPendingError()`.*

*Also note the framing "pending migration" is now stale: all migrations are applied. **PGRST204 fires whenever PostgREST's schema cache is stale after a migration**, so this window reopens on every future migration — it is a property each write has to keep, not a one-off cleanup.*

### [x] LT1 (original text, for the record) · Sweep every write for the PGRST204 class
**Added 2026-08-16 after PR #85.** **Effort:** 3h.
**Done when:** every `.insert(` / `.update(` whose payload contains a column from migration 012 or later either goes through `writeWithOptionalColumns()` or is confirmed to need no fallback, with a test for each.
**Why now:** this class took onboarding down for **every** signup and nothing in the repo could see it. PostgREST answers `PGRST204` (not `42703`) when a write names a column missing from its schema cache, so every fallback written against 42703 alone is unreachable on the write path. `db-errors.ts` and `writeWithOptionalColumns()` now exist; onboarding, `/api/apps` and the sync status write are converted. Everything else is still latent — it just hasn't met a database missing that particular column yet.

### [!] GP1 · Verify the Play service account still has access · HUMAN-REQUIRED

**Rescued 2026-08-22 from PR #149 before it was closed** — this was the only place
it was written down, and #149's `docs/today.md` was two days stale in every other
respect.

**What was observed, 2026-08-21:** Google Play sync returned
`The caller does not have permission` for `com.metroconnect3.app`, at 15:00:35 that
day and 08:01:06 the day before — so it **predated** that session's three merges and
was not caused by them. A sync that fetches nothing makes every downstream feature
look broken while the route still answers 200.

**What has changed since:** `classifySyncError()` now maps a 403/permission failure
to `needs_play_console_access` and writes a remedy into `last_sync_error` — *"Google
Play Console hasn't authorized ReviewBox yet… invite the service account with
View+Reply permissions."* So it is no longer silent at the app level.

**What is still unverified, and is the actual item:** whether the permission was ever
granted. That is a Play Console fact, not a code fact, and nothing in this repository
can answer it. Likely also blocks one-click reply posting on Android.

**Done when:** Play Console → Users and permissions shows the service account with
View + Reply on that app, and one sync run stores at least one review from it.

### [ ] LT2 · Founder: Clerk dev keys scoped to Preview · ICE 60 (6×10÷1) — HUMAN-REQUIRED
**Added 2026-08-16.** **Effort:** ~10 min (founder, Vercel env vars).
**Done when:** preview deployments can be signed into, so a fix can be verified before it reaches production.
**Why now:** CI runs with placeholder Clerk keys (`pk_test_ci-placeholder…`) that Clerk rejects with `"Invalid host"`. Every one of the 13 fixes in PR #85 had to be verified on **production** because the founder could not sign in to the preview. This is the single change that most shortens the feedback loop, and it is pure config.

### [ ] LT3 · Decide whether app deletion is recoverable · ICE 40 (4×10÷1) — HUMAN-REQUIRED
**Added 2026-08-16. Asked twice, unanswered.** **Effort:** 30 min once decided.
**Done when:** either the current behaviour is confirmed and documented in `decisions.md`, or reviews get a `deleted_at` and a restore window.
**Why now:** deleting an app permanently deletes its reviews (D015 sanctions it). That is defensible, but it must be a decision on the record before a paying customer does it by accident — after the fact there is nothing to restore, and the store only returns ~90 days on re-add.

**2026-08-22 — the behaviour is now read and documented; the policy is still yours.**
`DELETE /api/apps/[id]` soft-deletes the app row (`deleted_at`) and **hard-deletes its
reviews** (line 152). No export first, no restore window, immediate. Reconnecting does
not undo it — Play serves roughly the last week. **Deleting the whole workspace has a
30-day grace period**, so the more destructive of the two actions had the weaker warning.

Fixed in the same session, **copy only**: the confirm now says it is permanent, that
reconnecting will not bring the reviews back, and to export first. Locked by
`src/destructive-copy-contract.test.ts`, which also asserts the route still does what
the warning claims — so the copy cannot become scarier than the truth either.

**Still open:** whether reviews should get their own `deleted_at` and a restore window,
which is roughly the shape the workspace grace period already has.

### [x] AU3 · `ai_usage` is read everywhere, written nowhere — SHIPPED 2026-08-16 (PR #89)
`recordAiUsage()` (`src/lib/ai-usage.ts`) is called from every tier of
`/api/reply/draft` via the existing `log()` hook, and from both AI paths in the
automation executor. `model` carries the tier that served the reply
(reply-kit / template / cache / groq / gemini / composer), so the founder can
tell a free template draft from a metered provider call — a single count that
mixed them could not. Automation drafts are attributed to the rule rather than
a user, since a rule can burn far more quota than a person clicking Generate.
Written via `after()`, not a detached promise, which Vercel would cut off.

### [ ] ML1 · A 5-star bug report is counted as a happy customer · ICE ~28 (7×8÷2)

**Demonstrated 2026-08-22 against the live database**, not predicted. A Mumbai
One review reading *"kabhi kabhi paise cut jaate Hain Magar ticket nahin aati
hai"* — "sometimes money is deducted but the ticket doesn't come" — carries
**no issue tags** and is scored **`positive`**, so it counts toward the
**36% positive share** on the Sentiment page.

Two independent causes, and both must be fixed or the number stays wrong:

1. **The tags are English regexes.** Hinglish is caught only when an English
   loanword happens to appear (*payment*, *transaction*). This is II1's job.
2. **`scoreSentiment()` is 70% rating.** With no recognised keywords the score
   collapses to `rating / 5`, so any 5★ review is `positive` regardless of what
   it says. That is fine for a rating-only review and wrong for this one.

**Done when:** a review whose text reports a problem is not scored `positive`
on the strength of its star rating alone — and the positive share on Sentiment
can be defended review by review.

**Do not "fix" this by weighting text higher across the board.** The 70/30 split
is what makes rating-only reviews (a large share of Play traffic, with no text
at all) score sensibly. The defect is that an unrecognised *language* is
indistinguishable from an unrecognised *sentiment* — which is the same root as
P1-2's "an undetermined language is not English". Worked example and the
n-limits: `docs/PATH_TO_9.md` §10.

### [ ] RV1 · Store Play's versionCode, and bucket releases on it · ICE ~24 (6×8÷2)

**Found 2026-08-22 in Mumbai One's Play Console**, not in our data — our data
cannot show it. Play version *names* are reused and non-monotonic for this app:
code 59 and code 49 are both named **"1.5"** (three months apart), and codes 48,
50 and 51 are all **"1.4.1"** (six weeks). 1.5 also shipped *before* 1.4.1.

We store `reviews.app_version` (the name) and nothing else — no `version_code`
column exists anywhere. So `/releases` and II0 bucket several distinct builds
into one row and call it a release.

**Done when:** the Play review's `versionCode` is stored beside the name, the
release list buckets on `(app_id, version_code)` where present, and the UI still
*labels* rows with the human version name. Falls back to name-only for App Store
reviews and for rows synced before the migration.

**Status 2026-08-22 — half shipped.**
- ✅ Migration 031 applied to production and verified (column `integer`, nullable,
  `reviews_app_version_code_idx` present, 770 rows, 0 populated — as expected).
- ✅ The sync now writes it: `buildEnrichedRow` takes a trailing optional
  `versionCode`, the Publisher API path passes `uc.appVersionCode`, and the batch
  upsert sheds the column if a database has not run 031.
- 🔲 **Bucketing still keys on the version NAME**, and must for now: not one of
  the 770 existing rows has a code, and Play does not serve history far enough
  back to backfill them. Switching the release list over today would put every
  historical review in one nameless bucket.

**The remaining half is a judgement call about when, not how.** Once enough
reviews carry a code, group on `(app_id, coalesce(version_code::text,
app_version))` and keep labelling rows with the human name. Until then II0's
comparison is per version *name* — what the customer sees on their listing, and
accurate, but coarser than "this release" implies (`docs/specs/release-regression.md`
known gap 5).

### [x] AU5 · The `res.ok` load paths AU4 did not reach · SHIPPED 2026-08-22

*Eleven load paths fixed, each read individually. **Two were data-loss paths, not merely
misleading:** Workspace defaults rendered an empty support email and brand voice under
an amber "Without this, AI uses a generic voice" hint, and Save posts what is in the box
— so a customer who believed the hint overwrote their real brand voice. Alert
preferences seeds its `useState` from `mock-alerts.ts`, so a failed read left a fixture
file on screen looking like saved settings with Save live beneath it. Both now return
the failure state **before** the form, and the contract test asserts that ordering
specifically.*

*The other nine misled without destroying: "you have no teammates" (React Query cached
the error envelope as data, so `isError` could never fire), "Slack is not connected" —
so reconnect, over a working webhook, "No automation rules yet · Create first rule",
"No runs yet" on the panel whose job is answering why a rule did not fire, an empty
template dropdown that silently changes which rule gets saved, a "service account isn't
configured" claim during a blip, an eternal "Loading…", and the onboarding progress
poll's first tick.*

***The 35 catch() sites were classified, not swept.*** *Most are class A — the correct
defensive shape (`await res.json().catch(() => null)` while parsing an **error** body,
`defer.ts`, cache writes, the self-heal sync kick). Two are documented deliberate
degrades and were left: `use-tag-labels` (a tag under its default name is fine; a tag
rendered as nothing is not — it gained a `throw` only so `retry: 1` stops being dead
code) and onboarding's Google Play step, whose copy already covers both causes. Full
table: `docs/LAUNCH_READINESS_2026-08-22.md` §5.*

*`src/au5-load-error-contract.test.ts` — 27 tests, 6 mutations applied and 6 caught. Its
tree-wide sweep for `fetch(...).then(r => r.json())` has an **empty allowlist**, so
there is currently no unguarded client load path anywhere in `src/`.*

<details>
<summary>Original entry (kept for the record)</summary>

### AU5 · The `res.ok` load paths AU4 did not reach · ICE ~35 (7×8÷1.6)

**Found 2026-08-22 while re-scoping M6 in `docs/PATH_TO_9.md`** — AU4 was cited as
open in a stale handoff line, and checking that claim turned up its unfinished half.

**The defect class is AU4's own, verbatim:** a 500 returns a JSON error envelope, so
`res.json()` **resolves**, `.catch` is unreachable for every HTTP failure, and the
screen renders the error as the customer's data.

**Done when:** every client load path either checks `res.ok` before parsing or
renders `LoadErrorState`, and inducing a 500 on each surface shows a failure with a
retry — never an empty form. Contract-tested and mutation-verified like AU4's twelve.

Verified by reading the code, not by grep:
- `settings-sections.tsx:24` — support email + brand voice render **empty**; a failed
  load presented as "you never set these"
- `team-members.tsx:76,81` — React Query caches the error envelope **as data**, so its
  error state never fires: "you have no teammates". The mutation ten lines below
  *does* check `res.ok` — the same asymmetry AU4 found in Reply Kit, which is why
  this survived review twice
- `slack-integration.tsx:45,52` — "no webhook configured" when the call failed

Unread, same pattern, need triage: `ai-styles-tab.tsx:69`,
`automation-hub.tsx:220`, `rule-builder-modal.tsx:331`,
`google-play-setup-modal.tsx:324`, `google-play-invite-modal.tsx:35`,
`onboarding/page.tsx:1008`.

Also standing: **35** `catch(console.error)`-style swallow sites across 27 files and
**1** empty catch. Many are legitimately best-effort (analytics, cache writes). The
work is to separate those from the ones a customer would notice **and say which in a
comment** — not to fix all 35.

**Not to be bolted onto PR #150:** these are behaviour changes on settings and
onboarding surfaces, each needing its own test-plan line. Own branch, after #150.

</details>

### [ ] CP1 · Four public pages sell auto-publish on a plan that does not exist · ICE ~63 (9×7÷1)

**Found 2026-08-22.** Two independent falsehoods in one sentence, repeated four times.

*The Team plan* was removed from `PLAN_PRICING` and from Stripe.
`marketing-claims-contract.test.ts` asserts two marketing pages never say "Team plan" —
it does not cover these four:

| Where | String |
|---|---|
| `src/app/terms/page.tsx:87` | **"Team — $199/month"** — a price for a nonexistent product, in the Terms of Service |
| `src/app/faq/page.tsx:74` | "on the Team plan, you can configure auto-publish rules" |
| `src/app/help/ai-replies/page.tsx:136` | "On the **Team plan**, you can configure auto-publish rules" |
| `src/app/help/automation/page.tsx:41,172,180` | "Auto-publish (Team plan)" · "Team plan subscription" |

*Auto-publish* does not exist either. `SELECTABLE_AUTOMATION_ACTIONS` is
`ai_reply, template_reply, apply_tag, escalate, report_spam`;
`automation-actions.test.ts:59` asserts `auto_reply` is **deliberately excluded**, and
`sync-lock.ts`'s header explains why it cannot just be added — the lock fails open when
Redis is unreachable, and publishing to a live listing needs an answer for that. The
pricing page already deleted the row for this reason.

The homepage — *"nothing reaches the store until a human clicks Post"* — is the one
that matches the code.

**HUMAN-REQUIRED for the Terms line (D009 §9).** The three help/FAQ strings are ordinary
copy but are the same sentence, so fix them as one approved wording pass. Proposed
wording and the reasoning: `docs/LAUNCH_READINESS_2026-08-22.md` §2.3. Extend
`marketing-claims-contract.test.ts` to cover `/terms`, `/faq` and `/help/**` in the same
PR, or this comes back.

### [ ] CP2 · `/faq` and `/help/ai-replies` list five tones; the product has four · ICE ~35 (7×5÷1)

**Found 2026-08-22.** `reply-composer.ts` is the engine and it has
**professional · empathetic · casual · direct**. The Reply Kit style cards match. The
homepage says "four tones" and names them correctly.

`/faq` and `/help/ai-replies` list **Professional · Friendly · Empathetic · Brief ·
Custom**. Only two of those five exist. The help page also describes Custom as a persona
"up to 200 characters"; the real field is `brand_voice`, capped at **500**, and it is a
separate setting rather than a tone.

Two smaller things to fold in: onboarding's brand-voice step offers `friendly`, which is
not an engine tone (`composeReply()` silently falls back to `professional`), and
`types/review.ts:228` declares a fifth value `enthusiastic` that the composer's own type
does not have and nothing renders.

**Done when:** every surface names the same four, and a contract test reads the tone list
out of `reply-composer.ts` rather than trusting the copy.

### [ ] SP1 · Two public legal pages name different sets of sub-processors · ICE ~56 (8×7÷1) — HUMAN-REQUIRED

**Found 2026-08-22.** `/sub-processors` lists **ten**. `/dpa` §4 lists **eight**,
omitting **Vercel** and **Sentry** — in the same paragraph that says *"The authoritative
list is the /sub-processors page."*

Three further items, each needing a human:

1. **Slack.** After the 2026-08-22 remediation it no longer receives a reviewer's name
   or review text — only app name, rating, our issue tags, version, date and a link. It
   is on neither page. Whether that still requires disclosure is a legal call, not a
   technical one.
2. **Vercel's row** describes hosting and CDN. `<Analytics />` and `<SpeedInsights />`
   are mounted in `src/app/layout.tsx:117-118`, so it also receives visitor analytics
   and performance telemetry.
3. **Two unverifiable assertions already published:** `/sub-processors` says *"each is
   bound by a data processing agreement with us"*, and `/dpa` §4 says *"Groq (AI
   inference, **no data retention**)"*. Both are contractual facts about vendors and
   neither can be verified from this repository.

Full inventory with purpose, data and production status:
`docs/LAUNCH_READINESS_2026-08-22.md` §7.

### [x] AU4 · Finish the swallowed-error sweep · SHIPPED 2026-08-17
*ASO (both panels), Sentiment, Competitors and both Reply Kit tabs now separate "failed to load" from "no data", via a shared `LoadErrorState` (`src/components/load-error-state.tsx`) with a retry.*

*The copy is what made this expensive. These screens didn't fall through to "nothing here" — they fell through to* **"No gaps found — all top phrases are already tracked"**, **"No keywords tracked yet"**, **"Tags appear here once reviews are synced"**, **"Add competitor · coming soon"**, **"No templates yet. Create your first one above"** *and* **"No entries yet"**. *Two of those invite a customer to rebuild a library they still have; one announces that a shipped feature does not exist. Counts that asserted `0` on an unknown now read `—`.*

***Root cause in Reply Kit was one layer down from the item's description.*** *Those tabs did `fetch(...).then(r => r.json()).catch(console.error)`. A 500 from these routes returns a JSON error envelope, so `res.json()` **resolves** — the promise never rejects and the `.catch` was unreachable dead code for every HTTP failure, not merely incomplete. Fixed by checking `r.ok` before parsing. Their mutation handlers already checked it, which is exactly why the load path's omission survived review.*

*Also fixed while in there: `handleRemove` on Competitors had `if (res.ok)` with no else, so a rejected delete left the row, stopped the spinner and reported nothing; and the knowledge-base create/save handlers logged to console only, leaving the customer's text in an open form with no sign the save was refused (templates already had `formError`).*

*12 contract tests in `src/load-error-contract.test.ts`, each mutation-verified. 539 total.*

### [x] AS1 · Per-workspace sync lock · ICE 40 — SHIPPED 2026-08-17
*Wave 5. `src/lib/sync-lock.ts` — Redis `SET NX EX 90`, released with a Lua compare-and-delete so a run that overran its TTL cannot delete the next holder's lock. Wired inside `syncWorkspace()` itself rather than at the four call sites, so a fifth trigger cannot bypass it; the private `syncWorkspaceApps()` is the only unlocked path and is not exported. Skipped runs return `skipped: "already_running"` and are not errors. Fails open when Redis is unreachable (an unlocked sync is exactly today's behaviour; a lock that can take sync offline is a worse trade).*

*TTL is 90s, not the 120 proposed here: the sync route declares `maxDuration = 60`, so 90 covers a full run with headroom while keeping the worst-case wedge short. 11 tests, each mutation-verified.*

***Correction to this item's original rationale:*** *it listed spike alerts and metadata writes as the exposure. Both are already deduped (spike email and Slack each take their own Redis `SET NX` claim per app+version). The real exposure is `runAutomationRules()` running twice over the same reviews, `enrichOnboarding()` double-filling a new workspace's knowledge base past its read-then-write guard, and every store fetch happening twice against a shared egress IP. Review rows were never at risk — `unique (app_id, external_id)` plus `ignoreDuplicates: true`.*

**This unblocks `auto_reply`** (`SELECTABLE_AUTOMATION_ACTIONS`), but does not by itself make it safe to enable — see ADR 009 and the fail-open note above. Publishing to a live store listing needs a decision about what happens when Redis is down, not just a lock.

### [ ] AS2 · Finish the interrupted deep-audit round · ICE 36 (9×8÷2)
**Added 2026-07-28. The four-lens agent sweep (`docs/AUDIT_SYSTEM.md`) was cut off by a usage limit; a scheduled resume is armed.**
**Done when:** all four lenses report, findings verified + appended to AUDIT_SYSTEM.md, BLOCKER/HIGH fixes shipped or ICE-scored here.

### [x] AU1 · Five-lens audit round + 25 fixes · ICE 100 — SHIPPED 2026-08-15
*Branch `claude/product-audit-testing-toum42`. 27 verified defects (2 BLOCKER, 12 HIGH), 25 fixed. Every automation rule was a silent no-op; onboarding abandonment stranded users with 0 AI drafts; GDPR export leaked App Store .p8 signing keys to any member; App Store Connect territory codes broke sync entirely; CSV re-import erased drafts. Full table in `docs/AUDIT_SYSTEM.md`. Remaining: `ai_usage` never written, swallowed-error UI on ASO/Sentiment/Reply-Kit/Competitors, `pending_combined.sql` schema ambiguity (needs founder SQL check — see `docs/today.md`).*

### [x] R1 · Middleware matcher gaps · ICE 85 — VERIFIED DONE 2026-08-15
*Re-checked during the audit round: `/api/import`, `/api/competitors`, `/api/auth/slack`, `/api/cron` are all present in `src/middleware.ts:36, 89-91`. The item was stale. `/api/reports/send-now` was the one route genuinely missing and has been added.*

### [ ] R2 · Role-enforcement P0 pack · ICE 48 (8×9÷1.5)
**Added 2026-07-27 by role audit (`docs/ROLE_AUDIT.md` P0-1..4, P0-6).**
**Effort:** 1.5d.
**Done when:** (1) `POST /api/gdpr/export` owner-only, and export stops including `apps.access_token/refresh_token`; (2) Slack OAuth callback + `DELETE /api/settings/slack` + `/api/settings/slack/test` require workspace admin; (3) automation-rule create/update/delete requires admin (auto_reply owner-only); (4) shared `requireWorkspaceRole()` helper replaces the three inline patterns; (5) `sync/reviews` auth fail-open removed (previews too); (6) `stripe/portal` binds customer→workspace before D013 ever lifts.
**Why now:** Every gap becomes live exposure the day a customer invites their first teammate — which is what the Team plan sells.

### [ ] R3 · Role-aware UI + honest failure states · ICE 24 (8×6÷2)
**Added 2026-07-27 by role audit (`docs/ROLE_AUDIT.md` P1).**
**Effort:** 2d.
**Done when:** members no longer see owner-only controls (delete flows, credential forms, billing actions, invite form) — hidden or disabled with a "workspace owner only" hint; `WorkspaceDefaults` stops showing "Saved ✓" on 403; Slack paste-URL disconnect reports real status; the two delete-account flows are merged into one; owner gets remove-member / revoke-invite controls; signed-in users keep `?redirect_url` through sign-in/up (invite links).
**Why now:** Trust — the UI currently lies to non-owners and sometimes to owners.

### [x] N1 · Apply Supabase migrations to prod · ICE 90 (10×9÷1)
*Applied 2026-05-19. Migrations 002–006 live in production. Note: 002 required normalizing existing rows before adding check constraint.*
**Effort:** 5 min (founder pastes SQL).
**Done when:** All 6 migrations (002–006) applied to production Supabase project.
**Files:** `supabase/migrations/002_plan_vocabulary.sql` through `006_workspace_invites.sql`
**Why now:** Nothing else can be tested end-to-end until prod schema matches code.
**HUMAN-REQUIRED** (founder runs SQL in Supabase dashboard).

### [x] N2 · Notification panel — empty state instead of fake data · ICE 72 (8×9÷1)
*Shipped on branch `claude/n2-notification-panel-empty-state`. Replaced hardcoded 3-item array with empty array + comment pointing to future real-feed work. "Mark all read" button hidden when empty. As a side-effect fixed lint error in `test-play-api.ts` so CI now passes.*
**Effort:** 30 min.
**Done when:** Top-nav bell shows real notifications only. No "Crash spike v2.4.1" hardcoded items.
**Files:** `src/components/layout/top-navigation.tsx`
**Why now:** First impression. Every new user sees a "Crash spike" for an app they don't have.

### [x] N7 · Marketing site mobile responsiveness · ICE 81 — SHIPPED 2026-05-18
*Approach: instead of rewriting 1000+ inline styles per page, added a
single `rb-marketing` class to MarketingShell wrapper, then global
`@media (max-width: 768px)` rules in `globals.css` that override
inline grids, font sizes, and padding via attribute selectors. One
PR covers all 13 marketing pages (landing, pricing, compare, blog,
customers, etc).*

### [x] N8 · Auth pages redesign · ICE — SHIPPED 2026-05-18
*Split-screen sign-up/sign-in with brand-side panel + AuthShell.
Dropped the custom terms gate in favor of inline legal line below
the form.*

### [x] N3 · Detail pages exist · ICE 64 (8×8÷1) — VERIFIED 2026-05-26
*Both `/incidents/[id]` and `/releases/[version]` already fully implemented with real DB queries — title, severity/status badges, timeline, rating distribution, reviews list. Verified on branch `claude/n3-detail-pages`. Brand color fix applied (not-found state was using old `#5B5BD6` purple).*

### [x] N4 · Remove or wire dead buttons · ICE 56 (7×8÷1) — DONE 2026-05-26
*Verified all visible buttons: competitors wired (2026-05-25), ASO buttons all wired (AI Suggestions, Add keyword, Update ranks), report cards properly gate with "Coming soon" label when endpoint is null, dead "+ New report" header button removed. No remaining dead buttons. PR `claude/n3-detail-pages` awaiting merge.*

### [x] N5 · /compare/appfollow with real teeth · ICE 81 (9×9÷1) — **WITHDRAWN 2026-08-18, see SEO4**
*The page this shipped was taken down (307 to `/pricing`, PR #124). Its ROI
calculator priced ReviewBox at a flat $49 for any number of apps when Starter
caps at 2 and 3 apps is Pro at $129 — it understated our own price by $80/month
in its default state — and the three "customer-style quotes" below were still
in production, unlabelled, with no customers to attribute them to. The item is
left marked shipped because it was; **SEO4 is the rebuild**, and its acceptance
criteria deliberately no longer include invented quotes.*
*Shipped 2026-05-19 on branch `claude/n5-compare-appfollow-rewrite` — awaiting founder merge.*
*42-row table across 7 categories, ROI calculator widget, 4-step switch timeline, 3 placeholder quotes, price callout, dual CTA. Placeholder quotes marked in code for replacement with real customers.*
**Effort:** 3h.
**Done when:** Page has: feature comparison table (12 rows), ROI calculator widget, 3 customer-style quotes, "Switch in 5 min" CTA, screenshots side-by-side.
**Files:** `src/app/compare/page.tsx`, `src/components/marketing/roi-calculator.tsx`
**Why now:** This is your #1 inbound conversion asset. Currently a stub.

### [x] N-SYNC · Unblock first-login review sync · ICE 90 (10×9÷1) — SHIPPED 2026-05-25
*`isAuthorized()` in `/api/sync/reviews` returned `false` when `CRON_SECRET` not set, silently blocking every onboarding-triggered sync. Fixed: returns `true` when no secret is configured; enforces the secret once set. PR `fix/sync-and-competitors` awaiting merge.*

### [x] N-COMP · Competitors screen real data · ICE 60 (8×7÷1) — SHIPPED 2026-05-25
*New `GET /api/competitors` endpoint. "You" row shows real DB metrics (rating, reviews/week, reply rate, 6-week trend). Competitors are illustrative placeholders with amber "sample" badge — competitor tracking is a future feature. PR `fix/sync-and-competitors` awaiting merge.*

### [x] N-CRON · Set CRON_SECRET in Vercel · ICE 72 (9×8÷1) — DONE 2026-05-26
*Founder set env var in Vercel. weekly-digest, unreplied-alert, trial-nudge crons now secured and firing.*

### [x] N-SEC2 · Cross-verification audit — 9 fixes · ICE 88 (10×9÷1) — MERGED 2026-05-26
*Third-party code review found 9 real bugs missed by audit-round-1/2: trial-nudge cron fail-open, slug regex 1-char, dedup race, invite primary-only email, no reply char limit, GDPR export CSRF, days param NaN, PostgREST injection, .single() log noise. Merged to master.*

### [x] N-META · Cache store metadata scrapes in Redis · ICE 63 (9×7÷1) — SHIPPED 2026-05-29
*`fetchGooglePlayMetadata()` + `fetchAppStoreMetadata()` now check Redis before scraping (keys `meta:gplay:{id}` / `meta:appstore:{id}`, 6h TTL). Eliminates redundant scrapes across onboarding search → onboarding/complete → daily sync. Branch `fix/metadata-scrape-cache` awaiting merge.*

### [x] N-UX · Reply UX + onboarding skip path · ICE 72 (9×8÷1) — SHIPPED 2026-05-29
*Draft save: loading state, "✓ Saved" feedback, cache update to `draft_ready`. Credential errors: stay visible with "Set up in Settings →" link. Onboarding step 3: reframed as optional step with "I'll connect later" skip. Branch `fix/reply-ux-and-onboarding-skip` awaiting merge.*

### [-] N6 · Stripe test keys + verify upgrade flow · ICE 80 (10×8÷1)
*Deferred per D013 — do not work on until founder asks.*

### [x] SX1 · Fix sync reliability · ICE 100 (10×10÷1) — MERGED 2026-05-30
*`last_sync_attempted_at` now stamped before any API call — kills "banner on every login". Bootstrap uses review-count check not attempted_at — no more re-running scraper on retry. Soft-deleted apps excluded. `last_synced_at` added to SELECT.*

### [x] UX1 · Smart inbox routing · ICE 63 (9×7÷1) — MERGED 2026-05-30 (#58)
*InboxRouter redirects to /reviews when unreplied > 0 AND apps connected, once per session.*

### [x] UX2 · AI as primary CTA in composer · ICE 72 (9×8÷1) — MERGED 2026-05-30 (#58)
*AI text auto-populates textarea on open. Post reply is full-width primary. Regenerate is secondary link.*

### [x] UX3 · Hover quick actions on review rows · ICE 56 (8×7÷1) — MERGED 2026-05-30 (#58)
*Hover reveals "Draft" — generates AI reply + saves draft_ready without opening composer.*

### [x] SEO1 · Canonicals, and stop advertising the closed door · ICE 90 (9×10÷1) — SHIPPED 2026-08-18
*Item 1 of `docs/SEO_KEYWORD_PLAN.md` §6, the one everything else is gated on.*
*One deployment serves `tryreviewbox.com`, `www.tryreviewbox.com` and
`app.tryreviewbox.com`; only `/` declared a canonical, so the other 21
indexable pages could each be indexed once per hostname, per trailing slash,
per query string. `sitemap.ts` also advertised `/sign-in` and `/sign-up`, which
middleware 307s to the app host — where every public route is served
`X-Robots-Tag: noindex`. Both fixed, and `src/canonical-contract.test.ts` fails
the build if a sitemap entry ever loses its canonical again.*
*The plan's "3 blog 404s" were already gone — PR #124 cut the four dead blog
cards and nine dead help links. Its "host" item is now the only part of #1 left
open, and it is founder-side: confirm in Vercel that `www` is configured as a
**redirect**, not an alias. The canonicals make a `www` alias survivable; they
do not make it correct.*

### [x] SEO6 · robots.txt and sitemap.xml were 404 to Google · ICE 100 (10×10÷1) — SHIPPED 2026-08-18
*The layer underneath SEO1. `/robots.txt` and `/sitemap.xml` were in neither of
middleware's route matchers, and neither `.txt` nor `.xml` is in the matcher's
extension-exclusion list, so both fell through to `auth.protect()` and answered
Googlebot — always a signed-out visitor — with a 404. Verified in production:
`x-clerk-auth-reason: protect-rewrite`. Every canonical SEO1 added was being
collected by nobody, and a missing robots.txt means "crawl everything", which is
why `/customers`, `/status` and `/compare` still ranked after deletion.*
*Also shipped: the app host serves its own `Disallow: /` robots.txt from
middleware (a static `robots.ts` is one prerendered body for both hostnames and
cannot tell them apart); marketing pages 301 off the app host to `www`; the root
layout stopped asserting `index, follow` over the signed-in product; and
`marketingUrl()` can no longer resolve to the app host, which a missing
`NEXT_PUBLIC_MARKETING_URL` would otherwise have made every canonical point at.*
*`src/seo-indexing-contract.test.ts` — 14 tests, reads middleware's source,
mutation-verified to fail on four separate regressions.*
*Deliberately NOT done: adding the deleted pages to robots.txt. `Disallow` and
`noindex` cancel out — a blocked URL is never recrawled, so Google never sees
the 404 and the URL lingers as "Indexed, though blocked by robots.txt".*

### [x] SEO7 · The first two product pages · ICE 90 (9×10÷1) — SHIPPED 2026-08-18
*Spec: `docs/specs/marketing-product-pages.md`.*
*The nav was Pricing/Blog/Help — no product page existed, so the site's only
self-description was ~268 words on the homepage. Shipped `/app-review-management`
(170/mo, KD 18 — the highest-value term reachable at AS 2, and AppFollow defends
it with their homepage rather than a dedicated page) and `/alternatives/appfollow`
(the KD 0 modifier cluster, the only thing this domain can rank for this
quarter). `/vs/appfollow` 301s to the latter to avoid cannibalising it.*
*Every price is imported from `lib/plans.ts` and the template count exported from
`lib/templates.ts`; no AppFollow fact appears at all, because appfollow.io is
unreachable from the build environment and an unsourced competitor price is what
`/compare` was withdrawn for. `marketing-claims-contract.test.ts` enforces it.*
*Found on the way in: the new routes were in the sitemap but not in
`isPublicRoute` — a 404 for every signed-out visitor, the same defect as SEO6.
The contract test now ties the two lists together.*

### [ ] SEO2 · Reply template library · ICE 56 (8×7÷1)
*Item 2 of `docs/SEO_KEYWORD_PLAN.md`. Cluster A: ~4,950/mo at KD 19–33 — the
best demand-to-product fit on the site, and five of its eleven terms are ones
AppFollow does not rank for at all.*
**Effort:** 2–3d.
**Done when:** a public, no-signup App Store / Google Play reply template
library exists, filterable by star rating, issue tag (`ReviewIssueTag`) and
tone, with a copy button per template and the store-specific rules stated —
Apple's 350-character reply cap, Play Console's reply policy, what each store
forbids you from saying. Templates come from the 25 already in the reply
pipeline; **derive them, do not retype them**, for the reason N5 was withdrawn.
**Why now:** it is the one cluster where the search demand and the product are
the same thing, and the page demonstrates the product to the person searching.

### [ ] SEO3 · Free ASO keyword tool · ICE 42 (7×6÷1)
*Item 3 of `docs/SEO_KEYWORD_PLAN.md`. Cluster B: ~5,500/mo at KD 24–33.*
**Effort:** 2d.
**Done when:** a limited version of the existing ASO keyword suggestion feature
is exposed as a free, no-signup tool. Note the **format** — AppFollow holds
position 3 across this whole cluster with a tool page, not a blog post.
**Watch:** it calls Gemini, so it needs `rateLimit()` on the route and a hard
per-IP cap before it is linked from anywhere. An un-capped free AI tool on the
open web is a bill, not a funnel — and D-one-rule says no paid service before a
paying customer.

### [ ] SEO4 · Rebuild the AppFollow comparison, honestly · ICE 40 (8×5÷1)
*Item 4 of `docs/SEO_KEYWORD_PLAN.md`, and the replacement for the withdrawn
N5. "appfollow" is 880/mo and it is the highest-converting traffic available to
us — someone searching a competitor's name is shopping.*
**Effort:** 1–2d.
**Done when:** `/vs/appfollow` (and `/alternatives/appfollow`) exist, and:
every ReviewBox price and limit is read from `lib/plans.ts`; every AppFollow
claim carries a dated link to their own public page; there are **no
testimonials** until there is a customer to quote; and any row we lose is
listed as a loss. The last two are why the first version came down.
**Note:** the old `/compare` route currently 307s to `/pricing` — point it here
once this ships, and only then consider making it permanent.

### [!] SEO5 · Link acquisition · HUMAN-REQUIRED
*Item 5 of `docs/SEO_KEYWORD_PLAN.md`, and the honest headline of that document:
**every KD 24–33 target above is gated on this, not on content.** At Semrush
rank 15.4M, AppFollow ranks #3 for "aso tools" (KD 26) because their domain is
rank 112k, not because their page is good. SEO2 and SEO3 are correctly chosen
and still will not rank on a 9–15 month horizon unless links run alongside them
from week one. Directories, Product Hunt, mobile-dev communities. Nothing an
agent can do.*

### [x] SPINE · Make the 8-step launch path 100% · ICE 100 — ✅ 8/8 VERIFIED 2026-08-19
**The launch gate is clear.** The founder walked all eight steps against a real app on production and reported every one working — the first completed walk since the file was written 2026-05-31. Both former blockers (Draft Mode composer; app-delete cookie clear) shipped in #131 ahead of it.
**The feature freeze this item held is lifted.** Per D022, the Issue Intelligence epic (II1–II11) is next.
**One follow-up, carried:** step 8 overnight. "Persists after reload" passed; that the status survives the *next daily sync* is defended in code (`review-sync.ts`) but not yet walked. Re-open the replied review after the 08:00 UTC sync and confirm it still reads replied.

---

## 🟠 NEXT — next 2-4 weeks

Critical-edge features for AppFollow competition.

### [x] DS1 · Add `--rb-indigo-*` tokens to globals.css · ICE 48 (6×8÷1) — SHIPPED 2026-05-30
*`--rb-indigo-100/500/600` added to globals.css. All hardcoded `#5B5BD6` in Reply Kit + Automations replaced with `var(--rb-indigo-500)`. Merged in `feat/x1-slack-integration`.*

### [ ] DS2 · Define type scale tokens (`--rb-text-*`) · ICE 35 (7×5÷1) — IN PHASE 2
**Effort:** 30min + 1h replacement. **Branch:** `feat/inbox-experience`
**Done when:** 6 tokens in `globals.css`, wired as Tailwind utilities. Arbitrary `text-[Npx]` replaced in top 5 files.

### [x] DS3 · Token migration: gray-* → --rb-* in 4 files · ICE 30 (6×5÷1) — SHIPPED 2026-05-30
*`app-connections.tsx`, `templates-tab.tsx`, `automation-hub.tsx`, `google-play-setup-modal.tsx` migrated (~126 replacements). Merged in `feat/x1-slack-integration`.*

### [ ] DS4 · Replace raw `<button>` with `<Button>` in review-queue + aso-screen · ICE 35 (7×5÷1)
**Effort:** 1.5h.
**Done when:** `review-queue.tsx` (22) and `aso-screen.tsx` (17) use `<Button variant="ghost" size="sm">` throughout. Consistent focus rings, keyboard nav, disabled states.
**Why:** 39 of the 86 raw buttons are in these two files. Accessibility fix — `<button>` has no focus ring in the current stylesheet. See `docs/DESIGN_SYSTEM_AUDIT.md` C4.

### [x] X1 · Slack integration · ICE 72 (9×8÷1) — BUILT, HUMAN-REQUIRED
*OAuth flow, webhook delivery, UI, migration all done. Founder must create Slack app at api.slack.com and set `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `NEXT_PUBLIC_SLACK_CLIENT_ID` in Vercel.*

### [x] X2 · Auto-translate review text · ICE 60 (8×6÷0.8) — SHIPPED
*Translate button in review card, Groq translation, 7d Redis cache, 100/hr rate limit. `/api/reviews/[id]/translate`.*

### [x] X3 · Real-time inbox refresh · ICE 50 (8×5÷0.8) — SHIPPED
*`refetchInterval: 60_000` in `use-review-queue.ts`. Polling active when tab is in focus.*

### [x] X4 · Bulk operations in inbox · ICE 56 (8×7÷1) — SHIPPED
*Multi-select, bulk mark-replied, bulk archive. `/api/reviews/bulk-action`.*

### [x] X5 · Mobile responsive pass (dashboard + inbox) · ICE 56 (7×8÷1) — SHIPPED 2026-05-30
*Dashboard stacks on mobile (2-col KPIs, single-col sections). Inbox shows list OR composer — tap to open, back button to return. Merged in `feat/x1-slack-integration`.*

### [ ] X6 · Real competitor tracking · ICE 48 (8×6÷1)
**Effort:** 1d.
**Done when:** User can add competitor app by store URL; daily cron fetches public rating + recent review snippets; sparkline chart on /competitors.

### [ ] X7 · Help center: 12 articles written · ICE 48 (6×8÷1)
**Effort:** 1d.
**Done when:** /help has Getting Started, Connect GP, Connect AS, AI Replies, Automations, Templates, Slack, Billing, Cancel, Export, FAQ, Status — each ≥300 words with screenshots.

### [x] X8 · Trial day-5 + day-12 emails · ICE 49 (7×7÷1) — SHIPPED
*`/api/cron/trial-nudge` — day 5 engagement + day 12 conversion. Redis dedup. Wired to vercel.json.*

### [x] X9 · AppFollow CSV import wizard · ICE 50 (10×5÷1) — SHIPPED 2026-05-30
*3-step flow: drop CSV → auto-detect columns → batch upsert (200-row chunks). POST /api/import/appfollow, rate-limited 10/h, enriched via rules-engine.*

### [x] X10 · Full-text search on review body · ICE 56 (7×8÷1) — SHIPPED
*Search box in review queue, `ilike` on body+author, sanitized. Server-side, fires at ≥3 chars.*

### [ ] X11 · Saved views / smart inboxes · ICE 42 (7×6÷1)
**Effort:** 1d.
**Done when:** User saves a filter combo as a named view; pins to sidebar.

### [x] X12 · Admin panel real data · ICE 45 (5×9÷1) — SHIPPED 2026-07-27
*Admin business portal on PR #67: overview KPIs (workspaces, signups 7d, est. MRR from D002 list prices, reviews, AI drafts), customer detail (members w/ Clerk emails, apps + sync health, usage, audit trail), and a full support-ticket system (migration 017, in-app "Contact support" in Settings, /admin/tickets queue with threads + internal notes). ADR 007.*

### [x] X13 · Playwright e2e — onboarding + inbox flow · ICE 49 (7×7÷1) — SHIPPED 2026-05-30
*11 unauthenticated redirect tests, auth page structure, mocked inbox tests (gated behind NEXT_PUBLIC_BYPASS_E2E=1). Merged in `feat/x1-slack-integration`.*

---

## 🟡 SOON — month 2

### [ ] Y1 · Resend webhook → email_events table · ICE 42 (6×7÷1)
**Effort:** 0.5d.
**Done when:** Bounce / spam / open events captured. Lifecycle emails suppress hard-bounced addresses.

### [ ] Y2 · Auto-reply automation GA · ICE 64 (8×8÷1)
**Effort:** 2d.
**Done when:** Rule with action `auto_reply` actually publishes replies (not just drafts). Opt-in per workspace. Confidence threshold configurable.

### [ ] Y3 · Status page (BetterStack) · ICE 30 (5×6÷1)
**Effort:** 0.5d.
**Done when:** status.tryreviewbox.com live with uptime monitors; linked from footer + help center.

### [ ] Y4 · Internationalization of review display · ICE 35 (5×7÷1)
**Effort:** 1d.
**Done when:** Language detected on sync; UI shows language badge; Translate button on non-English reviews.

### [ ] Y5 · Apple App Store sync end-to-end · ICE 49 (7×7÷1)
**Effort:** 2d.
**Done when:** Per-app API key flow in /settings; sync fetches reviews; replies submit to App Store Connect.

### [ ] Y6 · Cohort retention dashboard in PostHog · ICE 35 (5×7÷1)
**Effort:** 0.5d (config in PostHog).
**Done when:** Weekly retention chart, signup → activation funnel, activation → paid funnel.

---

## 🟢 LATER — month 3+

### [ ] L1 · Public changelog page · ICE 42 (6×7÷1)
### [ ] L2 · Public roadmap page · ICE 36 (6×6÷1)
### [ ] L3 · Incident auto-detection (3+ crashes/version/24h) · ICE 40 (5×8÷1)
### [ ] L4 · Weekly digest email · ICE 30 (5×6÷1)
### [ ] L5 · Unreplied-for-48h reminder · ICE 25 (5×5÷1)
### [ ] L6 · Team invite UI in settings (UI for X1's API) · ICE 36 (6×6÷1)
### [ ] L7 · Workspace member management (remove, change role) · ICE 30 (5×6÷1)
### [ ] L8 · ASO keyword history charts · ICE 24 (4×6÷1)
### [ ] L9 · Featured/Top charts tracking · ICE 18 (3×6÷1)
### [ ] L10 · Zapier / webhook output for Power Users · ICE 30 (5×6÷1)

---

## ⚪ EXPLICITLY DEFERRED

Not in scope until a paying customer asks. Tracking only so we don't accidentally pick them up.

- 2FA / SSO (Team plan, year 1+)
- Mobile native app
- Public API + API keys
- Multi-workspace switcher
- Free-forever tier
- SOC 2 prep
- Multi-region deployment
- Salesforce / Helpshift / Zendesk integrations
- Custom dashboards
- White-label
- AI training on customer data

---

## How to use this file

**Founder (you), Mondays (5 min):**
- Read the NOW section. Are these still the right 6 things?
- Re-rank, add, remove. The top is what I build first.

**Me, every session:**
- Read NOW top to bottom.
- Pick the first unblocked, non-HUMAN-REQUIRED item.
- Ship it. Move to next.

**ICE re-scoring:**
- When new info arrives (a customer asks, a bug appears, a competitor moves), update the score.
- Score changes go in `docs/decisions.md` so we have history.
