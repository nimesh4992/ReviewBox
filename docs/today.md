# Today — Handoff for next agent

**Last updated:** 2026-07-29
**Branch agent left on:** `claude/saas-ui-design-review-tt435y` (PR #73 open — **merge it, master does not compile**)

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (never-do list) are critical.
3. **`docs/backlog.md`** — ICE-ranked queue
4. **This file (`docs/today.md`)** — last session's handoff

---

## ⚠️ Do this first

**PR #73 must merge.** Master's `dashboard/page.tsx` is corrupted and fails
`tsc`, so Vercel cannot build and production has been serving a pre-#72 bundle.
Every fix below is stacked behind that merge. The founder reported "nothing has
changed" twice for exactly this reason — the code was merged, the deploy never
succeeded.

**Do not trust the red "E2E tests (advisory)" check.** It has failed on every
commit on every branch for this entire session, including documentation-only
ones. CI uses placeholder Clerk keys that Clerk rejects with `"Invalid host"`,
so every route — including public pricing and legal pages — serves an error.
It says nothing about your change. Fix = real Clerk test keys as repo secrets
(founder, ~10 min). Do not silence it.

---

## What this session did (2026-07-29)

Founder shared production screenshots: Settings "looks very poorly designed",
dark mode broken, dead buttons, reports not working, both Save buttons saving
each other's fields. Mandate: fix the entire UI and wiring, keep going.

### Build / deploy
- Repaired `dashboard/page.tsx` (spliced `SyncBanners` / `WorkspaceStatusStrip`)
  and `api/apps/route.ts` (duplicated insert keys, doubled `if (error)`).
  **Third occurrence** of the same dashboard damage — see the warning in CLAUDE.md.

### Bugs where the UI lied about state
- **Reply Kit deletes and edits failed silently.** Four mutations updated local
  state without checking `res.ok`, so a rejected delete still removed the row and
  a rejected save still showed the new values — until a refresh restored the old
  data. Now checked, with visible errors.
- **App selector did nothing on Sentiment / ASO / Reports.** The sidebar stores
  the app **ID**; those screens resolved it by **name**, which never matches, so
  they showed workspace-wide data under one app's heading and Reports printed a
  raw UUID. Now behind the tested helper `src/lib/selected-app.ts` — this had
  already been "fixed" once and regressed, hence the extraction.
- **Search-as-you-type races** in onboarding and competitors: the debounce
  cleared the timer but never invalidated an in-flight request, so a slow earlier
  response could overwrite a newer one. In onboarding that meant connecting the
  wrong app.
- **"All reviews replied to. Great work!"** on a workspace with zero reviews.

### Invisible / unusable UI
- **Google Play modal**: service-account email drawn in `--rb-fg-1` on a
  `bg-[#F5F5F7]` box — identical colours in dark mode, so the box looked empty
  next to a working Copy button. Also two stacked close buttons, nested
  scrollbars, horizontal overflow, white panels.
- **Sign-in / sign-up**: shell is tokenised (goes dark) but Clerk's card is
  `bg-transparent` with fixed light label colours — near-black "Email address"
  on a dark panel. Pinned the auth shell to `data-theme="light"`.
- **Account menu**: items were dark-grey on a dark panel and turned near-black
  on hover — they vanished under the cursor.
- **Team invite page**: error message rendered white-on-white.
- **Onboarding**: was hardcoded dark-only (~140 white-alpha values); now
  theme-aware. Disabled Continue button was an unreadable navy block.
- **Contrast**: `--rb-fg-4` is 2.15:1 on a light surface. Moved all *content*
  off it app-wide; left the token value alone (see CLAUDE.md).

### Accessibility
- Declare-incident dialog is hand-rolled, not Radix: added Escape-to-close,
  scroll lock, `role="dialog"`/`aria-modal`.
- **DS4 (raw `<button>` → `<Button>`) was checked and deliberately skipped** —
  its premise is wrong. `globals.css` already applies
  `:focus-visible { outline: 2px solid var(--brand) }` to every focusable
  element, so those buttons do show a keyboard focus ring. Swapping 42 controls
  would restyle a dense inbox UI for no accessibility gain.

### Also
- Settings: converted to five tabs (General/Alerts/Integrations/Team/Data) with
  the active tab in ?tab= and every deep-link into Settings pointed at the tab
  it means; duplicate Data & Privacy card removed.
- Accent unified on `#0A84FF` (indigo `#5B5BD6` removed from app screens).
- 5 dead dashboard components deleted (zero imports).
- Global header search was broken (`/reviews?search=` redirects to `/inbox` and
  dropped the query); now wired.
- New `POST /api/reports/send-now` — the Reports buttons were POSTing to
  CRON_SECRET-gated endpoints and silently 401ing on every click.
- Tests 129 → 136.

## Verified clean (don't re-audit without reason)

Swept with scripted class-searches, no issues found: divisions guarded against
NaN/Infinity; `formatReviewDate` handles empty/invalid/non-ISO input; all 61
client `/api/*` URLs resolve to a real route handler; no `<div onClick>` without
a keyboard path except the modal backdrop (intentional); inbox search already
guards against stale responses correctly.

## What's next

1. **Merge PR #73** (founder) — nothing ships until then
2. Add real Clerk test keys as CI secrets so E2E becomes a real signal
3. Decide on `--rb-fg-4`: darkening it to pass contrast collapses it into
   `--rb-fg-3`; needs a design call
4. Visual QA on the preview. Onboarding, Settings (both tab layouts) and
   Reports **were** rendered and checked in both themes — the agent's network
   blocks the Vercel preview host, so this ran against a local dev server with
   placeholder env and middleware stubbed *locally only* (never committed; see
   the recipe below). Still unverified: the Inbox with real reviews and the
   Google Play modal, because neither renders without workspace data.

   Recipe, if you need it: write a `.env.local` with the CI placeholder Clerk/
   Supabase values, replace `src/middleware.ts` with a pass-through, `npm run
   dev`, then drive Playwright at `127.0.0.1:3000` with
   `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.
   Set the theme by seeding `localStorage['reviewbox-workspace']`. **Restore
   middleware and delete `.env.local` before committing** — verify with
   `git status` *after* cleanup, not before.
5. Invite the service account in Play Console so reviews actually sync
