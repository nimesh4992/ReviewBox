# Today — Handoff for next agent

**Last updated:** 2026-07-25
**Branch agent left on:** `claude/product-market-readiness-zcfowh` (pushed, draft PR open)

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (never-do list) are critical.
3. **`docs/MARKET_READINESS_AUDIT.md`** ← **new — read before picking work**
4. **`docs/SPINE.md`** — the 8-step launch gate. Still 0/8 verified.
5. **`docs/backlog.md`** — ICE-ranked queue
6. **This file (`docs/today.md`)** — last session's handoff

---

## What happened this session (2026-07-25)

A market-readiness audit was requested. It found **five defects that were
breaking the product for a real customer, all of which passed CI** — `tsc`
clean, 80 unit tests green, lint clean, production build green.

All five are fixed on this branch. Full write-up in
`docs/MARKET_READINESS_AUDIT.md`; one-line summaries in `docs/BUGS.md`
(BUG-024 … BUG-035).

### The founder's month-long "Play Store not connected" email — diagnosed and fixed

It was **not** a false alarm. The sync really was failing every single day.

The public scraper only ran when an app had zero reviews. Every sync after the
first went straight to the Google Play Publisher API — which Draft Mode
customers have no credentials for, by design (D018). So sync #2 onward 403'd
forever, `last_sync_status` was pinned to `needs_play_console_access`, and the
daily health cron dutifully emailed about it every 3 days.

Two independent bugs were feeding it, both fixed:
1. The scraper now runs on **every** sync (BUG-024) — so status is `success`
   and the nag stops at the source.
2. `/api/health/user-check` had no `deleted_at` filter, so **soft-deleted apps
   nagged forever** — their `last_sync_attempted_at` freezes at deletion, which
   permanently satisfies the "failing 48h+" test (BUG-029).

### The other three

- **BUG-025** — every sync erased the user's saved drafts and "mark as replied"
  state. App Store reviews were reset on *every* sync because iTunes RSS never
  reports developer replies. This is the worst one: it silently destroyed user
  work, and a single-session spine walk would not have caught it.
- **BUG-028** — trial users were locked out of AI drafts (middleware gated
  `/api/reply` to paid plans; onboarding stamps everyone `trial`; Stripe is
  deferred so nobody could pay). The trial could not demo the product.
- **BUG-030/031** — inbox pagination silently dropped reviews sharing a
  timestamp; the sidebar app selector filtered nothing.

**Verification:** `tsc` 0 errors · 92 unit tests (was 80) · lint 0 errors ·
production build passes.

---

## What you should pick up next

**Do not start feature work.** The backlog is ICE-ranked and ICE has no term for
"the core loop is broken." Order:

1. **FOUNDER: walk the spine** (`docs/SPINE.md`, 8 steps, ~30 min, real app on
   the Vercel preview). It is 0/8 after two months. Nothing else produces real
   information about readiness.
   **Then walk step 8 again the next day** — BUG-025 and BUG-029 only appear on
   the second day, and that is exactly the class of bug that got through.
2. **FOUNDER DECISION — BUG-020 (US-only reviews).** The scrape is hardcoded to
   `country: "us", lang: "en"`, but the dashboard's headline review count is the
   store's **global** figure. A non-US app shows "3,412 reviews" on the
   dashboard and ~200 in the inbox. Recommendation: label it honestly in the UI
   (1h) rather than fanning out locales (8× scrape volume, more block risk).
3. **Write the spine e2e test** — sign in → sync → draft → mark replied →
   **sync again** → assert the reply survived. That one test covers BUG-024,
   BUG-025 and BUG-030 at once. Currently no e2e touches the spine at all.
4. **BUG-022 — move sync off the 24h Vercel Hobby cron** to Supabase `pg_cron` +
   `pg_net` (free, extension already enabled). 24h latency is weak for a
   "respond fast to bad reviews" product at $99/mo.
5. **Only then reverse D013** and turn Stripe on. Taking money for a product
   whose core loop is unverified is the worse failure.

---

## Open risk to watch

`docs/MARKET_READINESS_AUDIT.md` G-3: the fix for BUG-024 makes the **public
Google Play scrape the single point of failure** for the whole product. That is
what D018 requires, but it concentrates all risk on one unofficial dependency
that Google actively rate-limits from datacenter IPs. Sentry alerting on sync
failure was added this session — **watch it.** A Google-side block is a total
outage, not a degradation.

---

## The process finding (most important thing in this handoff)

Every bug above was invisible to strict TypeScript, ESLint, 80 unit tests, a
build gate, and three prior security audits that found 44+ issues between them.

That apparatus verifies code is *internally consistent*. Every bug here was a
**state-over-time** bug — correct on first execution, wrong on the second:

- sync #1 works, sync #2 onward fails
- reply saved, next sync erases it
- app deleted, emails continue
- page 1 correct, page 2 drops rows

Unit tests cannot catch this class. Ask **"what happens the second time?"** —
that question would have found all five.

---

## Founder's context (stable)

- Solo founder, marketing-strong, non-coder
- Autopilot loop: Claude ships PRs on branches → founder verifies on Vercel preview → founder merges
- Goal: take on AppFollow ($49 vs $399) + AI-first + modern UX
- Works in pockets around a full-time job
- No `gh` CLI installed — give GitHub web PR URLs

---

## Final reminders

- Never push to `master`. PR only.
- Never merge PRs. Founder merges.
- Never run migrations against prod Supabase. Founder runs them.
- Never send real emails. Drafts only.
- Always write PR descriptions as plain-English 5-minute test plans.
- Always update this file at end of session.
- Always ICE-score new backlog items added to `docs/backlog.md`.
