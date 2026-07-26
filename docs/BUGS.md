# ReviewBox — Bug Tracker

Last updated: 2026-07-25

Legend: 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW · ✅ Fixed

> Full context for the 2026-07-25 entries: **`docs/MARKET_READINESS_AUDIT.md`**.

---

## Open Bugs

| ID | Severity | Summary | File(s) | Status |
|----|----------|---------|---------|--------|
| BUG-040 | 🟠 HIGH | **A Clerk outage takes down the whole marketing site, not just the app.** `clerkMiddleware` wraps every path in `config.matcher`, so when Clerk can't resolve the instance every route — including `/`, `/pricing`, `/privacy`, `/terms`, `/help` — returns HTTP 400 with a Clerk error JSON body instead of the page. Observed directly in CI run #1: public marketing pages served `{"errors":[{"message":"Invalid host","code":"host_invalid"}]}`. Means a Clerk incident or a botched key rotation removes the pages people need in order to sign up, plus the legal pages | `src/middleware.ts` | Open — fix: let public/marketing routes short-circuit before Clerk runs, keeping the host-based subdomain redirects. Security-critical file; wants its own PR + review, not a tail-end change |
| BUG-042 | 🟡 MEDIUM | **The `Security audit` job is green but is not actually auditing anything.** Two separate faults. (a) The gate conflated "a critical advisory exists" with "the registry did not answer" — both exit 1 — so a frontend-only commit was blocked by npm infrastructure. Fixed: 3× retry, still fails on real advisories, and on persistent registry failure passes with a loud `::warning::` marking the run UNVERIFIED rather than silently green. (b) The underlying reason it can never verify: `npm audit` POSTs to `/-/npm/v1/security/advisories/bulk`, gets **HTTP 200**, fails to use the body (`silly audit bulk request failed undefined`), falls back to the legacy `/security/audits/quick` endpoint that npm's own notice says is being retired, and that returns `400 Invalid package tree`. Lockfile is clean — v3, npm 10.9.7, no workspaces, 874 packages, 0 missing `resolved` — so the lockfile is not at fault. Reproduced on every CI run and locally, and on npm 10.9.7 and 12.0.1 alike. Under npm 12 the parse error is explicit: the bulk body begins `1f 8b 08` (gzip magic) and is never decompressed. **Caveat: the gzip detail was observed locally, behind a sandbox HTTPS proxy that CI does not use, so the compression layer may be a local artifact — what is proven for CI is only that bulk returns 200, is unusable, and the quick fallback 400s.** | `.github/workflows/ci.yml` | Partly fixed — the gate is honest, but advisory coverage is **zero** until this is resolved. Next step: verify the bulk response outside a proxy, then either pin a working npm or replace `npm audit` with a scanner that does not depend on it (GitHub Dependabot alerts / `dependency-review-action` / `osv-scanner`). Do not treat green here as "no vulnerabilities" in the meantime |
| BUG-041 | 🟢 LOW | GitHub Actions artifact storage quota is full — `Failed to CreateArtifact: Artifact storage quota has been hit`. Playwright reports can't upload, so a failing e2e run gives no artifact to inspect | `.github/workflows/ci.yml` | Open — **HUMAN-REQUIRED**: delete old artifacts in GitHub → Actions, or lower `retention-days` |
| BUG-037 | 🟠 HIGH | All 20 e2e specs fail without real Clerk credentials. CI run #1 gave the precise cause: the CI publishable key is structurally valid (server boots) but names a Clerk instance that doesn't exist, so Clerk answers every request — public pages included — with `{"errors":[{"message":"Invalid host","code":"host_invalid"}]}`. Not fixable from the app side. (Separately confirmed against a clean `master` worktree that protected routes 404 rather than redirect under placeholder creds — also not a regression.) E2E job is `continue-on-error` until fixed | `.github/workflows/ci.yml`, `tests/e2e/auth-flow.spec.ts` | Open — **HUMAN-REQUIRED**: add Clerk test-instance keys as GitHub repo secrets, then drop `continue-on-error` |
| BUG-036 | 🟡 MEDIUM | `npm audit --audit-level=high` can't pass — 12 high advisories remain after `npm audit fix`; fixes need semver-major (ESLint 9, `eslint-config-next` 16 → pulls Next 16, deferred in CLAUDE.md) or don't exist yet (`next`, `postcss`, `sharp`) | `package.json`, `.github/workflows/ci.yml` | Open — CI now blocks on `critical` only, high is advisory. Revisit with the Next 16 upgrade |
| BUG-020 | 🔴 CRITICAL | Reviews are US/English only (`lang:"en", country:"us"` hardcoded) while the dashboard shows the store's **global** lifetime review count — the two numbers cannot reconcile for a non-US app | `src/services/bootstrap-reviews.ts`, `src/services/store-search.ts` | Open — FOUNDER DECISION: disclose US-only in UI (1h) or fan out locales (costs 8× scrape volume) |
| BUG-021 | 🟠 HIGH | Whole product now depends on scraping Google Play from Vercel datacenter IPs — Google rate-limits these; no proxy, no fallback. A block is a total outage | `src/services/bootstrap-reviews.ts` | Open — accepted risk per D018; Sentry alerting added 2026-07-25, watch it |
| BUG-022 | 🟠 HIGH | Sync latency is 24h (Vercel Hobby cron cap) — weak for a "respond fast to bad reviews" product at $99/mo | `vercel.json` | Open — fix: Supabase `pg_cron` + `pg_net` (free, extension already enabled) |
| BUG-023 | 🟡 MEDIUM | No e2e test covers the spine (sync → draft → mark replied → sync again). The one flow that must not break has no automated test | `tests/e2e/` | Open — this single test would have caught BUG-024/025/028 |
| BUG-026 | 🟢 LOW | `/admin/customers` doesn't filter soft-deleted workspaces — deleted accounts show as live customers in the MRR view | `src/app/admin/customers/page.tsx` | Open |
| BUG-027 | 🟢 LOW | `tsconfig.tsbuildinfo` (640 KB) committed despite being in `.gitignore` | repo root | Open — `git rm --cached tsconfig.tsbuildinfo` |
| BUG-001 | 🔴 CRITICAL | No billing/payment path — Stripe keys unset, no plan gates on gated features | `src/app/api/stripe/*` | Open — HUMAN-REQUIRED: founder pastes Stripe keys |
| BUG-002 | 🔴 CRITICAL | Competitors screen shows illustrative placeholder data, not real competitor apps | `src/features/competitors/components/competitors-screen.tsx` | Open — M4 scope (X6) |
| BUG-006 | 🟡 MEDIUM | 2 of 4 report types are placeholder stubs (crash report, retention report) | `src/features/reports/components/reports-screen.tsx` | Open — M3 scope |
| DS-001 | 🟡 MEDIUM | `#5B5BD6` indigo used across Reply Kit + Automations (10 files, ~40 usages) with no `--rb-*` token defined | `src/features/reply-kit/*`, `src/features/automations/*` | Open — fix: add `--rb-indigo-500/600` to `globals.css` (10 min) |
| DS-002 | 🟡 MEDIUM | 86 raw `<button>` elements in place of `<Button>` component — missing focus rings, disabled states, accessibility | `src/features/reviews/components/review-queue.tsx` (22), `src/features/aso/components/aso-screen.tsx` (17), 30 other files | Open — see backlog DS4 |
| DS-003 | 🟢 LOW | 1,095 raw `gray-*` Tailwind classes bypass `--rb-*` token system — dark mode unreliable in affected components | 69 files | Open — see backlog DS3, fix top offenders first |
| DS-004 | 🟢 LOW | Marketing pages use `dark:text-[#F5F5F7]` / `dark:bg-[#161618]` hardcoding token values instead of `text-fg-*` / `bg-surface` | 20+ marketing pages | Open — refactor when touching those pages |

