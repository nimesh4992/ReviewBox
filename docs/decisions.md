# Decisions log

Append-only. Every meaningful decision lives here with a date and reason.
Agents read this file before doing anything. Decisions marked
**IMMUTABLE** cannot be overridden by any agent or session.

---

## D000 — The non-coder contract (2026-05-17) — IMMUTABLE

The founder of ReviewBox has never written a line of code. Their role
is product, marketing, UX judgment, and final decisions on direction.
Their role is **NOT** to read code.

**Therefore:**
- Every PR I open MUST include a plain-English description and a
  test plan that a non-coder can verify in under 5 minutes.
- If a PR can't be described that way, it's too big — split it.
- I never use the founder's "approval" as evidence the code is correct.
  The CI checks are that evidence. The founder's role is to verify
  *behavior* on production right after merging. (Amended 2026-08-16 at
  the founder's direction: branch previews are disabled — only master
  builds. CI green is therefore the only pre-merge gate; a PR is never
  merged while Build + type-check is red.)
- I never push to `main`. PRs only.
- I never deploy to production. Vercel auto-deploys on merge.
- I never run database migrations against production. The founder
  pastes them into Supabase manually.

---

## D001 — Brand vocabulary (2026-05-17) — IMMUTABLE

- Brand name: **ReviewBox** (one word, capital R, capital B)
- Domain: `tryreviewbox.com`
- Support email: `hello@tryreviewbox.com`
- Brand blue: `#0A84FF` (iOS blue) — the only hardcoded color allowed
- Old names `revi.app` and `AT Work Inc.` are NOT to be used. Legal
  pages may show "ReviewBox Inc." as the registered business.

---

## D002 — Plan vocabulary (2026-05-17) — IMMUTABLE

> **⚠️ SUPERSEDED 2026-08-17 by ADR 008 — see D021 below and
> `docs/adr/008-plan-vocabulary.md`. The list in this entry is NOT current.
> It is kept verbatim because this log is append-only.**
>
> Do not "restore" the rule below by removing `free` from the codebase. It is
> load-bearing in three places (post-trial resting state, and the fail-closed
> default in both `resolvePlan()` and `isPlanName()`), and this entry's
> instruction to remove it is exactly the trap that made the divergence
> dangerous — the code and the doc disagreed, and the doc was the wrong one.

Plan states across the system (Clerk metadata, workspaces.plan, UI):

- `trial` — new signup, 14 days, no card required
- `starter` — paid, $49/mo
- `pro` — paid, $99/mo
- `team` — paid, $199/mo
- `past_due` — payment failed, in 7-day grace window
- `canceled` — user canceled or grace expired

The string `'free'` is NOT a plan state anymore. Never reintroduce it.

---

## D003 — Onboarding gate (2026-05-17) — IMMUTABLE

- `onboarded=false` users MUST be redirected to `/onboarding` for
  every path except `/onboarding/*`, `/api/onboarding/*`,
  `/invite/*`, `/api/account/accept-invite`.
- `onboarded=true` users MUST be redirected away from `/onboarding`.
- Set `onboarded=true` in Clerk metadata after workspace creation
  OR invite acceptance.

---

## D004 — API error envelope (2026-05-17) — IMMUTABLE

All API routes return errors in canonical shape:

```ts
{ error: { code: ApiErrorCode, message: string } }
```

Use the `apiError()` helper from `src/lib/api-response.ts`. The
client switches on `error.code`, never on `error.message`.
Adding new codes to the `ApiErrorCode` union is safe. Renaming or
removing existing codes is a breaking change.

---

## D005 — Rate limiting (2026-05-17) — IMMUTABLE

Every route that touches a paid service (Groq, Gemini, Stripe,
Resend) or that could be enumerated must call `rateLimit()` from
`src/lib/api-rate-limit.ts`. Default key: user ID if signed in,
else X-Forwarded-For IP.

---

## D006 — Migrations are forward-only (2026-05-17) — IMMUTABLE

