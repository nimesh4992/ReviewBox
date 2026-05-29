# ADR 001: Slack Integration

**Status:** Accepted
**Date:** 2026-05-25
**Backlog item:** X1

---

## Context

X1 in `docs/backlog.md`: workspace owners want rating spike alerts, new incident alerts, and urgent unreplied review alerts delivered to Slack. This is the single most-requested feature and the primary competitive gap vs AppFollow (ICE 72).

An audit of the codebase before writing this ADR revealed that significant groundwork is already in place:

- `src/lib/slack.ts` — `sendSlackNotification()`, `notifySlack()`, and three pre-built payload builders (`ratingSpike`, `newIncident`, `urgentReview`) already exist.
- `supabase/migrations/011_slack_webhook.sql` — `workspaces.slack_webhook_url TEXT` column already exists.
- `src/features/settings/components/slack-integration.tsx` — settings UI for pasting an Incoming Webhook URL is already built and wired to `PATCH /api/settings/workspace`.
- `src/app/api/settings/slack/test/route.ts` — test-fire endpoint already exists.
- `src/app/api/sync/reviews/route.ts` — calls `notifySlack()` for rating spikes (up to 1 per version) and urgent reviews (capped at 3 per sync batch).
- `src/app/api/incidents/route.ts` — calls `notifySlack()` on `POST /api/incidents`.

The integration is therefore mostly shipped. What is **missing** is:

1. A dedup guard so the same rating spike event does not fire Slack again on the next sync run.
2. A URL validation + length cap server-side on `PATCH /api/settings/workspace` (the client-side check exists but the server-side is absent).
3. An `audit()` call on the workspace PATCH that sets `slack_webhook_url`.
4. A rate limit on the `POST /api/settings/slack/test` route (currently unprotected — an attacker can hammer an arbitrary webhook URL via any authenticated session).
5. The `POST /api/incidents` route is missing a rate limit.
6. `audit.ts` has no `"slack.connect"` or `"slack.disconnect"` action types.

This ADR records the chosen approach for the gaps and the decisions already baked into the existing code (so the coder knows what to close out vs what to leave alone).

---

## Decision

**Connection method: Slack Incoming Webhook (not OAuth Bot token).**
The workspace owner creates an Incoming Webhook in their Slack workspace and pastes the URL into Settings. No OAuth redirect, no callback route, no Slack app listing required.

**Storage: `workspaces.slack_webhook_url TEXT` column (already in place via migration 011).**
A separate `slack_integrations` table is not warranted at this scope — one webhook per workspace is sufficient for phase 1.

**Token security: store the raw webhook URL in plaintext in Supabase.**
Slack Incoming Webhook URLs are single-purpose bearer tokens with no user identity. They can only post messages to one channel. The risk profile is low enough to accept storage without symmetric encryption; the column is server-side only (never exposed to the browser except when the user reads their own workspace settings).

**Notification trigger: inline in the sync worker and incidents route (already in place).**
No pg_notify, no separate notification service. The sync route already calls `notifySlack()` after spike detection; the incidents route calls it after insert. This is the right architecture — keep it.

**Dedup: Redis key `slack:spike:{workspaceId}:{appId}:{version}` with 23h TTL.**
Set after a spike fires; skip the Slack call if the key exists. This prevents the same spike from re-alerting on every subsequent daily sync run. 23h rather than 24h avoids an off-by-one where a spike at 08:01 is suppressed forever because the 24h window doesn't reset until 08:01 the next day (the daily cron fires at 08:00).
Urgent review dedup: `slack:urgent:{workspaceId}:{reviewId}` with 48h TTL, set per review. Prevents the same urgent review from firing on back-to-back sync runs.

---

## Alternatives considered

- **Slack OAuth (Bot token, `chat:write` scope):** Requires a Slack app listing, a redirect URI, token storage with Clerk or Supabase, a callback route, and scope approval. Upside is channel selection inside the product UI and token revocation visibility. Rejected because it adds ~4h of plumbing for features (channel picker, disconnect via Slack revocation) that can ship in a later ADR once there are paying customers asking for them.

