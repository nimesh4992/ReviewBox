# SPINE.md — the one path that must be 100%

**This is the launch gate.** If any spine step is broken, we do not launch.
Everything *not* in this file is a secondary organ — it may be imperfect at
launch and that's acceptable.

## The rule that put us here

> **"Done" means a human walked this step against a REAL app and watched it work.**
> Not "CI green." Not "code written." Not "unit tests pass."

Our build status has dozens of ✅ that only ever meant "compiles + unit tests
pass." That is a different claim from "a real review flowed end-to-end." This
file tracks the second claim only.

## Launch tier: Draft Mode (D018)

The founder has **user-level** access to a real app on both stores — NOT
admin/API access. So:

- We pull reviews via the **public scraper** (no credentials needed).
- AI drafts the reply in the workspace brand voice.
- The user **copies the draft and pastes it into Play Console / App Store
  Connect**, then marks the review replied here.
- One-click API posting is a **Pro feature, sequenced** — verified later with
  a customer who has store admin access.

This makes **every spine step below verifiable today** with what we have.

## The spine — 8 steps

Status: ⬜ unverified · 🟡 in progress · ✅ verified against real app · ❌ broken

| # | Step | How the FOUNDER verifies (no code reading) | Status |
|---|------|--------------------------------------------|--------|
| 1 | Sign up / sign in | Create a new account → land inside the app | ✅ |
| 2 | Onboarding: workspace + pick real app | Search your real app (both platforms), select it, finish wizard | ✅ |
| 3 | Bootstrap scrape pulls real reviews | Inbox shows YOUR app's actual recent reviews (not demo data) | ✅ |
| 4 | Reviews display correctly | Rating ★, date, text, version, author each match the store | ✅ |
| 5 | Dashboard numbers correct | Portfolio rating + total review count match the store page | ✅ |
| 6 | AI draft generates in brand voice | Open a review → AI text appears → reads in your chosen tone | ✅ |
| 7 | Copy reply to store | "Copy reply" → paste into Play Console → reply posts on the store | ✅ |
| 8 | Mark as replied | Toggle review → replied → status persists after page reload | ✅ |

**Steps 3 and 7 are the whole game.** 3 = do we actually see real data.
7 = can the user actually act on it. Both must be ✅ before launch.

## ✅ 8 of 8 — walked 2026-08-19 by the founder, against a real app

**The launch gate is clear.** The founder walked all eight steps end to end on
production and reported every one working. This is the first completed walk in
the eleven weeks since this file was written, and it is the only evidence in
this repository that the product works — every ✅ in `CLAUDE.md` means "compiles
and unit tests pass", which is a different claim (see the note above the
build-status tables there).

Recorded from the founder's report, which is exactly what this file's rule asks
for: *"Done means a human walked this step against a REAL app and watched it
work."* No agent verified any of this and none could.

**One follow-up is genuinely still open — step 8 overnight.** Step 8 as defined
above is "persists after a page reload", and that passed. What a single-day walk
cannot establish is that the status survives the **next sync**: a review that
reads `replied` tonight and `needs_reply` tomorrow is the failure mode that
erased people's work before. The code defends it — `review-sync.ts` refuses a
blanket upsert because `reply_status`/`reply_text` are user-owned, and the
promote-to-replied update is filtered `.eq("reply_status", "needs_reply")` — but
that is a code guarantee, not a walked one. **Re-open the replied review after
the next daily sync (08:00 UTC) and confirm it still reads replied.** If it has
flipped back, this drops to ❌ and nothing else matters until it is fixed.

### What this unblocks

