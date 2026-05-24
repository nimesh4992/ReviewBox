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

### [ ] N3 · Detail pages exist · ICE 64 (8×8÷1)
**Effort:** 2h.
**Done when:** Clicking an incident or release in the lists goes to a real detail page (not 404 or blank).
**Files:** `src/app/(app)/incidents/[id]/page.tsx`, `src/app/(app)/releases/[version]/page.tsx`
**Why now:** Users will click these. 404 = trust killer.

### [ ] N4 · Remove or wire dead buttons · ICE 56 (7×8÷1)
**Effort:** 3h.
**Done when:** Every visible button does something. If we can't ship the feature, the button is hidden behind a feature flag or removed.
**Files:** `competitors-screen.tsx`, `aso-screen.tsx`, `reports-screen.tsx`, settings sections
**Why now:** "Save defaults" that does nothing trains users to mistrust us.

### [x] N5 · /compare/appfollow with real teeth · ICE 81 (9×9÷1)
*Shipped 2026-05-19 on branch `claude/n5-compare-appfollow-rewrite` — awaiting founder merge.*
*42-row table across 7 categories, ROI calculator widget, 4-step switch timeline, 3 placeholder quotes, price callout, dual CTA. Placeholder quotes marked in code for replacement with real customers.*
**Effort:** 3h.
**Done when:** Page has: feature comparison table (12 rows), ROI calculator widget, 3 customer-style quotes, "Switch in 5 min" CTA, screenshots side-by-side.
**Files:** `src/app/compare/page.tsx`, `src/components/marketing/roi-calculator.tsx`
**Why now:** This is your #1 inbound conversion asset. Currently a stub.

### [ ] N6 · Stripe test keys + verify upgrade flow · ICE 80 (10×8÷1)
**Effort:** 1h.
**Done when:** Founder completes a real upgrade with test card on local dev; webhook fires; sidebar plan label flips to "Pro".
**HUMAN-REQUIRED** (founder pastes Stripe test keys).

---

## 🟠 NEXT — next 2-4 weeks

Critical-edge features for AppFollow competition.

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
