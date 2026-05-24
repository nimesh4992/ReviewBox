# ReviewBox — Bug Tracker

Last updated: 2026-05-24

Legend: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW · ✅ Fixed

---

## Open Bugs

| ID | Severity | Summary | File(s) | Status |
|----|----------|---------|---------|--------|
| BUG-001 | 🔴 CRITICAL | No billing/payment path — Stripe keys unset, no plan gates on gated features | `src/app/api/stripe/*` | Open — needs Stripe keys + dashboard config |
| BUG-002 | 🔴 CRITICAL | Competitors screen shows hardcoded Finance mock data, not real competitor info | `src/features/competitors/components/competitors-screen.tsx` | Open — M4 scope |
| BUG-006 | 🟡 MEDIUM | 2 of 4 report types are placeholder stubs (crash report, retention report) | `src/features/reports/components/reports-screen.tsx` | Open — M3 scope |

---

## Fixed Bugs

### Fixed in `fix/bugs-batchfix-001` (2026-05-24)

| ID | Severity | Summary | Fix |
|----|----------|---------|-----|
| BUG-003 | 🟠 HIGH | No "Publish reply" button in review card UI | Already existed as "Post reply" button in ReplyComposer — confirmed present |
| BUG-004 | 🟠 HIGH | Team invite UI missing — backend done, no settings UI | Created `team-members.tsx` component + `/api/team/members` + wired into settings |
| BUG-005 | 🟠 HIGH | `report_spam` automation only added tag, didn't set `escalation_state: "support"` | Fixed in `automation-executor.ts` |
| BUG-007 | 🟡 MEDIUM | Incidents POST didn't fire Slack alert | Already fixed in master — `notifySlack()` was present |
| BUG-008 | 🟡 MEDIUM | GDPR export audit action was `"workspace.create"` instead of `"gdpr.export"` | Fixed `gdpr/export/route.ts` + `gdpr/delete/route.ts`; added `"gdpr.export"` + `"gdpr.delete"` to AuditAction union |
| BUG-009 | 🟢 LOW | `deleteReply()` in connect-api.ts didn't check `res.ok` | Added `res.ok` check + throws on non-404 errors |
| BUG-010 | 🟢 LOW | Team invite token: no email-match check; double `clerkClient()` TOCTOU bug | Added email-match check; fixed to single `clerkClient()` instance |
| BUG-011 | 🟢 LOW | No `audit()` on app create/update/delete; GET didn't filter soft-deleted apps; DELETE was hard-delete | Added `audit()` calls; `deleted_at IS NULL` filter on GET; soft-delete on DELETE |
| BUG-012 | 🟢 LOW | `incidents/[id]` PATCH: no status validation, no owner length cap | Added `VALID_STATUSES` allowlist + 120-char owner cap |
| BUG-013 | 🟢 LOW | `automations/rules` POST/PATCH: no action validation, no name/conditions caps | Added `VALID_ACTIONS` allowlist, `NAME_MAX_LEN=120`, `CONDITIONS_MAX=10` to both routes |
| BUG-014 | 🟢 LOW | No request timeouts on external API calls (Google Play, App Store Connect) | Added 15s `Promise.race` timeout in publisher-api.ts; `AbortSignal.timeout(15000)` in connect-api.ts |
| BUG-015 | 🟢 LOW | sync/reviews fire-and-forget fanout could silently drop workspace errors | Already addressed in master — per-app try/catch + `recordSyncResult()` with error detail |

---

### Fixed in earlier passes (before this branch)