Feature work was frozen behind this gate ("no new feature work until all 8 are
✅") and that freeze is now lifted. D022 sequenced SPINE ahead of the Issue
Intelligence epic, so that epic is next in line. Launch itself remains a founder
call, not an automatic consequence of 8/8.

## How we work the spine

1. **Freeze features.** No new feature work until all 8 are ✅. Secondary
   screens (sentiment, ASO, competitors, incidents, releases, automations,
   reports, Slack) are frozen — they may be half-broken; nobody launches
   because the ASO screen is pretty.
2. **Walk it.** Founder runs all 8 steps against the real app **on production**
   (`app.tryreviewbox.com`). Logs every break inline in this table (set to ❌ +
   a one-line note).

   *This said "on the Vercel preview" until 2026-08-19. There are no previews:
   `vercel.json`'s `ignoreCommand` exits 0 for every git ref except `master`, so
   a preview build never runs, and backlog LT2 (Clerk keys scoped to Preview) is
   still open besides. Production is the only place the spine can be walked.
   Verified the same day that production is current — the deploy blocker
   recorded in `docs/today.md` was fixed by PR #127, and the #127 and #128
   merges both reached production.*
3. **Fix in order.** I fix top-down. After each fix, founder re-walks the
   whole spine. Repeat until 8/8 ✅.
4. **Launch.** A narrow product where the spine is 100% beats a broad product
   where everything is 80%.

## Explicitly NOT in the spine (secondary organs)

These can be imperfect at launch. Do not let them block:

- Sentiment screen · ASO keywords · Competitors · Incidents · Releases
- Automations · Reports · Slack · CSV import
- One-click API reply posting (Pro, sequenced — D018)
- Official-API ongoing sync (Pro, sequenced — D018)
- Stripe / billing (deferred — D013)

## Build tasks before the first walk — both DONE (verified 2026-08-19)

This section listed two blockers. Both are in master; the list had gone stale.
**There is nothing left to build before the first walk.**

1. ~~**Draft Mode in the composer (step 7)**~~ — **shipped.**
   `src/features/reviews/components/reply-composer-panel.tsx` renders "Copy
   reply" (real `navigator.clipboard.writeText`) and "Mark as replied" whenever
   the app has no store API credentials — which is the founder's case, and most
   customers'. "Mark as replied" POSTs `status: "manual_replied"` to
   `/api/reviews/[id]/reply`, which persists `reply_status: "replied"` and
   `replied_at` **without any store API call** (the store submit is fenced
   inside `status === "sent"`).
2. ~~**Re-apply the app-delete fix**~~ — **shipped.** `apps/[id]/route.ts`
   DELETE clears `rb_onboarded` when the last live app goes.

### Two defects found on the spine path while confirming the above

Both were fixed the same day, before the first walk, because each would have
produced a false ❌ on the two steps this file calls "the whole game":

- **Step 8 was blocked for any reply over the store limit.** "Mark as replied"
  was disabled on `overLimit` — but that limit describes what *we* may push
  through the store's API, and this button pushes nothing: the user has already
  pasted the reply into Play Console themselves. Since "Copy reply" was never
  limit-gated, we handed the customer an over-limit reply to paste and then
  refused to record that they had. Google Play's limit is 350 characters, which
  an AI draft reaches easily, so this was likely to fire during the first walk.
- **Step 7 failed silently.** `handleCopy`'s catch set `copied = false` and said
  nothing, so a browser-blocked copy looked identical to not having clicked —
  and the next thing the user does in Draft Mode is paste into a public store
  reply. It now selects the text and says so.

Locked in by `src/spine-draft-mode-contract.test.ts` (7 tests, each
mutation-verified), since neither failure is reachable by this repo's
pure-function unit suite.

## Faster than a manual walk, for steps 3–5

`GET /api/admin/probe/stores` runs the real store pipeline against the three
fixture apps in `docs/PRODUCT_CONTEXT.md` (Mumbai One `in`, WhatsApp `us`,
Instagram `us`) **from production's own IP**, and returns a verdict naming the
likely cause: `healthy` · `google_blocked` · `apple_blocked` ·
`regional_handling_broken` · `all_upstreams_unreachable` · `degraded`.

Run it before walking steps 3–5 by hand. It answers "does the scrape path work
at all" in one request, and distinguishes a regional-handling bug from an
outright block — which a manual walk against a single app cannot. Needs an admin
session (or `Bearer $CRON_SECRET`); a sandbox or local run proves nothing about
what Google serves Vercel.
