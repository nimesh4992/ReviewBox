# User-Role & Access-Control Audit

**Date:** 2026-07-27 · **Scope:** every page/layout under `src/app/**` and all 67 API route files under `src/app/api/**` · **Method:** two independent full-codebase sweeps (API authorization; page/UI role gating) + manual trace of role-helper usage. Evidence cited as `file:line`. **No fixes applied — findings only.**

## The role model that actually exists

| Actor | Where defined | Enforced? |
|---|---|---|
| Anonymous visitor | middleware `isPublicRoute` | ✅ consistently (4 pages mis-tiered, see P1-5) |
| Signed-in, no workspace | page-level only | ✅ degrades gracefully everywhere, zero crashes |
| Workspace **member** | `workspace_members.role` | ⚠️ treated as full owner by ~90% of routes |
| Workspace **admin** | same | ⚠️ meaningful in 2 routes only |
| Workspace **owner** | same | ✅ on the 3 most catastrophic actions only |
| Platform admin | `ADMIN_CLERK_USER_ID` | ✅ fail-closed, consistent (layout + all /api/admin) |
| Machine (cron/Stripe) | `CRON_SECRET` / signature | ✅ fail-closed except one route (P0-6) |

**Core numbers:** role checks exist in **6 of 67 routes** (`apps/[id]` PATCH+DELETE, `settings/workspace` PATCH, `gdpr/delete`, `account/cancel`, `account/restore`, `team/invites` POST). **Zero client components** read the caller's role — every owner-grade control renders for every member. There is no `useWorkspaceRole` hook and no role field in the workspace store.

## What is genuinely solid ✅

1. **Tenant isolation passes.** Across all 67 routes, no cross-workspace read or write was found. Every id taken from a request is re-verified against the caller's workspace (`.eq("id", …).eq("workspace_id", …)` pattern) — reviews, incidents, templates, KB, rules, apps, keywords, exports. This is the existential SaaS property and it holds.
2. Every route re-checks `auth()` in-handler — nothing relies on middleware alone.
3. The three most catastrophic actions are owner-only: workspace cancel (`account/cancel:46`), hard GDPR delete (`gdpr/delete:64`), restore (`account/restore:32`). Invites require owner/admin (`team/invites:88`).
4. Platform-admin gate is fail-closed (`lib/admin-auth.ts`) and consistently applied.
5. Cron routes fail closed on missing `CRON_SECRET` (trial-nudge, digests, user-check) — one exception below.
6. Stripe webhook verifies signatures + dedupes replays.
7. No page crashes for a workspace-less user; server pages guard with explicit null checks, hooks fall back to empty states, error boundaries report to Sentry.

## P0 — fix before the first real team invite

*Today most workspaces are one person, so live exposure is limited. Every one of these becomes real the day a customer invites a teammate (the $199 Team plan depends on that).*

1. **Any member can exfiltrate the whole tenant, including store credentials.** `POST /api/gdpr/export` has no role check (`gdpr/export/route.ts:13-24`) and dumps `apps.*` — which contains `access_token`/`refresh_token`, i.e. the App Store Connect key JSON and the raw `.p8` private key — plus `workspaces.*` (Slack webhook, Stripe customer id) and the full audit log. Its sibling `gdpr/delete` is owner-gated; export must be too.
2. **The Slack OAuth callback bypasses the webhook protection.** `settings/workspace` PATCH is admin-gated specifically so "a plain member must not point alerts at an attacker-controlled webhook" (`settings/workspace/route.ts:72`), but `auth/slack/callback/route.ts:122-145` overwrites `workspaces.slack_webhook_url` with only membership. Same gap: any member can disconnect Slack entirely (`DELETE /api/settings/slack`, no role check) and make the server post to an arbitrary `hooks.slack.com` URL (`settings/slack/test:17-52`).
3. **Any member can switch on auto-reply for every app.** `automations/rules` POST/PATCH have no role gate; POST hardcodes `enabled: true` with `action: "ai_reply"` and `apps_scope: "all"` (`automations/rules/route.ts:91-93`), executed against synced reviews by `sync/reviews/route.ts:385`. Publishing replies in the customer's brand name is an owner-trust action.
4. **Stripe portal has no workspace binding at all.** `stripe/portal/route.ts:33-38` resolves the customer purely by the caller's Clerk **email** — no `getWorkspaceId`, no role check. Latent while D013 keeps Stripe off, but it is the worst-shaped route in the codebase and must not go live as-is. `stripe/checkout:68-73` also lets any member overwrite `workspaces.stripe_customer_id`, which later routes webhook events.
5. ~~**Middleware matcher gaps break real features on the prod app host.**~~ **FIXED 2026-07-27 (R1).** `/api/import/*`, `/api/competitors/*`, `/api/auth/slack/*` added to the app-route matcher; `/api/cron/(.*)` added to the public matcher (machine-authenticated via CRON_SECRET, like the sibling digest crons). On `app.tryreviewbox.com` these no longer redirect to `/dashboard` before auth runs — AppFollow import, Slack OAuth, the Competitors add-flow, and the trial-nudge cron work in production again.
6. **Review sync fails open outside production.** `sync/reviews/route.ts:44` returns *authorized* when `CRON_SECRET` is unset and `NODE_ENV !== "production"`, on a route that is PUBLIC in middleware and can fan out over all workspaces. Preview deployments are the risk surface.

