# Launch readiness — 2026-08-22

**Base commit:** `b1b6d41` (master) · **Branch:** `claude/nifty-bardeen-qprl0k`
**Reconciles:** `docs/PATH_TO_9.md` · `docs/PRODUCT_READINESS.md` · `docs/backlog.md`
· `docs/adr/009-review-volume-limit.md` · `docs/adr/010-review-history-and-retention.md`
· `docs/GLOBAL_BENCHMARK_PROPOSAL.md` §7/§14

This file is the **evidence record** for one controlled launch-readiness pass. Every
row names what was read, and every claim it cannot support says so. Where a decision
belongs to the founder it is in §3 and **nothing was implemented for it**.

> **One thing to read first, if you read nothing else:** §2.1. A billing gate that
> ADR 009 says in writing not to build is shipped, live, and defended by tests — and
> the two public pages that describe it promise a warning the product does not send.

---

## 0. The nine-item blocker list, checked against the repository

The list this session was handed had drifted. Corrected against code and GitHub:

| # | Item as handed over | What is actually true on `b1b6d41` |
|---|---|---|
| 1 | Corpus decision (DECISION) | **Still open.** Options written up in §4. Evidence unchanged and now measured twice: 2.7% Hinglish, 1 Devanagari review in 225 |
| 2 | Pricing row (DECISION) | **CLOSED — decided and applied this session.** "Topic clustering" → "Topic breakdown", three surfaces, commit `3fd3d59` |
| 3 | W6B / ADR 010 retention (DECISION) | **Still open — and see §3.2: `/privacy` §4 already publishes a 2-year retention commitment that the recommended 365-day answer would breach** |
| 4 | W5A review-volume limit (DECISION) | **PREMISE WRONG. Not undecided — decided by implementation, as the option the ADR rejects.** See §2.1 |
| 5 | AC-6 walk (ACTION) | Open. Script written: `docs/TESTER_PROTOCOL.md` §1 |
| 6 | Three non-founder testers (ACTION) | Open. Package written: `docs/TESTER_PROTOCOL.md` §2 |
| 7 | `ADMIN_CLERK_USER_ID` + LT2 Clerk preview keys (ACTION) | Open. Runbook: §6 |
| 8 | Slack / sub-processors | **Technical half CLOSED this session** (commit `104e73f`): Slack no longer receives a reviewer's name or review text. **The disclosure question stays open** — §3.1 |
| 9 | PR #150 | **PREMISE WRONG — merged.** Commit `7417d03`. #151 and #152 merged after it |

Also handed over and corrected:

- **PR #153** — open, draft, docs-only, **6 of 6 checks green** on head `2520ae0`,
  `mergeable_state: clean`. Merge-ready. **Not merged** — no authorisation was given.
- **PR #149** — open, draft, a docs handoff from base `ddf9e41`, now three merges
  stale. Nobody mentioned it. It needs a rebase or a close.
- **AU4** — finished 2026-08-17. Was not re-done.
- **AU5** — was un-started; **done this session** (§5).
- **`checkReviewLimit()` "has zero call sites"** — false since commit `fc53682`.

---

## 1. Baseline, measured not assumed

| | Before | After this session |
|---|---|---|
| `npx vitest run` | 985 in 87 files | **1029 in 90 files**, all passing |
| `npx tsc --noEmit` | clean | clean |
| `npx eslint src/` | 0 errors, 13 warnings | 0 errors, **13 warnings** (same 13) |
| `npx next build` | — | exit 0, full route table (12 KB log) |

`npm ci` is required in a fresh clone — the checkout arrives without `node_modules`.

The build was run **twice**. The first run exited 0 while writing an empty log, which
in this repository is the signature of a job reporting success for work it did not do.
It was re-run capturing output to a file before being believed.

---

## 2. What the code does that the plan says it does not

### 2.1 · P0 — the review-volume cap is a hard stop, shipped, and nobody decided it

**ADR 009 lists three options. Option A is "Enforce at sync time — hard stop", and the
ADR's own text under it reads, verbatim: "Do not do this."** It recommends **B**, a soft
cap that never withholds data.

