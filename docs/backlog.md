# Backlog

Single source of truth for what we build next. Agents work top-down.

Scoring: **ICE = Impact (1-10) × Confidence (1-10) ÷ Effort (1-10)**
Higher = do sooner.

Status legend: `[ ]` queued · `[~]` in progress · `[x]` shipped · `[!]` blocked · `[-]` deferred

---

## 🔴 NOW — this week

These are the next items to ship. Don't skip; don't reorder without thinking.

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

### [ ] N6 · Stripe test keys + verify upgrade flow · ICE 80 (10×8÷1)
**Effort:** 1h.
**Done when:** Founder completes a real upgrade with test card on local dev; webhook fires; sidebar plan label flips to "Pro".
**HUMAN-REQUIRED** (founder pastes Stripe test keys).

---

## 🟠 NEXT — next 2-4 weeks

Critical-edge features for AppFollow competition.

### [ ] DS1 · Add `--rb-indigo-*` tokens to globals.css · ICE 48 (6×8÷1)
**Effort:** 10 min.
**Done when:** `--rb-indigo-500: #5B5BD6` and `--rb-indigo-600: #4a4ac4` defined in `globals.css` with dark mode overrides; all 40 hardcoded `#5B5BD6` usages in Reply Kit + Automations replaced with `var(--rb-indigo-500)`.
**Files:** `src/app/globals.css`, `src/features/reply-kit/components/*`, `src/features/automations/components/*`
**Why now:** Quickest design system win. Unblocks theming Reply Kit + Automations. See `docs/DESIGN_SYSTEM_AUDIT.md` C3.

### [ ] DS2 · Define type scale tokens (`--rb-text-*`) · ICE 35 (7×5÷1)
**Effort:** 30 min.
**Done when:** 7 type tokens defined in `globals.css` (`caption` 11px → `lg` 16px), wired as Tailwind utilities via `@theme inline`. 538 arbitrary `text-[Npx]` usages replaced in top-5 files (review-queue, dashboard, aso-screen).
**Files:** `src/app/globals.css`, top-5 offending components.
**Why:** 538 arbitrary font sizes means one type change = grep across 63 files. See `docs/DESIGN_SYSTEM_AUDIT.md` M1.

### [ ] DS3 · Token migration pass: Settings + Reply Kit `gray-*` → `--rb-*` · ICE 30 (6×5÷1)
**Effort:** 2h.
**Done when:** `app-connections.tsx` (52 hits), `templates-tab.tsx` (28), `automation-hub.tsx` (30), `google-play-setup-modal.tsx` (41) all use `text-fg-*` / `bg-surface` instead of `gray-*`. Zero new `gray-*` usages introduced.
**Why:** Top 4 files = 151 violations. Dark mode broken in all of them. See `docs/DESIGN_SYSTEM_AUDIT.md` C1.

### [ ] DS4 · Replace raw `<button>` with `<Button>` in review-queue + aso-screen · ICE 35 (7×5÷1)
**Effort:** 1.5h.
**Done when:** `review-queue.tsx` (22) and `aso-screen.tsx` (17) use `<Button variant="ghost" size="sm">` throughout. Consistent focus rings, keyboard nav, disabled states.
**Why:** 39 of the 86 raw buttons are in these two files. Accessibility fix — `<button>` has no focus ring in the current stylesheet. See `docs/DESIGN_SYSTEM_AUDIT.md` C4.

### [ ] X1 · Slack integration · ICE 72 (9×8÷1)
**Effort:** 1d.
**Done when:** Workspace owner connects Slack via OAuth; rating spikes + new incidents + urgent unreplied reviews post to chosen channel.
**Why:** Biggest competitive gap vs AppFollow. Universally requested.
**Architect ADR required before coding.**

### [ ] X2 · Auto-translate review text · ICE 60 (8×6÷0.8)
**Effort:** 0.5d.
**Done when:** Reviews in non-English show a "Translate" button; click → Groq translation cached for 7d; original always preserved.

### [ ] X3 · Real-time inbox refresh · ICE 50 (8×5÷0.8)
**Effort:** 1d.
**Done when:** New reviews appear in /inbox without manual refresh. Polling every 60s when tab is active.

### [ ] X4 · Bulk operations in inbox · ICE 56 (8×7÷1)
**Effort:** 1d.
**Done when:** Multi-select reviews → bulk reply with template, bulk mark-replied, bulk archive.

### [ ] X5 · Mobile responsive pass (dashboard + inbox) · ICE 56 (7×8÷1)
**Effort:** 1d.
**Done when:** Both screens usable on a phone. Inbox collapses to single column; dashboard cards stack.

### [ ] X6 · Real competitor tracking · ICE 48 (8×6÷1)
**Effort:** 1d.
**Done when:** User can add competitor app by store URL; daily cron fetches public rating + recent review snippets; sparkline chart on /competitors.

### [ ] X7 · Help center: 12 articles written · ICE 48 (6×8÷1)
**Effort:** 1d.
**Done when:** /help has Getting Started, Connect GP, Connect AS, AI Replies, Automations, Templates, Slack, Billing, Cancel, Export, FAQ, Status — each ≥300 words with screenshots.

### [ ] X8 · Trial day-5 + day-12 emails · ICE 49 (7×7÷1)
**Effort:** 0.5d.
**Done when:** Daily cron queries Clerk users by `trialEndsAt`; sends nudge emails via Resend.

### [ ] X9 · AppFollow CSV import wizard · ICE 50 (10×5÷1)
**Effort:** 2d.
**Done when:** /settings → "Import from AppFollow" → upload CSV → map columns → reviews appear. Killer migration tool.

### [ ] X10 · Full-text search on review body · ICE 56 (7×8÷1)
**Effort:** 0.5d.
**Done when:** Search box in /inbox header filters by text content. Postgres `to_tsvector` index.

### [ ] X11 · Saved views / smart inboxes · ICE 42 (7×6÷1)
**Effort:** 1d.
**Done when:** User saves a filter combo as a named view; pins to sidebar.

### [ ] X12 · Admin panel real data · ICE 45 (5×9÷1)
**Effort:** 1d.
**Done when:** /admin shows real customers (workspaces table joined with Clerk users), MRR (Stripe), AI usage volumes.

### [ ] X13 · First Playwright e2e (signup → upgrade) · ICE 49 (7×7÷1)
**Effort:** 0.5d.
**Done when:** Headless test creates a fresh user, walks through onboarding, lands on dashboard, opens billing, mocks Stripe checkout success. Runs on every PR.

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
