# ReviewBox — 30-Day Launch Plan

> Living document. Update status as tasks complete.
> Read alongside `CLAUDE.md` (stack, types, conventions) and `ARCHITECTURE.md` (data flow).
> Last updated: 2026-05-10

---

## Product decisions locked in

| Decision | Choice | Reason |
|---|---|---|
| Name | **ReviewBox** | Short, language-agnostic, doesn't box into one feature |
| Pricing | $49/month · 3 apps · 2 users · 14-day free trial | One plan, no decision fatigue |
| Launch platform | **Google Play only** | App Store Connect reply API is blocked; add post-launch |
| Auth | **Clerk** | Org switching, team invites, Google OAuth — saves 2 weeks |
| Email | **Resend** | Best Next.js DX, 3K/month free |
| Payments | **Stripe** | No monthly cost, industry standard |
| AI replies | **Claude API** (claude-sonnet-4-5) | Already in stack, best reply quality |
| Analytics | **PostHog** | 1M events/month free, session replay, feature flags |
| Errors | **Sentry** | 5K errors/month free |
| Cron / sync | **Supabase pg_cron + Edge Functions** | No extra service, already in stack |

---

## Launch definition

A customer can complete this loop without any help:

```
Sign up → Connect Google Play app → See real reviews →
Generate AI reply → Submit reply → Receive email on critical review → Pay
```

Nothing else matters for day 1.

---

## Week 1 — Foundation
*Stable codebase, real infrastructure, team can deploy confidently*

### Technical debt (must fix before anything else)
- [ ] Fix `package.json` — pin all deps to exact versions (no more `"latest"`)
- [ ] Remove Radix duplicate — drop all `@radix-ui/react-*` individual packages, keep `radix-ui` umbrella
- [ ] Upgrade Next.js 15 → 16, update `eslint-config-next` to match
- [ ] Verify build clean after upgrade (`npm run build`)
- [ ] Add `--no-turbopack` flag to dev if Tailwind CSS breaks under Turbopack

### Infrastructure
- [ ] Create Vercel project — connect GitHub repo, set up preview + production environments
- [ ] Create Supabase project — enable `pg_cron` extension
- [ ] Install Clerk — add `CLERK_SECRET_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` to Vercel env
- [ ] Install Sentry — add `SENTRY_DSN`, wrap `_app` with Sentry
- [ ] Set up GitHub Actions CI — runs `npm run build` + `npm run lint` on every PR

### Supabase schema
Run this migration to create the minimum viable schema:

```sql
-- Enable pg_cron
create extension if not exists pg_cron;

-- Workspaces (one per company)
create table workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  clerk_org_id text unique not null,
  created_at  timestamptz default now()
);

-- Apps (Google Play or App Store apps)
create table apps (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  platform     text not null check (platform in ('google_play', 'app_store')),
  store_id     text not null,          -- package name / bundle ID
  name         text not null,
  icon_url     text,
  last_synced_at timestamptz,
  created_at   timestamptz default now(),
  unique(workspace_id, platform, store_id)
);

-- Reviews
create table reviews (
  id            uuid primary key default gen_random_uuid(),
  app_id        uuid references apps(id) on delete cascade,
  external_id   text not null,         -- Play Store review ID
  author        text not null,
  rating        int not null check (rating between 1 and 5),
  text          text,
  app_version   text,
  device        text,
  country       text,
  sentiment     text,                  -- critical/negative/mixed/positive (AI-tagged)
  priority      text,                  -- urgent/high/normal/low (AI-tagged)
  reply_status  text default 'needs_reply',
  replied_at    timestamptz,
  created_at    timestamptz default now(),
  unique(app_id, external_id)
);

-- Reply drafts
create table reply_drafts (
  id           uuid primary key default gen_random_uuid(),
  review_id    uuid references reviews(id) on delete cascade,
  body         text not null,
  generated_by text default 'ai',     -- ai / human
  submitted_at timestamptz,
  created_at   timestamptz default now()
);

-- Incidents
create table incidents (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  title        text not null,
  description  text,
  severity     text not null check (severity in ('critical', 'high', 'medium')),
  status       text default 'active' check (status in ('active', 'investigating', 'resolved')),
  owner        text,
  created_at   timestamptz default now(),
  resolved_at  timestamptz
);

-- Subscriptions
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  workspace_id           uuid references workspaces(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  status                 text default 'trialing',
  trial_ends_at          timestamptz default (now() + interval '14 days'),
  created_at             timestamptz default now()
);

-- Row Level Security
alter table workspaces    enable row level security;
alter table apps          enable row level security;
alter table reviews       enable row level security;
alter table reply_drafts  enable row level security;
alter table incidents     enable row level security;
alter table subscriptions enable row level security;

-- RLS policies (workspace isolation)
-- Add policies keyed to clerk_org_id via JWT claims after Clerk is wired
```

