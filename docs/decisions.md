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

---

## D014 — Business model: boutique, not mass market (2026-05-30)

Target ceiling: **40–50 paying customers, 2–4 apps each = 80–200 apps total.**

This is a focused, high-margin niche product — not AppFollow. Implications:

- Do NOT over-engineer for scale that won't be reached.
- Optimize for **reliability and quality**, not throughput.
- Infrastructure decisions are made for 200 apps, not 200,000.
- Support model is high-touch: founder knows each customer by name at launch.
- Pricing reflects this: $200–500/month per customer, not $29/month self-serve.

Any architectural decision that adds complexity "for scale" must be questioned
against this ceiling. At 200 apps, simple and reliable beats clever and scalable.

---

## D015 — Data retention: store everything indefinitely (2026-05-30)

**Never delete review data on a time-based schedule.**

At max scale (200 apps, 5K reviews avg) = ~500 MB — well within Supabase free
tier (500 MB) and trivially under Pro (8 GB). Storage cost at this scale is
effectively zero.

Historical data is product value:
- Sentiment trend charts require months of history
- Year-over-year comparisons require full history
- "This user complained about this 6 months ago" context requires full history
- Incident detection across versions requires full history

Rolling deletion (e.g. 90-day window) trades real product value for ~$0 cost
savings. It is never worth it at this scale.

**The only valid deletion paths:**
- User-initiated account deletion → soft delete then hard delete after 30 days (D008)
- GDPR right-to-erasure request → hard delete via `/api/gdpr/delete`
- Individual app disconnect → soft delete, 30-day restore window

90 days is the scope of the **initial sync** (bounded, fast first connect).
After that, incremental sync adds new reviews forever and nothing is deleted.

---

## D016 — Sync architecture: reliability first, complexity never (2026-05-30)

At current scale (5–50 customers, 15–200 apps), the sync architecture must be:

**Rules:**
1. `last_sync_attempted_at` is stamped **before any API calls** — the moment sync begins.
   This is what the banner checks. If this is NULL, we've never tried. If set, we tried.
2. Initial sync (when `last_synced_at IS NULL`): fetch last **90 days** only. Bounded,
   fast, completes in seconds. Data kept forever per D015.
3. Incremental sync (when `last_synced_at IS NOT NULL`): fetch only reviews since
   `last_synced_at`. Tiny payload, always fast.
4. Write reviews to Supabase after the full response — no streaming required at this scale.
   Sequential is fine. 200 apps × 7 reviews/day = 1,400 rows/day. Trivial.

**Do NOT build (premature at this scale):**
- Supabase Edge Functions for sync (Vercel cron is sufficient)
- Real-time Supabase subscriptions for live review streaming
- Incremental batch writes during sync
- Queue-based sync architecture

Revisit if we exceed 200 apps or if Vercel cron consistently times out.
The timeout budget on Vercel Hobby (10s) is sufficient for incremental syncs.
Only the initial sync of a large app (50K+ reviews) risks timeout — handled by
the 90-day cap on first connect.

---

## D017 — ICP revision: boutique SaaS (2026-05-30)

Replaces the working hypothesis in D011.

**Target customer:**
- Indie developer or small studio (1–5 people)
- 1–4 apps on Google Play and/or App Store
- 500–50,000 lifetime reviews per app
- Currently using AppFollow, spreadsheets, or nothing
- Wants AI-assisted replies without hiring a community manager
- English-speaking primary market
- Pays $200–500/month — values reliability and quality over feature breadth

**What we are NOT building for:**
- Enterprise (100+ app portfolios)
- Agencies managing reviews for multiple clients
- Mass-market self-serve at $29/month
- Users who need SOC 2, SSO, or SLA contracts


