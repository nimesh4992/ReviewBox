# Backlog

Single source of truth for what we build next. Agents work top-down.

Scoring: **ICE = Impact (1-10) × Confidence (1-10) ÷ Effort (1-10)**
Higher = do sooner.

Status legend: `[ ]` queued · `[~]` in progress · `[x]` shipped · `[!]` blocked · `[-]` deferred

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

### [!] W5A · Decide the review-volume limit before Stripe goes live · HUMAN-REQUIRED
**Added 2026-08-17 by Wave 5 (audit finding M-6). Blocked on a founder decision — see `docs/adr/009-review-volume-limit.md`.**
`PLAN_LIMITS.reviewsPerMonth` is advertised on `/pricing` and Billing and enforced nowhere: `checkReviewLimit()` is fully implemented and has zero call sites. Three options are written up in the ADR; the recommendation is **B — soft cap** (never stop ingesting; show an upgrade banner over the limit). D009 puts this call with the founder, not with me.
**Why it can't wait for M2:** once a paid plan exists to compare against, the gap between what the pricing page promises and what the product does stops being tidiness.

### [ ] W6A · Apply migration 030 · HUMAN-REQUIRED
**Added 2026-08-17 by Wave 6 (audit finding L-2).** One migration, idempotent, self-checking.
`workspace_invites` declares `unique (workspace_id, email, accepted_at)` with a comment claiming it keeps pending invites unique. It does the exact opposite: Postgres treats every NULL as distinct, and `accepted_at` is NULL for every *pending* invite — so the constraint fires only for accepted ones. 030 adds the partial unique index that expresses the actual rule. Skips with a notice (and a resolution query) if duplicates already exist.

### [x] W5B · Apply migrations 026–029 · DONE 2026-08-17 (founder ran)
Verified by query, not assumed:
- **027** — `pg_policies` returns **zero** rows mentioning `auth.uid()`.
- **028** — all nine tenant columns report `is_nullable = NO`. The pre-check found zero NULL rows, so nothing was skipped. All 12 insert/upsert sites on those tables were confirmed to set `workspace_id` before applying.
- **029** — the diagnostic returned **zero rows**: no review had ever been stored as `replied` with blank text on this database. Section A was a no-op and Section B never applied. The PR #101 code fix stands; there was simply nothing persisted to repair.
- **026** — the four dead `alert_preferences` columns dropped.

### [ ] LT1 · Sweep every write for the PGRST204 class · ICE 72 (8×9÷1) 
**Added 2026-08-16 after PR #85.** **Effort:** 3h.
**Done when:** every `.insert(` / `.update(` whose payload contains a column from migration 012 or later either goes through `writeWithOptionalColumns()` or is confirmed to need no fallback, with a test for each.
**Why now:** this class took onboarding down for **every** signup and nothing in the repo could see it. PostgREST answers `PGRST204` (not `42703`) when a write names a column missing from its schema cache, so every fallback written against 42703 alone is unreachable on the write path. `db-errors.ts` and `writeWithOptionalColumns()` now exist; onboarding, `/api/apps` and the sync status write are converted. Everything else is still latent — it just hasn't met a database missing that particular column yet.

### [ ] LT2 · Founder: Clerk dev keys scoped to Preview · ICE 60 (6×10÷1) — HUMAN-REQUIRED
**Added 2026-08-16.** **Effort:** ~10 min (founder, Vercel env vars).
**Done when:** preview deployments can be signed into, so a fix can be verified before it reaches production.
**Why now:** CI runs with placeholder Clerk keys (`pk_test_ci-placeholder…`) that Clerk rejects with `"Invalid host"`. Every one of the 13 fixes in PR #85 had to be verified on **production** because the founder could not sign in to the preview. This is the single change that most shortens the feedback loop, and it is pure config.

### [ ] LT3 · Decide whether app deletion is recoverable · ICE 40 (4×10÷1) — HUMAN-REQUIRED
**Added 2026-08-16. Asked twice, unanswered.** **Effort:** 30 min once decided.
**Done when:** either the current behaviour is confirmed and documented in `decisions.md`, or reviews get a `deleted_at` and a restore window.
**Why now:** deleting an app permanently deletes its reviews (D015 sanctions it). That is defensible, but it must be a decision on the record before a paying customer does it by accident — after the fact there is nothing to restore, and the store only returns ~90 days on re-add.

### [x] AU3 · `ai_usage` is read everywhere, written nowhere — SHIPPED 2026-08-16 (PR #89)
`recordAiUsage()` (`src/lib/ai-usage.ts`) is called from every tier of
`/api/reply/draft` via the existing `log()` hook, and from both AI paths in the
automation executor. `model` carries the tier that served the reply
(reply-kit / template / cache / groq / gemini / composer), so the founder can
tell a free template draft from a metered provider call — a single count that
mixed them could not. Automation drafts are attributed to the rule rather than
a user, since a rule can burn far more quota than a person clicking Generate.
Written via `after()`, not a detached promise, which Vercel would cut off.

### [ ] AU4 · Finish the swallowed-error sweep (ASO / Sentiment / Reply Kit / Competitors) · ICE 40 (8×5÷1)
**Added 2026-08-15 by the audit round.** **Effort:** 3h.
**Done when:** these screens distinguish "failed to load" from "no data", and their mutations report failure. Same shape as the dashboard/inbox/automations fixes already shipped in AU1: hooks stop casting `{ error?: string }` over the `{ error: { code, message } }` envelope, and each screen gets one error branch.
**Why now:** on these screens a 500 still reads as "you have no keywords / no tags / this feature isn't shipped yet" — Competitors literally shows "coming soon" on a transient failure.

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

### [x] N5 · /compare/appfollow with real teeth · ICE 81 (9×9÷1)
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

### [ ] SPINE · Make the 8-step launch path 100% · ICE 100 — ACTIVE
**The launch gate. See `docs/SPINE.md`.** Features frozen until 8/8 verified against a real app.
Next build tasks: (1) Draft Mode composer — copy-to-store + mark-replied (step 7); (2) re-apply app-delete cookie-clear fix (missing from master, D019).

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
