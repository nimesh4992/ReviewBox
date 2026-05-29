# ADR 006: Slack OAuth v2 Integration

**Status:** Proposed
**Date:** 2026-05-26
**Backlog item:** X1

---

## Context

Backlog item X1 asks for workspace owners to connect Slack and receive alerts for rating spikes, new incidents, and urgent unreplied reviews. ADR 001 (2026-05-25) already shipped an Incoming Webhook implementation: the owner manually creates a webhook in Slack and pastes the URL into Settings. That implementation is live in production and covers the notification delivery path completely.

ADR 001 explicitly deferred Slack OAuth with a note: "Requires a Slack app listing, a redirect URI, token storage... Rejected because it adds ~4h of plumbing for features that can ship in a later ADR once there are paying customers asking for them."

This ADR designs the OAuth upgrade. The trigger is that the Incoming Webhook model has two user-experience gaps that paying customers will hit immediately:

1. **No channel picker in-product.** The owner must leave ReviewBox, navigate Slack's app-install flow, pick a channel there, copy a URL, and paste it back. This is friction that AppFollow eliminates with a one-click OAuth connect.
2. **No visibility into which channel is connected.** The settings UI shows the raw `https://hooks.slack.com/services/T.../B.../xxx` URL — opaque to non-technical founders.

OAuth v2 with a bot token fixes both: ReviewBox fetches the workspace's channel list and presents a dropdown, the owner picks a channel, and the token is stored. The connection reads as "connected to #reviews" rather than a URL string.

The existing `src/lib/slack.ts` notification layer (`sendSlackNotification`, `notifySlack`, `notifyRatingSpike`, `notifyUrgentReview`, `dedupAndNotifySlack`) does not change. Only the connection method and storage change.

---

## Decision

**Connection method:** Slack OAuth v2, `Add to Slack` button flow. Scopes: `incoming-webhook` + `channels:read` + `groups:read`. The `incoming-webhook` scope issues a per-channel webhook URL at OAuth completion — this means the notification delivery path (`sendSlackNotification`) remains unchanged. No `chat:write` bot token is needed.

**Why `incoming-webhook` scope instead of `chat:write`:** The `incoming-webhook` scope returns a webhook URL scoped to exactly one channel. This means the existing `sendSlackNotification(webhookUrl, payload)` call in `slack.ts` continues to work without modification — no Slack Web API client, no `chat.postMessage` call, no bot token management. `channels:read` and `groups:read` are added solely to power the channel picker UI via `conversations.list`.

**Channel selection:** After OAuth completes, ReviewBox calls `conversations.list` with the user token to fetch the workspace's public channels (and private channels the bot was added to). The user picks one from a dropdown in Settings. The selected channel's name and ID are stored alongside the webhook URL.

**Token storage:** The OAuth access token (needed only for `conversations.list` at connect time and for future revocation checks) is stored in a new `workspace_slack` table, not on the `workspaces` row. The webhook URL returned by OAuth is stored in `workspaces.slack_webhook_url` (already exists, migration 011) so the notification path has zero changes. The OAuth access token is stored plaintext in Postgres behind RLS — same security posture as ADR 001 accepted for the webhook URL. The bot/user access token can post to one channel; risk is bounded.

**CSRF protection:** The OAuth `state` parameter is a 32-byte random hex string generated at authorize-redirect time and stored in a short-lived (`httpOnly`, `SameSite=Lax`, 10-minute TTL) cookie named `slack_oauth_state`. The callback route validates `state` from the query string against the cookie before exchanging the code.

**Revocation on workspace delete:** The `workspace_slack` table has `ON DELETE CASCADE` on `workspace_id`. The GDPR delete route already calls Supabase service-role delete on the workspace row, which cascades. Additionally, the GDPR delete route is updated to call Slack's `auth.revoke` API before the DB delete so the token is invalidated at the Slack side.

**Backward compatibility:** The existing Incoming Webhook path (paste URL manually) remains in the settings UI as a fallback for workspaces that prefer it. If `workspace_slack.access_token` is null but `workspaces.slack_webhook_url` is set, `notifySlack` continues to work unchanged. No migration removes the existing webhook URL column.

---

## Alternatives considered

