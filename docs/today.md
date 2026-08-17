# Today — 2026-08-16 (session 3)

Everything below is on `claude/dashboard-rating-bug-lf7pkl` (draft PR).
Build clean, 336 unit tests passing, lint 0 errors.

**The bug:** the dashboard showed 2.53 ("30-day average of synced reviews")
where the Play listing shows Mumbai One's own all-time rating, 3.1. Spec
`review-sync.md` AC-6 — "shown numbers match the store" — was failing, again,
for the region-locked fixture app.

---

## ⚠️ Founder actions, in order of cost-if-skipped

| # | Action | What breaks without it |
|---|---|---|
| 1 | After merging this PR: **Settings → Apps → Sync now**, then reload the dashboard | The stale `store_country` / null `lifetime_rating` on the existing app row only heals when a sync runs (or wait for the 8am UTC cron) |
| 2 | If the rating STILL doesn't appear: run `GET /api/admin/probe/stores` and read `google-metadata-regional` | Tells apart "our bug" from "Google refusing our servers" (audit finding A8) — the one cause code cannot fix |
| 3 | Check Vercel is deploying `master` of this repo | The production screenshot shows hero copy ("We haven't read your store listing yet") that does not exist at ANY commit in this repository's history — production may be serving an old or foreign build |
| 4 | Set `NEXT_PUBLIC_APP_URL=https://app.tryreviewbox.com` in Vercel (carried from session 2) | Every link in every email points at the marketing site |
| 5 | Run `supabase/migrations/024_tag_labels.sql`, `023_trial_lifecycle.sql`, `021_orphaned_review_cleanup.sql` (carried) | Tag editing answers MIGRATION_PENDING; trial cron dead; ~250 orphaned reviews linger |

---

## What shipped this session — store rating pipeline + chart

### Why the store rating was null (three stacked defects)

1. **A persisted storefront could never heal** (`review-sync.ts`).
   `refreshAppMetadata()` only ever queried `apps.store_country` once it was
   set. For a region-locked app pinned to the wrong storefront ("us"), the
   listing fetch returned null on every sync, nothing was written, and
   `lifetime_rating` stayed null forever — while reviews kept arriving via the
   Publisher API, which made the sync look healthy. Now: a known storefront
   that returns nothing (or a placeholder page with neither rating nor review
   count) triggers a full re-probe of all storefronts, and a corrected
   country is persisted (previously only a first-discovered one was).

2. **The metadata write was all-or-nothing** (LT1 class). A bare
   `.update({lifetime_rating, lifetime_review_count, icon_url, developer})`
   dies whole on the first missing/uncached column (PGRST204) — rating
   included. Converted to `writeWithOptionalColumns()`; also finally writes
   `metadata_refreshed_at` (existed since migration 012, never written), so
   "has a refresh ever succeeded" is now answerable from the DB.

3. **Failure-shaped scrapes were cached 6 hours** (`store-search.ts`).
   A consent/placeholder page parse (rating null AND count null) was cached,
   so onboarding + every sync retry inside the TTL read the poisoned entry.
   Such results are no longer cached.

Decision logic extracted to `src/lib/app-metadata.ts`
(`buildMetadataUpdate`, `needsStorefrontReprobe`) with unit tests.

### Dashboard chart + labels

- **Y-axis is now the fixed 1–5 star scale** with integer ticks. It used to
  auto-zoom to the data, so a rough month rendered as a 1.4–2.5 window that
  read as "the rating axis ends at 2.5".
- **Axis text is no longer distorted.** The SVG was drawn at fixed 560 units
  and stretched with `preserveAspectRatio="none"`, which squeezes/smears the
  tick glyphs. It now renders at the container's measured pixel width
  (ResizeObserver), and gridlines use `--rb-border-1` instead of a
  light-only rgba black.
- **The two ratings are named.** Hero: "Store rating · all-time" vs
  "Synced reviews · 30-day average". KPI card: "Store rating / all-time
  (store)" vs "Avg. rating / last 30 days · synced". The store's own figure
  and our synced-window average must never be presentable as the same thing.

---

## Still open (code, no founder dependency)

1. **A8** — if Google refuses the public scrape from Vercel's IPs, no code
   path can read the listing rating; the dashboard now at least *says* which
   number it is showing. A Play Developer Reporting API integration would be
   the credentialed, unblockable source — needs an ADR.
2. **LT1** — four writes now on `writeWithOptionalColumns()`; the rest of the
   `PGRST204` class is still latent.
3. **CM1 multi-language**, **AU4** error surfacing, **CM2 remainder** — carried
   from session 2.

---

## Notes for the next session

- `src/app/(app)/dashboard/page.tsx` edited this session (sparkline + labels).
  It is one of the two files repeatedly mangled by auto-merges — if another
  branch touches it, merge locally and run `npx tsc --noEmit` before pushing.
- The connected Supabase/Vercel MCP accounts belong to other products
  (fieldlog etc.), NOT ReviewBox — prod DB/deploys can't be inspected from
  here. Diagnosis above is from code + the founder's screenshots.

---
---