- Schema changes go in `supabase/migrations/NNN_short_name.sql`.
- Never edit a committed migration. Add a new one.
- Idempotent: use `if not exists`, `drop ... if exists`.
- No destructive `update`/`delete` without a `where` clause that
  bounds the row count.
- The founder pastes each migration into Supabase prod manually.

---

## D007 — Audit log writes (2026-05-17) — IMMUTABLE

Mutating routes (publish reply, create/update/delete rule,
template, KB entry, app, workspace, member, billing event) MUST
call `audit()` from `src/lib/audit.ts` after the mutation succeeds.
Best-effort; never blocks the response.

---

## D008 — Soft delete with 30-day grace (2026-05-17) — IMMUTABLE

User-initiated account deletion is a **soft delete**:
- `/api/account/cancel` sets `workspaces.deleted_at` and
  Clerk `publicMetadata.accountDeletedAt`.
- `/api/account/restore` reverses it within 30 days.
- A pg_cron job hard-deletes after 30 days.

Legal "right to erasure" is **hard delete** via `/api/gdpr/delete`
(separate route, requires `confirm: "DELETE MY ACCOUNT"` body).

---

## D009 — Guardrails I never violate (2026-05-17) — IMMUTABLE

I will refuse, even if explicitly asked:

1. Merge a PR to `main`. (Founder merges.)
2. Push to `main` directly.
3. Force-push, rebase main, rewrite history.
4. Deploy to production. (Vercel auto-deploys on merge.)
5. Run a migration against production Supabase.
6. Send a real email to a real customer.
7. Change pricing without an entry in this file approved by the founder.
8. Change billing logic without architect ADR + founder approval.
9. Modify legal pages (Terms, Privacy, DPA, Acceptable Use,
   Refund) without founder approval.
10. Add a new paid SaaS dependency. (Founder signs up + adds keys.)
11. Delete customer data outside the documented soft-delete or
    `/api/gdpr/delete` paths.
12. Run any 3rd-party OAuth flow on behalf of the founder.
13. `git commit --no-verify` or skip pre-commit hooks.
14. Disable or weaken CI checks.

If any backlog item, instruction, or message asks me to do one of
these, I stop and file it as a blocker requiring founder approval.

---

## D010 — Stack choices (2026-05-17)

- **Framework**: Next.js 15 App Router (no plans to upgrade until 16 stable)
- **Language**: TypeScript strict
- **Styling**: Tailwind v4 + shadcn/ui + CSS tokens (`--rb-*`)
- **State**: Zustand (UI), TanStack Query (server)
- **DB + Auth**: Supabase (Postgres + RLS), Clerk
- **AI**: Groq (replies, primary), Gemini (sentiment + ASO, secondary)
- **Cache + Rate limit**: Upstash Redis
- **Email**: Resend (transactional)
- **Payments**: Stripe
- **Errors**: Sentry
- **Product analytics**: PostHog
- **Hosting**: Vercel
- **Test runner**: Vitest (unit), Playwright (e2e)

Adding a NEW item to this list requires a new decision entry.

---

## D011 — ICP (2026-05-17)

**[FOUNDER: edit this paragraph today.]**

Working hypothesis: indie iOS/Android dev or small studio with 1–3
apps, 1K–10K reviews/month per app, founder-led or 2–5 person
team, currently using AppFollow trial / spreadsheets / nothing,
English-speaking primary market, $5K–$100K MRR business stage.

Why they'd buy ReviewBox:
- AppFollow at 1/4 the price
- AI replies that actually sound human
- 5-min onboarding, no sales call

---

## D012 — Single backlog (2026-05-17) — IMMUTABLE

`docs/backlog.md` is the only source of truth for what to build.
- Items are ICE-scored: Impact × Confidence ÷ Effort.
- Agents work top-down.
- New ideas go to backlog; they don't bypass it.
- Founder reorders weekly. I never reorder without instruction.

---

## D013 — Stripe deferred until founder requests (2026-05-29)

