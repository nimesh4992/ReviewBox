# ReviewBox — Launch Checklist

A single source of truth for what must be true before flipping on customer
acquisition. Each box must be ticked. No "nice to haves" here — every item
is a real failure mode if skipped.

## Code

- [ ] All open PRs merged or closed (`gh pr list`)
- [ ] `main` builds clean on Vercel (no warnings)
- [ ] `npm run test` passes locally
- [ ] `npx tsc --noEmit` passes (zero errors)
- [ ] `npm run lint` passes
- [ ] No `console.log` in production code paths (greppable)
- [ ] No `TODO` / `FIXME` blocking real flows
- [ ] No mock data shown to real users (only used in tests)

## GitHub

- [ ] **Branch protection on `main`**: require status checks before merge
  - `Build + type-check` required
  - `Lint` required
  - `Unit tests` required
- [ ] Force-push to `main` disabled
- [ ] CODEOWNERS file (if team > 1)

## Database (Supabase)

- [ ] All migrations applied (verify no pending in `supabase/migrations/`)
- [ ] RLS active on every user-scoped table:
  - `workspaces`, `workspace_members`, `apps`, `reviews`, `automation_rules`,
    `reply_templates`, `knowledge_base`, `ai_usage`, `incidents`,
    `alert_preferences`, `aso_keywords`, `automation_execution_logs`
- [ ] Service role key never exposed client-side (grep for `SUPABASE_SERVICE_ROLE_KEY` in `NEXT_PUBLIC_` context)
- [ ] Daily backup enabled (Supabase → Database → Backups)
- [ ] pg_cron keep-alive job running (`select cron.schedule('supabase-keepalive', ...)`)

## Auth (Clerk)

- [ ] Production instance keys live in Vercel (`pk_live_` / `sk_live_`)
- [ ] `app.tryreviewbox.com` listed in Clerk → Domains
- [ ] Component paths in Clerk → Configure → Paths point to `app.tryreviewbox.com/sign-in` etc
- [ ] After sign-in / sign-up URLs match middleware expectations
- [ ] Email verification template branded
- [ ] Magic link / OTP working
- [ ] Sign-out redirects to `app.tryreviewbox.com/sign-in`

## Vercel — Production Environment Variables

| Name | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | yes | starts `pk_live_` |
| `CLERK_SECRET_KEY` | yes | starts `sk_live_` |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | https REST URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | server-only |
| `GROQ_API_KEY` | yes | primary AI |
| `GEMINI_API_KEY` | yes | fallback AI |
| `UPSTASH_REDIS_REST_URL` | yes | rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | yes | |
| `RESEND_API_KEY` | yes | email |
| `SENTRY_DSN` | yes | error tracking |
| `STRIPE_SECRET_KEY` | for billing | `sk_live_` |
| `STRIPE_WEBHOOK_SECRET` | for billing | from webhook endpoint |
| `STRIPE_PRICE_STARTER` | for billing | |
| `STRIPE_PRICE_PRO` | for billing | |
| `STRIPE_PRICE_TEAM` | for billing | |
| `GOOGLE_CLIENT_EMAIL` | for sync | service account |
| `GOOGLE_PRIVATE_KEY` | for sync | service account |
| `CRON_SECRET` | yes | gates `/api/sync/*` and `/api/reports/*` |
| `NEXT_PUBLIC_APP_URL` | yes | `https://app.tryreviewbox.com` |
| `ADMIN_CLERK_USER_ID` | yes | gates `/admin/*` |

- [ ] `BYPASS_AUTH` is **not** set (it was for one-off testing)
- [ ] All keys above present in **Production** scope (not just Preview)

## Stripe

