# ReviewBox — Claude Context

AI-powered review management platform for Google Play and Apple App Store operations.

**Brand:** ReviewBox · **Domain:** `tryreviewbox.com` · **Email:** `hello@tryreviewbox.com`

> **READ THESE FIRST, EVERY SESSION** (the autopilot relies on them):
> 1. **`docs/PRODUCT_CONTEXT.md`** — who the customer is, what we promise, platform limits, fixture apps. **Read before any code.** Without it an audit can only find inconsistency, never wrongness (this is how the US-storefront bug hid for months).
> 2. **`docs/decisions.md`** — IMMUTABLE rules + the non-coder contract. Agents obey D000–D022.
> 3. **`docs/backlog.md`** — single source of truth for what we build next. ICE-scored.
> 4. **`docs/today.md`** — what shipped last session, what's queued. Overwritten each session.
> 5. **`docs/specs/`** — the definition of done per feature (Given/When/Then). Touching a feature? Read its spec, and update it in the same PR if behaviour changes.
> 6. **`docs/AUDIT_SYSTEM.md`** — the six review lenses, the process rules, and the live store probe.
> 7. **`.claude/agents/*.md`** — pm, architect, coder, tester, reviewer, **triager** roles. Spawn per task.

> **Before shipping anything non-trivial:** does it hold for the region-locked
> fixture app, not just a US one? Run `GET /api/admin/probe/stores`.

> **Other docs:** `docs/LAUNCH_PLAN.md` · `docs/ZERO_COST_PLAN.md` · `docs/ARCHITECTURE.md` · `docs/FEATURES.md`

## The one rule
Do not add a paid service until a customer pays first. Every tool has a free tier that covers 0–20 customers.
See `docs/ZERO_COST_PLAN.md` for the full breakdown.

## The autopilot

The founder is a non-coder. The product ships via this loop:

1. **PM agent** picks the top NOW item from `docs/backlog.md` (ICE-ranked, skip HUMAN-REQUIRED)
2. **Architect agent** writes an ADR in `docs/adr/` if the item is non-trivial
3. **Coder agent** branches `claude/<id>-<slug>`, implements, opens a PR
4. **Tester agent** writes Vitest + Playwright tests for new logic
5. **Reviewer agent** comments BLOCKER/NIT on the PR before founder merge
6. CI on every PR (`.github/workflows/ci.yml`): build, type-check, lint, unit tests, e2e tests, security audit. Failure blocks the merge button
7. Founder merges once every CI check is green — **never on red; CI is the only pre-merge gate** (branch previews are disabled, see Known Issues) — then verifies behavior on production right after, using the plain-English "How to test" section of the PR template
8. Vercel auto-deploys main to production. Founder gets ~60s to roll back via Vercel if needed

Hard rules (`docs/decisions.md` D009):
- I never push to `main`. PRs only.
- I never deploy to production.
- I never run migrations against prod Supabase. Founder pastes them manually.
- I never send real emails or change pricing or billing.
- Every PR description must be a 5-minute test plan in plain English.

End of every session: overwrite `docs/today.md` with what shipped and what's next.

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 15 App Router | — |
| Language | TypeScript strict | — |
| Styling | Tailwind CSS v4 + shadcn/ui (New York style) | CSS design tokens: `--rb-*`, semantic classes: `bg-surface`, `text-fg-1/2/3` |
| State | Zustand (workspace) + TanStack React Query (server) | — |
| Database | Supabase (PostgreSQL + RLS + Edge Functions + pgvector) | Schema created, RLS active |
| Auth | Clerk | ✅ Installed — free to 5K MAU |
| Payments | Stripe | 🔲 Keys not yet set — no monthly cost |
| AI (phase 1) | **Groq** (Llama 3.3 70B) | Free tier: 6K req/day — use until $1K MRR |
| AI (phase 2) | Claude Haiku 3.5 + prompt caching | Switch at $1K MRR — ~$10/month |
| Local ML | @xenova/transformers (WASM) | Semantic tags, sentiment, clustering — $0 forever |
| Rate limiting | Upstash Redis | Free: 10K commands/day |
| Email | Resend | ✅ Client wired — free: 3K/month |
| Analytics | PostHog | ✅ Installed (`posthog-js`) — free: 1M events/month |
| Errors | Sentry | ✅ Installed (`@sentry/nextjs`) — free: 5K errors/month |
| Icons | Lucide React | strokeWidth=1.5 globally via CSS |

Path alias: `@/*` → `src/*`

---

## Directory Map

```
src/
  app/
    page.tsx                          → landing page (Apple-style light design)
    layout.tsx                        → root layout (fonts, metadata, ClerkProvider)
    globals.css                       → Tailwind base + CSS design tokens (--rb-*)
    opengraph-image.tsx               → OG image (edge runtime)
    onboarding/page.tsx               → 4-step onboarding wizard (dark themed)
    sign-in/[[...sign-in]]/page.tsx   → Clerk sign-in (light theme, #0A84FF)
    sign-up/[[...sign-up]]/page.tsx   → Clerk sign-up (light theme, terms gate)
    privacy/page.tsx                  → Privacy policy
    terms/page.tsx                    → Terms of service
    (app)/
      layout.tsx                      → authenticated shell (AppShell)
      dashboard/page.tsx
      reviews/page.tsx
      incidents/page.tsx
      releases/page.tsx
      automations/page.tsx
      reply-kit/page.tsx
      sentiment/page.tsx
      competitors/page.tsx
      aso/page.tsx
      reports/page.tsx
      settings/page.tsx
      billing/page.tsx
    api/
      apps/route.ts                   → GET /api/apps (workspace apps)
      reviews/route.ts                → GET /api/reviews (paginated, Supabase)
      reviews/[id]/reply/route.ts     → POST reply submission
      reply/draft/route.ts            → POST AI draft via Groq
      dashboard/metrics/route.ts      → GET KPI metrics (real deltas + ratingTrend)
      incidents/[id]/route.ts         → GET incident detail
      incidents/route.ts              → GET/POST incidents
      automations/rules/route.ts      → GET/POST automation rules
      reply-kit/templates/route.ts    → GET/POST reply templates
      reply-kit/knowledge-base/       → GET/POST/DELETE KB entries
      settings/alerts/route.ts        → GET/PUT alert preferences
      onboarding/state/route.ts       → GET onboarding state (DB-authoritative)
      onboarding/slug-check/route.ts  → GET slug availability (rate-limited)
      onboarding/search-app/route.ts  → GET search App Store / Google Play
      onboarding/complete/route.ts    → POST mark onboarding done (sets rb_onboarded cookie)
      reports/export/route.ts         → GET CSV export with totals
      reports/weekly-digest/route.ts  → Cron (Mon 9am) parallel batched
      reports/unreplied-alert/route.ts → Cron (daily 10am)
      stripe/checkout/route.ts        → POST create Stripe session
      stripe/portal/route.ts          → POST billing portal
      stripe/webhook/route.ts         → POST Stripe webhooks
      gdpr/export/route.ts            → POST GDPR data export
      gdpr/delete/route.ts            → POST GDPR deletion
      health/route.ts                 → GET health check
      admin/                          → admin-only routes (ADMIN_CLERK_USER_ID gate)

  components/
    layout/
      app-shell.tsx                   → sidebar + topnav wrapper
      sidebar.tsx                     → nav links, app selector, AI triage panel
      top-navigation.tsx              → header bar
      page-header.tsx                 → per-page title/actions area
      cookie-banner.tsx               → GDPR cookie consent
    providers/
      query-provider.tsx              → React Query client provider
      theme-provider.tsx              → dark/light theme
    ui/                               → shadcn/ui primitives (DO NOT edit)
      badge, button, card, dialog, dropdown-menu,
      input, sheet, skeleton, table, tabs, tooltip

  features/                           → domain feature slices
    reviews/
      components/review-queue.tsx
      data/mock-reviews.ts            → mock AppReview[] (until Supabase wired)
    incidents/
      components/incident-list.tsx
    releases/
      components/release-health-table.tsx
    sentiment/
      components/sentiment-screen.tsx
    competitors/
      components/competitors-screen.tsx
    aso/
      components/aso-screen.tsx
    reports/
      components/reports-screen.tsx
    onboarding/
      components/onboarding-wizard.tsx → standalone wizard component
    reply-kit/
      components/                     → AI styles, templates, KB tabs
      data/mock-reply-kit.ts
    settings/
      components/                     → settings sections + alert preferences
    automations/
      components/                     → automation rule builder

  hooks/
    use-review-queue.ts               → React Query hook for review list
    use-dashboard-metrics.ts          → React Query hook for KPI metrics

  lib/
    utils.ts                          → cn() Tailwind merge helper
    email/
      client.ts                       → getResend(), FROM constant
      send-welcome.ts
      send-trial-expiring.ts
      send-payment-failed.ts
    groq.ts                           → generateReply() via Groq API

  services/
    supabase/client.ts                → getSupabaseClient() / getServiceClient() factories
    reviews/review-service.ts         → listReviewQueue() wired to Supabase
    store-search.ts                   → searchAppStore() + searchGooglePlay()
    google-play/publisher-api.ts      → reviews + reply submission
    app-store/connect-api.ts          → reviews + reply submission via JWT

  store/
    use-workspace-store.ts            → Zustand: selectedApp, environment (persisted)

  types/
    review.ts                         → ALL shared domain types (see below)
    global.d.ts                       → module declarations

  utils/
    format.ts                         → formatRating(), humanizeToken()

  emails/
    weekly-digest.html                → HTML email template
    rating-spike-alert.html           → HTML email template
```