| ID | Severity | Summary | Merged in |
|----|----------|---------|-----------|
| SEC-001 | 🔴 | `supabase-server.ts` using Postgres pooler URL with supabase-js | `claude/aso-mining` |
| SEC-002 | 🔴 | `aso_keywords` table schema mismatch | migration 007 |
| SEC-003 | 🔴 | `automation_rules.action_label` column missing | migration applied |
| SEC-004 | 🔴 | `/api/aso/suggest` querying non-existent columns | `claude/aso-mining` |
| SEC-005 | 🔴 | `BYPASS_AUTH` env var allowed auth bypass | `claude/picture-perfect` |
| AUD-001 | 🟠 | Cron `isAuthorized()` fail-open when `CRON_SECRET` unset | `feat/bootstrap-reviews` |
| AUD-002 | 🟠 | `gplay.reviews()` had no timeout | `feat/bootstrap-reviews` |
| AUD-003 | 🟠 | Fake fallback metrics shown on dashboard errors | `claude/picture-perfect` |
| AUD-004 | 🟠 | Mock review fallback hiding real failures in `/api/reviews` | `claude/picture-perfect` |
| AUD-005 | 🟠 | `/api/demo/reply` using in-memory Map for rate limiting (useless on serverless) | `claude/picture-perfect` |
| AUD-006 | 🟠 | Stripe webhook creating fresh client per request | `claude/picture-perfect` |
| AUD-007 | 🟠 | `/api/reviews/[id]/reply` missing soft-delete workspace check | `claude/picture-perfect` |
| AUD-008 | 🟡 | CSV export missing `X-Total-Count` / `X-Truncated` headers | `claude/picture-perfect` |
| AUD-009 | 🟡 | `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` pointing to `/onboarding` | fixed in env |
| AUD-010 | 🟡 | `revi.app` branding in email templates / sitemap / robots | `claude/picture-perfect` |
| AUD-011 | 🟡 | `ai_reply` automation calling HTTP to `/api/reply/draft` (always 401) | re-fixed in BUG-005 above (regression) |
| AUD-012 | 🟡 | `health/user-check` emailing owners of soft-deleted workspaces | `feat/bootstrap-reviews` |
| AUD-013 | 🟡 | `knowledge-base` + `templates` PATCH: workspace_id injection via raw body | `feat/bootstrap-reviews` |
| AUD-014 | 🟡 | `accept-invite`: double `clerkClient()` TOCTOU | re-fixed in BUG-010 above (regression) |
| AUD-015 | 🟡 | `vercel.json` sync cron running once daily instead of every 4h | `feat/bootstrap-reviews` |
| AUD-016 | 🟡 | `DELETE /api/apps/[id]` hard-deleting rows | re-fixed in BUG-011 above (regression) |
| AUD-017 | 🟡 | Automation scope check using `review.id.startsWith(appId)` (never matched) | `feat/bootstrap-reviews` |
| AUD-018 | 🟡 | `export` route: unvalidated `days`/`rating` params → NaN crash | `feat/bootstrap-reviews` |
| AUD-019 | 🟡 | `demo/reply` no input length cap on reviewBody | `feat/bootstrap-reviews` |
| AUD-020 | 🟡 | Slack webhook URL stored without `https://hooks.slack.com/` validation | `feat/bootstrap-reviews` |
| AUD-021 | 🟡 | `aso/mine` querying non-existent `text` column (correct: `body`) | `feat/bootstrap-reviews` |
| AUD-022 | 🟢 | `middleware.ts` `/api/health` not matched by auth bypass pattern | `feat/bootstrap-reviews` |
| AUD-023 | 🟢 | `rate-limit.ts` double Redis prefix bug (`ai_draft:ai_draft:userId`) | `feat/bootstrap-reviews` |
| AUD-024 | 🟢 | `reply/draft` no length cap on reviewBody | `feat/bootstrap-reviews` |
| AUD-025 | 🟢 | `incidents` POST unvalidated severity + unbounded title/description | `feat/bootstrap-reviews` |
| AUD-026 | 🟢 | `settings/alerts` POST unbounded array upsert | `feat/bootstrap-reviews` |
| AUD-027 | 🟢 | `gdpr/delete` no rate limit | `feat/bootstrap-reviews` |
| AUD-028 | 🟢 | `settings/workspace` PATCH `defaultTone` accepted any string | `feat/bootstrap-reviews` |
| AUD-029 | 🟢 | `sync/reviews` bootstrap rows double-counted in `last_sync_review_count` | `feat/bootstrap-reviews` |
| AUD-030 | 🟢 | `publisher-api.ts` raw googleapis error logged (could contain auth tokens) | re-fixed in BUG-014 above (regression) |
