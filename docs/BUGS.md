# ReviewBox — Bug & Gap Tracker

Last updated: 2026-05-24

Legend: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW · ✅ FIXED

---

## Open Bugs

### Product Gaps (features that exist in UI but don't work)

| ID | Severity | Area | Description | File(s) |
|---|---|---|---|---|
| BUG-001 | 🔴 CRITICAL | Billing | No payment path exists. Stripe keys unset → "Choose Plan" returns 503. All paid features (automations, reply-kit, reports, Slack) are accessible to free users — zero plan enforcement except app count and AI draft rate | `src/app/api/stripe/checkout/route.ts`, `src/lib/plan-enforcement.ts` |
| BUG-002 | 🔴 CRITICAL | Competitors | Screen shows hardcoded finance-app mock data ("FinanceFlow", "BudgetPal") for every user regardless of their app category. "Add competitor" button has no onClick. Date range selector updates state but never changes displayed data | `src/features/competitors/components/competitors-screen.tsx` |
| BUG-003 | 🟠 HIGH | Reply submission | `POST /api/reviews/[id]/reply` is fully wired to both Google Play and App Store APIs — but there is no "Publish reply" button in the review card UI. AI draft generation works; actually sending the reply to the store is unreachable from the UI | `src/features/reviews/components/review-queue.tsx` |
| BUG-004 | 🟠 HIGH | Team invites | Backend fully implemented (invite email, accept flow, Clerk onboarding). Settings page "Manage access" button has no onClick. No team member management component exists anywhere in the UI | `src/app/(app)/settings/page.tsx`, `src/features/settings/components/settings-sections.tsx` |
| BUG-005 | 🟠 HIGH | Automations | `report_spam` action in automation executor silently applies `support-delay` tag instead of flagging spam. Wrong tag, no store API call, silent misfiring | `src/lib/automation-executor.ts` lines 178–186 |
| BUG-006 | 🟡 MEDIUM | Reports | "Bug triage export" and "Exec dashboard" report cards have `endpoint: null` and render "Coming soon" — clicking does nothing. "+ New report" button has no handler | `src/features/reports/components/reports-screen.tsx` lines 47, 57, 243 |
| BUG-007 | 🟢 LOW | Slack / Incidents | `notifySlack()` is called for urgent reviews and rating spikes but NOT when a new incident is created. `newIncident` payload builder exists in `src/lib/slack.ts` lines 111–138 but is never imported from the incidents route | `src/app/api/incidents/route.ts`, `src/lib/slack.ts` |

---

### Open Low-Priority Code Issues (from audit — not yet fixed)

| ID | Severity | Area | Description | File(s) |
|---|---|---|---|---|
| BUG-008 | 🟡 MEDIUM | Audit log | `gdpr/export` logs action as `"workspace.create"` instead of `"gdpr.export"` — `AuditAction` type needs extending | `src/app/api/gdpr/export/route.ts` |
| BUG-009 | 🟢 LOW | App Store API | `connect-api.ts deleteReply()` does not check HTTP response status — errors silently swallowed | `src/services/app-store/connect-api.ts` |
| BUG-010 | 🟢 LOW | Auth | Invite token email-match not enforced — any signed-in user who has the token link can accept an invite meant for a different email | `src/app/api/account/accept-invite/route.ts` |
| BUG-011 | 🟢 LOW | Audit log | `apps/[id]` create/update/delete have no `audit()` calls — no paper trail for app changes | `src/app/api/apps/[id]/route.ts`, `src/app/api/apps/route.ts` |
| BUG-012 | 🟢 LOW | Validation | `incidents/[id]` PATCH does not validate `status` against an allowlist — any string can be written to DB | `src/app/api/incidents/[id]/route.ts` |
| BUG-013 | 🟢 LOW | Validation | `automations/rules` PATCH missing the same action allowlist validation that POST has | `src/app/api/automations/rules/route.ts` |
| BUG-014 | 🟢 LOW | Reliability | `publisher-api.ts` and `connect-api.ts` external HTTP calls have no request timeout — a slow store API hangs the sync worker indefinitely | `src/services/google-play/publisher-api.ts`, `src/services/app-store/connect-api.ts` |
| BUG-015 | 🟢 LOW | Reliability | `sync/reviews` coordinator uses fire-and-forget `Promise.all` fanout with no error collection — one failing app silently swallows its error | `src/app/api/sync/reviews/route.ts` |

---

## Fixed Bugs

### Security Audit Pass 3 (2026-05-24, merged in `feat/bootstrap-reviews`)

| ID | Area | Fix |
|---|---|---|
| ✅ | Middleware | `/api/health` root blocked by auth.protect() — pattern `/(.*)`  didn't match root; fixed to `(.*)` |
| ✅ | Rate limiting | Redis double-prefix bug: `prefix: "ai_draft"` + key `"ai_draft:userId"` = `ai_draft:ai_draft:userId`; removed manual prefix |
| ✅ | reply/draft | No reviewBody length cap (quota abuse); capped at 5000 chars. No-workspace users now get 403 |
| ✅ | incidents POST | Unvalidated severity string + unbounded title/description written to DB; allowlist + length caps added |
| ✅ | automations/rules POST | Unvalidated action string + unbounded name/conditions; allowlist + bounds added |
| ✅ | settings/alerts POST | Unbounded array upsert; capped at 20 items |
| ✅ | gdpr/delete | No rate limit on irreversible hard-delete endpoint; now 3 attempts/hour |
| ✅ | settings/workspace | `defaultTone` accepted any string; validated against known tones allowlist |
| ✅ | sync/reviews | Bootstrap rows double-counted in `last_sync_review_count`; `reviewsBefore` moved after bootstrap block |
| ✅ | publisher-api | Raw googleapis error logged (could contain auth tokens); now logs `.message` only |

