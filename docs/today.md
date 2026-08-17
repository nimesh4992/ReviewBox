# Today — 2026-08-17

Everything below is on `claude/stripe-review-readiness-fadzzh` (draft PR).
Build clean, tsc 0 errors, lint 0 errors, 344 unit tests passing.

**The task:** get the site ready for Stripe's account/website review. Along
the way: **master does not build** and has not deployed since PR #91 merged.

---

## ⚠️ Master is broken — this PR fixes it (merge this first)

PR #91's GitHub auto-merge mangled `src/app/(app)/dashboard/page.tsx` for the
**fourth documented time**: it spliced #90's hero rework and #91's chart rework
into one file, leaving an unclosed JSX element and a KPI object with duplicate
keys. `tsc` fails, so `next build` fails, so **every Vercel deploy of master
since #91 merged has failed** — production is frozen at PR #90.

Two consequences worth knowing:

1. **The "foreign build" mystery from 2026-08-16 is solved.** The production
   hero copy "We haven't read your store listing yet" that session 3 couldn't
   find at any commit is from PR #90 (`53cdf24`) — #90 and #91 were developed
   concurrently, so session 3's branch never contained it. Production is OUR
   build; it's just pinned at #90 until master compiles again.
2. The resolution in this PR keeps **both** PRs' work: #90's hero design
   (store rating never falls back to the synced average; "As shown on Google
   Play · N ratings" attribution) + #91's chart (fixed 1–5 star axis, measured
   width via ResizeObserver, no glyph distortion) + #91's "last 30 days ·
   synced" KPI label. Where the two disagreed (hero fallback), #90's
   strict-separation design won because #91's would have re-introduced the
   duplicate-number bug #90 exists to fix.

---

## What shipped this session — Stripe review readiness

Founder said "let's finish Stripe" (lifts D013 freeze for this work).

- **The in-app Billing page sold plans we don't have.** It was a hand-typed
  list: a $199 "Team" tier that no longer exists, Pro at $99 (the *annual*
  per-month price) while checkout would charge the $129 monthly price, and
  limits ("Up to 2 apps", "7-day history") matching nothing in `PLAN_LIMITS`.
  Advertised-price ≠ charged-price is exactly what Stripe reviews punish. The
  page now derives from `lib/plans.ts` like `/pricing` does, and shows an
  Enterprise "Talk to us" card instead of Team.
- **"team" removed everywhere it could still be charged or tracked:**
  `PRICE_IDS` (now `Record<PaidPlanName, string>`), checkout's plan guard,
  analytics event types, upgrade toast, `.env.example`.
- **Middleware entitlement fixed:** dead "team" removed; **"enterprise" added**
  — it's quote-only and hand-assigned, and was the one plan that would have
  been locked out of `/automations`, `/reply-kit` and `/api/reply` after
  signing a contract.
- **Currency is explicit:** `/pricing` and Billing now say "USD / month"
  (Stripe's checklist item; ₹ line names its own currency).
- **`docs/STRIPE_SETUP.md` rewritten to reality:** 2 products not 3, $129 Pro,
  all **5** webhook events the handler listens for (the doc said 3 — configured
  that way, payment recovery and portal plan changes would never sync),
  cancellation flips plan to `canceled` not `free`, India-account pointers.
- **`docs/STRIPE_LEGAL_CHECKLIST.md` §4** is now the single submission runbook
  (added: production-build verification, `NEXT_PUBLIC_APP_URL`, annual/INR
  decision; ticked: currency display).

---

## ⚠️ Founder actions, in order

| # | Action | Why |
|---|---|---|
| 1 | **Merge this PR** | Master builds again; every deploy since #91 has failed |
| 2 | **Fill the 5 facts in `src/lib/legal/company.ts`** — firm reg. number (or "unregistered"), GSTIN, business address, Grievance Officer (named human), courts city | Every page footer shows "[to be published]" until then; a Stripe reviewer reads that as an unfinished site. `npm run test:unit` prints what's missing |
| 3 | After deploy: check `/pricing`, `/terms`, `/privacy`, `/refund-policy`, `/grievance`, `/contact` **logged out** on tryreviewbox.com | What the reviewer sees |
| 4 | Set `NEXT_PUBLIC_APP_URL=https://app.tryreviewbox.com` in Vercel (carried from session 2) | Stripe checkout return URLs + every email link |
| 5 | Run migrations `024`, `023`, `021` (carried) | Tag editing, trial cron, orphaned reviews |
| 6 | **Request Stripe India invite** + gather KYC (partnership deed, firm PAN, GSTIN, bank proof, partner IDs). Firm name in the application must match the deed character-for-character | Invite-only; gates everything |
| 7 | Decide **annual + INR billing** (RBI e-mandate issue) before creating prices | `/pricing` advertises both; checkout sells monthly USD only |

Then: `docs/STRIPE_SETUP.md` end-to-end in test mode (I can verify the flow
once test keys exist).

---

## Still open (code, no founder dependency)

Carried from session 3: **A8** (Play listing scrape blockable from Vercel IPs),
**LT1** (`PGRST204` sweep), **CM1** (multi-language), **AU4** (error
surfacing), **CM2 remainder**.

---

## Notes for the next session

- `dashboard/page.tsx` mangled by auto-merge **again** (4th time). The pattern
  is always the founder pressing "Update branch" on GitHub while two PRs touch
  the file. Until branch protection requires green checks, every merge of a PR
  touching this file or `review-queue.tsx` needs a local `npx tsc --noEmit`
  first.
- The reference resolution for this round: `#90 hero + #91 chart`. If it gets
  mangled again, that's the shape to restore.
- Stripe keys are still unset — checkout intentionally answers
  `STRIPE_NOT_CONFIGURED` (503) until N6 lands. D013's freeze is lifted only
  for review-readiness work the founder asked for.