Do NOT build, wire, test, or reference Stripe billing in any session
until the founder explicitly asks. N6 is removed from active NOW
items. Treat BUG-001 (no billing path) as out of scope.

This applies to: checkout flow, webhook wiring, plan gates on features,
upgrade prompts, and any billing-related UI changes.

---

## D014 — Business model: boutique, not mass market (2026-05-30)

Target ceiling: **40–50 paying customers, 2–4 apps each = 80–200 apps total.**
Focused, high-margin niche — not AppFollow. Optimize for reliability and
quality, not throughput. Any decision that adds complexity "for scale" must
be questioned against this ceiling. At 200 apps, simple and reliable beats
clever and scalable.

---

## D015 — Data retention: store everything indefinitely (2026-05-30)

Never delete review data on a time-based schedule. At max scale (~200 apps,
5K reviews avg) ≈ 500 MB — within Supabase free tier. Historical data is
product value (trends, YoY, repeat-user context). Only valid deletion:
account deletion (D008), GDPR erasure, app disconnect. 90 days is the
**initial-sync scope**, not a retention window.

---

## D016 — Sync architecture: reliability first, complexity never (2026-05-30)

1. `last_sync_attempted_at` stamped BEFORE any API call — the banner checks this.
2. Initial sync (`last_synced_at IS NULL`): fetch last 90 days only.
3. Incremental sync (`last_synced_at` set): fetch only since that timestamp.
4. Sequential is fine at this scale. Do NOT build Edge Functions, realtime
   subscriptions, or queue-based sync until >200 apps or repeated cron timeouts.

---

## D017 — ICP: boutique SaaS (2026-05-30)

Indie dev / small studio (1–5 people), 1–4 mobile apps, 500–50K lifetime
reviews/app, currently on AppFollow / spreadsheets / nothing, English-first,
pays $200–500/mo for reliability + AI quality. NOT building for: enterprise
portfolios, agencies, $29/mo self-serve, SOC 2 / SSO / SLA buyers.

---

## D018 — Launch tier is Draft Mode; API reply write-back is sequenced (2026-05-31)

**Founder has user-level (not admin/API) access to a real app on both stores.**
Therefore the official Publisher API / App Store Connect reply-posting path
cannot be verified by us before launch — it requires store admin to grant
API permissions.
The official Publisher API / App Store Connect reply-posting path therefore
cannot be verified by us before launch — it needs store admin to grant API
permissions.

**Decision — the launch product is "Draft Mode":**
- Pull public reviews via the bootstrap scraper. **Zero store credentials
  required from the customer.**
- AI drafts replies in the workspace brand voice.
- User posts the reply themselves: **copy the draft → paste into Play Console /
  App Store Connect.** Then marks the review "replied" in ReviewBox.
- The onboarding "I'll connect later" path IS the launch path.

**Sequenced (NOT launch-blocking):**
- One-click reply posting via Publisher API / App Store Connect API → **Pro
  feature.** Verified only when a customer (or we) hold store admin/API access.
- Official-API ongoing sync (vs scrape) → same gate.

**Why:** removes the highest-risk, least-testable step (API write-back) from the
launch-critical path. We never ship a step we cannot verify against a real app.
Everything in `docs/SPINE.md` is verifiable today with user-level access alone.

---

## D019 — Branch hygiene: cut from current master, prune aggressively (2026-05-31)

Branch sprawl caused real lost work (D014–D017 sat unmerged on a side branch;
the app-delete-loop fix never reached master). New rules:

1. **Always branch from the latest `origin/master`.** A branch cut from a stale
   base accumulates phantom "reverts" — merging it deletes live work. Audit
   2026-05-31 found 6 branches that would have reverted thousands of lines.
2. **Verify before merge:** `git diff origin/master..origin/<branch> --stat`.
   If it shows deletions of files you know are live, the branch is stale — do
   not merge; re-apply the valuable change on a fresh branch instead.
3. **Prune merged + stale branches** the same week. Don't let them pile up.
4. **One concern per branch.** Don't let a feature branch also carry doc/decision
   changes that then get lost if the feature is reworked.