- **Incoming Webhook encrypted at rest (AES-256):** Would require a `SLACK_ENCRYPTION_KEY` env var, a lib/crypto utility, and encrypt-on-write / decrypt-on-read in every place that touches the column. Rejected for this phase because the webhook URL is only capable of posting to a single channel and is not a re-usable credential. If a workspace is breached at the DB layer, the attacker already has full access to the workspace's review data, which is the more sensitive asset. Revisit if enterprise customers require it (add to `LATER` backlog as Y7).

- **pg_notify → Supabase Edge Function → Slack:** Adds Supabase Edge Functions as a new runtime (currently unused), complicates local dev, and introduces an async delivery path that is harder to observe. Rejected — the sync worker already has the right context (workspace ID, app name, version) at spike-detection time.

- **Separate `slack_integrations` table:** Allows multiple Slack channels per workspace (e.g., #crashes vs #reviews). Over-engineered for the ICP (indie dev / 2–5 person team) right now. One webhook per workspace covers the use case. Rejected for phase 1; defer to a future ADR if multi-channel routing is requested.

---

## Consequences

**Positive:**
- The feature is already 80% shipped — the coder closes out 5 targeted gaps.
- Incoming Webhook approach requires zero Slack app review process.
- No new external dependency (Upstash Redis already in stack; `fetch` is native).
- Dedup via Redis reuses the same `alreadySent` / `markSent` pattern from `src/app/api/health/user-check/route.ts` — consistent, no new pattern.

**Negative:**
- The webhook URL stored plaintext means a DB dump leaks a "post to one Slack channel" capability. Acceptable at current scale; flag for revisit at Team plan tier.
- Incoming Webhooks cannot be revoked from inside ReviewBox — the owner must delete the app in Slack. The disconnect button in the UI removes the URL from our DB but does not revoke the Slack side. The settings UI should say this clearly.
- One webhook per workspace means all alerts go to the same channel. Users who want different channels for spikes vs incidents cannot do that in phase 1.

**Risks:**

| Risk | Mitigation |
|---|---|
| Spike fires every day for the same version until it resolves | Redis dedup key (23h TTL) — see Decision section |
| Urgent review fires every sync for unreplied reviews | Per-review Redis dedup key (48h TTL) |
| `POST /api/settings/slack/test` abused to hammer arbitrary Slack webhooks | Rate limit: 5 req / 1 min per user |
| Malicious user crafts a webhook URL to an internal service (SSRF) | URL must start with `https://hooks.slack.com/` — already enforced client-side, add server-side validation in PATCH handler |
| webhook URL exposed to workspace members who can read settings | Current: only the workspace owner reaches the settings page. Future: RLS should restrict the column read to owner role only when multi-member workspaces are common |

---

## Rollback plan

1. Slack notifications are fire-and-forget (`void notifySlack(...)`). Disabling them does not break the sync or incidents flow.
2. If dedup Redis keys cause false-suppression: flush `slack:spike:*` and `slack:urgent:*` keys via Upstash console.
3. If the `slack_webhook_url` column causes issues: `ALTER TABLE workspaces DROP COLUMN slack_webhook_url` (additive migration 011 is already applied; a reversal migration is `supabase/migrations/014_drop_slack_webhook.sql` if needed).
4. Feature flag: not required — the feature silently no-ops for any workspace where `slack_webhook_url IS NULL`, so no user is impacted until they actively paste a URL.

---

## Acceptance criteria for the coder

### Files touched

| File | Change |
|---|---|
| `src/lib/slack.ts` | Add `dedupAndNotifySlack()` wrapper that checks + sets Redis dedup key before calling `notifySlack()` |
| `src/app/api/sync/reviews/route.ts` | Replace bare `notifySlack()` calls with `dedupAndNotifySlack()` for spike and urgent review events |
| `src/app/api/incidents/route.ts` | Add `rateLimit()` (10 req / 1 min per user). Add `audit()` call after incident insert. Incident Slack call already present — no change needed |
| `src/app/api/settings/workspace/route.ts` | In PATCH handler: (a) validate `slackWebhookUrl` starts with `https://hooks.slack.com/` and is ≤500 chars if non-null; (b) call `audit({ action: "slack.connect" })` when setting a non-null URL, `audit({ action: "slack.disconnect" })` when setting null |
| `src/app/api/settings/slack/test/route.ts` | Add `rateLimit()` (5 req / 1 min per user). Add `apiError()` for the 401 path (currently returns raw JSON). |
| `src/lib/audit.ts` | Add `"slack.connect"` and `"slack.disconnect"` to `AuditAction` union |

### New patterns introduced

- `dedupAndNotifySlack(workspaceId, dedupeKey, ttlSeconds, payload)` in `src/lib/slack.ts`. Takes a Redis key string (caller constructs it) and TTL. Returns `"sent" | "deduped" | "no-webhook" | "failed"`. Uses the same `alreadySent` / `markSent` pattern from `src/app/api/health/user-check/route.ts` — do not inline a new Redis client, share the pattern.

### Tests required

- `src/lib/slack.test.ts`: add test for `dedupAndNotifySlack` — mock Redis hit (returns "deduped"), mock Redis miss (returns "sent"), mock `sendSlackNotification` failure (returns "failed"), no webhook configured (returns "no-webhook").
- `src/app/api/settings/slack/test/route.test.ts`: verify 429 when rate limit exceeded, verify 400 on invalid URL prefix.

### Audit log calls required

- `audit({ action: "slack.connect", workspaceId, actorUserId })` — in `PATCH /api/settings/workspace` when `slackWebhookUrl` is set to a non-null value.
- `audit({ action: "slack.disconnect", workspaceId, actorUserId })` — in `PATCH /api/settings/workspace` when `slackWebhookUrl` is set to null.

### Rate limit required

- `POST /api/settings/slack/test`: 5 requests / 1 minute per user ID. Bucket: `"slack-test"`.
- `POST /api/incidents`: 10 requests / 1 minute per user ID. Bucket: `"incidents-create"`.

### Feature flag required

No. The integration is a no-op for any workspace with no webhook URL set.

### Migration required

None. Migration 011 (`workspaces.slack_webhook_url`) is already applied to production.

### What NOT to build in this PR

- Slack OAuth flow (Bot token, `channels:read`, `chat:write`)
- Channel picker UI
- Per-event-type toggle (disable spike alerts but keep incident alerts)
- Slack slash commands or thread replies
- Multiple webhooks per workspace
- Encryption at rest for the webhook URL
- RLS column-level restriction for `slack_webhook_url` (defer to member-management ADR)

---

## Security review

- [x] Does this route touch user input → external API? — Yes (`/api/settings/slack/test` POSTs to an arbitrary-ish URL). Mitigated by URL prefix check (`https://hooks.slack.com/`) + rate limit.
- [x] Does this mutate state? — Yes (workspace PATCH). `audit()` calls added.
- [x] Does this leak data across workspaces? — No. `notifySlack()` looks up the workspace's own `slack_webhook_url` by `workspaceId`. RLS on `workspaces` enforces row isolation.
- [x] Does this accept untrusted input? — Yes (webhook URL from user). Validated: must start with `https://hooks.slack.com/`, capped at 500 chars.
- [x] Does this make a paid-service call? — Slack Incoming Webhooks are free. No quota concern.
- [x] Does this introduce a new external dependency? — No. `fetch` is native. No Slack SDK.
- [x] Is there a rollback path? — Yes. Described above.
- [x] Could a malicious user abuse this? — SSRF risk mitigated by URL prefix check. Spam risk mitigated by rate limit on test route and Redis dedup on notification paths.
