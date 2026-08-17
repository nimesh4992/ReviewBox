# Today — 2026-08-17 (Stripe review readiness)

Work is on `claude/stripe-review-readiness-fadzzh` → **PR #95**.
tsc clean, lint 0 errors, full `next build` passes.

**State of master:** healthy. #93 (dashboard repair + per-app scoping +
previews-off), #94 (production Clerk key), #92 (security round + sixth
mangling repair) all merged this morning. Production deploys work again.

**PR #95 pivoted mid-flight.** It originally also repaired the #91 dashboard
mangling — #93/#92 landed their own repair first, so that half was dropped by
merging master in and taking master's dashboard whole (the CLAUDE.md
take-one-side rule). #95 is now Stripe-readiness only.

---

## What ships in PR #95

The founder asked to finish Stripe review readiness (in-session approval —
lifts D013 for this work; keys/products remain founder-side).

- **The in-app Billing page sold plans we don't have.** Hand-typed list: a
  $199 "Team" tier that no longer exists, Pro at $99 (the *annual* per-month
  figure) while checkout would charge the $129 monthly price, limits matching
  nothing in `PLAN_LIMITS`. Advertised-price ≠ charged-price is what Stripe
  reviews punish. Now derived from `lib/plans.ts` exactly like `/pricing`;
  Enterprise renders as "Talk to us" (no Stripe product, by design).
- **"team" removed everywhere it could be charged or tracked:** `PRICE_IDS`
  (now `Record<PaidPlanName, string>`), checkout's plan guard, analytics
  types, upgrade toast, `.env.example`, CLAUDE.md env list.
- **`enterprise` now entitles in middleware** — quote-only, hand-assigned, and
  was the one plan that would have been locked out of `/automations`,
  `/reply-kit`, `/api/reply` after signing a contract. Dead "team" removed
  from the same set.
- **Currency explicit:** `/pricing` and Billing say "USD / month".
- **`docs/STRIPE_SETUP.md` rewritten to reality:** 2 products not 3, Pro at
  $129, all **5** webhook events the handler needs (doc said 3 — payment
  recovery and portal plan-changes would never have synced), cancellation
  sets plan `canceled` not `free`, India-account pointers.
- **`docs/STRIPE_LEGAL_CHECKLIST.md` §4** is the single Stripe submission
  runbook (production checks, `NEXT_PUBLIC_APP_URL`, annual/INR decision).

Merge plan: per **D020**, merge once every check is green on the head commit.

---

## ⚠️ Founder actions, in order

| # | Action | Why |
|---|---|---|
| 1 | **Fill the 5 facts in `src/lib/legal/company.ts`**: firm reg. number (or "unregistered"), GSTIN, business postal address, Grievance Officer (named human: name/designation/email/address), courts city. And **confirm "AT WORK Inc" matches the partnership deed exactly** | Every page footer prints "[to be published]" until then — a Stripe reviewer reads that as an unfinished site. `npm run test:unit` prints what's missing |
| 2 | After #95 deploys: open `/pricing` `/terms` `/privacy` `/refund-policy` `/grievance` `/contact` **logged out** on tryreviewbox.com | What the reviewer sees |
| 3 | Set `NEXT_PUBLIC_APP_URL=https://app.tryreviewbox.com` in Vercel (carried) | Stripe checkout return URLs + every email link |
| 4 | Run migrations `024`, `023`, `021` (carried) | Tag editing, trial cron, orphaned reviews |
| 5 | **Settings → Apps → Sync now**, reload dashboard (carried from #93) | Store rating heals only when a sync runs |
| 6 | **Request Stripe India invite** + KYC ready (partnership deed, firm PAN, GSTIN, bank proof, partner IDs); tick export opt-in | Invite-only; gates the application |
| 7 | Decide **annual + INR billing** before creating Stripe prices | `/pricing` advertises both; checkout sells monthly USD; RBI e-mandate makes annual-on-Indian-cards fail unattended |

Then `docs/STRIPE_SETUP.md` end-to-end in test mode (agent verifies checkout →
webhook → Supabase once test keys exist).

---

## Still open (code, no founder dependency)

Carried: **A8** (Play scrape blockable from Vercel IPs), **LT1** (PGRST204
sweep), **LT2** (Clerk preview keys, only if previews return), **AS1**
(per-workspace sync lock), **CM1** (multi-language), **AU4** (error
surfacing).

---

## Notes for the next session

- PR #95's first head commit (0ddd918) got **no CI runs at all** — cause not
  identified (the Vercel checks ran). If CI silence repeats on a fresh push,
  investigate Actions triggering before trusting any "no red checks" state.
- The #90×#91 dashboard collision has now been repaired independently three
  times (#93, #92, and #95's dropped attempt). The CLAUDE.md rule held: take
  one side's file whole, never hand-blend.