### Auth
- [ ] Add Clerk `<ClerkProvider>` to `src/app/layout.tsx`
- [ ] Create `src/middleware.ts` — protect all `/dashboard`, `/reviews`, `/incidents`, `/releases`, `/settings` routes
- [ ] Create `src/app/sign-in/[[...sign-in]]/page.tsx` and `sign-up` equivalent
- [ ] Redirect `/` to `/dashboard` if signed in, `/sign-in` if not
- [ ] Wire `clerk_org_id` into Supabase JWT so RLS policies can use it

**End of week 1 checkpoint:** Engineer can sign up, log in, log out. Dashboard loads (still mock data). Deployment pipeline green.

---

## Week 2 — Data pipeline
*Real reviews flowing from Google Play into the dashboard*

### Google Play OAuth
- [ ] Create Google Cloud project → enable Android Publisher API
- [ ] Configure OAuth consent screen — submit for verification **on day 8** (Google takes 3-5 days)
  - Use "Testing" status with allowlisted emails while waiting for approval
- [ ] Create OAuth 2.0 credentials (Web Application type)
- [ ] Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` to Vercel env
- [ ] Build OAuth callback: `src/app/api/auth/google-play/callback/route.ts`
  - Exchange code for tokens
  - Store encrypted `refresh_token` in `apps` table
  - Redirect to onboarding step 2

### Review sync worker
- [ ] Create Supabase Edge Function: `sync-reviews`
  - Accept `app_id` as parameter
  - Call `androidpublisher.reviews.list` API
  - Upsert reviews to `reviews` table (unique on `external_id`)
  - Update `apps.last_synced_at`
  - Handle quota: max 200 requests/day per app — batch smartly
- [ ] Register pg_cron job: run `sync-reviews` every 15 minutes for each connected app
  ```sql
  select cron.schedule('sync-all-apps', '*/15 * * * *',
    $$select sync_reviews_for_all_apps()$$
  );
  ```
- [ ] Add sync error logging — if 3 consecutive failures, trigger Sentry alert

### Wire service layer (remove all mock data)
- [ ] `src/services/reviews/review-service.ts` → real Supabase query
- [ ] `src/services/apps/app-service.ts` → `listApps()`, `getApp()`, `createApp()`
- [ ] `src/services/incidents/incident-service.ts` → real queries
- [ ] `src/services/releases/release-service.ts` → real queries
- [ ] Delete `src/features/*/data/mock-*.ts` files once service layer is live

### Frontend — states that must exist before real users
- [ ] Loading skeletons — every data section (use `src/app/(app)/dashboard/loading.tsx`)
- [ ] Empty states — new account with no apps shows onboarding CTA, not broken dashboard
- [ ] Error boundaries — `error.tsx` in every route folder
- [ ] Pagination — review list max 50 per page

**End of week 2 checkpoint:** First real review appears on the dashboard from a real Play Store app.

---

## Week 3 — Core product loop
*Signup → connect app → see reviews → AI reply → submit → get alerted → pay*

### Onboarding wizard
Location: `src/app/(app)/onboarding/page.tsx`

```
Step 1  →  Connect Google Play (OAuth button)
Step 2  →  Select apps to monitor (checklist of detected apps)
Step 3  →  First sync running... (progress bar, ~30 seconds)
Step 4  →  Dashboard with real data + first urgent review highlighted
```

Rules:
- [ ] Skip wizard if workspace already has connected apps
- [ ] Wizard must complete in < 8 minutes — test with a stranger, time them
- [ ] If OAuth fails — show clear error with retry, not a blank screen
- [ ] On step 3, poll sync status every 3 seconds, auto-advance when done

### AI reply generation
- [ ] Add `ANTHROPIC_API_KEY` to Vercel env
- [ ] Create `src/app/api/reply/generate/route.ts` (POST, server action)
  - Input: `review_id`
  - Fetch review + app context from Supabase
  - Call Claude API with prompt caching on system context
  - Save draft to `reply_drafts` table
  - Return draft body
- [ ] Wire "Generate reply" button in `review-queue.tsx` dialog to this endpoint
- [ ] Show streaming response (typing indicator while generating)
- [ ] Rate limit: max 50 generations/hour per workspace

Prompt structure:
```
System (cached): You are a professional app support agent for {app_name}.
  Tone: professional, empathetic, action-oriented.
  Always: acknowledge the issue, reference what's being fixed, end with next step.
  Never: be defensive, make promises about timelines.

User: Write a reply to this {rating}-star review:
  "{review_text}"
  Issue tags: {tags}
```

### Reply submission
- [ ] Create `src/app/api/reply/submit/route.ts` (POST)
  - Call `androidpublisher.reviews.reply` API
  - Update `reviews.reply_status = 'replied'`, set `replied_at`
  - Update `reply_drafts.submitted_at`
- [ ] Wire "Submit reply" button in the dialog
- [ ] Show success state, update card reply status inline

### Email alerts (Resend)
- [ ] Add `RESEND_API_KEY` to Vercel env
- [ ] Create Supabase trigger: fires on INSERT to `reviews` where `priority = 'urgent'`
- [ ] Trigger calls Edge Function `send-alert-email`
- [ ] Email template (React Email):
  - Subject: `⚠️ {rating}★ urgent review — {app_name}`
  - Body: author name, review text, rating stars, "Open in Revi" button
  - Target: < 5 minutes from review appearing on Play Store

### Stripe billing
- [ ] Create Stripe account, add `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` to Vercel env
- [ ] Create product: $49/month, 14-day free trial
- [ ] Create `src/app/api/stripe/checkout/route.ts` — creates Checkout session
- [ ] Create `src/app/api/stripe/webhook/route.ts` — handles:
  - `customer.subscription.created` → set `subscriptions.status = 'active'`
  - `customer.subscription.deleted` → set `subscriptions.status = 'cancelled'`
  - `invoice.payment_failed` → set status, send email
- [ ] Add billing gate in `src/middleware.ts`:
  - If trial expired and status not `active` → redirect to `/billing`
- [ ] Create `src/app/(app)/billing/page.tsx` — "Your trial has ended" + Checkout button

**End of week 3 checkpoint:** Full loop works end-to-end. A stranger can sign up, connect a real app, generate an AI reply, and pay. Do this test yourself before calling week 3 done.

---

## Week 4 — Launch prep
*Survive first 20 real customers without manual intervention*

### Security
- [ ] Verify RLS — write a test: create 2 workspaces, confirm workspace A cannot read workspace B's reviews
- [ ] Audit `NEXT_PUBLIC_` env vars — nothing secret should be prefixed `NEXT_PUBLIC_`
- [ ] API routes — all require authenticated Clerk session (`auth()` check at top of every route handler)
- [ ] Google OAuth tokens — stored encrypted in DB, never logged, never returned to client
- [ ] Rate limiting on `/api/reply/generate` — 50/hour per workspace (use Vercel middleware or Upstash Ratelimit)

### Reliability
- [ ] Sync worker retry logic — 3 attempts with exponential backoff before marking failed
- [ ] Stale data UI — if `last_synced_at` > 30 min, show "Syncing delayed" badge, not an error
- [ ] Sentry alert rule — if sync fails 3× in a row for same app → page on-call (you)
- [ ] Supabase connection pooling — use `pgbouncer` mode for Edge Functions

### Performance
- [ ] Dashboard initial load < 2 seconds on real connection (test on phone, not localhost)
- [ ] Suspense boundaries — above-fold KPI cards load before review list
- [ ] Review list pagination — 50 per page, cursor-based
- [ ] React Query stale time — 30 seconds for review list (no over-fetching)

### Observability (PostHog — 6 events only)
```ts
posthog.capture('workspace_created')
posthog.capture('app_connected', { platform: 'google_play' })
posthog.capture('first_sync_completed', { review_count: n })
posthog.capture('ai_draft_generated')
posthog.capture('reply_submitted')
posthog.capture('subscription_started', { plan: '$49' })
```
These 6 events tell you exactly where the funnel is breaking.

### Landing page (live by day 25)
Location: `src/app/page.tsx` (replace root redirect with actual page)

Required sections:
- [ ] Hero — "Reply to your app store reviews before they damage your rating"
- [ ] 3 features — AI replies, critical alerts, release health
- [ ] Pricing — one card, $49/month, 14-day free trial, no credit card required
- [ ] Social proof — 1+ beta customer quote (get this from week 4 beta users)
- [ ] CTA → Clerk signup

### Beta customers (days 22-28)
- [ ] Find 3-5 people with Google Play apps (communities: IndieHackers, r/androiddev, personal network)
- [ ] Give free access for 30 days — in exchange for a 30-minute feedback call
- [ ] Watch them do onboarding silently — don't help, just observe
- [ ] Every point of confusion = a product bug to fix before public launch
- [ ] Get at least 1 written quote for the landing page

### Environment variables — full list for Vercel
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Google Play
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID=

# Anthropic
ANTHROPIC_API_KEY=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=alerts@yourdomain.com

# Sentry
SENTRY_DSN=

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## Definition of done — Day 30

Every item must be checked before calling the product live.

### Auth + access
- [ ] Signup, login, logout, password reset all work
- [ ] Clerk middleware blocks unauthenticated access to all app routes
- [ ] Trial expiry gate redirects to billing page

### Data
- [ ] Google Play OAuth connects successfully
- [ ] Reviews sync every 15 minutes automatically
- [ ] Dashboard shows real data (zero mock data in production)
- [ ] Loading skeletons show during data fetch
- [ ] Empty states show for new accounts with no apps

### Core loop
- [ ] AI reply draft generates in < 10 seconds
- [ ] Reply submits to Google Play successfully
- [ ] Email alert sends within 5 minutes of urgent review
- [ ] Stripe checkout completes, subscription activates

### Reliability
- [ ] Error boundary on every route (no white screen of death)
- [ ] Sentry capturing errors in production
- [ ] Sync failure alert working
- [ ] RLS verified — cross-workspace data leak test passed

### Observability
- [ ] All 6 PostHog events firing correctly
- [ ] Vercel deployment logs clean (no runtime errors)

### Launch
- [ ] Custom domain configured on Vercel
- [ ] Landing page live
- [ ] At least 1 beta customer using real data
- [ ] At least 1 written customer quote

---

## Do NOT build in month 1

Say no to all of these. Revisit after first 20 customers.

| Request | Why not now |
|---|---|
| App Store Connect | Apple doesn't support reply API — needs workaround |
| Competitor tracking | Months of work, nobody's asked for it yet |
| Bulk reply / automation rules | Do it manually first, automate what's repetitive |
| CSV / PDF export | Not a day-1 need |
| Team member invites | One user per account is fine for 20 customers |
| Slack notifications | Email is enough; add when someone asks twice |
| Mobile app | You have a browser |
| Dark mode | Just removed it |
| ASO / keyword tracking | Different product |
| Real-time WebSocket | 30-second polling is fine for SMB |

---

## Risk register

| Risk | Probability | Impact | Owner | Mitigation |
|---|---|---|---|---|
| Google OAuth consent screen rejected | Medium | High | Dev | Submit day 8. Use test-mode allowlist while waiting |
| Sync worker fails silently | High | High | Dev | Sentry alert if no sync in 45 min |
| First customer can't connect app | High | Medium | Founder | Offer manual onboarding call via screen share |
| App Store demand before built | Medium | Low | Product | "Join App Store waitlist" on landing page |
| Claude API latency > 10s | Low | Medium | Dev | Stream response, typing indicator |
| Supabase free tier exhausted | Low | Low | Dev | 500MB handles 10K+ reviews; upgrade at 30 customers |
| Google quota (200 req/day) hit | Medium | Medium | Dev | Batch smartly, prioritise recently-active apps |

---

## New service files to create (not yet in codebase)

```
src/
  app/
    (app)/
      onboarding/page.tsx             → 4-step wizard
      billing/page.tsx                → trial expired + Stripe CTA
    api/
      auth/google-play/
        callback/route.ts             → OAuth exchange + token storage
      reply/
        generate/route.ts             → Claude API call
        submit/route.ts               → Google Play reply submission
      stripe/
        checkout/route.ts             → create Checkout session
        webhook/route.ts              → handle subscription events
      sync/
        trigger/route.ts              → manual sync trigger (for testing)
    sign-in/[[...sign-in]]/page.tsx
    sign-up/[[...sign-up]]/page.tsx

  middleware.ts                       → Clerk auth + billing gate

  services/
    apps/app-service.ts               → listApps, createApp, getApp
    google-play/
      auth.ts                         → OAuth helpers, token refresh
      publisher-api.ts                → reviews.list, reviews.reply wrappers
    email/email-service.ts            → sendAlertEmail(), sendWelcomeEmail()
    stripe/stripe-service.ts          → createCheckout, handleWebhook
```

---

## Progress tracker

| Week | Status | Notes |
|---|---|---|
| Week 1 — Foundation | 🔲 Not started | |
| Week 2 — Data pipeline | 🔲 Not started | |
| Week 3 — Core product loop | 🔲 Not started | |
| Week 4 — Launch prep | 🔲 Not started | |
| Beta customers | 🔲 Not started | |
| Public launch | 🔲 Not started | |

Update status: 🔲 Not started · 🟡 In progress · ✅ Done · 🔴 Blocked