# Session 4 (same day) — security round + master repair

On `claude/product-audit-testing-toum42` → **PR #92**. 356 tests, lint 0
errors, build clean. Session 3's notes above are already in master; this
section is additive, not a replacement.

## 🚨 Merge PR #92 first — master does not build

`npx tsc --noEmit` against `origin/master` (1d53409) fails outright.

PRs #90 and #91 each fixed the same dashboard rating bug independently, and
merging them spliced both bodies together — two `PortfolioSparkline`
implementations in one component, the "Avg. rating" KPI object with every key
declared twice, and the hero label as two adjacent expressions rendering
"Store rating · all-timeStore rating" to the customer. Fifth occurrence in
this file; first one where **both sides were fixes for the same bug**, which
is why each PR was green alone.

Resolved by keeping #91's sparkline (measured pixel width, fixed 1–5 axis —
better than #90's HTML-overlay workaround) and #90's KPI tile (always the
30-day average, so it stops duplicating the hero).

**Lesson worth keeping:** `tsc` caught the syntax damage and the duplicate
object keys. It could NOT see the doubled hero label — that is valid JSX that
renders wrong. After any merge of this file, also scan for adjacent
near-identical JSX expressions.

## Security fixes in #92

The 8-dimension audit workflow died before its verification pass, so findings
were recovered from its journal and **verified by hand**. Three were dropped
for overstating what the code does; one was left as a product decision.

| Finding | Note |
|---|---|
| **AI reply cache had no tenant in its key** | Global Redis namespace, 7d TTL. Drafts are built from the workspace's brand voice + KB, so two customers with the same app served each other's drafts — which then get published to a public store. `workspaceId` now a required arg (omitting it is a compile error). 5 tests. |
| **6 of 7 `/admin` pages had no auth of their own** | Only the layout checked. A layout is not a security boundary — RSC partial rendering can resolve a page without it. Every page calls `getServiceClient()` (bypasses RLS). |
| **`/api/reports/daily-digest` and `/api/tags` in NEITHER matcher** | Both mine. Digest cron never executed; tag renaming broken in prod. A route in neither list does not error — it stops working. |
| **`/api/aso/keywords`, `/api/sync/reviews` unthrottled** | Gemini's 1,500/day is platform-wide; unthrottled sync risks Google blocking our shared egress IP for every customer. |
| **CSV formula injection** | Review bodies are public-written; `=`/`+`/`-`/`@` executes on open. Quoting does not prevent it. → `lib/csv.ts`, 7 tests. |
| **Slack webhook URL returned to any member** | Bearer credential; writing was owner-gated, reading was not. Now a flag + masked tail. |
| Leaked exception, unvalidated cursor, unescaped email icon URL | — |
| 5 dependency advisories | `postcss`/`sharp` NOT taken — only fix via `--force` → next@16.3.1. Neither CVE class is reachable here. |

## GDPR (the dimension that never ran)

Enumerated all 18 tables and diffed against both routes.

- **Export covered 10 of 18.** Added `incidents`, `workspace_invites` (invitee
  email addresses), `support_tickets`, `support_ticket_messages`.
- **Deletion:** workspace row is hard-deleted and 14 tables cascade — but
  `support_tickets` uses `on delete set null` **deliberately** ("must not
  destroy support history"). Those rows keep requester email, name, clerk id
  and every message. Cascading would destroy the history the schema means to
  keep, so the person is removed and the shell stays: email → sentinel, name
  and clerk id null, subject replaced, message bodies deleted.

## ⚠️ Founder decisions — code cannot proceed without these

1. **Slack is an undisclosed sub-processor.** `slack.ts:199-209` sends the
   review author's NAME and full review TEXT to Slack on every urgent review.
   Personal data about someone who never signed up for this product, going to
   an undisclosed US processor. One row on `/sub-processors` fixes it — NOT
   edited here, D009 forbids touching legal pages without approval.
   (Checked and cleared: Apple/Google Play are outbound *reads* of public
   data, not sub-processors. Google is listed anyway.)
2. **`.p8` credential encryption.** Needs a key-management decision first —
   where the key lives, how it rotates, what happens when it is lost (answer:
   every customer's store connection becomes unrecoverable). ADR, not a quiet
   addition. The schema comment claiming Vault encryption was false and is now
   corrected; the privacy page claim is accurate and was left alone.
3. **`auto_reply` publishes un-reviewed model output** to public stores. A
   reviewer's text reaches the model and the output becomes your official
   reply. Guardrails are possible; removing the capability may be honest.
4. **Deletion does not propagate to processors** — Clerk, Resend, Upstash,
   Sentry, PostHog, Groq/Gemini.
5. **Reviewer personal data has no retention limit.** Author names, devices,
   countries about people who never signed up. No expiry at all.

## Carried, still true

`NEXT_PUBLIC_APP_URL`, migrations 021/023/024, and "check Vercel is deploying
master" from session 3 — all still outstanding. Note session 3 observed
production serving hero copy present at no commit in this repo; combined with
the production domain having been pointed at a PR branch earlier today, the
Vercel wiring is worth a proper look.