**Option A is what is running.** `src/services/review-sync.ts:838`:

```ts
const quotaMsg = await checkReviewLimit(workspaceId, plan)…
if (quotaMsg) {
  summary.errors.push(quotaMsg);
  return summary;          // ← the whole workspace, every app, no provider call
}
```

Wired by commit `fc53682` ("complete commercial readiness P0 and sub-daily sync").
**ADR 009 is still marked `Status: Proposed — needs a founder decision before M2`.**
The guard test that existed to keep the decision visible — "checkReviewLimit is still
not wired" — was **inverted** to assert the opposite, and
`src/services/review-sync.quota.test.ts` now locks the behaviour in with three cases,
including "stays closed on every repeated scheduled run while the quota is exhausted".

**What a customer experiences.** Read end to end:

1. The counter is `count(reviews) where created_at >= start of calendar month` — it
   counts **rows inserted**, so a first import spends the whole month's allowance at
   once. A new Starter customer (5,000/month) connecting an app with 5,000 reviews
   is over the line on day one.
2. The next scheduled sync — and every one after it until the 1st — returns before
   touching Google or Apple.
3. **Nothing tells them.** The cron path drops the message into `summary.errors` and
   discards it. No email. No banner. `last_sync_error` is not written, so the app row
   still reads healthy with its old `last_synced_at`. Only a manual "Sync now" surfaces
   it, as a 402.
4. Reviews simply stop arriving, silently, for up to a month.

That is the exact outcome ADR 009 predicted in the sentence recommending against it:
*"The failure is silent and looks like the product breaking, which is the worst possible
form of an upsell."*

**And two public pages promise a warning that does not exist:**

> `/pricing` — *"We'll notify you when you hit **80% of your quota**. Your existing
> reviews stay safe — new reviews will pause syncing until you upgrade or the next
> cycle resets."*
>
> `/faq` — *"We notify you at **80%** of your review quota… AI drafts similarly pause
> after the **daily** limit resets at midnight UTC."*

Grepped the whole tree: **the only two occurrences of an 80% quota notification are
those two sentences.** No threshold check, no email, no banner. And the AI-draft
sentence contradicts `lib/plans.ts`, whose header says in capitals that drafts are
metered **per MONTH, not per day**, with the reasoning written out.

**Not changed here.** Reverting a live gate is a billing change (D009), and so is
rewording `/pricing`. Both are the founder's. §3.3 states the choice.

### 2.2 · The Team plan was removed from pricing and survives in four places

`PLAN_PRICING` has no `team`, Stripe has no such price, and
`marketing-claims-contract.test.ts` asserts two marketing pages never say "Team plan".
It does not cover these:

| Where | What it says |
|---|---|
| `src/app/terms/page.tsx:87` | **"Team — $199/month:** Unlimited apps, reviews, AI drafts, and priority…" — a price, for a product that does not exist, in the **Terms of Service** |
| `src/app/faq/page.tsx:74` | "on the Team plan, you can configure auto-publish rules" |
| `src/app/help/ai-replies/page.tsx:136` | "On the **Team plan**, you can configure auto-publish rules" |
| `src/app/help/automation/page.tsx:41,172,180` | "Auto-publish (Team plan)" · "Team plan subscription" |

**Not changed here.** Terms is a legal page (D009 §9). The three help/FAQ strings are
ordinary copy, but they are the *same sentence* as the Terms one and the fix should be
one decision, not three — and it is entangled with §2.3.

### 2.3 · Auto-publish does not exist, on any plan

`SELECTABLE_AUTOMATION_ACTIONS` (`src/lib/automation-actions.ts:42`) is
`ai_reply, template_reply, apply_tag, escalate, report_spam`.
`automation-actions.test.ts:59` asserts **`auto_reply` is deliberately excluded**, and
`src/lib/sync-lock.ts`'s header explains why it cannot simply be added: the sync lock
fails open when Redis is unreachable, and publishing to a live store listing needs an
answer for that first.

