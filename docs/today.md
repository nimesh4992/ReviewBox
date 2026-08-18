# Today — 2026-08-18 (marketing site rebuilt on the Envato theme, then the SEO unblock)

**State of master:** `009484f` — PR #124 merged. **Verify the production deploy
before trusting it**; the `VERCEL_ORG_ID` mismatch below may still be blocking it.
`tsc` clean, lint 0 errors, full `next build` passes, **591 unit tests** (was 539).

Two things shipped today, in order.

---

## 1. The marketing site, rebuilt (PR #124 — merged)

The founder bought **SassTech — SaaS Software IT Solution Multipurpose** on
Envato and asked to adapt its `index-4` (CRM) demo. The theme is
Bootstrap + jQuery; this repo is Next.js 15 + Tailwind v4, so **the design was
adapted, not the code** — no theme file is in this repository, which also keeps
us inside the Elements licence (use in an end product, yes; redistribution, no).

**What that produced**

- A marketing palette scoped to `.rb-marketing` in `globals.css` (`--rb-mk-*`):
  amber actions, an ink ramp, hairlines, card radii, the hero mesh. The app
  keeps `#0A84FF`; the two never mix. `src/marketing-shell-contract.test.ts`
  enforces the scoping.
- A shared vocabulary — `features/marketing/components/primitives.tsx` —
  so every page uses the same `Section`, `Card`, `PageHero`, `Disclosure`,
  `Breadcrumb`, rather than 20 hand-rolled variants.
- Dark mode removed from marketing (founder decision). Light only.
- Every marketing page converted: landing, pricing, about, contact, blog,
  changelog, faq, help centre + 5 help articles, and the legal set.

**What came out rather than went in**

- `/compare` — its ROI calculator understated our own price by $80/month and it
  carried three invented testimonials. 307 to `/pricing`. (See SEO4.)
- `/status` — it could not report an outage.
- `roi-calculator.tsx`, 13 dead links, a search box that could not search, and
  category filter pills with no handler.

**Two corrections I owe the record.** I claimed "zero legacy colour references
left" after grepping only for `gray-*` and hex literals — `/blog/ai-cost-reduction`
had not been converted at all and five help articles still carried
amber/blue/emerald/purple. Fixed in `34d0187`. And the `/help` pages shipped
with the nav's "Start free" button rendering with **no background**, because
those six pages were never wrapped in `MarketingShell`; type-check, lint, build
and every test passed. Only a screenshot caught it. That is what the shell
contract test now exists for.

---

## 2. SEO: canonicals, and the sitemap's closed door (this PR)

The founder supplied a **Semrush-backed keyword plan** built against
`appfollow.io` — now `docs/SEO_KEYWORD_PLAN.md`. It is the missing half of
`docs/SEO_CONTENT_PLAN.md`, which was written in July with no volume data at
all because the Ahrefs account had no API access. That older document's §0 now
says so and points here.

Its item #1 is the gate on everything else, and two thirds of it were real:

- **Canonicals.** One deployment serves `tryreviewbox.com`,
  `www.tryreviewbox.com` and `app.tryreviewbox.com`. Only `/` declared a
  canonical. The other 21 indexable pages had none, so each was free to be
  indexed once per hostname, per trailing slash, per query string. All 22 now
  declare one, verified in the built HTML — not just in the source.
- **The sitemap advertised `/sign-in` and `/sign-up`.** Middleware 307s both to
  the app host, where every public route is served `X-Robots-Tag: noindex`. We
  were spending crawl budget to reach a closed door. Removed.
- **The "3 blog 404s" were already gone** — PR #124 cut them.

`src/canonical-contract.test.ts` fails the build if a sitemap entry ever loses
its canonical, or points at the wrong path. Verified to fail by reintroducing
the bug.

Also fixed here: three corrupted Tailwind class names my own colour sweep left
behind in `/help/ai-replies` — `bg-[var(--rb-green-100)]0`, with a trailing
zero, is not a class name, so the three pipeline step badges had no background
and their white numerals were invisible. Same silent class as the `/help` nav
button: everything green, nothing rendered.

---

## Outstanding — founder only

1. **`VERCEL_ORG_ID` is wrong and production may not have deployed since #118.**
   GitHub's secret says `team_mQlD3mcz32rsA4HcPOBRiW6b`; the Vercel bot reports
   `team_YDfGTQhOF3TYQa36p7LILfuB`. Check the deploy job on the #124 merge
   before assuming the new site is live.
2. **Confirm `www` is a redirect in Vercel, not an alias.** The canonicals make
   an alias survivable; they do not make it correct. This is the last open part
   of the plan's item #1.
3. **`/blog/ai-cost-reduction` opens "We audited 10,000 reviews across our beta
   customers."** There are no customers. Same class as the claims already
   removed from `/about` and `/compare`. Copy edit drafted, not applied — it is
   a public claim, so it is the founder's call.
4. **15 `NEXT_PUBLIC_APP_URL ??` sites** share the empty-string bug fixed on the
   Google Play guide: `??` does not catch `""`. They cover Stripe checkout and
   portal, Slack OAuth, team invites and five email templates. Untouched —
   D009 puts billing behind founder approval.

## Next

`SEO2` (reply template library, ~4,950/mo at KD 19–33) is the highest-value
content item and the best product fit we have. But read **SEO5** first: the
plan's own conclusion is that every KD 24–33 target is gated on link
acquisition, not on content, and nothing an agent does changes that.