## P1 — trust, honesty, and half-built role UX

7. **The UI lies to members.** Owner-only buttons render for everyone and fail late or silently: both "Delete account" flows show scary confirms then `alert()` on 403 (`data-privacy-section.tsx:111`, `danger-zone.tsx:139`); **`WorkspaceDefaults` shows "Saved ✓" even when the API returned 403** — no `res.ok` check (`settings-sections.tsx:45-58`) — silently losing brand-voice edits, the #1 AI-quality lever; Slack paste-URL "Disconnect" always claims success (`slack-integration.tsx:148-161`).
8. **Two competing delete-account flows on one settings page** (hard GDPR delete + soft 30-day cancel), different confirms, both shown to everyone (`settings/page.tsx:28-29`).
9. **Role management is half-built.** You can *grant* admin via invite (`team-members.tsx:144-151`) but there is **no UI for anyone — including the owner — to remove a member, revoke an invite, or change a role.** The invite `role` is also not allowlisted in the handler (`team/invites:72,106`); only a DB CHECK stops an invite minting `owner`.
10. **Billing page + user menu expose checkout/portal to every role** (`billing/page.tsx:99-129`, `user-menu.tsx:144-153`). Fine to view; actions should be owner-only when Stripe lands.
11. **Four public legal pages are accidentally auth-gated** — `/refund`, `/refund-policy`, `/cookies`, `/acceptable-use` are missing from `isPublicRoute`, yet linked from public legal pages and listed in the sitemap; anonymous visitors and crawlers get bounced to sign-in. (Website slice 3 will merge the refund pair anyway.)
12. **Invite links die for signed-in users.** `sign-up/page.tsx:12-14` (and sign-in) unconditionally redirect authed users to `/dashboard`, discarding `?redirect_url=/invite/<token>` — the invite is silently lost.
13. **App connection is asymmetric:** any member can *add* an app (`/api/apps` POST, plan-gated only) but only admins can edit/delete one (`apps/[id]:29,103`). Pick one policy.

## P2 — hygiene

14. **Mock data still renders as if real, for every role:** Releases page shows a hardcoded release-health table (`releases/page.tsx:34` ← `operations.ts:143`); Reply Kit Tags + AI Styles render `mockTags`/`mockAIStyles` unconditionally; AutomationHub and AlertPreferences seed mock state before fetch. Violates the "show, don't claim" honesty rule for brand-new users.
15. **Dead buttons:** Settings "Manage access", Releases "Pause rollout"/"New release", Automations header "Add rule" — enabled, no handlers.
16. **`audit()` gaps on mutations:** onboarding/setup, import/appfollow, reports/export (a data-egress action with no trail), stripe/checkout+portal, aso/keywords (all methods), apps/[id]/test-credentials, reviews/[id]/translate; `reviews/bulk-action` audits without `request` (no IP/UA).
17. **`rateLimit()` gaps:** account/restore, apps POST, automations writes, settings/alerts POST, reply-kit `[id]` writes, aso routes, incidents PATCH, import GET, /api/health (unauthenticated DB ping), admin/tickets*. Reminder: the limiter **fails open** when Upstash env is missing (`api-rate-limit.ts:58-61`) — including on the unauthenticated `/api/demo/reply` Groq endpoint.
18. **Info disclosure to members:** `/api/debug/sync-status` returns `GOOGLE_CLIENT_EMAIL` + raw sync errors; `/api/team/members` + `/api/team/invites` GET enumerate Clerk IDs/emails to any member (defensible, but note it).
19. **Admin child pages fetch before the layout guard** — output never reaches non-admins, but the guard isn't a data-fetch boundary; each `/admin/*` page could re-assert `isAdminUser` (defense in depth).
20. **Multi-workspace is undefined behavior:** `getWorkspaceId` picks the first membership (`supabase-server.ts:26-35`, `limit 1`, no ordering); onboarding routes use `.maybeSingle()` on membership and would error for a two-workspace user. Fine under D014, but nothing prevents the state from arising via invites.

## Verdict

- **Tenant isolation (customer A vs customer B): A-.** Zero cross-workspace holes in 67 routes. This is the one that kills SaaS companies, and it's clean.
- **Internal roles (owner vs member): C-.** The model exists in the schema and in six routes; everywhere else "member" means "owner", and the UI pretends roles don't exist. Acceptable for solo workspaces today; not acceptable the day the Team plan sells.
- **One real production bug cluster** (P0-5 middleware matchers) found as a side effect — worth fixing regardless of roles.

**Suggested order:** P0-5 (fixes broken features), then P0-1/2/3 as one "role-enforcement pack" with a shared `requireWorkspaceRole` helper + role-aware UI hiding, then P0-4/6 before Stripe/preview exposure. Backlog entries R1–R3 added (see `docs/backlog.md`).