### Security Audit Pass 2 (2026-05-23, merged in `feat/bootstrap-reviews`)

| ID | Area | Fix |
|---|---|---|
| ✅ | Automations | `ai_reply` action called HTTP `/api/reply/draft` (always 401 — no Clerk session in executor); now calls `generateReply()` directly |
| ✅ | health/user-check | Was emailing owners of soft-deleted workspaces; now filters to active only |
| ✅ | knowledge-base + templates PATCH | Raw body passed to Supabase (workspace_id injection); now field-whitelisted with length caps |
| ✅ | accept-invite | Double `clerkClient()` call creating TOCTOU race window; reuses single instance |
| ✅ | vercel.json | Sync cron was `0 8 * * *` (once daily); corrected to `0 */4 * * *` (every 4h) |
| ✅ | DELETE /api/apps/[id] | Hard-deleted rows, cascading all review history; now soft-deletes via `deleted_at` |
| ✅ | Automation scope check | `review.id.startsWith(appId)` never matched (external store ID vs Supabase UUID); fixed to `scopeIds.includes(appId)` |
| ✅ | reports/export | Unvalidated `days`/`rating` params produced NaN → Supabase crash; now allowlist-validated |
| ✅ | demo/reply | No input length cap on reviewBody; capped at 500 chars |
| ✅ | settings/workspace | Slack webhook URL stored without validation (SSRF risk); now requires `https://hooks.slack.com/` prefix |
| ✅ | aso/mine | Selected nonexistent `text` column (correct: `body`); n-gram mining now works |

### Security Audit Pass 1 (2026-05-23, merged in `feat/bootstrap-reviews`)

| ID | Area | Fix |
|---|---|---|
| ✅ | All cron routes | `isAuthorized()` was fail-open when `CRON_SECRET` unset; now fail-closed |
| ✅ | Dashboard | Error banner hidden for apps that previously succeeded but are now failing; reordered banner logic |
| ✅ | bootstrap-reviews | `gplay.reviews()` had no timeout; wrapped in 15s `Promise.race` |
| ✅ | middleware | `/api/health(.*)` was dead code in `isAppRoute`; removed |
| ✅ | unreplied-alert | `.single()` on workspace member query throws when no owner row; changed to `.maybeSingle()` |

### Codebase Audit (2026-05-19–22, merged via `claude/aso-mining` + `claude/picture-perfect`)

| ID | Area | Fix |
|---|---|---|
| ✅ | BLOCKER | `supabase-server.ts` used Postgres pooler URL with supabase-js (wrong API); now uses HTTPS REST URL only |
| ✅ | BLOCKER | `aso_keywords` table schema mismatch; recreated with correct columns via migration 007 |
| ✅ | BLOCKER | `automation_rules.action_label` column missing; added via migration |
| ✅ | BLOCKER | `alert_preferences` schema misaligned; columns added via migration |
| ✅ | BLOCKER | `/api/aso/suggest` queried nonexistent `reviews.text` and `apps.description`; fixed to `body` |
| ✅ | HIGH | `useDashboardMetrics` showed hardcoded fallback metrics (127 unreplied / 9 urgent) on errors; removed |
| ✅ | HIGH | `/api/reviews` returned mock data on failure, hiding real errors; mock fallback removed |
| ✅ | HIGH | Missing `"use client"` on `src/hooks/use-incidents.ts` |
| ✅ | HIGH | `/api/incidents` GET returned 404 (not empty array) when user had no workspace |
| ✅ | HIGH | `/api/sentry-example-api` always-500 test route deleted |
| ✅ | HIGH | `/api/demo/reply` used in-memory Map for rate limiting (useless on serverless); switched to Upstash Redis |
| ✅ | HIGH | Stripe webhook created fresh Supabase client per event; now uses `getServiceClient()` singleton |
| ✅ | HIGH | `/api/reviews/[id]/reply` did not reject soft-deleted workspace |
| ✅ | HIGH | `/api/onboarding/complete` did not validate slug format server-side |
| ✅ | MEDIUM | CSV export missing `X-Total-Count` / `X-Truncated` headers |
| ✅ | MEDIUM | `session.reload()` not wrapped in try/catch on onboarding page |
| ✅ | MEDIUM | `BYPASS_AUTH` test-only env var removed |
| ✅ | MEDIUM | Stripe checkout did not cache `stripe_customer_id` on workspace |
| ✅ | MEDIUM | Weekly digest cron processed workspaces serially; now parallel batches of 10 |
| ✅ | MEDIUM | `/api/health` returned 200 without pinging Supabase; now returns 503 on DB failure |

---

## How to use this file

- **Adding a bug:** append to the Open section with next sequential ID (`BUG-NNN`), severity, area, description, and file path(s).
- **Fixing a bug:** move the row to the relevant Fixed section with ✅, add the fix description, and note the branch/PR.
- **Severity guide:**
  - 🔴 CRITICAL — paying user notices immediately or data loss risk
  - 🟠 HIGH — power user hits this day 1
  - 🟡 MEDIUM — noticeable but has a workaround
  - 🟢 LOW — edge case, NIT, or missing polish