The pricing page already knows. Its removed-rows comment reads:
*`"Auto-publish rules"` — Automations draft; they never publish without a human (M3,
opt-in, unbuilt).*

So the four surfaces in §2.2 promise a feature that is unbuilt, gated behind a plan
that does not exist. The homepage's *"nothing reaches the store until a human clicks
Post"* is **correct** and is the one that matches the code.

**Proposed wording, for approval — not applied:**

> **Replies are never published automatically.** Every draft waits for a human to
> click Post. Rule-driven auto-publish is on the roadmap and is not available today.

Do **not** ship *"Team workspaces can optionally configure auto-publish rules"* — it is
false twice over.

### 2.4 · Tones: the product has four; two pages list five, of which three do not exist

| Source | Tones |
|---|---|
| `src/lib/reply-composer.ts:25` — **the engine** | professional · empathetic · casual · direct |
| Reply Kit "AI reply styles" cards | the same four |
| Homepage (`landing-page.tsx`) | *"four tones"*, and the hub page names them — **correct** |
| Onboarding brand-voice step | professional · **friendly** · empathetic · direct — `friendly` is not an engine tone; `composeReply()` falls back to `professional` for an unknown one |
| `/faq` and `/help/ai-replies` | **Professional · Friendly · Empathetic · Brief · Custom** |

**The answer to "is Custom a fifth tone or a configuration field?" is neither — it does
not exist.** Nor do "Friendly" or "Brief" as tones. The help page also says Custom is a
persona description "up to 200 characters"; the real field is `brand_voice`, capped at
**500** (`/api/settings/workspace` line 120), and it is a separate free-text setting,
not a tone.

`src/types/review.ts:228` additionally declares a fifth value, `enthusiastic`, that the
composer's own local type does not have and nothing renders — dead vocabulary, worth
deleting, not a customer-facing claim.

**Not changed here.** The pricing-adjacent copy fix needs to land with §2.2/§2.3 as one
approved wording pass.

### 2.5 · Understatements, listed so they are not mistaken for the above

These make the product sound *worse* than it is. No legal exposure, but they are drift:

- `/pricing` sells **"Daily automatic sync"**; `vercel.json` runs `0 */3 * * *`.
- The same file's comment still says *"Vercel Hobby caps cron at once a day"*. The
  project is on **Pro** (confirmed 2026-08-21). Stale premise, in a place where someone
  will re-derive a constraint from it.
- `/app-review-management`: *"Automatically once a day, and on demand."*

---

## 3. Decisions that are the founder's, with the facts each needs

### 3.1 · Slack: the technical exposure is closed; the disclosure question is not

**What was found.** Seven files send to Slack. Six were already clean — rating spikes
and both digests carry aggregate counts; an incident title is typed by an authenticated
human (nothing auto-generates one from review text); the connection test is static.

The seventh, `urgentReview()`, sent the **reviewer's display name** and the **first 120
characters of the review body**. `/dpa` §3 classifies review content and author handles
as personal data, and Slack is on neither `/sub-processors` (ten providers) nor the DPA
§4 list (eight). The most sensitive outbound payload in the product was going to the
one recipient no public document names.

**What was changed** (commit `104e73f`): the alert is now metadata only — rating, our
own issue tags, app version, the UTC day it was posted, and a link. `urgentReview()`'s
signature no longer *accepts* `author` or `text`, so a caller cannot reintroduce them
by accident, and `src/slack-privacy-contract.test.ts` holds three guards including an
inventory of every file that sends to Slack. Five mutations applied, five caught.

**What ReviewBox receives from Slack**, for completeness: `workspace_slack` stores
`slack_team_id`, `slack_team_name`, `slack_channel_id`, `slack_channel_name`, a bot
`access_token` and `scope`. That is organisational metadata plus a credential, not
personal data of reviewers. GDPR deletion calls `auth.revoke` (`/api/gdpr/delete:96`).

