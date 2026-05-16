# Revi — Project Walkthrough

> Complete record of what's been built, every file touched, and what still needs doing.
> Last updated: 2026-05-10

---

## Table of Contents

1. [Stack](#stack)
2. [What's Done](#whats-done)
   - [Frontend](#frontend)
   - [Auth (Clerk)](#auth-clerk)
   - [Database (Supabase)](#database-supabase)
   - [AI Pipeline (Groq)](#ai-pipeline-groq)
   - [Payments (Stripe)](#payments-stripe)
   - [Email (Resend)](#email-resend)
   - [Rate Limiting (Upstash)](#rate-limiting-upstash)
   - [API Routes](#api-routes)
   - [Admin Panel](#admin-panel)
   - [Legal & SEO](#legal--seo)
   - [Security](#security)
3. [File Map — Every File Created or Modified](#file-map)
4. [Environment Variables](#environment-variables)
5. [Key Patterns & Conventions](#key-patterns--conventions)
6. [What's Pending](#whats-pending)
7. [Build Status](#build-status)

---

## Stack

| Layer | Tech | Free Tier |
|---|---|---|
| Framework | Next.js 15 App Router | — |
| Language | TypeScript strict | — |
| Styling | Tailwind CSS + shadcn/ui (New York) | — |
| Auth | Clerk | 5K MAU free |
| Database | Supabase (PostgreSQL + RLS + pgvector) | 500MB free |
| AI | Groq (llama-3.3-70b-versatile) | 6K req/day free |
| Payments | Stripe | No monthly cost |
| Email | Resend | 3K/month free |
| Rate Limiting | Upstash Redis | 10K cmd/day free |
| State | Zustand + TanStack React Query | — |
| Icons | Lucide React (strokeWidth=1.5) | — |

---

## What's Done

### Frontend

#### App Shell
- **`src/app/(app)/layout.tsx`** — authenticated shell wrapping sidebar + topnav
- **`src/components/layout/app-shell.tsx`** — responsive layout: sticky sidebar on desktop, Sheet drawer on mobile
- **`src/components/layout/sidebar.tsx`**
  - Dark sidebar (`#0d0f14`), collapsible nav groups with chevron toggle
  - App selector dropdown (fetches real apps from `/api/apps` on mount)
  - Active route indicator with indigo left-bar accent
  - AI triage panel at bottom (crash cluster / needs reply / SLA window)
  - Signal badges (review count, incident count) on nav items
  - Falls back gracefully if `/api/apps` fails
- **`src/components/layout/top-navigation.tsx`**
  - Sticky frosted header, search pill with ⌘K hint
  - Notification sheet (right side, w-80) with 3 sample notifications, colored severity dots, navigation on click
  - Empty state with CheckCircle when no notifications
  - Environment badge, avatar button
- **`src/components/layout/page-header.tsx`** — eyebrow + title + description per page

#### Pages
- **`/dashboard`** — KPI metrics (real data via `useDashboardMetrics`), platform health cards, AI insights panel, critical incident banner
- **`/reviews`** — infinite-scroll review queue with cursor-based pagination, priority borders, AI draft dialog, send reply button (calls API)
- **`/incidents`** — incident list with severity borders, status badges, stats strip
- **`/releases`** — release health table with rollout bars
- **`/automations`** — automation hub with 12 presets, install/toggle rules (calls API)
- **`/reply-kit`** — reply templates + knowledge base management
- **`/settings`** — alert preferences, account settings
- **`/billing`** — 3-plan pricing cards (Starter $49, Pro $99, Team $199), trial-expired banner, payment-failed banner, manage subscription button
- **`/onboarding`** — 4-step wizard (connect app → select apps → sync → dashboard)
- **`/`** — full marketing landing page: hero, stats bar, features, pricing, footer

#### UI States
- Loading skeletons on all data sections
- Empty states for new accounts
- Error boundaries (`error.tsx`) on root and app group
- 404 page (`not-found.tsx`)

---

### Auth (Clerk)

**Files:**
- `src/app/layout.tsx` — `<ClerkProvider>` wraps entire app
- `src/middleware.ts` — full auth + billing gate
- `src/app/sign-in/[[...sign-in]]/page.tsx` — Clerk hosted SignIn component
- `src/app/sign-up/[[...sign-up]]/page.tsx` — terms gate before SignUp (checkbox for ToS + Privacy Policy required to show Clerk component)

**Middleware logic (`src/middleware.ts`):**
```
Public routes: /, /sign-in/*, /sign-up/*, /api/stripe/webhook

All other routes:
  1. auth.protect() — redirect to /sign-in if not logged in
  2. Trial expiry — if trialEndsAt < now && plan === "free" → redirect /billing?reason=trial-expired
  3. Billing gate — /automations, /reply-kit, /api/reply/* require paid plan
  4. Payment grace — if paymentFailedAt > 7 days ago → redirect /billing?reason=payment-failed
```

**Session claims used:**
- `sessionClaims.metadata.plan` — "free" | "starter" | "pro" | "team"
- `sessionClaims.metadata.trialEndsAt` — ISO date string
- `sessionClaims.metadata.paymentFailedAt` — ISO date string, set on payment failure, cleared on successful checkout

---

### Database (Supabase)

**Migration:** `supabase/migrations/001_initial_schema.sql` — **ran successfully** (confirmed in Supabase SQL editor)

**Tables created:**
| Table | Purpose |
|---|---|
| `workspaces` | One per company — name, plan, stripe IDs |
| `workspace_members` | `clerk_user_id` → `workspace_id` mapping |
| `apps` | Google Play / App Store apps per workspace |
| `reviews` | Reviews with vector(384) embedding column |
| `automation_rules` | Trigger + action pairs per workspace |
| `reply_templates` | Canned reply templates per workspace |
| `knowledge_base` | KB entries for AI context injection |
| `ai_usage` | Per-user AI draft tracking for rate limiting |
| `incidents` | Critical incidents per workspace |
| `alert_preferences` | Per-workspace notification settings |

**RLS:** Enabled on all tables. `my_workspace_ids()` helper function returns workspace IDs for current user — used in all RLS policies to enforce workspace isolation.

**pg_cron:** Keepalive job every 15 min prevents Supabase free tier auto-pause.

**Server client (`src/lib/supabase-server.ts`):**
- `getServiceClient()` — uses `SUPABASE_DB_POOLER_URL` (Supavisor transaction mode, port 6543) when set, falls back to direct URL in dev. Prevents Vercel serverless from exhausting the 60-connection limit.
- `getWorkspaceId(clerkUserId)` — helper used by all API routes to resolve workspace

---

### AI Pipeline (Groq)

**File:** `src/lib/groq.ts`
- Lazy singleton — no crash at build time if `GROQ_API_KEY` missing
- Model: `llama-3.3-70b-versatile`
- `generateReply(review, tone?, context?)` — optional `context` param injects KB entries into system prompt
- Max 200 tokens per reply

**Reply draft route (`src/app/api/reply/draft/route.ts`):**
3-layer waterfall:
1. Template match — if workspace has matching template, return it instantly
2. Knowledge base context — fetch up to 3 KB entries, pass as context to Groq
3. Groq AI generation — llama-3.3-70b with KB context

Rate limit checked before any AI call (see Upstash section).

**Plan limits (`src/lib/plans.ts`):**
```
free:    0 AI drafts/day,  1 app,  1K reviews/month
starter: 50 AI drafts/day, 2 apps, 5K reviews/month
pro:     200/day,          10 apps, 50K reviews/month
team:    999/day,          unlimited, unlimited
```

---

### Payments (Stripe)

**Files:**
- `src/lib/stripe.ts` — lazy Proxy singleton (build-safe), API version `2026-04-22.dahlia`
- `src/app/api/stripe/checkout/route.ts` — creates Checkout session with `clerkUserId` + `plan` in metadata
- `src/app/api/stripe/portal/route.ts` — opens Stripe billing portal for existing subscribers
- `src/app/api/stripe/webhook/route.ts` — handles 3 events:
  - `checkout.session.completed` → updates plan in Clerk metadata + Supabase + sends welcome email + clears `paymentFailedAt`
  - `customer.subscription.deleted` → downgrades plan to "free" in Clerk + Supabase
  - `invoice.payment_failed` → sets `paymentFailedAt` in Clerk metadata + sends payment-failed email

**Stripe 2026 API note:** `invoice.subscription` field no longer exists. Webhook casts invoice to `unknown` and reads `invoiceAny.subscription ?? invoiceAny.parent?.subscription_details?.subscription` instead.

**Plans on billing page:**
| Plan | Price | Apps | Reviews/mo | AI Drafts/day |
|---|---|---|---|---|
| Starter | $49 | 2 | 5,000 | 50 |
| Pro | $99 | 10 | 50,000 | 200 |
| Team | $199 | Unlimited | Unlimited | 999 |

---

### Email (Resend)

**Files:**
- `src/lib/email/client.ts` — lazy `getResend()` singleton (build-safe when `RESEND_API_KEY` missing)
- `src/lib/email/send-welcome.ts` — welcome email on first subscription
- `src/lib/email/send-payment-failed.ts` — payment failed email with next retry date

All email functions use `getResend()` (not a module-level `new Resend()`). This prevents build crashes when the API key isn't set.

**From address:** `hello@tryreviewbox.com` — requires DNS verification in Resend dashboard before going live. Use `onboarding@resend.dev` for local/staging testing.

---

### Rate Limiting (Upstash)

**File:** `src/lib/rate-limit.ts`
- Sliding window per `ai_draft:{userId}:{date}`
- Daily limit pulled from `PLAN_LIMITS[plan].aiDraftsPerDay`
- Falls back to `{ allowed: true, remaining: 99 }` in dev when Upstash not configured — no crash

---

### API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/apps` | GET | List workspace apps (used by sidebar) |
| `/api/apps` | POST | Create app (plan-gated via `canAddApp`) |
| `/api/reviews` | GET | Paginated reviews with filters (cursor-based) |
| `/api/reviews/[id]/reply` | POST | Submit reply text, sets `reply_status=replied` |
| `/api/reply/draft` | POST | Generate AI draft (template → KB → Groq waterfall) |
| `/api/dashboard/metrics` | GET | 6 parallel Supabase queries → KPI metrics |
| `/api/automations/rules` | GET | List automation rules for workspace |
| `/api/automations/rules` | POST | Create rule (install preset) |
| `/api/automations/rules/[id]` | PATCH | Toggle rule enabled/disabled |
| `/api/automations/rules/[id]` | DELETE | Delete rule |
| `/api/reply-kit/templates` | GET/POST | List/create reply templates |
| `/api/reply-kit/templates/[id]` | PATCH/DELETE | Update/delete template |
| `/api/reply-kit/knowledge-base` | GET/POST | List/create KB entries |
| `/api/reply-kit/knowledge-base/[id]` | PATCH/DELETE | Update/delete KB entry |
| `/api/settings/alerts` | GET/PUT | Read/update alert preferences |
| `/api/incidents/[id]` | GET/PATCH | Get/update incident |
| `/api/onboarding/complete` | POST | Mark onboarding done, set trialEndsAt in Clerk |
| `/api/stripe/checkout` | POST | Create Stripe Checkout session |
| `/api/stripe/portal` | POST | Open Stripe billing portal |
| `/api/stripe/webhook` | POST | Handle Stripe events (public, bypasses auth) |
| `/api/gdpr/export` | POST | Export all user data as JSON |
| `/api/gdpr/delete` | POST | Delete all user data + cancel Stripe subscription |
| `/api/health` | GET | `{ status: "ok", timestamp, version }` |

**All routes follow this pattern:**
```ts
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const workspaceId = await getWorkspaceId(userId);
if (!workspaceId) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
// ... DB operations
```

**Pagination pattern (`/api/reviews`):**
- Accepts `limit`, `cursor` (ISO timestamp), `status`, `sentiment`, `rating`, `platform` query params
- Returns `{ reviews, nextCursor, hasMore }`
- Frontend uses `useInfiniteQuery` — filter changes reset to page 1

---

### Admin Panel

**Files:**
- `src/app/admin/layout.tsx` — gate: checks `userId === process.env.ADMIN_CLERK_USER_ID`, returns 403 otherwise
- `src/app/admin/customers/page.tsx` — table: workspace name, plan badge, app count, join date
- `src/app/admin/analytics/page.tsx` — totals: workspaces, apps, reviews, AI drafts; top 5 workspaces by review count

Access: `/admin` — only works when `ADMIN_CLERK_USER_ID` env var is set to your Clerk user ID.

---

### Legal & SEO

**Files:**
- `src/app/terms/page.tsx` — Terms of Service (12 sections, Delaware governing law)
- `src/app/privacy/page.tsx` — Privacy Policy (10 sections, GDPR/CCPA mentions)
- `src/app/sitemap.ts` — Next.js native sitemap, public routes indexed, app routes excluded
- `src/app/robots.ts` — blocks `/dashboard`, `/reviews`, `/incidents`, `/releases`, `/settings`, `/admin`, `/api`
- `src/app/opengraph-image.tsx` — Edge runtime OG image (1200×630, dark Revi branding)
- `src/components/layout/cookie-banner.tsx` — fixed bottom banner, "Accept all" / "Essential only", persisted in `localStorage` as `revi_cookie_consent`

**Sign-up terms gate:** Users must check "I agree to Terms of Service and Privacy Policy" before the Clerk SignUp component is shown.

---

### Security

**`next.config.ts` headers (all responses):**
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
X-DNS-Prefetch-Control: on
```

**`src/lib/plan-enforcement.ts`:**
- `canAddApp(workspaceId, plan)` — counts apps, blocks if over plan limit
- `checkReviewLimit(workspaceId, plan)` — counts reviews in current calendar month

**GDPR:**
- `/api/gdpr/export` — dumps all workspace data (apps, reviews, members, preferences) as JSON
- `/api/gdpr/delete` — deletes all workspace data + cancels Stripe subscription

---

## File Map

Every file that was created or meaningfully modified:

```
src/
  app/
    layout.tsx                          ← ClerkProvider, OG metadata, CookieBanner
    page.tsx                            ← Full marketing landing page
    globals.css                         ← Tailwind base, CSS vars
    error.tsx                           ← Root error boundary
    not-found.tsx                       ← 404 page
    opengraph-image.tsx                 ← Edge OG image (1200×630)
    sitemap.ts                          ← Next.js sitemap
    robots.ts                           ← robots.txt
    terms/page.tsx                      ← Terms of Service
    privacy/page.tsx                    ← Privacy Policy

    (app)/
      layout.tsx                        ← AppShell wrapper
      error.tsx                         ← App group error boundary
      dashboard/page.tsx                ← Real metrics via useDashboardMetrics
      reviews/page.tsx                  ← Infinite scroll review queue
      incidents/page.tsx                ← Incident list
      incidents/[id]/page.tsx           ← Incident detail (force-dynamic)
      releases/page.tsx                 ← Release health table
      releases/[version]/page.tsx       ← Release detail (force-dynamic)
      automations/page.tsx              ← Automation hub
      reply-kit/page.tsx                ← Reply templates + KB
      settings/page.tsx                 ← Alert prefs + account
      billing/page.tsx                  ← Plans + trial banner (Suspense-wrapped)
      onboarding/page.tsx               ← 4-step wizard

    admin/
      layout.tsx                        ← ADMIN_CLERK_USER_ID gate
      customers/page.tsx                ← Customer table
      analytics/page.tsx                ← Totals + top workspaces

    sign-in/[[...sign-in]]/page.tsx     ← Clerk SignIn
    sign-up/[[...sign-up]]/page.tsx     ← Terms gate + Clerk SignUp

    api/
      health/route.ts
      apps/route.ts
      reviews/route.ts                  ← Cursor-based pagination
      reviews/[id]/reply/route.ts
      reply/draft/route.ts              ← Template → KB → Groq waterfall
      dashboard/metrics/route.ts        ← 6 parallel Supabase queries
      automations/rules/route.ts
      automations/rules/[id]/route.ts
      reply-kit/templates/route.ts
      reply-kit/templates/[id]/route.ts
      reply-kit/knowledge-base/route.ts
      reply-kit/knowledge-base/[id]/route.ts
      settings/alerts/route.ts
      incidents/[id]/route.ts
      onboarding/complete/route.ts
      gdpr/export/route.ts
      gdpr/delete/route.ts
      stripe/checkout/route.ts
      stripe/portal/route.ts
      stripe/webhook/route.ts

  components/
    layout/
      app-shell.tsx
      sidebar.tsx                       ← Real app list, collapsible groups, AI triage panel
      top-navigation.tsx                ← Notification sheet
      page-header.tsx
      cookie-banner.tsx                 ← NEW
    providers/
      query-provider.tsx

  features/
    dashboard/
      components/ai-insights-panel.tsx
      components/critical-incident-banner.tsx
      components/operational-metrics.tsx
      data/operations.ts
    reviews/
      components/review-queue.tsx       ← Send reply, load more, "Your reply" section
      data/mock-reviews.ts
    incidents/
      components/incident-list.tsx
    releases/
      components/release-health-table.tsx
    settings/
      components/settings-sections.tsx
    automations/
      components/automation-hub.tsx     ← 12 presets, install/toggle/delete
    reply-kit/
      components/reply-kit-hub.tsx

  hooks/
    use-review-queue.ts                 ← useInfiniteQuery, cursor pagination, filter reset
    use-dashboard-metrics.ts            ← NEW: 5-min staleTime, mock fallback

  lib/
    utils.ts
    supabase-server.ts                  ← getServiceClient() with pooler, getWorkspaceId()
    stripe.ts                           ← Lazy Proxy singleton (build-safe)
    groq.ts                             ← Lazy singleton, generateReply()
    rate-limit.ts                       ← Upstash sliding window, dev fallback
    plans.ts                            ← PLAN_LIMITS constant
    plan-enforcement.ts                 ← canAddApp(), checkReviewLimit()
    email/
      client.ts                         ← Lazy getResend()
      send-welcome.ts
      send-payment-failed.ts

  services/
    supabase/client.ts
    reviews/review-service.ts

  store/
    use-workspace-store.ts

  types/
    review.ts                           ← All domain types (never inline)
    global.d.ts

  utils/
    format.ts

  middleware.ts                         ← Clerk auth + trial + billing + grace period

next.config.ts                          ← Security headers
supabase/migrations/001_initial_schema.sql  ← Full schema (ran ✅)
```

---

## Environment Variables

Set in `.env.local` (local dev) and Vercel dashboard (production):

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_DB_POOLER_URL=          # ← STILL NEEDED: Supabase → Settings → Database → Transaction mode (port 6543)

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Groq
GROQ_API_KEY=gsk_...

# Upstash Redis
UPSTASH_REDIS_REST_URL=https://...upstash.io
UPSTASH_REDIS_REST_TOKEN=AX...

# Stripe
STRIPE_SECRET_KEY=               # ← STILL NEEDED
STRIPE_WEBHOOK_SECRET=           # ← STILL NEEDED (get from Stripe dashboard after adding endpoint)

# Resend
RESEND_API_KEY=re_...

# Admin
ADMIN_CLERK_USER_ID=             # ← STILL NEEDED: Clerk dashboard → Users → copy your user ID

# Google Play (Week 2)
GOOGLE_CLIENT_ID=                # ← NOT STARTED
GOOGLE_CLIENT_SECRET=            # ← NOT STARTED

# Optional observability
NEXT_PUBLIC_POSTHOG_KEY=         # ← NOT STARTED
SENTRY_DSN=                      # ← NOT STARTED
```

---

## Key Patterns & Conventions

### Lazy SDK singletons
All external SDKs use lazy init to avoid build crashes when env vars are missing:
```ts
// ✅ Correct — lazy
let _stripe: Stripe | null = null;
export function getStripe() {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

// ❌ Wrong — crashes build
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
```

### Stripe Proxy pattern
Stripe needs to be importable as `stripe.customers.retrieve(...)` everywhere. A Proxy wraps the lazy getter:
```ts
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
```

### API route auth pattern
Every protected route:
```ts
const { userId } = await auth();
if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const workspaceId = await getWorkspaceId(userId);
if (!workspaceId) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
```

### useSearchParams → Suspense boundary
Any component using `useSearchParams()` must be wrapped in `<Suspense>`:
```tsx
function InnerContent() {
  const searchParams = useSearchParams(); // fine inside Suspense
  ...
}
export default function Page() {
  return <Suspense fallback={null}><InnerContent /></Suspense>;
}
```

### force-dynamic for client-hook pages
Pages with dynamic segments + client components:
```ts
export const dynamic = "force-dynamic"; // prevents static generation crash
```

### Mock fallback pattern
All hooks and API routes fall back to mock data so UI never breaks in dev:
```ts
try {
  const real = await fetchFromSupabase();
  return real;
} catch {
  return MOCK_DATA; // never a white screen
}
```

---

## What's Pending

### Must do before any real users

| Item | Where | Notes |
|---|---|---|
| **Supabase pooler URL** | `.env.local` + Vercel | Supabase → Settings → Database → Connection string → Transaction mode (port 6543) |
| **Stripe setup** | `.env.local` + Vercel | Create 3 products ($49/$99/$199), copy `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` |
| **ADMIN_CLERK_USER_ID** | `.env.local` + Vercel | Clerk dashboard → Users → copy your user ID |
| **Rotate all API keys** | All providers | Every key was shared in plain text in chat — rotate all 6: Groq, Upstash, Supabase service role, Clerk, Resend |
| **Resend domain verification** | Resend dashboard | Verify `tryreviewbox.com` DNS before real emails; use `onboarding@resend.dev` for testing |
| **Vercel deployment** | Vercel | `vercel --prod`, add all env vars in dashboard |

### Core features not yet built

| Feature | Status | Notes |
|---|---|---|
| **Google Play OAuth** | 🔲 Not started | Needs Google Cloud project + Android Publisher API + OAuth consent screen (3-5 day approval wait) |
| **Review sync worker** | 🔲 Not started | Supabase Edge Function `sync-reviews` + pg_cron every 15 min |
| **Reply submission to Google Play** | 🔲 Partial | DB updated but `androidpublisher.reviews.reply` API not called — needs OAuth first |
| **Automation execution engine** | 🔲 Not started | Rules are stored in DB but never run against incoming reviews |
| **App Store Connect** | 🔲 Not started | Apple reply API blocked — add post-launch |

### Nice to have (not blocking launch)

| Feature | Status | Notes |
|---|---|---|
| Team invitation flow | 🔲 Not started | Team plan ($199) sold but no `/settings/team` or invite UI |
| Staging environment | 🔲 Not started | Separate Supabase project + Vercel preview env |
| `vercel.json` | 🔲 Not started | Function timeouts, region config |
| PostHog analytics | 🔲 Not started | 6 key funnel events (see LAUNCH_PLAN.md) |
| Sentry error tracking | 🔲 Not started | Wrap app, add `SENTRY_DSN` |
| GitHub Actions CI | 🔲 Not started | `npm run build` + `npm run lint` on every PR |
| RLS cross-workspace test | 🔲 Not started | Create 2 workspaces, verify isolation |
| Sync failure alerting | 🔲 Not started | Sentry alert if no sync in 45 min |
| Reply streaming | 🔲 Not started | Typing indicator while Groq generates |
| Real-time review badge | 🔲 Not started | Sidebar signal count is hardcoded (127/2) |
| Beta customers | 🔲 Not started | 3-5 people with Play Store apps, 30-day free access for feedback |

---

## Build Status

```
✅  npm run build  — 31 pages, 0 errors (verified 2026-05-10)

Route breakdown:
  ○ Static:   /, /billing, /dashboard, /reviews, /incidents, /releases,
              /automations, /reply-kit, /settings, /onboarding,
              /terms, /privacy, /sitemap.xml, /robots.txt
  ƒ Dynamic:  All /api/* routes, /admin/*, /incidents/[id],
              /releases/[version], /sign-in, /sign-up, /opengraph-image

Middleware: 89.1 kB
```

Next logical step: get `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` from Stripe dashboard, fill in `SUPABASE_DB_POOLER_URL`, set `ADMIN_CLERK_USER_ID`, then deploy to Vercel.
