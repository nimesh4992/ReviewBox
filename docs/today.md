# Today — 2026-08-18 (the marketing site rebuilt on one design system)

**State of master:** `d32b40be`. **Unit/build/lint jobs green — the deploy job
is RED and has been since 07:19.** Production is therefore running older code
than master. See "Master is not shipping" below; this predates today's work.

**Open PR: #120** — `claude/website-ui-fonts-visuals-be6587`. Draft. Locally:
`tsc` clean, lint clean on every touched file, **565 unit tests**, full
`next build` passes (96 static pages), zero horizontal overflow across 12 pages
× 7 widths in both themes.

**⚠️ CI has not run on #120.** No `ci.yml` run exists for the branch after
either the initial PR or a subsequent push. Every prior `pull_request` run in
this repo came from a **non-draft** PR; #120 is the first draft. Marking it
ready for review is the untested fix. Until a run exists there is nothing to
merge on — CI green is the only gate (previews are disabled).

---

## What shipped in #120

### The actual finding: the site had two design systems

The homepage used `--rb-*` tokens and a hand-tuned scale. The other nine
marketing pages used raw `gray-*`, hardcoded dark-mode hex and default Tailwind
sizes. Counted before the change, across those nine files:

| | before | after |
|---|---|---|
| raw `gray-*` utilities | 232 | 0 |
| hardcoded dark-mode hex | 180 | 0 |
| default-scale `text-*` | 146 | 0 |
| `--rb-*` token uses | 0 | 278 |
| shared type classes | 0 | 137 |

That is why the secondary pages read as generic next to the homepage. It was
never a taste problem.

### Fonts: the scale was the dashboard's

The only type scale in the repo is `--rb-text-*` — 11–17px, "display" at 28px.
That is correct for a queue of 200 review rows and wrong for a page a stranger
reads at arm's length. Marketing inherited it and set body copy at **12–13px**.

Added a marketing scale in `globals.css`: `.rb-display / h1 / h2 / h3 / h4 /
lead / body / body-sm / meta / kicker`. Body is 16px with a 15px dense variant.
Every step is a `clamp()`, so the scale is responsive at the point of
definition and needs no breakpoint overrides.

Deleted ~60 lines of dead CSS while there: `.rb-marketing [style*="font-size:
88"]` attribute-substring rules, all `!important`, written when these pages
were built from inline style objects. Those inline styles are long gone, so
none of the rules matched anything — while still reading as live responsive
logic a future change had to respect.

### The hero's floating cards were broken in both directions

Founder-reported, and worse than it looked:

- **Below 1536px they did not render at all** (`2xl:block`) — so on a 1440,
  1366 or 1280 laptop they were simply missing.
- **Above 1536px they overlapped the frame** and covered the "Urgent" badge.

They are now a squared three-up row *inside* `ProductFrame`, identical from
390px to 2560px. The review list is also no longer `hidden md:block`, so the
"one inbox" story survives on a phone.

### The hero mock showed a screen that doesn't exist

Narrow list, wide reading pane, no search, no filter chips. The real queue
(`features/reviews/components/review-queue.tsx`) is the reverse — list is the
flexible wide pane, detail is a fixed 420px column — and opens with a search
field and chips. Rebuilt to match.

### One real responsive bug, found by measuring rather than looking

The pricing/compare tables scrolled internally **and** expanded the document's
scroll area: 208px of horizontal page scroll at 390px, so dragging the table
slid the nav, hero and footer with it.

Ancestor `overflow-hidden` did not stop it. Moving the `min-width` from the
`<table>` onto a plain block wrapper did not either. **Paint containment did.**
The usual global escape hatch — `overflow-x: hidden` on a page wrapper — is not
available here: `MarketingShell` is an ancestor of the `sticky` nav, and an
overflow-hidden ancestor silently kills `position: sticky`. Commented in place.

### A silent Server/Client boundary bug I introduced and caught

`RHYTHM` was exported from `components/primitives.tsx`, which carries
`"use client"`. Next.js turns every export of a client module into a client
*reference* at the server boundary, so Server Components got a proxy and
`RHYTHM.md` evaluated to `undefined`.

It failed **silently** — `<Section className={undefined}>` is valid, so the
class was just absent. All nine server-rendered pages shipped with no section
padding; the homepage was fine because it is a Client Component and crosses no
boundary. The rendered HTML is what exposed it: one `py-16` per server page
against every section on the homepage.

Moved to `src/features/marketing/rhythm.ts` — no directive, both sides import
the real object. **The rule: a plain value shared across the boundary must not
be exported from a `"use client"` module.**

### Dark mode was broken on ten pages

- `/help` rendered `MarketingNav` + `MarketingFooter` but never
  `MarketingShell`. The nav's toggle reads its state from that provider, so on
  that page the moon button **did nothing at all** — and the page carried zero
  `dark:` variants, pinned to a hardcoded `#F5F5F7`.