**The question that is yours.** Slack still receives, per alert: your app's name, a star
rating, our issue-tag classification, an app version, a date, and a link — tied to a
workspace and an app. Whether that is personal data of the *reviewer* (I would say no —
it identifies no one) and whether Slack is therefore a sub-processor requiring
disclosure is a legal determination. **I am not making it.** Two defensible answers:

| | Add Slack to `/sub-processors` + DPA §4 | Leave it off |
|---|---|---|
| Argument | It is an optional integration that receives workspace-identifiable operational data; disclosure costs nothing and the page's credibility is the asset | After this change it receives no personal data, and it is customer-initiated — the customer chooses the channel and controls it |
| Risk | None | An auditor disagrees with the classification |

If you disclose it, the row needs *purpose*, *data received*, and *location* — and I
must not invent Slack's processing locations, retention, DPA status, SCC posture or
certifications. Those come from Slack's own published terms, which you or counsel read.

### 3.2 · W6B / ADR 010 — the four retention questions, plus one the ADR does not mention

ADR 010's four, with the recommendations already on record:
**(A)** hide rather than delete at 365 days · **(B)** retain-but-restrict on free ·
**(C)** 365 days from capture, not review date · **(D)** retention replaces the
`reviewsPerMonth` cap.

**No authoritative record of approval exists in this repository.** `docs/decisions.md`
carries no D-number for it; the backlog still marks W6B `HUMAN-REQUIRED`. So nothing
was implemented.

**The fact the ADR does not mention, and it changes (C):**

> `/privacy` §4, live: *"App store reviews and associated metadata are retained for up
> to **2 years** from the date they are imported."*

That is a published commitment, already made, measured from import date. A 365-day
policy is **shorter than what customers have been told**, so answering (C) "365 days
from capture" requires editing a legal page and deciding what happens to data already
held under the 2-year promise. Please decide the retention period and the privacy-page
wording together, not in sequence.

**And (D) is not a free choice any more** — see §2.1. The cap it would replace is now
enforced as a hard stop. Answering (D) "yes" is also a decision to remove a live gate.

### 3.3 · W5A — the choice, restated for what is actually running

Not "should we enforce?" but:

| | Keep the hard stop | Revert to ADR 009's Option B | Drop the claim (C) |
|---|---|---|---|
| Work | Build the 80% notification the pages already promise, and surface the pause where a customer can see it (banner + `last_sync_error`) | Remove the early return; add the over-limit banner | Remove `reviewsPerMonth` from `/pricing` and Billing; delete `checkReviewLimit()` |
| Honesty | Pages become true | Pages need the "pause" sentence removed | Loses a Starter↔Pro differentiator right before Stripe |
| Risk | A silent stop remains one bug away | None to the customer | Commercial |

**Until one is chosen, the live behaviour contradicts a written ADR and two public
pages.** My recommendation is unchanged from ADR 009's: **B**, with the pause removed
and a banner added — but this is D009 territory and I have implemented none of it.

### 3.4 · LT3 — asked three times; here is the answer the code gives

- `DELETE /api/apps/[id]` **soft-deletes the app row** (`deleted_at`) and
  **hard-deletes its reviews** (`.delete()`, line 152). D015 sanctions it.
- No export first. No restore window. Immediate, not queued. The audit entry records
  how many rows went; the rows are gone.
- Reconnecting does not undo it — Play's API serves roughly the last week
  (`/help/review-history`).
- **Deleting the whole workspace has a 30-day grace period** (`danger-zone.tsx`). The
  more destructive action had the weaker warning.

**Changed this session, copy only** (commit `969c353`): the confirm now says it is
permanent, that reconnecting will not bring the reviews back, and to export first.
Behaviour is untouched. **Whether app deletion should become recoverable is still your
call** — a `deleted_at` on reviews plus a restore window is roughly the same shape as
the workspace grace period that already exists.

### 3.5 · Company identity — five facts nobody can invent

`src/lib/legal/company.ts` already models these properly, with `PENDING` markers and an
`outstandingLegalFacts()` checklist that prints in the unit run without failing it.
Outstanding:

1. Firm registration number (Registrar of Firms) — **or** written confirmation the firm
   is unregistered