---

## CSS Design Tokens

Defined in `src/app/globals.css`. Use these instead of raw color values:

```css
/* Surfaces */
bg-surface          → white / dark card background
--rb-bg-sunken      → slightly darker than canvas (#F5F5F7 in light)
--rb-bg-raised      → slightly lighter than surface
--rb-bg-hover       → hover state background

/* Borders */
--rb-border-1       → default border (subtle)
--rb-border-2       → stronger border

/* Foreground */
text-fg-1           → primary text (#1D1D1F)
text-fg-2           → secondary text (#48484D)
text-fg-3           → tertiary/muted text (#86868B)

/* Shadows */
--rb-shadow-xs      → card shadow
--rb-shadow-sm      → elevated shadow
```

Brand blue: `#0A84FF` (iOS blue). Use for primary actions, links, active states.

---

## Core Domain Types (`src/types/review.ts`)

```ts
ReviewSentiment   = "critical" | "negative" | "mixed" | "positive"
ReviewPriority    = "urgent" | "high" | "normal" | "low"
ReplyStatus       = "needs_reply" | "draft_ready" | "replied" | "waiting"
EscalationState   = "none" | "support" | "product" | "engineering" | "incident"
ReviewIssueTag    = "crash" | "billing" | "login" | "performance" |
                    "release-regression" | "feature-request" | "support-delay" | "localization"

AppReview {
  id, author, rating(1-5), text, appVersion, device, country,
  issueTags, sentiment, priority, replyStatus, escalationState,
  createdAt, source("Google Play" | "App Store"), hasAiSuggestion
}

OperationalMetric { label, value, delta, state }
IncidentAlert     { id, title, description, severity, owner, detectedAt }
InsightSignal     { label, value, detail, state }
ReleaseHealth     { version, status, ratingDelta, complaintDelta, rollout, startedAt }
```

**When adding new domain types: add to `src/types/review.ts`. Never inline types in components.**

---

## Patterns & Conventions

### Feature Slice Rule
Each feature lives in `src/features/<name>/`. Structure:
```
features/<name>/
  components/    → UI components for this feature only
  data/          → mock data (temp, until Supabase connected)
  hooks/         → feature-specific hooks (if needed)
```
Cross-feature shared logic → `src/hooks/`, `src/lib/`, `src/utils/`.

### Data Layer (Current State → Target)
- **Now:** `review-service.ts` returns mock data from `mock-reviews.ts`
- **Target:** `review-service.ts` calls `getServiceClient()` and queries DB filtered by `workspace_id`
- **Pattern:** Pages/components never import mock data directly — always go through service → hook
- **Workspace lookup:** `getWorkspaceId(clerkUserId)` via `workspace_members` join

### Component Rules
- Server Components by default (no `"use client"` unless needed)
- `"use client"` required for: Zustand store, React Query hooks, event handlers
- shadcn/ui components in `src/components/ui/` — never modify these files
- New shared components → `src/components/`
- Feature-specific components → `src/features/<name>/components/`

### State Rules
- **Zustand (`use-workspace-store`)**: workspace-level UI state only (selected app, environment)
- **React Query**: all server/async data (reviews, incidents, releases)
- No prop-drilling past 2 levels — use store or query

### Styling
- Tailwind only — no inline styles, no CSS modules
- `cn()` from `@/lib/utils` for conditional classes
- Use CSS design tokens (`--rb-*`, `bg-surface`, `text-fg-*`) not raw hex values
- shadcn/ui base color: slate, CSS variables enabled
- Brand blue `#0A84FF` is the only hardcoded color allowed in non-token contexts

### File Naming
- Components: PascalCase file + named export (`ReviewQueue.tsx` → `export function ReviewQueue`)
  - **Exception:** Next.js conventions use kebab-case file names (current project does this — keep it)
- Hooks: `use-<name>.ts` with `use<Name>()` export
- Services: `<noun>-service.ts` with verb functions (`listX`, `getX`, `createX`, `updateX`, `deleteX`)
- Types: noun-first (`AppReview` not `ReviewApp`)

---

## Platform Scope

Target stores:
- **Google Play** (Android) — current mock data uses this
- **Apple App Store** (iOS) — to be added

`AppReview.source` field already typed as `"Google Play" | "App Store"`.
When adding App Store: extend mock data + service layer, not the type.

---

## Environment Variables

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=           ✅ Set
NEXT_PUBLIC_SUPABASE_ANON_KEY=      ✅ Set
SUPABASE_SERVICE_ROLE_KEY=          ✅ Set
SUPABASE_DB_POOLER_URL=             🔲 Not set — Supabase → Settings → Database → Transaction mode (port 6543)

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=  ✅ Set
CLERK_SECRET_KEY=                   ✅ Set
NEXT_PUBLIC_CLERK_SIGN_IN_URL=      ✅ /sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=      ✅ /sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL= ✅ /dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL= ⚠️ /onboarding — change to /dashboard before launch

# AI
GROQ_API_KEY=                       ✅ Set
GEMINI_API_KEY=                     ✅ Set

# Redis
UPSTASH_REDIS_REST_URL=             ✅ Set
UPSTASH_REDIS_REST_TOKEN=           ✅ Set

# Email
RESEND_API_KEY=                     ✅ Set

# Stripe — fill in before M2 (see docs/STRIPE_SETUP.md + docs/STRIPE_LEGAL_CHECKLIST.md)
STRIPE_SECRET_KEY=                  🔲 Not set
STRIPE_WEBHOOK_SECRET=              🔲 Not set
STRIPE_PRICE_STARTER=               🔲 Not set — $49/mo USD
STRIPE_PRICE_PRO=                   🔲 Not set — $129/mo USD (Team plan removed; Enterprise is quote-only, no price ID)
STRIPE_PRICE_STARTER_ANNUAL=        🔲 Not set — $468/yr USD (= $39/mo)
STRIPE_PRICE_PRO_ANNUAL=            🔲 Not set — $1188/yr USD (= $99/mo)

# Google Play (service account — already working)
GOOGLE_CLIENT_EMAIL=                ✅ Set
GOOGLE_PRIVATE_KEY=                 ✅ Set

# App
NEXT_PUBLIC_APP_URL=                ⚠️ localhost:3000 locally — must be https://tryreviewbox.com in production
ADMIN_CLERK_USER_ID=                🔲 Not set — Clerk dashboard → Users → your user ID
```

`getServiceClient()` uses `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS) — server-side only.
`getSupabaseClient()` uses anon key — safe for client-side queries with RLS.

---

## Current Build Status

