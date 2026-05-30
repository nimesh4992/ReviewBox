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
| 1 | Sign up / sign in | Create a new account → land inside the app | ⬜ |
| 2 | Onboarding: workspace + pick real app | Search your real app (both platforms), select it, finish wizard | ⬜ |
| 3 | Bootstrap scrape pulls real reviews | Inbox shows YOUR app's actual recent reviews (not demo data) | ⬜ |
| 4 | Reviews display correctly | Rating ★, date, text, version, author each match the store | ⬜ |
| 5 | Dashboard numbers correct | Portfolio rating + total review count match the store page | ⬜ |
| 6 | AI draft generates in brand voice | Open a review → AI text appears → reads in your chosen tone | ⬜ |
| 7 | Copy reply to store | "Copy reply" → paste into Play Console → reply posts on the store | ⬜ |
| 8 | Mark as replied | Toggle review → replied → status persists after page reload | ⬜ |

**Steps 3 and 7 are the whole game.** 3 = do we actually see real data.
7 = can the user actually act on it. Both must be ✅ before launch.

## How we work the spine

1. **Freeze features.** No new feature work until all 8 are ✅. Secondary
   screens (sentiment, ASO, competitors, incidents, releases, automations,
   reports, Slack) are frozen — they may be half-broken; nobody launches
   because the ASO screen is pretty.
2. **Walk it.** Founder runs all 8 steps against the real app on the Vercel
   preview. Logs every break inline in this table (set to ❌ + a one-line note).
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

## Open dependency

Reply posting (step 7) in Draft Mode = **copy-to-clipboard + manual paste +
"mark replied"**. The current composer has an API "Post reply" button that we
cannot verify. First build task: add the Draft Mode copy/mark-replied path so
step 7 becomes verifiable. Then walk the spine.