2. GSTIN
3. Principal place of business — full postal address (renders today as
   *"[registered office address to be published]"* on the homepage and `/grievance`)
4. Grievance Officer: name, designation, email, address — a statutory obligation in
   India, and `/grievance` currently says *"The Grievance Officer's details are being
   published."*
5. The city whose courts have exclusive jurisdiction

**Plus a risk the file already flags and I am repeating because it is the expensive
one:** the legal name is `"AT WORK Inc"` and the entity is a **partnership firm**. "Inc"
abbreviates "Incorporated"; a partnership firm is not an incorporated body. That invites
both a Stripe verification mismatch and an argument that the public was misled about who
they contracted with. Confirm against the partnership deed before going live.

---

## 4. The corpus decision (Section 17)

**The evidence, and it is now counted twice from independent samples:** Mumbai One
carries **6 of 225** reviews with romanised-Hindi markers (**2.7%**) and **exactly one**
Devanagari review. The golden set counted 6/200 from a separate sample. Waiting for more
Mumbai One data will not make the corpus multilingual — that is measured, not argued.

**No multilingual corpus was fabricated and none will be.**

`GLOBAL_BENCHMARK_PROPOSAL` §7 ranks four sources and says plainly that source selection
is a founder decision with real exposure; §14 asks five questions, of which **#3
(source)** and **#4 (is a second labeller available?)** gate everything. §10.1 is the
one to read: with a single labeller, decision-grade may be unreachable *at any corpus
size* — which would be worth knowing before, not after, ~420 reviews are labelled.

### Option A — ship English-certified, say so, claim nothing more

Declare the benchmark **English-certified**; state that multilingual is **not
certified**; name the unvalidated languages; make no multilingual performance claim
anywhere public.

- Unblocks **M4/M5** (the Issues primitive and its screens) on an English scope.
- **M7 stays blocked** — multilingual proof is what M7 *is*.
- Requires the launch narrative to stop implying multilingual coverage. Note that
  `docs/ISSUE_INTELLIGENCE.md` §8 calls multilingual **"P0, not a side constraint"**
  because the ICP is India-first: choosing A means accepting that the differentiated
  product ships first for the half of the ICP it can already read.

### Option B — block Issue Intelligence until a defensible corpus exists

Keep **M4, M5 and M7** blocked. Answer §14 #3 and #4 first, then label.

- Honest, and avoids building an engine that cannot be scored on the traffic it is for.
- Costs the epic's whole critical path on a dependency with no date, and the fixture
  app cannot supply the data at any point in the future.

**A third path, which is why I am not recommending between them:** A **plus** an
explicit, dated commitment to B's corpus work before any multilingual claim is made.
That is the only version where the ICP argument in §8 and the "do not overclaim" rule in
L1 both survive. It is still your call, because it commits real labelling effort.

**Nothing here is implemented.** M4/M5/M7 remain as `docs/PATH_TO_9.md` §2 has them.

---

## 5. AU5 — what was fixed, what was classified, what remains

Eleven load paths, read individually. The class is AU4's, verbatim: these routes answer
a 500 with a JSON error envelope, so `res.json()` **resolves**, `.catch` is unreachable
for every HTTP failure, and the screen renders the error as the customer's data.

**Two were data-loss paths, not merely misleading:**

| Site | What a 500 produced |
|---|---|
| `settings-sections.tsx` | Empty support email and empty brand voice, under an amber *"Without this, AI uses a generic voice"* hint. Save posts what is in the box — so a customer who believed the hint **overwrote their real brand voice with a guess** |
| `alert-preferences.tsx` | Its `useState` is seeded from `mock-alerts.ts`, so a failed read left **a fixture file** on screen looking like saved settings, with Save live beneath it |

**Nine misled without destroying:** "you have no teammates" (React Query cached the
error envelope *as data*, so `isError` could never fire); "Slack is not connected" — so
reconnect, over a working webhook; "No automation rules yet · Create first rule"; "No
runs yet" on the panel whose entire job is answering why a rule did not fire; an empty
template dropdown that silently changes which rule gets saved; "service account isn't
configured on the server" during a blip; an eternal "Loading…" in the modal that exists
to hand over one address; and the onboarding progress poll's first tick.