- **`chat:write` bot token (no `incoming-webhook` scope):** Allows posting to any channel the bot is invited to, supports thread replies and message updates. Rejected because it requires the `chat.postMessage` Slack Web API, a different delivery path than the existing `sendSlackNotification(webhookUrl)`, and a more complex permission model. Saves for a future ADR if thread-reply or message-update features are needed.

- **Store token encrypted at rest (AES-256):** Would require a `SLACK_ENCRYPTION_KEY` env var and encrypt/decrypt wrappers. Rejected on the same grounds as ADR 001: the token can only post to one channel; if the DB is fully compromised, the attacker already has full review data which is more sensitive. Revisit at Team plan tier or if a compliance customer requires it.

- **Per-event-type channel routing (separate webhook per alert type):** Allows spikes to go to `#alerts` and incidents to go to `#incidents`. Would require storing three webhook URLs. Over-engineered for the ICP (indie dev / 2–5 person team). One channel per workspace is sufficient. Defer to a future ADR if a paying customer requests multi-channel routing.

- **Keep Incoming Webhook only, add channel name display:** Slack's `incoming-webhook` object returned by the `incoming-webhook` scope OAuth flow already contains the `channel` name. So the simpler option is to run OAuth only to get the `incoming-webhook` URL with channel metadata, and skip `conversations.list` entirely. Rejected because that approach still requires OAuth — so the complexity delta vs full channel-picker is small — and the channel-picker is the primary UX win.

- **Slack app distribution (public listing):** Listing the ReviewBox Slack app publicly on the Slack App Directory requires Slack's review process. Rejected for this phase; the app will be distributed via a direct install link (`https://slack.com/oauth/v2/authorize?client_id=...`). A public listing can be pursued after launch.

---

## Consequences

**Positive:**
- Owner connects in two clicks (Authorize → pick channel) rather than navigating Slack manually.
- Settings shows "Connected to #reviews" rather than an opaque URL.
- Notification delivery path (`sendSlackNotification`) is unchanged — zero regression risk on alerts.
- Revocation at workspace delete now invalidates the Slack side, not just the DB row.

**Negative:**
- Requires a Slack app to be created in the Slack developer console and `SLACK_CLIENT_ID` + `SLACK_CLIENT_SECRET` added to env. This is HUMAN-REQUIRED (D009 guardrail 10 — founder adds keys).
- `conversations.list` paginates — for workspaces with >200 channels it may need multiple API calls. Mitigated by fetching the first 200 only (covers all ICP workspaces).
- The `incoming-webhook` scope's webhook URL is tied to the bot's membership in the channel. If the bot is removed from the channel in Slack, the webhook silently 404s. The existing `sendSlackNotification` already returns `false` on non-ok responses — no crash, but the alert is lost silently. Mitigation: log a `[slack] webhook 404` warning and surface a "reconnect" prompt in Settings if `notifySlack` returns false.

**Risks:**

| Risk | Mitigation |
|---|---|
| CSRF on OAuth callback | `state` param validated against `slack_oauth_state` cookie (httpOnly, 10-min TTL, SameSite=Lax) |
| OAuth code replay | Slack codes are single-use; callback route exchanges immediately and clears the state cookie |
| Token leaked in server logs | Never log the token; log only the workspace ID and Slack team ID |
| `conversations.list` rate-limited by Slack (tier 2: 20 req/min) | Called once at connect time, not on every notification — no concern at ICP scale |
| Bot removed from channel → silent alert loss | `notifySlack` returning false triggers a `console.warn`; future work: surface "Slack disconnected" banner in Settings |
| Slack API outage blocks ReviewBox UI | `conversations.list` is only called during connect flow; notifications are best-effort (`void notifySlack(...)`) — ReviewBox never blocks a page render on Slack |
| Workspace hard-delete without Slack revocation | GDPR delete route updated to call `auth.revoke` before DB delete |

---

## Rollback plan

