# Today — Handoff for next agent

**Last updated:** 2026-07-26
**Branch agent left on:** `claude/product-market-readiness-zcfowh` (pushed, draft PR #67 open, production domain currently serves this branch's build)

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (never-do list) are critical.
3. **`docs/UX_AUDIT.md`** — the 8 slop patterns + per-screen findings driving the UX program
4. **`docs/backlog.md`** — ICE-ranked queue
5. **This file (`docs/today.md`)** — last session's handoff

---

## What happened this session (2026-07-26)

The founder asked two big things: redesign the website from scratch ("think
like a UI designer hired fresh"), and — after a PM-style usability rating of
3/5 — "get me at least 4/5 on all the points." Six slices shipped to PR #67:

### Website slice 1 — homepage, Direction A (founder-approved)
- Newsreader editorial serif via next/font; hero "Your *worst* review
  deserves your *best* reply."; **ProductFrame** (the inbox drawn as the hero
  illustration, reply types itself). Nav/footer rebuilt on tokens; links to
  the approved-for-deletion pages (/customers /careers /status) removed;
  fake social chips replaced with hello@tryreviewbox.com.
- **Bug found:** font tokens declared at `:root` referenced next/font vars
  that only exist on `<body>` — CSS silently invalidates the whole custom
  property. Font tokens now live on `body`. Remember this if adding fonts.
- Founder approvals on file: Direction A + the full 25→15 page cut
  (deletions/redirects are Slice 3, NOT done yet).

### Inbox core-loop pass
- Keyboard flow: j/k/arrows move selection, Enter → composer, "/" → search.
  Rows are real listbox options (focus ring, Enter/Space) — were click-only divs.
- **Credential-aware reply hierarchy:** connected app → hero button is
  one-click "Post reply to <store>"; no credentials → Draft Mode copy-paste
  stays hero. Reviews now carry `appId` (API select + type).
- All 10 remaining purple accents in the inbox → brand blue.

### Competitors — real tracking (replaces invented rows)
- `competitor_apps` table (migration 016, **founder must run** — safe, and
  the API detects 42P01 and falls back to the old illustrative rows until
  then). Add via store search (same endpoint as onboarding), max 5,
  rate-limited, audited. Rating/total-ratings scraped through the existing
  6h Redis metadata cache. Reply rate/trend for competitors show "—" —
  not public, never invented.

### Funnel instrumentation
- `reply_drafted` (source), `reply_sent` (method: api|manual),
  `competitor_added` now actually fire — they were defined in
  `src/lib/analytics.ts` but had zero call sites. "% of signups that post a
  first reply" is now measurable in PostHog.

### Also
- Cookie banner retokened (was hardcoded dark + indigo).
- Reports screen checked: already honest (real Send-now endpoints, real CSV
  export, "Coming soon" for unbuilt) — audit memory was stale.

**Verification:** every slice rendered locally with stubbed APIs before
commit (light+dark+mobile for homepage; keyboard flow asserted
programmatically for inbox; tracked+empty states for competitors).
tsc 0 · lint 0 errors · 95 unit tests · production build green.
All 4 blocking CI jobs green on every push. E2E advisory red = BUG-037
(needs founder's real Clerk test keys).

---

## What you should pick up next

1. **FOUNDER: run migration 016** (`supabase/migrations/016_competitor_apps.sql`)
   — flips Competitors from "coming soon" to the real add flow.
2. **FOUNDER: review the homepage on the PR #67 preview.** Website slice 2
   (Pricing + Compare on the new system) is explicitly gated on this approval.
3. **Website slice 3 — the cut** (approved): delete /customers +
   /customers/acme-banking (410), /careers → 301 /about, /status → 301
   /help, merge the two contradictory refund pages (**founder must pick
   which text survives**), update sitemap.ts + robots.ts.
4. **DS-003 gray sweep** — ~1,000 raw gray-* utilities remain outside the
   redesigned screens. Mechanical, low-risk.
5. **BUG-037** — founder adds Clerk test secrets → make E2E blocking.

## Standing watch

- PR #67 has an hourly self check-in armed (send_later). All pushes get
  Vercel previews now (Git integration fixed after the founder removed the
  second collaborator). Production domain points at this branch's build —
  **don't push to master until #67 merges** or prod regresses.
- Ahrefs MCP: "insufficient plan" — don't invent keyword volumes.
  SEO plan lives in `docs/SEO_CONTENT_PLAN.md` (Phase 0 shipped).

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
- Honesty rule: no fabricated metrics, testimonials, logos, or numbers —
  anywhere, ever. "Show, don't claim."
