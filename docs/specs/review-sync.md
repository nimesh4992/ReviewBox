# Spec: Review Sync

**Status:** partially met — see the gaps at the bottom.
**Owner promise:** PRODUCT_CONTEXT promise #1 ("see your reviews without
connecting anything") and #3 ("the numbers match the store").

The single most valuable feature in the product: without reviews in the
inbox, nothing else — AI drafts, sentiment, automations, digests — has any
input. Every hour this is broken, the product is worth nothing to the
customer. It has broken silently four times.

## Scope

Fetching public reviews and store metadata for a connected app, on signup and
on a schedule, and recording honestly what happened.

Out of scope here: posting replies (see reply flow), AI drafting, automations.

---

## Acceptance criteria

### AC-1 — First sync happens without the user asking
**Given** a new user finishes onboarding with a valid app
**When** they land on the dashboard
**Then** within 60 seconds they see that app's rating and at least one review,
having clicked nothing.
*Verified by:* manual step in every PR test plan touching onboarding.

### AC-2 — A region-locked app works exactly like a global one
**Given** the app is `com.mmrda.mumbaione` (India-only)
**When** the first sync runs
**Then** reviews are scraped from the storefront that actually carries it, and
the count is > 0.
*Verified by:* `GET /api/admin/probe/stores` → `google-reviews-regional`.
**This is the criterion the product failed silently for months.**

### AC-3 — A failed sync is never reported as success
**Given** any failure (blocked scrape, missing package name, DB column absent)
**When** the sync finishes
**Then** `apps.last_sync_status` holds a specific status, `last_sync_error`
holds a sentence a non-technical user can act on, and the dashboard shows it.
"Success with zero reviews" is only allowed when the store genuinely has none.
*Verified by:* unit tests on the classifier + `/api/debug/sync-status`.

### AC-4 — The user's own work is never overwritten
**Given** a review with a saved AI draft or a "replied" state
**When** any later sync runs
**Then** that reply state is preserved; sync may only promote
`needs_reply → replied`, never downgrade.
*Verified by:* `src/lib/sync-writes.test.ts`.

### AC-5 — Syncing twice is safe
**Given** two syncs for the same workspace overlap (dashboard self-heal +
onboarding trigger + daily cron can all fire)
**When** both complete
**Then** no duplicate reviews, and no duplicate alert emails or Slack pings.
*Verified by:* unit tests on `planSyncWrites`; **gap — see below.**

### AC-6 — Shown numbers match the store
**Given** an app with a public listing
**When** the dashboard renders rating and review count
**Then** they equal the store's figures, or are labelled to say which window
they cover.
*Verified by:* probe `google-metadata-regional`; **gap — see below.**

### AC-7 — The customer is never stuck without a next step
**Given** sync cannot proceed (no package name, no Play Console access, store
blocking us)
**When** the user opens the dashboard
**Then** they see one banner naming the cause and one action that fixes it.
*Verified by:* manual step; dashboard `WorkspaceStatusStrip`.

---

## Done does NOT mean

- Reviews in every language (English only today — tagged assumption).
- Reviews from every storefront (one per app — the one that carries it).
- Fresher than daily on Vercel Hobby (cron limit, PRODUCT_CONTEXT).
- Developer replies visible without Play Console (public listing lacks them).

## Known gaps against this spec

| AC | Gap | Tracked as |
|---|---|---|
| AC-5 | No per-workspace lock; concurrent syncs rely on Redis dedup alone | backlog **AS1** |
| AC-6 | Lifetime count is global while the inbox is per-country; not yet labelled | **BUG-020** |
| AC-2 | Depends on the public scrape, which Google may refuse from our IP | audit finding **A8** |

When a gap closes, move it into the criterion and delete the row.