1. The `workspace_slack` table is additive. Drop it with `DROP TABLE IF EXISTS workspace_slack CASCADE` — this nulls `slack_webhook_url` on no rows (it's on `workspaces`, not this table). Notifications revert to the paste-URL path.
2. If the OAuth callback route breaks: the existing paste-URL settings UI path continues to function independently; users who already had a webhook URL pasted retain Slack notifications.
3. Feature flag: not required — the OAuth connect button is shown only when `SLACK_CLIENT_ID` env var is set. If the env var is missing, the settings UI shows the existing paste-URL field.
4. Env vars to add then remove: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`. Removing them reverts the UI to paste-URL mode.

---

## DB migration

**New file:** `supabase/migrations/014_slack_oauth.sql`

```sql
-- ============================================================
-- 014 — Slack OAuth connection per workspace
-- ============================================================
-- Stores the OAuth bot token and selected channel metadata.
-- The webhook URL for delivery continues to live on
-- workspaces.slack_webhook_url (migration 011).
-- ============================================================

create table if not exists public.workspace_slack (
  id               uuid primary key default uuid_generate_v4(),
  workspace_id     uuid not null references public.workspaces(id) on delete cascade,
  slack_team_id    text not null,                    -- Slack workspace T-ID, e.g. "T01ABC123"
  slack_team_name  text,                             -- display name, e.g. "Acme Corp"
  slack_channel_id   text not null,                  -- Slack channel C-ID, e.g. "C01ABC123"
  slack_channel_name text not null,                  -- display name, e.g. "#reviews"
  access_token     text not null,                    -- OAuth bot access token (xoxb-...)
  scope            text not null,                    -- scopes granted, e.g. "incoming-webhook,channels:read"
  installed_by     text not null,                    -- Clerk user ID of the installer
  connected_at     timestamptz not null default now(),
  unique (workspace_id)                              -- one Slack connection per workspace
);

create index if not exists workspace_slack_workspace_idx
  on public.workspace_slack(workspace_id);

alter table public.workspace_slack enable row level security;

-- Members can read their own workspace's connection status
create policy "rls_workspace_slack_select" on public.workspace_slack
  for select using (workspace_id in (select public.my_workspace_ids()));

-- Only service role may insert/update/delete (done via server routes only)
-- No RLS insert/update/delete policies = anon/authed roles cannot write directly
```

Note: `workspaces.slack_webhook_url` (migration 011) is retained. After OAuth connect, the route writes the webhook URL from the OAuth response into `workspaces.slack_webhook_url` AND inserts a row into `workspace_slack`. Disconnect deletes the `workspace_slack` row and sets `workspaces.slack_webhook_url = NULL`.

---

## New API routes

### `GET /api/settings/slack/channels`

Called by the settings UI after the user clicks "Add to Slack" to populate the channel picker.

- Auth: Clerk session, `userId` required
- Reads `workspace_slack.access_token` for the workspace
- Calls `https://slack.com/api/conversations.list?limit=200&exclude_archived=true` with `Authorization: Bearer <access_token>`
- Returns `{ channels: Array<{ id: string; name: string; isPrivate: boolean }> }`
- Rate limit: 10 req / 1 min per workspace (bucket: `"slack-channels"`)
- Error paths: `apiError("NO_SLACK_CONNECTION", 404)` if no row in `workspace_slack`; `apiError("SERVICE_UNAVAILABLE", 502)` if Slack API returns non-ok

### `GET /api/auth/slack/authorize`

Redirects the user to the Slack OAuth authorization URL.

- Auth: Clerk session required
- Generates a 32-byte hex `state` param
- Sets `slack_oauth_state` cookie: `httpOnly`, `SameSite=Lax`, `Path=/`, `Max-Age=600`
- Redirects to:
  `https://slack.com/oauth/v2/authorize?client_id={SLACK_CLIENT_ID}&scope=incoming-webhook,channels:read,groups:read&redirect_uri={APP_URL}/api/auth/slack/callback&state={state}`
- No request body; no DB write at this step

### `GET /api/auth/slack/callback`

Handles the OAuth redirect from Slack.

- Auth: Clerk session required (user must be signed in when the redirect lands)
- Validates `state` query param against `slack_oauth_state` cookie — returns `apiError("FORBIDDEN", 403)` on mismatch
- Exchanges `code` for token via `POST https://slack.com/api/oauth.v2.access`
- On success:
  - Upserts row in `workspace_slack` (workspace_id, slack_team_id, slack_team_name, slack_channel_id, slack_channel_name, access_token, scope, installed_by)
  - Writes `incoming_webhook.url` from the OAuth response into `workspaces.slack_webhook_url`
  - Calls `audit({ action: "slack.connect", workspaceId, actorUserId })`
  - Clears `slack_oauth_state` cookie
  - Redirects to `/settings?slack=connected`
- On failure: redirects to `/settings?slack=error&reason={reason}`
- Rate limit: 5 req / 5 min per user (bucket: `"slack-oauth-callback"`) to prevent code-stuffing

### `DELETE /api/settings/slack`

Disconnects Slack for the workspace.

- Auth: Clerk session required
- Reads `workspace_slack.access_token` for the workspace
- Calls `https://slack.com/api/auth.revoke` with the token (best-effort; continue even if it fails)
- Deletes the `workspace_slack` row
- Sets `workspaces.slack_webhook_url = NULL`
- Calls `audit({ action: "slack.disconnect", workspaceId, actorUserId })`
- Rate limit: 5 req / 1 min per user (bucket: `"slack-disconnect"`)
- Returns `{ ok: true }`

---

## Notification trigger changes

None. The existing call sites are unchanged:

- `src/app/api/sync/reviews/route.ts` calls `notifyRatingSpike(workspaceId, appId, params)` — this resolves to `notifySlack(workspaceId, ...)` which reads `workspaces.slack_webhook_url`. That column is still populated (now written by the OAuth callback instead of by the user manually). No code change.
- `src/app/api/incidents/route.ts` calls `notifySlack(workspaceId, ...)` — same, no change.
- Dedup keys (`slack:spike:*`, `slack:urgent:*`) and TTLs are unchanged.

---

## Acceptance criteria for the coder

### Files touched

| File | Change |
|---|---|
| `supabase/migrations/014_slack_oauth.sql` | New — `workspace_slack` table as specified above |
| `src/app/api/auth/slack/authorize/route.ts` | New — redirect to Slack OAuth, set state cookie |
| `src/app/api/auth/slack/callback/route.ts` | New — exchange code, upsert `workspace_slack`, write webhook URL, audit, redirect |
| `src/app/api/settings/slack/channels/route.ts` | New — call `conversations.list`, return channel list |
| `src/app/api/settings/slack/route.ts` | New — `DELETE` to disconnect: revoke token, delete row, null webhook URL, audit |
| `src/features/settings/components/slack-integration.tsx` | Update: replace paste-URL input with "Add to Slack" button + channel picker dropdown after connect; show "Connected to #channel-name" when connected; show "Disconnect" button |
| `src/lib/audit.ts` | No change — `slack.connect` and `slack.disconnect` already in `AuditAction` union |
| `src/lib/slack.ts` | No change — notification path is unchanged |
| `src/app/api/gdpr/delete/route.ts` | Add: call `auth.revoke` on any `workspace_slack.access_token` before hard-deleting workspace |

### New patterns introduced

- **OAuth state cookie pattern:** `slack_oauth_state` cookie set in authorize route, validated and cleared in callback route. Cookie options: `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `maxAge: 600`. Use `cookies()` from `next/headers` in the authorize route (server component / route handler). This is a new pattern in the codebase — document it in the callback route's JSDoc comment so it is reusable for future OAuth flows (e.g., Google OAuth in a later sprint).

- **External OAuth token upsert pattern:** `workspace_slack` rows use `upsert` with `onConflict: "workspace_id"` so reconnecting replaces the old token without a delete+insert. This avoids a race where a notification fires after delete but before re-insert.

### Environment variables required (HUMAN-REQUIRED)

The founder must create a Slack app at `api.slack.com/apps` and add to Vercel + `.env.local`:

```
SLACK_CLIENT_ID=       # from Slack app "Basic Information" page
SLACK_CLIENT_SECRET=   # from Slack app "Basic Information" page
```

The redirect URI registered in the Slack app must be:
- Local dev: `http://localhost:3000/api/auth/slack/callback`
- Production: `https://app.tryreviewbox.com/api/auth/slack/callback`

The settings UI renders the paste-URL fallback when `SLACK_CLIENT_ID` is not set, so the existing Incoming Webhook path continues working during the transition.

### Tests required

- `src/app/api/auth/slack/callback/route.test.ts`:
  - CSRF: returns 403 when `state` param does not match the cookie
  - Success path: mocks `fetch` to return a valid Slack OAuth response, verifies `workspace_slack` upsert and `workspaces.slack_webhook_url` write, verifies redirect to `/settings?slack=connected`
  - Slack API error: mocks `fetch` to return `ok: false` from Slack, verifies redirect to `/settings?slack=error`
- `src/app/api/settings/slack/route.test.ts` (`DELETE`):
  - Returns 404 when workspace has no Slack connection
  - Calls `auth.revoke` and then deletes the row
  - Calls `audit()` with `slack.disconnect`
- `src/app/api/settings/slack/channels/route.test.ts`:
  - Returns 404 when `workspace_slack` row is missing
  - Returns mapped channel list on success
  - Returns 429 when rate limit exceeded

### Audit log calls required

- `audit({ action: "slack.connect", workspaceId, actorUserId })` — in `GET /api/auth/slack/callback` after successful upsert
- `audit({ action: "slack.disconnect", workspaceId, actorUserId })` — in `DELETE /api/settings/slack` after row deletion

Both actions are already in the `AuditAction` union in `src/lib/audit.ts`. No change to that file needed.

### Rate limits required

| Route | Limit | Bucket |
|---|---|---|
| `GET /api/auth/slack/callback` | 5 req / 5 min per userId | `"slack-oauth-callback"` |
| `GET /api/settings/slack/channels` | 10 req / 1 min per workspaceId | `"slack-channels"` |
| `DELETE /api/settings/slack` | 5 req / 1 min per userId | `"slack-disconnect"` |

The authorize redirect (`GET /api/auth/slack/authorize`) does not need a rate limit — it performs no DB write and makes no external call; it only sets a cookie and issues a redirect.

### Feature flag required

Implicit via env var. The `SlackIntegration` component checks `NEXT_PUBLIC_SLACK_CLIENT_ID` (expose as a public var, value is non-secret) at render time:
- Set: show "Add to Slack" OAuth button and channel picker
- Not set: show existing paste-URL input (backward compatible)

Add `NEXT_PUBLIC_SLACK_CLIENT_ID` to `.env.example` with an empty value and a comment: `# Slack app client ID — from api.slack.com/apps. Set to enable OAuth connect flow.`

### What NOT to build in this PR

- `chat:write` bot token or `chat.postMessage` API calls
- Slack slash commands or interactive message buttons
- Multiple channels per workspace (one channel per workspace is the constraint)
- Token encryption at rest (deferred to Team-plan tier ADR)
- Public Slack App Directory listing
- Per-event-type channel routing (spikes to one channel, incidents to another)
- RLS column-level restriction on `access_token` within `workspace_slack` (service-role only writes already enforce this via no insert/update/delete RLS policies)

---

## Security review

- [x] Does this route touch user input → external API? — Yes. The OAuth callback receives a `code` from Slack (untrusted query param) and exchanges it with `slack.com`. The `state` cookie guards against CSRF. The code is single-use at Slack's side.
- [x] Does this mutate state? — Yes. Callback upserts `workspace_slack` and updates `workspaces.slack_webhook_url`. Disconnect deletes a row and nulls the URL. Both call `audit()`.
- [x] Does this leak data across workspaces? — No. All routes resolve `workspaceId` from the authenticated Clerk `userId` via `getWorkspaceId()`. RLS on `workspace_slack` restricts reads to `my_workspace_ids()`.
- [x] Does this accept untrusted input? — Yes: `state` query param (validated against cookie), `code` query param (passed to Slack, never logged), `channel` selection from UI (validated as a real channel ID returned by `conversations.list`, not free-text).
- [x] Does this make a paid-service call? — Slack OAuth and `conversations.list` are free with no quota concern at ICP scale (one call at connect time). `auth.revoke` is free.
- [x] Does this introduce a new external dependency? — Slack's OAuth API is called via native `fetch`. No Slack SDK. No new npm package. Slack's API is not a new paid SaaS dependency (free tier unlimited).
- [x] Is there a rollback path? — Yes. Described in the Rollback section above.
- [x] Could a malicious user abuse this? — CSRF mitigated by state cookie. Code replay: single-use codes. Token exposure: never logged, stored plaintext but scoped to one channel. Rate limits on callback and disconnect prevent enumeration. `auth.revoke` on disconnect prevents token reuse after the user disconnects.