> ### ⚠️ What ✅ means in the tables below — read before trusting one
>
> **✅ means "the code exists, compiles, and its unit tests pass." It does NOT
> mean a human has watched it work.** Those are different claims, and this
> project has paid for confusing them four separate times:
>
> - **CI ran zero times.** The workflow triggers were filtered to `main`; this
>   repo's default branch is `master` and no `main` has ever existed. So it ran
>   **zero times across 45 branches and every merged PR** — "CI is green"
>   throughout these docs was never an observed fact (see `ci.yml`'s header).
> - **136 green tests defended a bug.** A `CHECK` constraint rejected `free` and
>   `enterprise` while the app wrote both, so **no trial had ever expired**.
>   TypeScript cannot see a SQL constraint (PR #97).
> - **The deploy job reported success while shipping a broken bundle.** Every
>   page answered `{"errors":[{"message":"Invalid host"}]}` because a CI
>   placeholder Clerk key was inlined at build time (PR #94).
> - **"E2E tests (advisory)" is green while executing zero specs.** Still true
>   today; `src/ci-contract.test.ts` now fails if this document claims otherwise.
>
> The only artefact tracking the stronger claim is **`docs/SPINE.md`**, whose rule
> is *"Done means a human walked this step against a REAL app and watched it
> work."* It is **0 of 8**. Read SPINE.md to learn whether the product works;
> read below to learn whether the code is present.
>
> **Do not promote a row here to ✅ on a passing test suite alone** — say what was
> verified and how.

### Frontend
| Feature | Status |
|---|---|
| App shell — sidebar, topnav, page-header | ✅ Done |
| Sidebar — collapsible groups, app selector, AI triage panel | ✅ Done |
| Dashboard — KPI metrics + sparklines + apps overview | ✅ Done (real data) |
| Review queue — card layout, priority borders, AI draft dialog | ✅ Done (real data) |
| Incident list — severity borders, status badges | ✅ Done (real data) |
| Incident detail — status actions, timeline | ✅ Done (real data) |
| Release health table — rollout bars | ✅ Done |
| Release detail — rating dist, issue tags, reviews per version | ✅ Done (real data) |
| Sentiment screen — trend chart + topic breakdown + AI recluster | ✅ Done (real data) |
| Competitors screen — benchmark table + sparklines | ✅ Done (real data via `/api/competitors`) |
| ASO screen — keyword rank tracker + AI suggestions panel | ✅ Done (real data) |
| Reports screen — report cards + Send now | ✅ Done — `/api/reports/send-now` (user-scoped, rate-limited) |
| Onboarding wizard — 5-step (workspace → app search → brand voice → connect → ready) | ✅ Done — theme-aware light/dark |
| Settings UI — alerts, profile, billing | ✅ Done |
| Landing page — Apple-style light design | ✅ Done |
| Sign-in / Sign-up — light theme, Clerk appearance API | ✅ Done |
| Email templates — weekly digest + rating spike HTML | ✅ Done |
| Automations — rule builder UI | ✅ Done |
| Reply Kit — AI styles + templates + knowledge base | ✅ Done |
| Billing page — plan cards + trial expiry banner | ✅ Done |

### Backend — partially done
| Feature | Status |
|---|---|
| Clerk auth — installed, middleware, sign-in/sign-up | ✅ Done |
| Supabase schema + RLS policies | ✅ Done |
| pg_cron extension enabled | ✅ Done |
| Groq AI reply generation — 3-tier: template → cache → Groq | ✅ Done |
| Rules engine — zero-API tags/sentiment/priority/escalation | ✅ Done |
| Reply cache — Redis SHA-256 key, 7d TTL | ✅ Done |
| Prompt compression — 30 filler phrases stripped, 73% token reduction | ✅ Done |
| Gemini sentiment analysis — batch, ambiguous-only, rules fallback | ✅ Done |
| Gemini ASO keyword suggestions — Redis 24h cache | ✅ Done |
| Email send functions (welcome, trial, payment-failed) | ✅ Done |
| Upstash Redis rate limiting | ✅ Done |
| Stripe billing routes (checkout, portal, webhook) | ✅ Routes exist — 🔲 keys not set |
| GDPR export + delete routes | ✅ Routes exist |
| Service layer wired to Supabase (reviews, metrics, apps) | ✅ Done |
| Dashboard apps panel wired to real `/api/apps` | ✅ Done |
| Welcome email fired from `/api/onboarding/complete` | ✅ Done |
| Google Play review sync (fetch → upsert Supabase) | ✅ Done |
| Vercel Cron sync worker (every 4h) | ✅ Done |
| Rating spike detection → `send-rating-spike-alert` email | ✅ Done |
| Reply submission to Google Play API | ✅ Done |
| Reply submission to App Store Connect API | ✅ Done |
| Apple App Store review sync | ✅ Done |
| DB→AppReview mapping fix (snake_case, source, createdAt) | ✅ Done |
| Automation executor (evaluate rules, auto-draft after sync) | ✅ Done |
| Onboarding → demo mode banner + first-visit modal | ✅ Done |
| PostHog analytics | ✅ Done |
| Sentry error monitoring | ✅ Done |
| Admin panel wired to real customer data | ✅ Done — overview KPIs, customer detail, support tickets (needs migration 017) |
| Security audit + RLS verification | ✅ Done (3 passes: 2026-05-21 + 2026-05-25 round-1/2 + 2026-05-26 cross-verify — 44+ fixes) |
| Next.js 15 → 16 upgrade | 🔲 When stable |
| Unit test suite (Vitest) | ✅ Done — 649 tests across 63 files, CI-gated. Node env, pure functions only (no React Testing Library) |
| CI pipeline (tsc, lint, vitest, e2e, audit) | ✅ Done — `.github/workflows/ci.yml` |
| Launch checklist | ✅ `docs/LAUNCH_CHECKLIST.md` (80+ items) |
| App Store / Google Play search during onboarding | ✅ Done — `/api/onboarding/search-app` |

---

## Product Properties

| Property | URL | Purpose | Tool |
|---|---|---|---|
| **Main App** | app.tryreviewbox.com | The SaaS dashboard | Build (this repo) |
| **Marketing Website** | tryreviewbox.com | Acquisition + pricing + trust | Build (this repo `/`) |
| **Help Center** | help.tryreviewbox.com | Support deflection, onboarding docs | Mintlify free or Notion public |
| **Status Page** | status.tryreviewbox.com | Uptime transparency | BetterStack free |
| **Admin Panel** | app.tryreviewbox.com/admin | Manage customers, debug, MRR | Build (this repo `/admin`) |
| **Changelog** | tryreviewbox.com/changelog | Ship updates publicly, build trust | Simple MDX page or Beehiiv embed |

---

## Milestone Map

### M0 — House in Order *(current)*
> **Goal:** Nothing embarrasses you if someone lands today. Target: 1–3 days.

#### Sprint S0.1 — Config & Cleanup
- [x] Fix `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` → `/dashboard`
- [x] Fix `revi.app` → `tryreviewbox.com` in email templates (`weekly-digest.html`, `rating-spike-alert.html`)
- [x] Fix `revi.app` fallback in `src/app/sitemap.ts` and `src/app/robots.ts`
- [x] Fix `support@revi.app` → `hello@tryreviewbox.com` in `mock-reply-kit.ts`
- [x] Remove dead env keys (`ANTHROPIC_API_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) from `.env.local`
- [x] Set `ADMIN_CLERK_USER_ID` in `.env.local`
- [x] Set `SUPABASE_DB_POOLER_URL` in `.env.local`
- [x] Fix typo `STRIPE_PRICE_TEAM=q ` in `.env.local`
- [x] Update `.env.example` — flip default `AFTER_SIGN_UP_URL` to `/dashboard`, remove dead keys
- [x] Update `Walkthrough.md` — `hello@revi.app` → `hello@tryreviewbox.com`

#### Sprint S0.2 — Observability
- [ ] Install Sentry (`@sentry/nextjs`) — free 5K errors/month
- [ ] Install PostHog (`posthog-js`) — free 1M events/month
- [ ] Verify domain in Resend for `hello@tryreviewbox.com`

#### Sprint S0.3 — Onboarding UX
- [ ] Replace blocking 8-step wizard with first-visit modal (workspace name + app name only, 2 fields)
- [ ] Auto-generate workspace URL slug from name
- [ ] Add demo mode banner to sidebar (`DemoModeBanner` component)
- [ ] Sign-up → Dashboard → modal fires on first load (check Clerk `publicMetadata.onboarded`)

---

### M1 — Real Product
> **Goal:** User signs up, connects Google Play, sees their actual reviews. Target: 1–2 weeks.

#### Sprint S1.1 — Review Data Pipeline
- [x] Wire `review-service.ts` to Supabase (drop mock fallback)
- [x] `GET /api/reviews` — confirms filters work with real workspace data (already had Supabase query)
- [x] Dashboard — replace `MOCK_APPS` with real `useApps()` hook → `/api/apps`
- [x] `/api/apps` — sidebar app selector queries Supabase (was already wired)

#### Sprint S1.2 — Google Play Sync
- [x] Create `POST /api/sync/reviews` route — fetch from `publisher-api.ts` → `enrichReview()` → upsert Supabase
- [x] `vercel.json` — cron `0 */4 * * *` → `/api/sync/reviews`
- [x] `enrichReview()` runs on every synced review (tags, sentiment, priority — zero tokens)
- [x] Rating spike detection (≥5 reviews rated ≤2 same version in 24h) → `send-rating-spike-alert`
- [x] Welcome email fires from `/api/onboarding/complete` on workspace creation

#### Sprint S1.3 — Help Center
- [ ] Create 4 Mintlify / Notion pages: Getting Started · Connect Google Play · AI Replies · FAQ
- [ ] Configure `help.tryreviewbox.com` CNAME

---

### M2 — First Dollar
> **Goal:** Stripe live, someone pays, admin panel shows it. Target: 2–4 weeks after M1.

#### Sprint S2.1 — Billing Live
- [ ] Create plans in Stripe dashboard (Starter / Pro / Team), fill price IDs in `.env`
- [ ] Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- [ ] Test checkout → webhook → Supabase subscription record end-to-end
- [ ] Upgrade prompt on gated features (automations, reply-kit) for free/trial users

#### Sprint S2.2 — Reply Submission
- [ ] "Publish reply" button in review card → `POST /api/reviews/[id]/reply` → Google Play API
- [ ] Update `replyStatus` in Supabase on success (`needs_reply` → `replied`)
- [ ] Show reply in review card after publish

#### Sprint S2.3 — Email Sequences (automated)
- [ ] Trial day 1: welcome + quick-start checklist (fire from onboarding complete)
- [ ] Trial day 5: "You have X unread reviews" — real count from Supabase
- [ ] Trial day 12: "2 days left" conversion push
- [ ] Post-upgrade confirmation email

#### Sprint S2.4 — Admin Panel
- [ ] `/admin/customers` — query `workspaces` + `workspace_members` + Stripe subscription status
- [ ] `/admin/analytics` — signups/week, MRR, active workspaces, AI call volume

---

### M3 — Retention Engine
> **Goal:** Users come back weekly without manual effort. Target: 6–8 weeks after M2.

#### Sprint S3.1 — Automated Touchpoints
- [ ] Weekly digest email — Vercel Cron (Mondays 9am) → per-workspace stats from Supabase
- [ ] "Unreplied for 48h" reminder email — cron daily, query unreplied reviews > 48h
- [ ] Incident auto-detection — ≥3 crash reviews same version in 24h → create incident + alert

#### Sprint S3.2 — Automations Live
- [ ] Automation rule executor — evaluate saved rules against new reviews on each sync
- [ ] Auto-draft: rule match → call `/api/reply/draft` → save as `draft_ready`
- [ ] Auto-reply: opt-in per workspace → publish without human approval

#### Sprint S3.3 — Apple App Store
- [ ] App Store Connect API integration (`src/services/app-store/`)
- [ ] Extend review sync cron to include App Store apps
- [ ] Map App Store review fields to `AppReview` type

#### Sprint S3.4 — Product Polish
- [x] Competitors screen — real data (manual competitor add → fetch public store rating)
- [ ] Reports — scheduled PDF/email export (weekly/monthly)
- [ ] Status page live on BetterStack, linked in app footer + settings

---

### M4 — Growth
> **Goal:** Users bring other users. Founder stops doing things manually. Target: 3+ months.

#### Sprint S4.1 — Virality
- [ ] Referral: "invite a colleague → 1 month free" (Clerk invite link + Stripe coupon)
- [ ] Public changelog page (`/changelog`) — MDX, update on every release
- [ ] Product Hunt + G2 listing

#### Sprint S4.2 — Power Users
- [ ] Public API with API key management (developer customers)
- [ ] Zapier / Make webhook output (pipe review events anywhere)
- [ ] Slack integration — critical review → Slack DM

#### Sprint S4.3 — Scale
- [ ] Multi-app workspace fully tested end-to-end
- [ ] Team invite flow verified (UI exists, not tested)
- [ ] Usage analytics per workspace in admin (AI calls, reply rates, login frequency)
- [ ] Evaluate Next.js 16 upgrade when stable

---

## Automation Roadmap

| Task | Manual Now | Automated By |
|---|---|---|
| Review sync | Nothing | M1 — Vercel Cron every 4h |
| AI triage (tags, priority, sentiment) | On demand | M1 — fires on every sync batch |
| Rating spike detection | Nothing | M1 — on every sync |
| Welcome email | Nothing | M1 — fires from onboarding complete |
| Reply drafts | User clicks | M2 — auto-drafted for high-priority (opt-in) |
| Auto-reply (template match) | Never | M3 — opt-in per workspace |
| Trial email sequence | Nothing | M2 — Resend + Vercel Cron |
| Weekly digest | Nothing | M3 — Cron every Monday |
| Unreplied reminder | Nothing | M3 — Cron daily |
| Incident creation | Manual | M3 — auto from crash cluster |
| Churn detection | Nothing | M3 — PostHog "no login 7d" cohort |
| Customer support | Founder replies | M1 — Help center deflects ~60% |

---

## Current Sprint

**Active: SPINE — the 8-step launch walk (backlog ICE 100, D022 puts it ahead
of the Issue Intelligence epic)**
Last updated: 2026-08-19. Master `53001d4`: `tsc` clean, **649 unit tests in 63
files**. Read `docs/today.md` first — it carries the current narrative.

**The bottleneck is not code any more, it is verification.** `docs/SPINE.md`
defines the eight steps that decide whether the product works for a customer, and
**zero of the eight have ever been marked verified** in the eleven weeks since it
was written. Its two blocking defects were fixed on 2026-08-19 (PR #131) and are
locked in by `src/spine-draft-mode-contract.test.ts`, so nothing in the repo
blocks the walk. Nothing in the repo can complete it either — it needs a human,
a real app, and a real store listing.

Founder-blocking behind it: **W5A** (review-volume limit, ADR waiting at
`docs/adr/009-review-volume-limit.md`) which gates Stripe; **`ADMIN_CLERK_USER_ID`**
in Vercel production, without which `/api/admin/probe/stores` 403s because
`requireAdminUser()` is fail-closed; and the **Slack sub-processor disclosure** —
`/sub-processors` lists ten processors and omits Slack while `src/lib/slack.ts:198`
sends a reviewer's name and a 120-char review snippet there. D009 point 9 forbids
an agent editing legal pages, so only the founder can close that one.

### ⚠️ Read this before touching the dashboard

`src/app/(app)/dashboard/page.tsx` has been corrupted by overlapping merges
**three times** (PR #68's merge, PR #69's merge, and the manual resolution just
before #72 merged). Every time it is the same damage: `SyncBanners`' JSX runs
into an orphaned `WorkspaceStatusStrip` fragment, which fails `tsc` and takes
the whole production deploy down with it — master shipped nothing for hours
because of this. The canonical shape is ONE component,
`SyncBanners({ apps, onRetry, onConnectPlayConsole })`, per-app banners, and
**no `WorkspaceStatusStrip` anywhere in the file**. If you resolve a conflict
here, run `npx tsc --noEmit` before pushing — every time.

**2026-08-16: `src/features/reviews/components/review-queue.tsx` joined the
club.** PR #87 was merged with red checks after a GitHub "Update branch"
auto-merge mangled a one-line conflict into ~40 JSX syntax errors, breaking
master. If two branches touch this file, do the three-way merge locally
(`git merge-file --diff3`), resolve by hand, and never merge a PR whose
Build + type-check is red — the check being red IS the conflict detector.

**2026-08-16 (later, the FIFTH dashboard mangling): PRs #90 and #91 both
rewrote `PortfolioSparkline` in parallel.** The "Update branch" auto-merge
fused the two function bodies (unclosed div, dead `tsc`), #91 was merged
about a minute after opening — before CI could turn red — and every
production deploy failed until the repair commit. Two lessons on top of the
standing one: (a) with previews disabled there is no second net, wait for CI
before merging; (b) if the dashboard hero/sparkline needs changing, check
open PRs for a competing rewrite first. Note the strip note above is stale:
since PR #88-era the canonical shape IS one `WorkspaceStatusStrip` rendered
once (see the comment inside the component) — trust the in-file comment over
this section when they disagree.

**2026-08-17, the SIXTH: "Update branch" on PR #92.** Not two PRs racing this
time — one PR pulling master in. Master had repaired the fifth mangling itself
(`2ea42cc`) while #92 carried its own repair of the same broken base, so git
fused two independent fixes for the SAME bug. Three checks went red.
`src/lib/reply-cache.ts` fused the same way in the same merge: both sides had
independently closed the cross-tenant cache leak.

**The pattern to internalise: two fixes for one bug collide worse than two
features.** Each side is green alone — that is precisely why nobody catches it
until the merge. When a bug is being fixed on more than one branch, expect the
merge to be manual, and check master for an existing repair before writing
yours. Resolution rule that worked twice now: take ONE side's file whole,
never hand-blend the two.

### Open PRs

Check GitHub rather than trusting this line — several sessions run in parallel
and it goes stale within hours. As of 2026-08-19 09:20Z only **#133** (this
documentation pass) was open; #92–#132 are merged or closed.

⚠️ **`git branch -r` in a fresh session may list only the few refs the clone
fetched.** Run `git fetch origin --prune` before concluding that a fix "exists
in no branch" — this repo has 80+ remote refs, and on 2026-08-19 that mistake
produced a confident, wrong claim that two already-merged composer fixes did not
exist anywhere.

### ⚠️ Two error codes mean "column missing", not one

PostgREST reports it differently depending on direction:

| | error | raised by |
|---|---|---|
| **read** — `.select("col")`, `.eq("col", …)` | `42703` | Postgres |
| **write** — `.insert({col})`, `.update({col})` | `PGRST204` | PostgREST, before Postgres sees it |

Every pending-migration fallback in this repo was originally written against
`42703` alone, so on the write path **none of them had ever been reachable** —
which is how onboarding 500'd for every new signup on 2026-08-16.

Never compare the code directly. Use `isMissingColumnError()` from
`@/lib/db-errors`, and `writeWithOptionalColumns()` for a write whose payload
contains columns behind a migration. Backlog **LT1** tracks the remaining sweep.

### ⚠️ The two stores authenticate differently — don't conflate them

`apps.has_credentials` is `!!(access_token && refresh_token)`: the **App
Store's** per-app `.p8` key pair. Google Play never writes those columns — its
auth is the workspace service account, recorded in `publisher_api_connected`.
Asking `has_credentials` about a Play app is permanently false, which is how
every Android customer was denied one-click reply posting while the server
happily supported it. Use `canPostRepliesViaApi()` from `@/lib/sync-status`.

Likewise `last_sync_status`: `credentials_verified` is a **healthy** value, not
a failure. `status !== "success"` marked an app broken the moment its
connection was verified. Use `isSyncFailureStatus()`.

### ⚠️ `syncWorkspace()` is the only way to run a sync

Four triggers reach it (daily cron, "Sync now", the dashboard self-heal kick,
onboarding / app-create), so it holds a per-workspace Redis lock —
`withWorkspaceSyncLock()` in `src/lib/sync-lock.ts`. The unlocked body is the
private `syncWorkspaceApps()` and is deliberately **not exported**: adding a
fifth trigger must not be able to bypass the lock. A declined run returns
`skipped: "already_running"`, which is **not** an error — don't push it into
`summary.errors` or surface it as a red banner.

The lock **fails open** when Redis is unreachable. That is correct for
everything the sync does today, and it is why AS1 shipping does **not** on its
own make `auto_reply` safe to add to `SELECTABLE_AUTOMATION_ACTIONS` —
publishing to a live store listing needs an answer for "what happens when
Redis is down". See `docs/adr/009-review-volume-limit.md`'s sibling reasoning
and the module header.

Read the module header before "simplifying" the release path: it uses a Lua
compare-and-delete, not `DEL`, because a run that overran its TTL would
otherwise delete the *next* holder's lock and cause the exact race the lock
exists to prevent.

### "E2E tests (advisory)" — green, but it currently runs NOTHING

**Do not read this check as evidence your change works.** Every spec in both
`tests/e2e/*.spec.ts` is **skipped** on every CI run today. The job is green
because zero tests ran, not because anything passed.

This section previously claimed the opposite ("this check now passes, and a
failure is a real signal"). That was wrong, and is the same silent-success
class as the deploy job that reported success while deploying nothing — see
below. Corrected 2026-08-17 (audit finding H-8).

**Why it skips.** CI runs with `pk_test_Y2ktcGxhY2Vob2xkZXIuY2xlcmsuYWNjb3VudHMuZGV2JA==`,
which is *structurally* valid (it base64-decodes, so Clerk's provider can parse
it) but decodes to `ci-placeholder.clerk.accounts.dev$` — an instance that does
not exist. Clerk answers "Invalid host", so every route serves the error page
and even the public smoke tests fail. `tests/e2e/clerk-env.ts` therefore skips
the whole suite when it detects a placeholder, and both spec files call
`test.skip(clerkKeyIsPlaceholder, …)` at module scope.

**Skipping is the right call** — a check that is red on every commit, including
documentation-only ones, trains everyone to ignore it, so the day it goes red
for a real reason nobody looks. The defect was never the skip; it was claiming
the skip was a pass.

**To make it real** (≈10 minutes, HUMAN-REQUIRED): create a Clerk *development*
instance for CI, put its publishable + secret keys in GitHub → Settings →
Secrets and variables → Actions, and reference them in the `e2e-tests` job's
`env:` block. `clerkKeyIsPlaceholder()` then returns false and the specs run.
Tracked as BUG-037.

**This claim is now enforced.** `src/ci-contract.test.ts` runs in the *blocking*
unit-tests job, reads the Clerk key out of `ci.yml`, and fails if this file
claims the suite runs while CI still uses a placeholder — in either direction.
The documentation cannot silently drift from the pipeline again.

⚠️ **The same PR fixed a far more serious bug — read this before touching
`ci.yml`.** Those placeholders used to sit in a workflow-level `env:` block,
which applies to *every* job including `deploy-production`. `NEXT_PUBLIC_*`
values are inlined into the browser bundle at **build** time, and a variable
already in the process environment beats whatever `vercel pull` writes to
`.vercel/.env.production.local`. So `vercel build --prod` compiled the real
production bundle with the CI placeholder Clerk key, and every page on
app.tryreviewbox.com answered `{"errors":[{"message":"Invalid host"}]}` —
while the deploy job reported **success**, because it deployed exactly what it
was told to.

**Rule: any job that deploys must inherit no build-time app config from CI.**
Placeholders belong only to jobs that compile or run the app for tests, which
is why each such job now carries its own copy. Never hoist them back up to the
workflow level to remove the duplication.

`deploy-production` was removed on 2026-08-19 (see the Vercel section below),
so **this rule currently guards nothing** — which is exactly why it is worth
keeping and exactly why it will be tempting to undo. The duplication looks
gratuitous with no deploy job in the file. It is the precondition for ever
adding one back safely.

### Design-system notes

- `--rb-fg-4` measures **2.15:1** on a light surface — below the 3.0 floor even
  for large text. Use it for decoration only (icons, dashes, ghost affordances),
  never for content. Darkening the token enough to pass collapses it into
  `--rb-fg-3`, so the value is left alone pending a founder call.
- The dangerous pattern to watch for is a **hardcoded colour paired with a token
  colour** — e.g. `bg-[#F5F5F7]` with `text-[var(--rb-fg-1)]`. That reads fine in
  light mode and renders invisible text in dark (this is exactly how the Google
  Play modal's service-account email disappeared).
- The sidebar app selector stores the app **ID**. Resolve it with
  `resolveSelectedApp()` from `src/lib/selected-app.ts` — never by name.
- **Border weights are semantic, not decorative.** `--rb-border-1` (6% white in
  dark) is a *divider* — card edges, row separators. Putting it on something
  interactive makes the element vanish on a dark surface: a form field stops
  reading as a field, an outline button stops reading as a button. Use
  `--rb-border-2` for inputs and `--rb-border-3` for interactive elements. Two
  of the three plan CTAs on Billing looked disabled because of this, and it
  passed every contrast check — the failure was affordance, not legibility, so
  only rendering the screen caught it.

### What shipped 2026-05-29

**`fix/metadata-scrape-cache`** — Redis caching for store metadata scrapes.
- `fetchGooglePlayMetadata()` and `fetchAppStoreMetadata()` now check Redis first (keys `meta:gplay:{id}` / `meta:appstore:{id}`, 6h TTL) before hitting the store.
- Eliminates redundant scrapes across onboarding search → onboarding/complete → daily sync.
- Best-effort: Redis errors fall through to live scrape transparently.

**`fix/reply-ux-and-onboarding-skip`** — 3 user-facing friction fixes:
- Draft save was fire-and-forget (no feedback). Now shows "Saving…" → "✓ Saved", updates cache to `draft_ready`, handles errors silently.
- Credential errors (`APP_STORE_NOT_CONNECTED`, `GOOGLE_PLAY_NOT_CONFIGURED`) now stay visible with "Set up in Settings →" link instead of auto-clearing in 4s.
- Onboarding step 3 heading reframed from "One thing before reviews can sync" (implied blocking) to "Connect X to sync reviews". Primary CTA changed to "I've done this — launch workspace". Added "I'll connect later" text link so non-technical users aren't blocked.

**`docs/DESIGN_SYSTEM_AUDIT.md`** — Comprehensive design system audit:
- 4 critical issues, 3 medium, 2 low. See `docs/DESIGN_SYSTEM_AUDIT.md` for full findings.
- Biggest gap: 1,095 raw `gray-*` usages across 69 files instead of `--rb-*` tokens. 47 tokens defined but rarely used.
- Quick win: add `--rb-indigo-*` tokens (10 min) — unblocks 40 hardcoded `#5B5BD6` values in Reply Kit + Automations.

### What shipped 2026-05-26 (branch `fix/audit-round-3`)

**Cross-verification audit — 9 fixes:**
- `trial-nudge` `isAuthorized()` fail-closed (C-02)
- Slug regex minimum 3 chars (H-01)
- Dedup key before email send in trial-nudge (H-02)
- Invite email checks all addresses not just `[0]` (H-03)
- Server-side reply char limit → `REPLY_TOO_LONG` (H-05)
- GDPR export `GET` removed — CSRF vector (H-06)
- Export `days` param clamped 1-365 (M-01)
- PostgREST `.or()` search sanitized (C-03)
- `notifyWorkspaceOwner` `.single()` → `.maybeSingle()` (M-03)

### Up next (per backlog NOW)

1. Merge 6 open PRs (founder action, in order listed above)
2. Trigger manual sync after first two merges
3. **N6** — Stripe test keys + upgrade flow (HUMAN-REQUIRED). ICE 80.
4. **DS1** — Add `--rb-indigo-500/600` tokens to `globals.css` (10 min, unblocks Reply Kit design debt)
5. **DS4** — Replace 86 raw `<button>` in review-queue + aso-screen with `<Button>` (accessibility)

### Completed (2026-05-19 → 2026-05-22)

**Codebase audit + bug fixes** (now merged to master via `claude/aso-mining`):
- ✅ Full codebase audit — 27 bugs found across 5 BLOCKER / 10 HIGH / 6 MEDIUM
- ✅ All BLOCKERs fixed:
  - `supabase-server.ts` was using Postgres pooler URL with supabase-js (wrong API). Now uses HTTPS REST URL only
  - `aso_keywords` table schema mismatch — recreated with correct columns via SQL migration
  - `automation_rules.action_label` column added
  - `alert_preferences` schema aligned (`channels`, `schedule_day_of_week`, `schedule_day_of_month`)
  - `/api/aso/suggest` was querying non-existent `reviews.text` and `apps.description` — fixed to use `body` and skip non-existent
- ✅ All HIGH fixes:
  - Removed fake fallback metrics from `useDashboardMetrics` (was showing hardcoded `127 unreplied / 9 urgent / 2764 total` on errors)
  - Removed mock-review fallback from `/api/reviews` (was hiding real failures with seeded data)
  - Added `"use client"` to `src/hooks/use-incidents.ts`
  - `/api/incidents` GET returns empty array (not 404) when user has no workspace
  - Deleted `/api/sentry-example-api` (always-500 test route)
  - `/api/demo/reply` uses Upstash Redis rate limiting (in-memory Map was useless on serverless)
  - Stripe webhook uses `getServiceClient()` singleton (was creating fresh client per webhook)
  - `/api/reviews/[id]/reply` rejects if workspace soft-deleted
  - `/api/onboarding/complete` validates slug format server-side
- ✅ All MEDIUM fixes:
  - CSV export includes `X-Total-Count` / `X-Truncated` headers and `totalMatching` in JSON
  - `session.reload()` wrapped in try/catch on onboarding page
  - `BYPASS_AUTH` env var removed (was test-only)
  - Stripe checkout caches `stripe_customer_id` on workspace
  - Weekly digest cron now processes workspaces in parallel batches of 10
  - `/api/health` actually pings Supabase, returns 503 on failure

**DB migrations applied 2026-08-17** (founder ran, verified by query):
- `025_plan_vocabulary_reconcile` — constraint now allows `free`…`canceled`
- `026_drop_superseded_alert_columns` — the four dead `alert_preferences` columns are gone
- `027_rls_identity_reconcile` — verified: **zero** policies mention `auth.uid()`
- `028_tenant_columns_not_null` — verified: all nine tenant columns report `is_nullable = NO`
- `029_repair_blank_replies` — Section A ran; **the diagnostic returned zero rows**, so
  no review was ever stored as `replied` with blank text. Nothing needed repairing and
  Section B is moot. Don't re-run it looking for something to fix.
- `030_pending_invite_uniqueness` — verified: `workspace_invites_one_pending_idx`
  exists, no duplicates were found so nothing was skipped. **A second pending
  invite to the same address now raises 23505**, which `/api/team/invites` POST
  turns into a 409 with a readable sentence. If you add another write path to
  `workspace_invites`, handle that code — it is a race between two admins doing
  something reasonable, not a server fault.

All 12 insert/upsert sites on the tables 028 constrains were checked to set
`workspace_id` before it was applied. A new insert path on `apps`, `reviews`,
`automation_rules`, `reply_templates`, `knowledge_base`, `ai_usage`, `incidents`
or `alert_preferences` that omits `workspace_id` (or `reviews.app_id`) will now
fail at the database instead of silently creating a tenant-less row — that is
the point, but it means the error is a bug in the new code, not in the schema.

**DB migration applied 2026-05-21** (founder ran):
- `supabase/migrations/007_aso_keywords.sql` (correct schema: `volume_estimate INT`, `trend_data INT[]`, `added_at`, `updated_at`)
- `automation_rules.action_label TEXT` column
- `alert_preferences` new columns: `label`, `description`, `channels JSONB`, `schedule_day_of_week`, `schedule_day_of_month`
- Plus pending migrations 007_workspace_brand_voice, 008–011

**Onboarding 500 + loop fixes** (merged):
- `/api/onboarding/complete` defensive fallback: catches Postgres error 42703 (column doesn't exist) and retries insert without `brand_voice`/`app_category` so onboarding works even before migrations are applied
- `/api/onboarding/state` replaced PostgREST embedded join with two separate queries
- Middleware: removed `onboarded && /onboarding → /dashboard` redirect that caused infinite loops with stale JWTs
- Sentry edge auto-instrumentation disabled in `next.config.ts` — was crashing middleware on Vercel previews
- Single `auth.protect()` call in middleware (was calling `auth()` twice)
- `session.reload()` before navigating to /dashboard after completion

**Picture-perfect polish** (current branch `claude/picture-perfect`):
- ✅ Dead code removed: `src/features/onboarding/components/onboarding-wizard.tsx`, `src/features/reviews/data/mock-reviews.ts`
- ✅ Real dashboard metrics: `ratingTrend`, `reviewsWeekDelta`, `avgRatingDelta` computed from DB. Hardcoded `+18%` / `+0.31` / fake sparkline data removed
- ✅ `appCategory` captured in onboarding Step 2 → wired to `/api/onboarding/complete` → `brand_voice` pre-fill now actually fires
- ✅ `next.config.ts` `ignoreBuildErrors` + `ignoreDuringBuilds` removed (CI catches them)
- ✅ Sentry on `(app)/error.tsx` boundary
- ✅ Loading skeletons added for 7 routes: sentiment, aso, reports, settings, billing, releases, reply-kit, competitors
- ✅ 404 page: `#5B5BD6` → `#0A84FF`, two CTAs (home + open app)
- ✅ Test suite: 70 tests across rules-engine, reply-composer, workspace-persona, prompt-utils, templates, slack, api-response, plans, store-search
- ✅ `docs/LAUNCH_CHECKLIST.md` — comprehensive 80+ item pre-launch checklist
- ✅ Sign-in/sign-up pages: server-side redirect to /dashboard if already signed in (was rendering empty form)
- ✅ **Onboarding refactor — AppFollow-style app search**:
  - `src/services/store-search.ts` — `searchAppStore()` via iTunes Search API, `searchGooglePlay()` via HTML scrape
  - `/api/onboarding/search-app` route — rate-limited 30/min, returns `{ results, searchFailed? }`
  - Onboarding Step 2 redesigned: platform → search box → live results → click to pick. Manual entry fallback toggle.
  - Selected app shown as confirmation pill on Step 3
  - Back buttons on Steps 2 + 3
- ✅ **Onboarding loop fix (2026-05-22)** — see "Known Issues" below
  - `/api/onboarding/complete` now sets `rb_onboarded=1` cookie (5min TTL)
  - Middleware honors the cookie even if Clerk JWT still says `onboarded=false`
  - `/api/onboarding/state` now returns `onboarded=true` if DB has workspace+app (DB is source of truth, not stale JWT)

### Next milestones (S1.3 — Help Center, then M2)

- [ ] Merge `claude/picture-perfect` PR
- [ ] Enable GitHub branch protection on `master` requiring CI to pass
- [ ] Run `docs/LAUNCH_CHECKLIST.md` end-to-end
- [ ] Create 4 help pages: Getting Started · Connect Google Play · AI Replies · FAQ
- [ ] Configure `help.tryreviewbox.com` CNAME (Mintlify or Notion public)
- [ ] M2: Stripe live (set `STRIPE_SECRET_KEY` + price IDs), test checkout end-to-end

---

## Known Issues (read before debugging)

### ⚠️ A route in NEITHER middleware matcher is served to Googlebot as a 404

`/robots.txt` and `/sitemap.xml` were absent from both `isPublicRoute` and
`isAppRoute`, and neither `.txt` nor `.xml` is in the `config.matcher`
extension-exclusion list — so both reached `auth.protect()`. A signed-out
visitor got a 404. **Googlebot is always a signed-out visitor**, so the site had
no robots.txt and no readable sitemap on any hostname, for months, while
`robots.ts` and `sitemap.ts` were correct and under test.

Two things generalise:

1. **A path in neither matcher does not error — it just stops working**, and
   only for people without a session. Every developer clicking around the site
   is signed in, so nothing looks wrong. This is the same failure that silently
   killed the `daily-digest` cron (see the `isPublicRoute` comments) and the
   AppFollow import, Competitors and Slack OAuth routes.
2. **Absent robots.txt means "crawl everything"**, not "crawl nothing". The
   404 was permissive, not protective.

`src/seo-indexing-contract.test.ts` now reads `middleware.ts` and fails if the
crawler paths leave the public matcher, or if `.txt`/`.xml` are ever added to
the extension exclusion.

**Related rule: `Disallow` and `noindex` cancel each other out.** Blocking a URL
in robots.txt stops Google crawling it, so it never sees the `noindex` or the
404 telling it to drop the page — the URL stays indexed, labelled "Indexed,
though blocked by robots.txt". To *remove* a page, leave it crawlable and let it
404/410. Only `Disallow` things that are already gone from the index —
`app.tryreviewbox.com` qualifies because Semrush shows it ranking for nothing.

**The app host's robots.txt is served from `middleware.ts`, not `robots.ts`.**
`next build` reports `/robots.txt` as `○ (Static)`: one prerendered body for
both hostnames, with no access to the Host header. A host-aware `robots.ts`
would be a coin flip over which host got the right file, and it 200s either way.

### ⚠️ Branch/preview deployments are intentionally DISABLED (2026-08-16, founder decision)

`vercel.json` carries an `ignoreCommand` that skips the build for every git
ref except `master`. Only master builds, straight to production. Why:

- Clerk isn't configured for preview URLs (backlog **LT2**), so previews could
  not be signed into and every fix was verified on production anyway.
- Preview builds queued ahead of production builds on the Hobby plan and
  spammed PRs with bot comments.
- Preview deployments were the fail-open risk surface flagged in
  `docs/ROLE_AUDIT.md` #6 (sync route authorizes when `CRON_SECRET` is unset
  outside production).

Consequences to respect:
- **CI green is the ONLY pre-merge gate. Never merge a PR while Build +
  type-check is red** — the red check is the conflict detector (see the
  dashboard-corruption warning above; #91 shipped a broken master exactly
  this way).
- The rollback lever is unchanged: Vercel → Deployments → previous green →
  Promote to Production.
- To re-enable previews: remove `ignoreCommand` from `vercel.json` AND do LT2
  first, or previews stay un-testable.

### ⚠️ Vercel's Git integration deploys master. CI does not.

There is **no deploy job in `ci.yml`** — removed 2026-08-19, founder's call.
Merging to master is what ships; Vercel builds it directly.

**Check the deploy, never infer it.** The Vercel MCP tools answer it in three
calls — `list_teams` → `list_deployments` → `get_deployment` gives state,
target and the alias list. `tryreviewbox.com` is blocked by the agent egress
proxy (403 on CONNECT), so curling the site is not an option; the API is. Do
not substitute a CI check for that, which is the whole point of what follows.

#### Why the job went, and what went with it

A CLI `deploy-production` job existed because Vercel's Git integration once
refused this repo: *"the commit author did not have contributing access · The
Hobby Plan does not support collaboration for **private** repositories"*. Note
"private" — the repo is public now, so the block lapsed and the integration
resumed on its own. Nothing updated the comment saying it hadn't.

Result: for two days the CLI job failed on a bad token scope and painted master
red, while the site shipped fine without it — and an agent (me) told the founder
seven merges were stuck in a queue that did not exist. That claim was inferred
from the red check and never once checked against Vercel. Verified afterwards:
`dpl_F8nMNiuuMogC8RiT7Mmu3VFqWvKw` (commit `0a4af8a`, the #127 merge) is
`READY`, `target: production`, `source: git`, aliased to **tryreviewbox.com,
www.tryreviewbox.com and app.tryreviewbox.com**. Every master merge from #123 on
is `READY` the same way; #120 and #121 are the only exceptions and they errored
at Vercel's own build because master was genuinely broken then.

Two things were genuinely lost with the job — know the trade:

1. **CI ordering.** It carried `needs: [build-and-typecheck, lint, unit-tests,
   security-audit]`, so a red master could not reach production. The Git
   integration has no such gate: it builds master whatever CI says. #120 and
   #121 reached Vercel broken and failed there rather than being held back.
   That was already the real behaviour while the CLI job was broken, but it is
   now the permanent one. **CI green is still the merge gate — but it is no
   longer a deploy gate.**
2. **The production-env guard.** A step refused to deploy if the pulled Clerk
   key was missing or still the CI placeholder — the check that would have
   caught the 2026-08-17 outage. That entire class of bug came *from* the CLI
   path (`vercel build --prod` inherits the runner's env, and a `NEXT_PUBLIC_*`
   already present there beats what `vercel pull` writes). Vercel's builder has
   no CI env to inherit, so the guard protected against a hazard the job itself
   created.

The warning above `jobs:` about workflow-level `NEXT_PUBLIC_*` placeholders
**still stands and must not be relaxed.** It guards nothing today and is
exactly what makes re-adding a deploy job safe.

#### Two facts worth keeping

- **`www.tryreviewbox.com` is an alias serving the site, not a redirect** —
  confirmed in that deployment's alias list. The duplicate-content problem the
  canonical tags fix is real, not hypothetical. Making it a redirect in Vercel
  is still the cleaner fix.
- **Two error strings do not distinguish two faults.** `vercel pull` prints
  either `Project not found ({…ORG_ID})` or `Could not retrieve Project
  Settings` depending on internals, and neither says whether the org id, the
  project id or the token's scope is at fault. An earlier version of this file
  mapped them to distinct diagnoses. That was inference stated as a rule, and
  the next run disproved it. If a deploy job is ever re-added, get the answer
  from `vercel whoami` / `vercel teams ls`, not from the error text.

### ⚠️ Vercel free plan: ~5,000 file uploads per 24h, shared across ALL deploys

Hit on 2026-08-17. Two master merges built green and then failed to deploy:

> `Too many requests - try again in 24 hours (more than 5000, code: "api-upload-free")`

**This is a rolling 24-hour budget, not a per-deploy limit.** Each deploy of
this app uploads thousands of files (~41MB of build output), so **merging
several PRs in one evening can exhaust it** and leave master green but not in
production — the same "merged but not shipped" outcome the `VERCEL_TOKEN`
check exists to make visible.

Two things to know:

1. **It is a quota, not a flake.** Re-running the job fails identically until
   the window resets. `rerun_failed_jobs` is the wrong instinct here.
2. **The real error is invisible in the log.** The CLI retries the upload ~12
   times and prints a generic `Error: Upload aborted` stack for each, so the
   one actionable line scrolls off the end. It looks exactly like a network
   blip. Read the *head* of the Deploy step, not the tail.

Mitigated by `--archive=tgz` in the deploy step (one tarball per deploy
instead of thousands of requests) plus a step-summary that surfaces the real
message. **If it recurs anyway, the answer is to wait for the window or
upgrade the plan — not to re-run.** The previous deployment stays live
throughout, so the site is never down; it is just stale.

### ⚠️ Vercel Hobby plan: cron jobs MUST be daily-or-less-frequent

`vercel.json` cron schedules cannot fire more than once per day on the Hobby plan. Schedules like `0 */4 * * *` or `*/30 * * * *` will be rejected at deploy time with:

> This cron expression would run more than once per day. Upgrade to the Pro plan to unlock all Cron Jobs features on Vercel.

Current schedules are all daily-or-less-frequent:
- `/api/sync/reviews` → `0 8 * * *` (daily 8am UTC)
- `/api/reports/weekly-digest` → `0 9 * * 1` (Mondays 9am)
- `/api/reports/unreplied-alert` → `0 10 * * *` (daily 10am)

**Do NOT change these to higher frequencies without upgrading the Vercel project to Pro first**, or the deploy fails entirely (taking the whole app offline).

For fresher data without upgrading Vercel:
1. New workspaces get an immediate one-off sync via `/api/onboarding/complete` (fire-and-forget)
2. Settings → Apps "Sync now" button hits the per-workspace worker
3. Future option: Supabase `pg_cron` + `pg_net` can call the sync endpoint on any schedule for free

**Also: `vercel.json` schema rejects `_comment` and other unknown top-level keys.** Use `$schema` for IDE hints but don't add custom comment fields — keep the rationale here in CLAUDE.md instead.

### ⚠️ Onboarding loop after completing setup (FIXED on `claude/picture-perfect`)

**Symptom:** User completes step 2 (app details) → step 3 (Connect) → clicks "Launch my workspace" → instead of reaching step 4 / dashboard, they bounce back to step 3.

**Root cause:** Clerk's JWT sessionClaims cache for up to 60s. When `/api/onboarding/complete` sets `onboarded: true` in Clerk metadata, the user's browser-side JWT still says `onboarded: false`. Middleware then redirects them away from `/dashboard` back to `/onboarding`. The onboarding page sees an existing workspace+app, sets step to 3, and the loop begins.

**Fix (on `claude/picture-perfect`):**
1. `/api/onboarding/complete` sets `Set-Cookie: rb_onboarded=1` (5min TTL, httpOnly, lax)
2. Middleware checks the cookie as a fallback when sessionClaims.onboarded is false
3. `/api/onboarding/state` returns `onboarded: true` whenever the user has a workspace + app row (DB is authoritative)

**If you see this again after the PR is merged:**
- Check browser DevTools → Application → Cookies → look for `rb_onboarded=1` on `app.tryreviewbox.com`
- Check middleware logs to confirm it reads the cookie
- The cookie expires after 5 min — by then Clerk JWT should have caught up. If not, user will need to clear site data (Application → Storage → Clear site data) and sign in again

### ⚠️ Sign-in page renders empty when user already has a session (FIXED)

**Symptom:** `/sign-in` loads but Clerk's `<SignIn>` component is invisible — only heading and footer show.

**Root cause:** Clerk's `<SignIn>` silently renders nothing when it detects an existing session, leaving the user confused. The `tokens` and `touch` API calls succeed in DevTools, but the UI is blank.

**Fix:** `/sign-in/[[...sign-in]]/page.tsx` and `/sign-up/[[...sign-up]]/page.tsx` now check `auth()` server-side and `redirect("/dashboard")` if the user is already signed in. User-side workaround: DevTools → Application → Clear site data.

### ⚠️ Schema drift between migrations and code

**History:** The codebase had multiple instances where code referenced columns that didn't exist in the DB. The audit (2026-05-21) fixed all known cases, but going forward:

- Every new column referenced in a route handler must have a migration
- Migration filenames must be sequential (`NNN_description.sql`) — we briefly had TWO `007_*` files in this repo
- After applying a migration in Supabase, update `CLAUDE.md` to track which are applied vs pending

### ⚠️ Don't use `SUPABASE_DB_POOLER_URL` with supabase-js

`supabase-js` requires the HTTPS REST URL (`https://xxx.supabase.co`), not the Postgres connection string (`postgresql://...:6543/postgres`). The pooler URL is for direct libraries like `pg`. Passing it to `createClient()` will crash every query. `src/lib/supabase-server.ts` now only reads `NEXT_PUBLIC_SUPABASE_URL`.

---

## Key Commands

```bash
npm run dev           # start dev server (localhost:3000)
npm run build         # production build
npm run lint          # ESLint check
npm run test          # Vitest unit tests (alias for test:unit)
npm run test:unit     # Vitest unit tests, single run
npm run test:e2e      # Playwright e2e — spins up dev server, runs in chromium
npm run test:coverage # Vitest with coverage report
```

Windows: use `npm.cmd` if `npm` not found in PowerShell. PowerShell 5.1 doesn't
support `&&` — use `;` or run commands on separate lines.

If `next build` runs out of memory on Windows:
```
$env:NODE_OPTIONS="--max-old-space-size=6144"
npm.cmd run build
```

After switching branches, clear the Next.js build cache if you see odd
MODULE_NOT_FOUND errors: `rm -rf .next` (or `Remove-Item -Recurse -Force .next`).

---

## What NOT To Do

Code patterns:
- Don't edit `src/components/ui/*` — shadcn-managed, re-add via CLI
- Don't put Supabase queries in components — use service layer or API route
- Don't create new type files — extend `src/types/review.ts`
- Don't add CSS modules or styled-components
- Don't use React context for global state — Zustand for UI, React Query for server
- Don't import mock data outside of service files
- Don't use raw hex values for colors — only `#0A84FF` is allowed; rest go via `--rb-*` tokens
- Don't return raw `NextResponse.json({ error: "..." })` — use `apiError()` from `@/lib/api-response`
- Don't forget `audit()` after a mutation, or `rateLimit()` on a paid-service or enumeration-prone route
- Don't add a paid service without a paying customer first

Workflow (autopilot guardrails — `docs/decisions.md` D009):
- Don't push to `main` directly. PRs only.
- Don't merge a PR **unless every CI check is green on the exact head commit** —
  D020 delegates the merge (and so the production deploy) to Claude on that
  condition alone. **Count** the checks and assert each succeeded; "no red
  checks" is not "all checks green" (#95 merged having received 1 of 6). If
  anything is not green, or the change is still-reserved (legal pages, pricing,
  migrations, real emails), open the PR and stop.
- Don't deploy to production. Vercel auto-deploys on merge.
- Don't run a migration against production Supabase. Founder runs the SQL.
- Don't send a real email to a real customer. Drafts only.
- Don't change pricing or billing logic without an ADR + founder approval.
- Don't modify legal pages (Terms, Privacy, DPA) without founder approval.
- Don't add a new paid SaaS dependency — founder signs up and adds keys.
- Don't `git commit --no-verify` or skip pre-commit hooks.
- Don't disable or weaken CI checks.