- [ ] Test mode → live mode toggle complete
- [ ] Three price IDs created (Starter / Pro / Team) and matched to env vars
- [ ] Webhook endpoint configured: `https://app.tryreviewbox.com/api/stripe/webhook`
- [ ] Webhook listening to: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`
- [ ] Test checkout end-to-end with a real card (refund afterward)
- [ ] Billing portal accessible from `/billing`

## Email (Resend)

- [ ] `hello@tryreviewbox.com` verified in Resend
- [ ] SPF, DKIM, DMARC DNS records added
- [ ] Welcome email sends on onboarding complete
- [ ] Rating spike alert sends from sync cron
- [ ] Weekly digest fires Monday 9am UTC
- [ ] Unreplied alert fires daily 10am UTC
- [ ] Payment-failed email fires from Stripe webhook

## Observability

- [ ] Sentry project created, DSN set in Vercel
- [ ] Test error visible in Sentry (trigger via `Sentry.captureException` once)
- [ ] PostHog project created, key set in Vercel
- [ ] Test event visible in PostHog (load any page, look for `$pageview`)
- [ ] Vercel Analytics enabled
- [ ] Vercel Speed Insights enabled
- [ ] Alerts: configure Sentry → Alerts to email on first new issue

## Cron jobs (Vercel)

- [ ] `/api/sync/reviews` schedule: `0 8 * * *` (daily 8am UTC)
- [ ] `/api/reports/weekly-digest` schedule: `0 9 * * 1` (Mondays 9am)
- [ ] `/api/reports/unreplied-alert` schedule: `0 10 * * *` (daily 10am)
- [ ] `CRON_SECRET` set so unauthorised calls return 401

## Security

- [ ] `npm audit` shows no `high` or `critical` (`npm audit --audit-level=high`)
- [ ] No exposed secrets in repo history (grep for `sk_live_`, `pk_live_`, etc)
- [ ] Security headers active (verify via securityheaders.com — should score ≥ A)
- [ ] Rate limits in place for: AI draft, slug check, reply publish, invite send,
      Stripe checkout, Stripe portal, demo reply
- [ ] CORS not configured to `*` on any API route

## Legal

- [ ] Privacy policy live at `/privacy`
- [ ] Terms of service live at `/terms`
- [ ] Cookie banner shows on first visit
- [ ] GDPR export endpoint working (`/api/gdpr/export`)
- [ ] GDPR delete endpoint working (`/api/gdpr/delete`)
- [ ] DPA available at `/dpa` (for EU enterprise customers)
- [ ] Refund policy live at `/refund-policy`

## DNS

- [ ] `tryreviewbox.com` → Vercel (marketing)
- [ ] `app.tryreviewbox.com` → Vercel (product)
- [ ] `accounts.tryreviewbox.com` → Clerk (auth portal, even if unused)
- [ ] `help.tryreviewbox.com` → Mintlify / Notion (if launching with help center)
- [ ] `status.tryreviewbox.com` → BetterStack (if launching with status page)
- [ ] MX records for `hello@tryreviewbox.com` (Resend or your mailbox)

## Manual smoke test (do this last, on production)

Sign in fresh, then in order:

1. [ ] Sign up with a test email
2. [ ] Verify email link works → lands on onboarding
3. [ ] Complete onboarding → lands on dashboard (no loop)
4. [ ] Dashboard shows real zeros (no fake numbers)
5. [ ] Settings → connect a real Google Play app
6. [ ] Trigger `/api/sync/reviews` manually → reviews appear
7. [ ] Open a review → click "Draft reply" → AI draft appears
8. [ ] Edit and publish reply → blue dot disappears, status updates
9. [ ] Open Incidents page → "Declare incident" → works
10. [ ] Export CSV from dashboard → file downloads
11. [ ] Sign out → redirected to sign-in
12. [ ] Sign back in → land on dashboard directly (no onboarding loop)

If any step fails, **do not launch.** Fix and re-run from step 1.

## After launch

- [ ] Watch Sentry for 1 hour after first signup
- [ ] Watch PostHog for funnel drop-off
- [ ] Check Vercel logs for any 500s
- [ ] Reply to first customer in person — measure response time