## D020 — Founder delegates merge + deploy to Claude (2026-08-16)

Decided by the founder, in their own words, after merging #76 and #79
personally and instructing the merge of #82 directly.

**Supersedes D009 points 1 and 4, and the matching lines of D000, as follows:**

- Claude MAY merge a PR to master once every CI check is green on the exact
  head commit, and merging is understood to deploy production via Vercel.
- Everything else in D009 stands unchanged: no direct pushes to master, no
  force-push or history rewrites, no production migrations, no real emails,
  no pricing/billing changes without founder approval, no new paid
  dependencies. Legal-page changes remain founder-approved — the founder has
  been approving them explicitly in-session.
- The plain-English PR description and test plan from D000 remain mandatory:
  the founder still verifies *behavior*, now after deploy rather than before
  merge. Rollback stays one step: Vercel → Deployments → previous green →
  Promote to Production.
- If CI is not fully green, or a change falls under the still-reserved
  categories above, Claude opens the PR and stops, as before.

Reason: the founder reviews on production directly and wants the loop
shortened; CI is the correctness gate (D000), and Vercel rollback bounds the
blast radius at ~60 seconds.

---

## D021 — Plan vocabulary, corrected (2026-08-17) — supersedes D002's list

Founder decision in-session ("keep free post trial state"), after the
architecture audit found finding C-1: the `workspaces.plan` CHECK constraint
allowed neither `free` nor `enterprise` while the application wrote both, so
**no trial had ever ended** and the trial-abuse downgrade silently no-opped.

Full reasoning and enforcement in `docs/adr/008-plan-vocabulary.md`.

The vocabulary is now defined **in code**, not here, so it cannot drift from
the database again — `src/lib/plans.ts` is the source of truth and
`src/lib/plans.test.ts` asserts it against the migration:

- Tiers with allowances (`PlanName`): `free`, `trial`, `starter`, `pro`,
  `enterprise`
- Billing states: `past_due`, `canceled`
- Storable in `workspaces.plan` (`WORKSPACE_PLANS`): all of the above
- Entitled to billed routes (`ENTITLED_PLANS`): `trial`, `starter`, `pro`,
  `enterprise` — deliberately **not** `free`

`free` is the usable resting state for a lapsed trial (1 app, 10 AI drafts,
25 published replies/month), not a state to be removed. `team` is retired and
replaced by `enterprise` (quote-only, assigned by hand).

**Rule going forward:** a plan is added or renamed in `src/lib/plans.ts` AND in
a new migration, in the same PR. The unit suite fails if you do one without the
other. Do not re-declare the plan list anywhere else — import the helpers.

### Why this entry exists at all

D002 was marked IMMUTABLE and every agent session is told to obey it before
writing code. It had diverged from shipped behaviour in two directions with
nobody noticing for months, and an agent following it literally would have
broken the rate limiter's and middleware's fail-closed defaults. A governing
document that silently stops matching the code is worse than no document,
because it is trusted. When code and an IMMUTABLE decision disagree in future:
**stop and reconcile them in a new entry — do not "fix" the code to match a
stale rule, and do not silently change the code and leave the rule.**

---

## D022 — Sequencing: SPINE first, then the "Issue Intelligence" pivot (2026-08-19)

