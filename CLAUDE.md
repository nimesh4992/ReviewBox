# ReviewBox — Claude Context

AI-powered review management platform for Google Play and Apple App Store operations.

**Brand:** ReviewBox · **Domain:** `tryreviewbox.com` · **Email:** `hello@tryreviewbox.com`

> **Active launch plan:** `docs/LAUNCH_PLAN.md` — read this before starting any backend or infra work.
> **Zero-cost survival plan:** `docs/ZERO_COST_PLAN.md` — read this before adding ANY paid service.
> **Architecture:** `docs/ARCHITECTURE.md` · **Features:** `docs/FEATURES.md`

## The one rule
Do not add a paid service until a customer pays first. Every tool has a free tier that covers 0–20 customers.
See `docs/ZERO_COST_PLAN.md` for the full breakdown.

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
| Analytics | PostHog | 🔲 Not installed yet — free: 1M events/month |
| Errors | Sentry | 🔲 Not installed yet — free: 5K errors/month |
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
      dashboard/metrics/route.ts      → GET KPI metrics
      incidents/[id]/route.ts         → GET incident detail
      automations/rules/route.ts      → GET/POST automation rules
      reply-kit/templates/route.ts    → GET/POST reply templates
      reply-kit/knowledge-base/       → GET/POST/DELETE KB entries
      settings/alerts/route.ts        → GET/PUT alert preferences
      onboarding/complete/route.ts    → POST mark onboarding done
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
    reviews/review-service.ts         → listReviewQueue() (still returning mock — needs wiring)

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

# Stripe — fill in before M2
STRIPE_SECRET_KEY=                  🔲 Not set
STRIPE_WEBHOOK_SECRET=              🔲 Not set
STRIPE_PRICE_STARTER=               🔲 Not set
STRIPE_PRICE_PRO=                   🔲 Not set
STRIPE_PRICE_TEAM=                  🔲 Not set

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

### Frontend — complete (mock data)
| Feature | Status |
|---|---|
| App shell — sidebar, topnav, page-header | ✅ Done |
| Sidebar — collapsible groups, app selector, AI triage panel | ✅ Done |
| Dashboard — KPI metrics + sparklines + apps overview | ✅ Done |
| Review queue — card layout, priority borders, AI draft dialog | ✅ Done |
| Incident list — severity borders, status badges | ✅ Done |
| Release health table — rollout bars | ✅ Done |
| Sentiment screen — trend chart + topic breakdown + AI recluster | ✅ Done |
| Competitors screen — benchmark table + sparklines | ✅ Done |
| ASO screen — keyword rank tracker + AI suggestions panel | ✅ Done |
| Reports screen — report cards + run/configure | ✅ Done |
| Onboarding wizard — 4-step (connect → apps → team → alerts) | ✅ Done |
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
| Admin panel wired to real customer data | 🔲 Pending |
| Security audit + RLS verification | 🔲 Pending |
| Next.js 15 → 16 upgrade | 🔲 When stable |

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
- [ ] Competitors screen — real data (manual competitor add → fetch public store rating)
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

**Active: S1.3 — Help Center**
Last updated: 2026-05-15

Completed sprints: S0.1 · S0.2 · S0.3 · S1.1 · S1.2

Key completions this session (S1.1 + S1.2):
- ✅ `review-service.ts` — wired to Supabase, accepts workspaceId + filters
- ✅ `src/hooks/use-apps.ts` — React Query hook calling `/api/apps`
- ✅ Dashboard `MOCK_APPS` → real apps from Supabase via `useApps()` hook
- ✅ `/api/onboarding/complete` — fires `sendWelcomeEmail()` after workspace creation
- ✅ `/api/sync/reviews` — Google Play fetch → `enrichReview()` → Supabase upsert
- ✅ `vercel.json` — Vercel Cron `0 */4 * * *` triggers sync
- ✅ Rating spike detection: ≥5 reviews ≤2★ same version/24h → email workspace owner
- ✅ `src/lib/email/send-rating-spike-alert.ts` — alert email template
- ✅ `/api/sync/reviews` added to Clerk middleware public routes

Up next (S1.3):
- [ ] Create 4 help pages: Getting Started · Connect Google Play · AI Replies · FAQ
- [ ] Configure `help.tryreviewbox.com` CNAME (Mintlify or Notion public)

---

## Key Commands

```bash
npm run dev     # start dev server (localhost:3000)
npm run build   # production build
npm run lint    # ESLint check
```

Windows: use `npm.cmd` if `npm` not found in PowerShell.

---

## What NOT To Do

- Don't edit `src/components/ui/*` — shadcn-managed, re-add via CLI
- Don't put Supabase queries in components — use service layer
- Don't create new type files — extend `src/types/review.ts`
- Don't add CSS modules or styled-components
- Don't use React context for global state — Zustand for UI, React Query for server
- Don't import mock data outside of service files
- Don't use raw hex values for colors — use CSS design tokens (`--rb-*`, `bg-surface`, `text-fg-*`)
- Don't add a paid service without a paying customer first
