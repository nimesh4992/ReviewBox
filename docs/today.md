# Today — Handoff for next agent

**Last updated:** 2026-08-16
**State:** PR #77 (audit round, 28 fixes) is **MERGED to master**. Master compiles,
all CI green, migration 020 applied to production by the founder.

You are the next Claude agent. Read this top-to-bottom before doing anything.

---

## Read order, every session

1. **`CLAUDE.md`** (repo root) — stack, conventions, autopilot model, what NOT to do
2. **`docs/PRODUCT_CONTEXT.md`** — who the customer is; an audit without it can only find inconsistency
3. **`docs/decisions.md`** — IMMUTABLE rules. D000 (non-coder contract) and D009 (never-do list) are critical.
4. **`docs/backlog.md`** — ICE-ranked queue
5. **This file (`docs/today.md`)** — last session's handoff

---

## ⚠️ Read this first: master may not be reaching production

There are two ways this repo can deploy production, and on 2026-08-16 **both
were closed at the same time**, silently:

1. **Vercel's Git integration** — refuses to build master for this repo.
   Vercel answers `Deployment Blocked — the commit author did not have
   contributing access; the Hobby Plan does not support collaboration for
   private repositories`. The repo owner's GitHub account is not a member of
   the Vercel team, and merge commits are authored by that account. This is
   why the CLI job below exists at all (see the comment above
   `deploy-production` in `.github/workflows/ci.yml`).
2. **The `deploy-production` CI job** — needs `VERCEL_TOKEN`, which is **not
   set**. It used to *skip* when the token was missing and still report a
   green "Deploy to production".

Net effect when PR #77 merged: CI was fully green, the deploy check was green,
and **nothing shipped**. A green check that means "deployed nothing" is the
exact silent-success failure the audit round was about, so this session made
that job **fail loudly** instead of skipping.

**Consequence for you:** a red `Deploy to production` on master is *correct and
expected* until the founder adds the secret. It means master genuinely is not
in production. Do not "fix" it by restoring the skip.

**Founder action (~2 min, unblocks all deploys):** Vercel → Account Settings →
Tokens → create a token scoped to the ReviewBox team → GitHub → Settings →
Secrets and variables → Actions → add it as `VERCEL_TOKEN` → re-run the job.

---

## What shipped (PR #77, merged 2026-08-16)

A full five-lens audit (`docs/AUDIT_SYSTEM.md`) plus a browser walkthrough and a
live probe of the signup path. **28 defects fixed.** The full table with
`file:line` evidence is in `docs/AUDIT_SYSTEM.md` under "2026-08-15 round".
Headlines:

- **Every automation rule was a silent no-op.** Sync passed the store's
  `external_id` where the executor updates `reviews` by uuid PK, so every write
  was a 22P02 no-op — while the run log (whose `review_id` is TEXT) recorded
  **"success"**. Auto-reply threw "review not found" on every fire.
- **Abandoning onboarding stranded users permanently.** Only `/complete`
  stamped the trial; closing the tab during the forced ~10s wait left Clerk with
  no plan, and `/api/reply/draft` read a *missing* plan as `free` (0 drafts/day).
- **GDPR export leaked App Store Connect `.p8` signing keys** to any member
  (no owner gate, `select("*")` over `apps`).
- **App Store Connect territories are alpha-3** ("IND") going into `char(2)` —
  22001 fails the whole insert batch, so connecting ASC broke sync entirely.
- **AppFollow re-import erased saved drafts** (blanket upsert) and keyed
  ID-less rows on their *position in the file*, overwriting unrelated reviews.
- **Eight UI spots reported failure as success or as empty data** — most
  damaging: any error loading apps rendered the first-run "connect your first
  app" welcome to established customers.

## Signup path — verified answers

- **Sentiment covers every review at signup.** The rules engine tags each
  bootstrapped review at write time (sentiment/priority/tags/escalation), no
  network, no tokens. Verified live: 1★ crash text → `critical`/`urgent`/
  `["crash","release-regression"]`/engineering. Gemini only refines ambiguous
  3★ reviews later, on demand.
- **Why customers see ~50-60 reviews, not 200.** `BOOTSTRAP_LIMIT` is 200, but
  the Play scrape is filtered to `lang: "en"`, so an app whose reviews are
  mostly Hindi/Marathi returns only its English subset. For the India-first ICP
  that is the normal case. This is backlog **CM1** and is the highest-value
  remaining item for the core promise.

## ⚠️ The build sandbox cannot test the live store calls

Its egress proxy refuses `CONNECT` to `play.google.com`, `itunes.apple.com` and
`tryreviewbox.com` with **403 before any request leaves the box**
(`curl: (56) CONNECT tunnel failed, response 403`). Every store 403 seen from a
Claude session — including the one recorded as finding **A8** — is the sandbox,
**not** Google blocking us. Only `GET /api/admin/probe/stores` against
production can settle it. Do not record a sandbox 403 as a store block again.

## Resolved — don't re-investigate

- **`aso_keywords` schema ambiguity: CLOSED.** Founder ran the check on
  2026-08-16; production has `volume_estimate` / `trend_data` / `added_at` /
  `updated_at`, matching `007_aso_keywords.sql` and the code. The conflicting
  `pending_combined.sql` has been deleted from the repo.
- **Migration 020 applied**, including RLS on `webhook_events`.
- **Backlog R1** (middleware matcher gaps) was already fixed; re-verified.

## What's next

1. **Founder: add `VERCEL_TOKEN`** — nothing reaches production until then
2. **CM1** — multi-language reviews; the `lang: "en"` filter is costing our ICP
   most of their feedback
3. **AU3** — `ai_usage` is read by four dashboards and written by nothing, so
   every "AI drafts" figure is permanently 0
4. **AU4** — finish the swallowed-error sweep on ASO / Sentiment / Reply Kit /
   Competitors (same shape as the fixes already shipped)
5. Migration numbering has hit its **third** duplicate (`007` + `007a`). Next
   number is **021**.