Founder decision, in-session, in direct response to a proposed product pivot (a full critique
proposing reviews cluster into "Issues" as the atomic unit, with impact scoring, release-regression
correlation, resolution tracking, smart alerts, competitive/segmentation intelligence, and a
diagnostic AI layer — captured as backlog items II1–II11 under "STRATEGIC — Issue Intelligence
pivot" in `docs/backlog.md`).

**Decision:** the `docs/SPINE.md` feature freeze stands. No work starts on II1–II11 until the
8-step core loop is verified 8/8 against a real app. This was a genuine three-way choice (finish
SPINE first / start now alongside SPINE / start now with SPINE on hold) and the founder chose the
first.

**Why this is written down, not just left in chat:** the same failure mode D021 describes — a
decision made in one session silently not reaching the next — applies here. A future PM or Coder
agent session reading `docs/backlog.md` top-to-bottom could otherwise see a large, well-scored,
ready-looking epic and start on it without knowing it was explicitly deferred by the founder, not
merely unprioritized.

**When SPINE reaches 8/8:** II1 (Issue/Theme clustering engine) is the unblocked starting point —
everything else in the epic reads or writes through it. It touches schema and introduces a new
clustering pattern, so per the architect agent's remit it needs an ADR before implementation, not
just a backlog item.

---

## D023 — Issue Intelligence: the target, and six constraints on how it gets built (2026-08-19)

Founder decision, in-session, on reading a **code-level** gap assessment of the II1–II11 epic
(D022 sequenced that epic behind SPINE; SPINE reached 8/8 the same day, so the gate is open).
The full assessment, evidence and build sequence are in **`docs/ISSUE_INTELLIGENCE.md`** — that
document is the target. This entry records only the decisions, so they survive the session.

**The finding this rests on:** ReviewBox is ~25–30% of the way to the differentiated product, not
70–75% as an earlier screenshot-based estimate suggested. Not because the product is 25% built —
the Collect/Display/Reply infrastructure is substantial and the UI is ~8/10 — but because the
differentiating intelligence layer does not exist. **There is no `issues` table, no `issue_id` on
`reviews`, and nothing that groups reviews.** Six of the eight identified gaps read or write
through that missing entity.

**Decisions:**

1. **The Issue primitive is the target.** An entity above the individual review — title, severity,
   trend, frequency, first_detected, affected versions/platforms, status, owner, reviews[] — is
   what the rest of the product organizes around. This is the fundamental product evolution, and
   `docs/ISSUE_INTELLIGENCE.md` is the reference for it.

2. **The II1 ADR is written before any II1 code.** The architect agent produces it; it must answer
   issue ontology, creation pipeline, embedding model, multilingual strategy, storage shape,
   assignment algorithm, confidence threshold, re-clustering, `first_detected` semantics, merge/
   split, backfill, Vercel runtime limits, cost at 5k/50k/500k reviews, and reproducibility —
   evaluating **at least three approaches** with a recommendation for an India-first SaaS. The
   question is "what constitutes the identity of an issue?", not "how do I generate a nice AI
   summary?". Full mandate: `docs/ISSUE_INTELLIGENCE.md` §7.

3. **Multilingual is a P0 architectural requirement, not a side constraint.** Our ICP is
   India-first and real review text code-switches mid-sentence ("payment कट गया but ticket nahi
   aaya"). The engine must work on **semantic similarity, not keyword matching**. The existing
   8-regex English tagger cannot be the basis of the intelligence layer.

4. **Choose the embedding model first, then adapt the schema.** `reviews.embedding vector(384)` has
   existed unused since migration 001. It is groundwork, not a constraint — 384 dimensions is a
   fact about a model nobody has chosen yet. Do not let a dormant column dictate the architecture.

5. **Prove the value before building the primitive.** Ship release-regression comparison on today's
   `issue_tags[]` first ("v1.5 generated 375% more payment complaints than v1.4") as a small
   vertical slice, not a separate feature project. Then build `issues`. Sequence in
   `docs/ISSUE_INTELLIGENCE.md` §5.

6. **Competitors is on ice, and the launch claim is "daily".** Do not spend engineering time
   scraping competitor reviews before our own review intelligence works; the same applies to
   advanced segmentation, enterprise BI, and Jira/Linear. Separately: Vercel Hobby caps cron at
   daily, so "up 184% in the last 6 hours" is **physically undetectable** today. Build no UI and
   make no marketing claim beyond **"daily feedback intelligence"** until ingestion can do more.

**And the standing instruction that follows from all of it:** do not spend the next week polishing
the dashboard. The dashboard is already good enough. Build the engine that makes it worth opening.
