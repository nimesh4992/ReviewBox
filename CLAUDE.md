# Revi — Claude Context

AI-powered review management platform for Google Play and Apple App Store operations.

> **Active launch plan:** `docs/LAUNCH_PLAN.md` — read this before starting any backend or infra work.
> **Zero-cost survival plan:** `docs/ZERO_COST_PLAN.md` — read this before adding ANY paid service.
> **Architecture:** `docs/ARCHITECTURE.md` · **Features:** `docs/FEATURES.md`

## The one rule
Do not add a paid service until a customer pays first. Every tool has a free tier that covers 0–20 customers.
See `docs/ZERO_COST_PLAN.md` for the full breakdown.

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js App Router | Upgrading 15 → 16 (see LAUNCH_PLAN week 1) |
| Language | TypeScript strict | — |
| Styling | Tailwind CSS + shadcn/ui (New York style) | — |
| State | Zustand (workspace) + TanStack React Query (server) | — |
| Database | Supabase (PostgreSQL + RLS + Edge Functions + pgvector) | Not wired yet |
| Auth | Clerk | Not installed yet — free to 5K MAU |
| Payments | Stripe | Not installed yet — no monthly cost |
| AI (phase 1) | **Groq** (Llama 3.3 70B) | Free tier: 6K req/day — use until $1K MRR |
| AI (phase 2) | Claude Haiku 3.5 + prompt caching | Switch at $1K MRR — ~$10/month |
| Local ML | @xenova/transformers (WASM) | Semantic tags, sentiment, clustering — $0 forever |
| Rate limiting | Upstash Redis | Free: 10K commands/day |
| Email | Resend | Not installed yet — free: 3K/month |
| Analytics | PostHog | Not installed yet — free: 1M events/month |
| Errors | Sentry | Not installed yet — free: 5K errors/month |
| Icons | Lucide React | strokeWidth=1.5 globally via CSS |

Path alias: `@/*` → `src/*`

---

## Directory Map

```
src/
  app/
    page.tsx                        → root redirect or landing
    layout.tsx                      → root layout (fonts, metadata)
    globals.css                     → Tailwind base + CSS vars
    (app)/
      layout.tsx                    → authenticated shell (AppShell)
      dashboard/page.tsx
      reviews/page.tsx
      incidents/page.tsx
      releases/page.tsx
      settings/page.tsx

  components/
    layout/
      app-shell.tsx                 → sidebar + topnav wrapper
      sidebar.tsx                   → nav links
      top-navigation.tsx            → header bar
      page-header.tsx               → per-page title/actions area
    providers/
      query-provider.tsx            → React Query client provider
    ui/                             → shadcn/ui primitives (DO NOT edit)
      badge, button, card, dialog, dropdown-menu,
      input, sheet, skeleton, table, tabs, tooltip

  features/                         → domain feature slices
    dashboard/
      components/
        ai-insights-panel.tsx
        critical-incident-banner.tsx
        operational-metrics.tsx
      data/operations.ts            → mock operational metrics
    reviews/
      components/review-queue.tsx
      data/mock-reviews.ts          → mock AppReview[] data
    incidents/
      components/incident-list.tsx
    releases/
      components/release-health-table.tsx
    settings/
      components/settings-sections.tsx

  hooks/
    use-review-queue.ts             → React Query hook for review list

  lib/
    utils.ts                        → cn() Tailwind merge helper

  services/
    supabase/client.ts              → getSupabaseClient() factory
    reviews/review-service.ts       → listReviewQueue() (currently mock)

  store/
    use-workspace-store.ts          → Zustand: selectedApp, environment

  types/
    review.ts                       → ALL shared domain types (see below)
    global.d.ts                     → module declarations

  utils/
    format.ts                       → formatRating(), humanizeToken()
```

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
- **Target:** `review-service.ts` calls `getSupabaseClient()` and queries DB
- **Pattern:** Pages/components never import mock data directly — always go through service → hook

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
- shadcn/ui base color: slate, CSS variables enabled
- No custom color values — use Tailwind palette or CSS vars from globals.css

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

Full list in `docs/LAUNCH_PLAN.md`. Minimum for local dev:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ANTHROPIC_API_KEY=
```

`getSupabaseClient()` returns `null` if vars missing — service layer must handle null client gracefully (fall back to mock or throw with clear message).

---

## Current Build Status

### Frontend — complete (mock data)
| Feature | Status |
|---|---|
| App shell — sidebar, topnav, page-header | ✅ Done |
| Sidebar — collapsible groups, sticky, edge-to-edge | ✅ Done |
| Dashboard — KPI metrics + sparklines | ✅ Done |
| Dashboard — Platform health (Google Play + App Store) | ✅ Done |
| Dashboard — AI insights panel | ✅ Done |
| Dashboard — Critical incident banner | ✅ Done |
| Review queue — card layout, priority borders, AI draft dialog | ✅ Done |
| Incident list — severity borders, status badges, stats strip | ✅ Done |
| Release health table — rollout bars, stats strip | ✅ Done |
| Settings UI | ✅ Done (static) |

### Backend — nothing wired
| Feature | Status |
|---|---|
| Next.js 15 → 16 upgrade | 🔲 Week 1 |
| package.json dep pinning + Radix dedup | 🔲 Week 1 |
| Clerk auth | 🔲 Week 1 |
| Supabase schema + RLS | 🔲 Week 1 |
| Google Play OAuth | 🔲 Week 2 |
| Review sync worker (pg_cron) | 🔲 Week 2 |
| Service layer wired to Supabase | 🔲 Week 2 |
| Onboarding wizard | 🔲 Week 3 |
| AI reply generation (Claude API) | 🔲 Week 3 |
| Reply submission to Google Play | 🔲 Week 3 |
| Email alerts (Resend) | 🔲 Week 3 |
| Stripe billing | 🔲 Week 3 |
| Security audit + RLS verification | 🔲 Week 4 |
| Landing page | 🔲 Week 4 |
| PostHog + Sentry | 🔲 Week 4 |

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