- The **eight legal pages** had a bespoke 14px nav, no footer, and the same
  hardcoded light canvas. The site footer links to every one of them, so
  following "Terms" stranded the reader with no way back. They now share the
  shell, nav and footer. **No legal text touched.**

Verified: all eleven marketing pages now report `data-theme=dark` and a dark
canvas after toggling.

---

## Claims corrected — each contradicted something already decided here

| Where | Said | Reality |
|---|---|---|
| **Homepage** | Pro **$99**, Team **$199** | Pro is $129; Team removed. $99 is Pro's *annual* per-month rate. Now derived from `lib/plans.ts` |
| `/compare` | 3 testimonials with job titles | The comment beside them read *"Placeholder quotes — replace once we have real customers"* |
| `/compare` | "Most teams save $1,000–$2,500/year" | No cohort to average |
| `/compare` | Sync every 4h | Cron is daily; Vercel Hobby caps it |
| `/compare` | Crash clusters, auto-publish, webhooks, Zapier | All unbuilt — `/pricing` had already deleted each one |
| `/compare` | Live chat ✓ | `/contact` says "Not yet" on the same site |
| `/compare` + ROI | "$49 … unlimited apps" | Starter covers 2. Now read from `PLAN_LIMITS` |
| `/faq` | "Yes — on the Team plan" (auto-publish) | Contradicts the homepage FAQ: nothing posts without a click |
| `/blog` | 6 posts | 3 returned 404 |
| `/status` | Live latencies, 90-day uptime, 2 incidents | All invented — `generateUptimeBar()`'s own comment said "simulation" |

13 `/compare` rows corrected. The page now shows several ✗ against us, which is
the point: a comparison table that only flatters its author is worth nothing.

---

## ⚠️ Founder actions from this session

1. **Terms of Service quotes prices we do not charge.** D009 forbids me
   touching legal pages, so it is untouched. §4 says *"Starter — $49/month …
   Pro — **$99**/month … **Team** — $199/month"*, and the plain-language
   summary says "Three paid tiers: Starter, Pro, Team." Pro is $129 and Team
   does not exist. This is the same drift fixed on the homepage, but in the
   contract. **Say the word and it is a one-commit follow-up.**
2. **#120 has no CI run.** Most likely because it is a draft. Marking it ready
   for review should trigger `ci.yml`.
3. **Master is not shipping.** The deploy job has failed since 07:19 with
   `Error: Project not found ({"VERCEL_PROJECT_ID":"prj_OE66Qpr8IdTXwLG6BOzevWYagRcl",
   "VERCEL_ORG_ID":"team_mQlD3mcz32rsA4HcPOBRiW6b"})`. Vercel's own bot reports
   this project under **`team_YDfGTQhOF3TYQa36p7LILfuB`** — a different org id
   than the one hardcoded in `ci.yml`. The test jobs are green, so this reads
   as "CI problem" rather than "production is running older code". Not fixed
   here: deploy config took production down once already (see CLAUDE.md), so it
   wants a deliberate change, not a drive-by.
4. **The footer still shows `[registered office address to be published]`** on
   every page, live.

---

## Deliberately not done

- **Blog posts and Help articles were removed, not written.** Three blog slugs
  404'd and nine Help entries pointed at `href: "#"`. Advertising writing that
  does not exist is the same class of claim as advertising an unbuilt feature.
- **`/status` kept, not deleted.** It is already in the founder-approved page
  cut, and `/contact` and the footer still link to it. It is now an honest
  notice board rather than a simulated dashboard.
- **`--rb-fg-4` left at 2.15:1**, decoration-only, per the standing note in
  CLAUDE.md. It is used for the "not included" glyphs, where meaning is carried
  by screen-reader text rather than the mark.
- **The Compare table kept all ~40 rows.** Trimming it is a content call.

---

## Still open from 2026-08-17 (unchanged — none of this was touched today)

1. **W5A — decide the review-volume limit.**
   `docs/adr/009-review-volume-limit.md`. `reviewsPerMonth` is advertised on
   `/pricing` and Billing and enforced nowhere. Recommendation is **B — soft
   cap**. Worth settling before Stripe goes live. Last open audit finding.
2. **BUG-037 — Clerk test keys into GitHub Actions secrets** (~10 min). Turns
   23 skipped e2e specs into real ones, and unblocks M-14.
3. **2026-08-30 — FieldLog's trial lapses.** The only workspace with a
   `trial_ends_at`; the other three are `null` and the expiry cron excludes
   nulls. Backfilling is a pricing call.
4. **ADR 010's four questions** — hide vs delete at 365 days, free-tier
   behaviour, capture-date vs review-date, whether retention replaces W5A.
5. **`resolveAppMetadata` short-circuit** — ranking never runs at onboarding.
6. **`auto_reply` stays off.** The sync lock was its prerequisite, not its
   approval — the lock fails open when Redis is unreachable.

## Up next

1. Get #120 a CI run, then merge on green.
2. **CM1** — multi-language reviews + replies. ICE 60.
3. **AU4** — finish the swallowed-error sweep on the remaining screens.
