# Decisions log

Append-only. Every meaningful decision lives here with a date and reason.
Agents read this file before doing anything. Decisions marked
**IMMUTABLE** cannot be overridden by any agent or session.

---

## D000 — The non-coder contract (2026-05-17) — IMMUTABLE

The founder of ReviewBox has never written a line of code. Their role
is product, marketing, UX judgment, and final decisions on direction.
Their role is **NOT** to read code.

**Therefore:**
- Every PR I open MUST include a plain-English description and a
  test plan that a non-coder can verify in under 5 minutes.
- If a PR can't be described that way, it's too big — split it.
- I never use the founder's "approval" as evidence the code is correct.
  The CI checks are that evidence. The founder's role is to verify
  *behavior* on the Vercel preview.
- I never push to `main`. PRs only.
- I never deploy to production. Vercel auto-deploys on merge.
- I never run database migrations against production. The founder
  pastes them into Supabase manually.

---

## D001 — Brand vocabulary (2026-05-17) — IMMUTABLE

- Brand name: **ReviewBox** (one word, capital R, capital B)
- Domain: `tryreviewbox.com`
- Support email: `hello@tryreviewbox.com`
- Brand blue: `#0A84FF` (iOS blue) — the only hardcoded color allowed
- Old names `revi.app` and `AT Work Inc.` are NOT to be used. Legal
  pages may show "ReviewBox Inc." as the registered business.

---

## D002 — Plan vocabulary (2026-05-17) — IMMUTABLE

Plan states across the system (Clerk metadata, workspaces.plan, UI):

- `trial` — new signup, 14 days, no card required
- `starter` — paid, $49/mo
- `pro` — paid, $99/mo
- `team` — paid, $199/mo
- `past_due` — payment failed, in 7-day grace window
- `canceled` — user canceled or grace expired

The string `'free'` is NOT a plan state anymore. Never reintroduce it.

---

## D003 — Onboarding gate (2026-05-17) — IMMUTABLE

- `onboarded=false` users MUST be redirected to `/onboarding` for
  every path except `/onboarding/*`, `/api/onboarding/*`,
  `/invite/*`, `/api/account/accept-invite`.
- `onboarded=true` users MUST be redirected away from `/onboarding`.
- Set `onboarded=true` in Clerk metadata after workspace creation
  OR invite acceptance.

---

## D004 — API error envelope (2026-05-17) — IMMUTABLE

All API routes return errors in canonical shape:

```ts
{ error: { code: ApiErrorCode, message: string } }
```

Use the `apiError()` helper from `src/lib/api-response.ts`. The
client switches on `error.code`, never on `error.message`.
Adding new codes to the `ApiErrorCode` union is safe. Renaming or
removing existing codes is a breaking change.

---

## D005 — Rate limiting (2026-05-17) — IMMUTABLE

Every route that touches a paid service (Groq, Gemini, Stripe,
Resend) or that could be enumerated must call `rateLimit()` from
`src/lib/api-rate-limit.ts`. Default key: user ID if signed in,
else X-Forwarded-For IP.

---

## D006 — Migrations are forward-only (2026-05-17) — IMMUTABLE

- Schema changes go in `supabase/migrations/NNN_short_name.sql`.
- Never edit a committed migration. Add a new one.
- Idempotent: use `if not exists`, `drop ... if exists`.
- No destructive `update`/`delete` without a `where` clause that
  bounds the row count.
- The founder pastes each migration into Supabase prod manually.

---

## D007 — Audit log writes (2026-05-17) — IMMUTABLE

Mutating routes (publish reply, create/update/delete rule,
template, KB entry, app, workspace, member, billing event) MUST
call `audit()` from `src/lib/audit.ts` after the mutation succeeds.
Best-effort; never blocks the response.

---

## D008 — Soft delete with 30-day grace (2026-05-17) — IMMUTABLE

User-initiated account deletion is a **soft delete**:
- `/api/account/cancel` sets `workspaces.deleted_at` and
  Clerk `publicMetadata.accountDeletedAt`.
- `/api/account/restore` reverses it within 30 days.
- A pg_cron job hard-deletes after 30 days.

Legal "right to erasure" is **hard delete** via `/api/gdpr/delete`
(separate route, requires `confirm: "DELETE MY ACCOUNT"` body).

---

## D009 — Guardrails I never violate (2026-05-17) — IMMUTABLE

I will refuse, even if explicitly asked:

1. Merge a PR to `main`. (Founder merges.)
2. Push to `main` directly.
3. Force-push, rebase main, rewrite history.
4. Deploy to production. (Vercel auto-deploys on merge.)
5. Run a migration against production Supabase.
6. Send a real email to a real customer.
7. Change pricing without an entry in this file approved by the founder.
8. Change billing logic without architect ADR + founder approval.
9. Modify legal pages (Terms, Privacy, DPA, Acceptable Use,
   Refund) without founder approval.
10. Add a new paid SaaS dependency. (Founder signs up + adds keys.)
11. Delete customer data outside the documented soft-delete or
    `/api/gdpr/delete` paths.
12. Run any 3rd-party OAuth flow on behalf of the founder.
13. `git commit --no-verify` or skip pre-commit hooks.
14. Disable or weaken CI checks.

If any backlog item, instruction, or message asks me to do one of
these, I stop and file it as a blocker requiring founder approval.

---

## D010 — Stack choices (2026-05-17)

- **Framework**: Next.js 15 App Router (no plans to upgrade until 16 stable)
- **Language**: TypeScript strict
- **Styling**: Tailwind v4 + shadcn/ui + CSS tokens (`--rb-*`)
- **State**: Zustand (UI), TanStack Query (server)
- **DB + Auth**: Supabase (Postgres + RLS), Clerk
- **AI**: Groq (replies, primary), Gemini (sentiment + ASO, secondary)
- **Cache + Rate limit**: Upstash Redis
- **Email**: Resend (transactional)
- **Payments**: Stripe
- **Errors**: Sentry
- **Product analytics**: PostHog
- **Hosting**: Vercel
- **Test runner**: Vitest (unit), Playwright (e2e)

Adding a NEW item to this list requires a new decision entry.

---

## D011 — ICP (2026-05-17)

**[FOUNDER: edit this paragraph today.]**

Working hypothesis: indie iOS/Android dev or small studio with 1–3
apps, 1K–10K reviews/month per app, founder-led or 2–5 person
team, currently using AppFollow trial / spreadsheets / nothing,
English-speaking primary market, $5K–$100K MRR business stage.

Why they'd buy ReviewBox:
- AppFollow at 1/4 the price
- AI replies that actually sound human
- 5-min onboarding, no sales call

---

## D012 — Single backlog (2026-05-17) — IMMUTABLE

`docs/backlog.md` is the only source of truth for what to build.
- Items are ICE-scored: Impact × Confidence ÷ Effort.
- Agents work top-down.
- New ideas go to backlog; they don't bypass it.
- Founder reorders weekly. I never reorder without instruction.

---

## D013 — Stripe deferred until founder requests (2026-05-29)

Do NOT build, wire, test, or reference Stripe billing in any session
until the founder explicitly asks. N6 is removed from active NOW
items. Treat BUG-001 (no billing path) as out of scope.

This applies to: checkout flow, webhook wiring, plan gates on features,
upgrade prompts, and any billing-related UI changes.