### The catch()-site classification

The brief's "35 swallow sites across 27 files" resolves, on reading, into:

| Class | Count | Examples | Action |
|---|---|---|---|
| **A — legitimate best-effort** | most of ~53 raw matches | `await res.json().catch(() => null)` when parsing an **error** body; `defer.ts`; the Redis persona cache write; the dashboard's self-heal sync kick; `automation-executor` log writes | none — this is the correct defensive shape and a retry button for it would be noise |
| **A — deliberate, documented degrade** | 2 | `use-tag-labels` (a tag under its default name is fine; a tag rendered as nothing is not) · onboarding's Google Play step, whose copy already covers both causes | left alone; `use-tag-labels` gained a `throw` **only** so its `retry: 1` stops being dead code |
| **B — customer-visible** | 11 | the table above | **fixed** |
| **C — operational** | 0 found needing a change | store-API `res.text().catch(() => "")` paths already log | none |
| **D — unclear** | 0 | — | — |

**Nothing was fixed mechanically.** The point of the sweep was to separate A from B, and
A is the larger set.

### What guards it

`src/au5-load-error-contract.test.ts`, 27 tests. Two assert the *ordering* that prevents
the overwrites specifically — the failure branch must `return` before the form, and Save
must sit strictly inside the not-failed branch. One sweeps the whole tree for
`fetch(...).then(r => r.json())`; **its allowlist is empty**, so there is currently no
unguarded client load path anywhere in `src/`.

Six mutations applied, six caught — including one that caught a **weak first version of
my own ordering assertion**, which compared source positions and passed a mutation that
moved the error banner above the form. It now matches the early-return shape instead.

---

## 6. Production configuration (Section 15) — no secrets in this file

### 6.1 · `ADMIN_CLERK_USER_ID`

- **Read by:** `requireAdminUser()`, fail-closed. Unset ⇒ every `/api/admin/*` route
  403s, including `GET /api/admin/probe/stores`, which `CLAUDE.md` tells every session
  to run before shipping anything non-trivial.
- **Value:** the founder's Clerk user id (`user_…`), from Clerk dashboard → Users → the
  founder's row.
- **Set in:** Vercel → Project → Settings → Environment Variables → **Production**.
  Not `NEXT_PUBLIC_`, so no rebuild-time inlining concern; a redeploy is still needed
  for the running functions to pick it up.
- **Verify, in this order:**
  1. Signed in as the founder, `GET /api/admin/probe/stores` → **200** with a
     per-storefront body.
  2. Signed in as any other account, the same URL → **403**. If a second account is not
     to hand, a signed-out request must also be non-200.
  3. Both checks matter. A probe that 200s for everyone is worse than one that 403s for
     everyone.

### 6.2 · LT2 — Clerk keys for CI and previews

Two separate things, often conflated:

**(a) CI.** `ci.yml` runs with `pk_test_Y2ktcGxhY2Vob2xkZXIu…`, which base64-decodes to
`ci-placeholder.clerk.accounts.dev$` — structurally valid, instance nonexistent. Clerk
answers "Invalid host", so `tests/e2e/clerk-env.ts` skips **every** spec. *"E2E tests
(advisory)" is green while executing zero specs*, and `src/ci-contract.test.ts` fails if
this repo's documentation ever claims otherwise. Fix: create a Clerk **development**
instance for CI, put its publishable + secret keys in GitHub → Settings → Secrets and
variables → Actions, reference them in the `e2e-tests` job's `env:` block **only**.

**(b) Previews.** `vercel.json` carries an `ignoreCommand` that skips every ref except
`master`, so previews do not build at all. Re-enabling them needs the Clerk preview keys
*first*, or they cannot be signed into — which is what made LT2 a blocker in the first
place.