---

## Fixed Bugs

### Fixed in `claude/product-market-readiness-zcfowh` (2026-07-25)

Market-readiness audit. **Every one of these passed `tsc`, `eslint`, 80 unit
tests, and the production build.** All were state-over-time bugs — correct on
first execution, wrong on the second. See `docs/MARKET_READINESS_AUDIT.md`.

| ID | Severity | Summary | Fix |
|----|----------|---------|-----|
| BUG-024 | 🔴 CRITICAL | Public scraper ran only when an app had **zero** reviews; every later sync used the Publisher API, which Draft Mode customers have no credentials for. Reviews stopped updating after day one, `last_sync_status` pinned to a failure code, red dashboard banner forever — **and the "hasn't synced in 2 days" nag email every 3 days that the founder had been receiving for a month.** Contradicted D018 | Scraper is now the primary path on **every** sync for both stores. Official APIs are optional enrichment (developer replies + device) whose absence no longer fails the sync |
| BUG-025 | 🔴 CRITICAL | `upsert onConflict (app_id, external_id)` rewrote every column from store data, so a saved AI draft or a Draft Mode "mark as replied" was reset to `needs_reply` on the next sync. iTunes RSS never reports developer replies → **every App Store review reset on every sync**, including API-posted ones | Sync inserts only unseen reviews; promotes `needs_reply → replied` when the store shows a reply it lacked; never downgrades. Extracted to `src/lib/sync-writes.ts` + 12 regression tests |
| BUG-028 | 🔴 CRITICAL | `middleware.ts` gated `/api/reply(.*)` to `starter\|pro\|team`, but onboarding stamps every user `plan: "trial"` — so **no trial user could generate an AI draft**, with no way to pay (Stripe deferred, D013). The 307 to an HTML page also broke the caller's `res.json()` | `trial` added to entitled plans (expiry still enforced separately); API billing blocks return `402` JSON |
| BUG-029 | 🟠 HIGH | `/api/health/user-check` had no `deleted_at` filter on apps and checked workspace liveness for only 1 of 3 signals. A soft-deleted app's `last_sync_attempted_at` freezes → satisfies "failing 48h+" forever → nags the owner every 3 days about an app they deleted | `deleted_at IS NULL` on apps; workspace liveness on all three signals; never-synced email copy no longer contradicts Draft Mode |
| BUG-030 | 🟠 HIGH | Inbox cursor paginated on `store_created_at` alone with `.lt()` — every review sharing the last row's timestamp was skipped and became unreachable. Common, since store feeds batch to the same second and the scraper falls back to `now()` on unparseable dates | Composite `timestamp\|id` cursor with matching tiebreak order; legacy cursors still accepted |
| BUG-031 | 🟠 HIGH | `/api/reviews` had no app filter at all — soft-deleted apps' reviews lingered forever, and the sidebar app selector (primary nav for the 2–4 app ICP in D017) was decorative | Scoped to live apps; `appId` filter added and wired to the selector; "All apps" option added; selection moved from app name to app id |
| BUG-032 | 🟡 MEDIUM | `GOOGLE_PRIVATE_KEY` parsed at module load — a malformed key threw during import, taking down **every route importing `publisher-api.ts`** (sync, reply) with an opaque module-init failure | Parsed lazily inside `getPlayClient()` |
| BUG-033 | 🟡 MEDIUM | Sync failures were `console.warn` only. Now that the scrape is the primary data path, an outage was invisible until a churn email | `Sentry.captureMessage` on every failed app sync |
| BUG-034 | 🟢 LOW | Automation rules re-ran against every synced row each day, re-firing auto-draft/auto-reply on months-old reviews | Rules now fire on newly-inserted reviews only |
| BUG-035 | 🟢 LOW | Leftover `sentry-example-page` scaffold shipped in the build | Removed |
| BUG-038 | 🔴 CRITICAL | **CI had never run — not once, on any branch, ever.** `ci.yml` triggers on `main`; the default branch is `master` and no `main` has ever existed. GitHub Actions API reports `total_count: 0` across 45 branches and every merged PR. D000's "the merge button is greyed out until all pass" was never true; every "CI green" note in the docs came from an agent running commands locally | Trigger fixed to `master` + unfiltered `pull_request` (so a branch rename can't silently disable it again). Build, type-check, lint and unit tests now block and all four pass on this branch |
| BUG-039 | 🟠 HIGH | The e2e job could never have passed regardless: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_ci-placeholder` isn't a structurally valid Clerk key (Clerk base64-decodes it for the frontend API domain), so every request threw `Publishable key not valid`, `next dev` never became ready, and Playwright timed out at 120s. Reproduced directly | Replaced with a decodable dummy (`pk_test_` + base64 of `ci-placeholder.clerk.accounts.dev$`) and added the sign-in/sign-up URL vars. Verified: dev server boots, serves 200 on `/`, `/pricing`, `/sign-in`, `/help` |

### Fixed in `fix/reply-ux-and-onboarding-skip` (2026-05-29)

| ID | Severity | Summary | Fix |
|----|----------|---------|-----|
| BUG-016 | 🟠 HIGH | Draft save was fire-and-forget — no loading state, no success feedback, no cache update, no error handling | Added `isSavingDraft`/`draftSaved` state, proper try/catch, cache update to `draft_ready` via new `useMarkDraft()` hook |
| BUG-017 | 🟠 HIGH | Reply credential errors auto-cleared after 4s with no actionable CTA — user had no idea how to fix | Credential errors now stay visible + show "Set up in Settings →" link. Other errors extended to 5s. `REPLY_TOO_LONG` + network errors added as explicit cases |
| BUG-018 | 🟡 MEDIUM | Onboarding step 3 heading "One thing before reviews can sync" implied connection was required before proceeding — users with no service account knowledge dropped here | Heading reframed to "Connect X to sync reviews". Primary CTA changed to "I've done this — launch workspace". Added "I'll connect later" skip link |

### Fixed in `fix/metadata-scrape-cache` (2026-05-29)

| ID | Severity | Summary | Fix |
|----|----------|---------|-----|
| BUG-019 | 🟡 MEDIUM | `fetchGooglePlayMetadata()` and `fetchAppStoreMetadata()` scraped the store on every call — onboarding search, onboarding/complete, and daily sync each triggered independent scrapes for the same app | Added Redis 6h TTL cache (keys `meta:gplay:{id}` / `meta:appstore:{id}`). Best-effort: Redis errors fall through to live scrape |

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