> ⚠️ **Never hoist Clerk keys to a workflow-level `env:` block.** That is what took
> production down on 2026-08-17: `NEXT_PUBLIC_*` is inlined at build time and beats
> whatever `vercel pull` writes, so the real production bundle compiled with the CI
> placeholder and every page answered `{"errors":[{"message":"Invalid host"}]}` — while
> the deploy job reported success. There is no deploy job today, so the rule guards
> nothing; it is exactly what makes re-adding one safe.

### 6.3 · Production DDL

None is required by anything in this session. Nothing was executed. Migration 031 is
applied and verified; **its approval was for 031 and does not carry forward.**

---

## 7. Processor inventory (Section 8)

Built by enumerating every external host reachable from `src/`, cross-checked against
`package.json` and the root-layout mounts. **Purpose and data are from the code.
Locations are quoted from `/sub-processors` as-published and are not independently
verified — see the caveats.**

| Provider | Purpose (from code) | Data it receives | Prod? | Disclosed |
|---|---|---|---|---|
| Vercel | Hosting/CDN — **and** `<Analytics />` + `<SpeedInsights />` are mounted in `src/app/layout.tsx:117-118` | All data in transit; **plus visitor analytics and performance telemetry** | yes | ✅ — but the row describes hosting only |
| Supabase | Database | Review content and metadata, workspaces, apps, replies | yes | ✅ |
| Clerk | Auth | Account email, name, auth identifiers, session metadata | yes | ✅ |
| Stripe | Billing | Billing identity and payment method | keys unset | ✅ |
| Groq | AI drafting | Review text, templates, KB entries at draft time | yes | ✅ |
| Google (Gemini) | Sentiment + ASO suggestions | Review text for classification | yes | ✅ |
| Upstash | Redis cache, rate limits, sync lock | Cached drafts keyed by content hash, counters | yes | ✅ |
| Resend | Email | Recipient address and email body, which summarises review activity | yes | ✅ |
| Sentry | Errors | Stack traces, request paths, device info, IP, user id (`maskAllText: true` on replay) | yes | ✅ |
| PostHog | Analytics | Usage events, page views, user id, device info. Host defaults to **`us.i.posthog.com`** | yes | ✅ — page says "US / EU depending on region"; code pins US |
| **Slack** | Alerts, customer-initiated | After `104e73f`: app name, rating, issue tags, app version, date, link. **No reviewer name, no review text** | yes, opt-in | ❌ **on neither page** |
| Google Play / App Store Connect | The customer's own stores | We read reviews; we write the reply **the customer authored** | yes | n/a — data source and destination, not a sub-processor |
| AppFollow | Linked only; CSV import is a file the customer uploads | none | n/a | n/a |

**Three problems with the published documents themselves:**

1. **They disagree with each other.** `/sub-processors` lists **ten**. `/dpa` §4 lists
   **eight** — omitting **Vercel** and **Sentry** — in the same paragraph where it says
   *"The authoritative list is the /sub-processors page."* Two public legal documents
   naming different sets of processors is worse than one imperfect list.
2. **`/sub-processors` asserts** *"each is bound by a data processing agreement with
   us."* That is a contractual fact about eleven vendors. **I cannot verify a single
   one** and will not restate it as true.
3. **`/dpa` §4 asserts** *"Groq (AI inference, **no data retention**)"* — a vendor
   contractual claim. Verify against Groq's current terms before launch; it is the kind
   of claim a customer's own DPA review will test.

**Unresolved questions for you:** Slack's classification (§3.1) · whether Vercel's row
should name analytics · whether a DPA exists with each of the eleven · Groq's retention
terms · PostHog's actual instance region.

---

## 8. Public claims audit (Section 18) — verdict per claim

✅ verified against code · ⚠️ inaccurate · ❓ cannot be verified from this repository

| Claim | | Evidence |
|---|---|---|
| Both stores supported | ✅ | `publisher-api.ts`, `connect-api.ts`, both wired into `review-sync.ts` |
| Sync "daily" | ⚠️ understated | `vercel.json` → `0 */3 * * *` |
| Review history is limited by the stores | ✅ | `/help/review-history`; Play's API has no older-review parameter |
| AI providers are Groq and Gemini | ✅ | `lib/groq.ts`, `@google/generative-ai` |
| Groq retains no data | ❓ | Vendor contractual claim — verify |
| Four tones | ✅ on homepage, ⚠️ on `/faq` + `/help/ai-replies` | §2.4 |
| Auto-publish on the Team plan | ⚠️ **false twice** | §2.2, §2.3 |
| Topic clustering | ✅ **fixed this session** | now "Topic breakdown"; `/api/sentiment/overview` delivers it |
| Pricing: Starter $49, Pro $129, annual $39/$99 | ✅ | one source, `lib/plans.ts`; annual figures are **derived**, never typed |
| Team $199 | ⚠️ | in Terms only; the plan does not exist |
| Quota: 80% notification | ⚠️ **unimplemented** | §2.1 |
| Quota: AI drafts reset daily | ⚠️ | `plans.ts` — metered monthly, deliberately |
| Refunds: non-refundable, duplicate charges excepted | ✅ **consistent** across `/refund-policy`, `/pricing` FAQ, `/faq` | **no 30-day or money-back claim exists anywhere in `src/`** |
| 14-day trial, no card | ✅ | `TRIAL_DAYS = 14` |
| Annual billing available | ✅ | gated by `isIntervalPurchasable("annual")` |
| App deletion removes reviews | ✅ **and now says it is permanent** | §3.4 |
| Reviews retained up to 2 years | ❓ policy | no retention job exists — nothing deletes on a schedule. The commitment is a ceiling, so holding data *less* long is not a breach, but it collides with W6B (§3.2) |
| Account deletion purges within 30 days | ✅ mechanism exists | `/api/gdpr/delete`, `danger-zone.tsx` |
| GDPR rights honoured | ✅ mechanism | export + delete routes exist |
| Sub-processor list is complete | ⚠️ | §7 |
| SOC 2 | — | **no such claim is made anywhere.** Good |
| Penetration testing | — | **no such claim is made anywhere.** Good |
| Backup retention | — | no claim found |
| Grievance process | ⚠️ | `/grievance` publishes no officer — §3.5 |
| Company identity | ⚠️ | five PENDING facts — §3.5 |

**One caveat on this whole table.** `tryreviewbox.com` is blocked by this environment's
egress proxy (403 on CONNECT; `WebFetch` returns `EGRESS_BLOCKED`), so every row is
verified against **the repository**, which is what master deploys — not against the
bytes currently served. Two premises in the brief did not match master at all: a
"30-day full refund" on the pricing FAQ, and a Pro price of $99 alongside a $129
homepage. Neither exists in the code; $99 is Pro's **annual per-month** price and
`lib/plans.ts` documents that exact confusion as a fixed bug. **Please confirm the
deployed pages match master** — if they do not, the deployment is stale, which is its
own finding.

---

## 9. What was changed, and what deliberately was not

**Changed** — five commits, each independently revertable:

| Commit | Scope |
|---|---|
| `104e73f` | Slack payloads → metadata only; contract test; 5 mutations caught |
| `3fd3d59` | R2 terminology on three surfaces; `KNOWN_UNBACKED` emptied; prose guard; 3 mutations caught |
| `5f82417` | AU5 — eleven load paths; 27 contract tests; 6 mutations caught |
| `969c353` | LT3 delete-warning copy; 7 contract tests |
| *(docs)* | this file, `docs/TESTER_PROTOCOL.md`, backlog and `today.md` |

**Not changed, on purpose:**

- The review-volume gate (§2.1) — billing behaviour, D009
- Retention (§3.2) — no approval on record
- Terms, Privacy, DPA, Refund, Grievance — D009 §9
- The Team-plan and auto-publish copy (§2.2/§2.3) — one wording decision, entangled with
  a legal page
- The `/faq` and `/help` tone lists (§2.4) — same pass
- `/sub-processors` — the disclosure question is legal, not technical
- Any production DDL — none needed, none run
- PR #153 — merge-ready, unmerged, unauthorised
