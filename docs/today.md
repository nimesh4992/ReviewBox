# Today — 2026-08-18 (marketing site rebuilt on the Envato theme, then the SEO unblock, then the reason none of it was being read)

**State of master:** `009484f` — PR #124 merged, every quality gate green.
**But master has not reached production since 03:48 UTC on 2026-08-18 (PR #118).**
The deploy job has failed on every merge since — #119, #120, #121, #123, #124 —
on a wrong GitHub secret. Diagnosis and the exact fix are at the bottom; it is
one value, and only the founder can change it.
`tsc` clean, lint 0 errors, full `next build` passes, **609 unit tests** (was 591).

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

## 3. SEO: Google could not read robots.txt or the sitemap at all (this PR)

Section 2 above fixed the canonicals inside pages Google can reach. This is the
layer underneath: **`/robots.txt` and `/sitemap.xml` returned 404 on every
hostname**, so none of that work was ever collected.

Verified against production before changing anything:

```
GET https://www.tryreviewbox.com/robots.txt
→ 404,  x-clerk-auth-reason: protect-rewrite, session-token-and-uat-missing
```

Neither path was listed in middleware's `isPublicRoute`, and neither `.txt` nor
`.xml` appears in the middleware matcher's extension-exclusion list — so both
fell through to `auth.protect()`. Googlebot is always a signed-out visitor, so
it got the 404 every time. `robots.ts` and `sitemap.ts` were correct, tested,
and unreachable. **A missing robots.txt means "crawl everything"**, which is how
`/customers`, `/status` and `/compare` were still ranking after being deleted:
Google found them by link and was never handed a sitemap saying otherwise.

**What Semrush actually shows** (us database, checked this session). Nine URLs
rank, all on `www`, all at zero traffic — and three of the nine are dead:

| URL | Keywords | State |
|---|---|---|
| `/blog` | 7 | live |
| `/` | 6 | live |
| `/pricing`, `/faq` | 3 each | live |
| `/terms`, `/about` | 2 each | live |
| `/customers` | 1 | deleted 2026-08-16 → 404 |
| `/status` | 1 | deleted 2026-08-18 → 404 |
| `/compare` | 1 | withdrawn → 307 |

`app.tryreviewbox.com` returns **no rows at all** — the app host is not ranking
for anything, which is what makes the `Disallow: /` below safe to ship now.

**Fixed**

- The three crawler files (`/robots.txt`, `/sitemap.xml`, `/opengraph-image`)
  are public routes. `/opengraph-image` was 404ing to every social unfurler too,
  so shared links rendered as a grey box.
- **The app host serves its own robots.txt from middleware** — `Disallow: /`.
  It has to be middleware: `next build` reports `/robots.txt` as `○ (Static)`,
  one prerendered body for both hostnames, so `robots.ts` cannot tell them
  apart. Making the path public without this would have served the *marketing*
  robots.txt — an `Allow: /` over the entire signed-in product.
- **Marketing pages on the app host now 301 to `www`.** They are public routes,
  so `app.tryreviewbox.com/pricing` was rendering the full pricing page. The
  noindex header kept it out of the index but discarded any link equity; a 301
  passes it on.
- **The root layout no longer asserts `index, follow` on every page.** It is
  inherited by `/dashboard`, which therefore shipped `index, follow` in its
  markup while middleware set `noindex, nofollow` in the header on the same
  response. Nothing leaked — Google takes the most restrictive — but the page
  was arguing with its own headers. The `(app)` and `/admin` trees now declare
  `noindex` in their own metadata, so it holds on preview URLs and the apex too,
  not only on the one host middleware adds a header to.
- **Canonicals moved to `www`.** They named the apex, which 308s to www — a page
  telling Google "the real me is over there" while the server says "not here".
  `marketingUrl()` now also refuses to ever return the app host: it falls back
  to `NEXT_PUBLIC_APP_URL`, so a missing `NEXT_PUBLIC_MARKETING_URL` in Vercel
  would have pointed every canonical at the `Disallow: /` hostname. Verified in
  a real build with only `NEXT_PUBLIC_APP_URL` set.

`src/seo-indexing-contract.test.ts` (14 tests) reads middleware's source and
fails if any of it regresses. Verified by mutation — four separate breakages
were reintroduced and each turned it red. One early version of the ordering
check could *not* fail (it matched the import line rather than the branch);
that is fixed and the note is in the test.

**Not done, deliberately: the deleted pages are NOT added to robots.txt.**
`Disallow` and `noindex` cancel out — blocking a URL stops Google crawling it,
so it never sees the 404 telling it to drop the page, and the URL sits in the
index as "Indexed, though blocked by robots.txt". They 404 cleanly and are
absent from the sitemap, which is what actually removes them. Search Console →
Removals is the fast path if the founder wants them gone in a day.

---

## Outstanding — founder only

1. **`VERCEL_ORG_ID` is wrong. Nothing has deployed since #118 — fix this first.**

   GitHub → Settings → Secrets and variables → Actions → `VERCEL_ORG_ID`

   | | |
   |---|---|
   | currently | `team_mQlD3mcz32rsA4HcPOBRiW6b` |
   | should be | `team_YDfGTQhOF3TYQa36p7LILfuB` |

   `VERCEL_PROJECT_ID` is correct and must not change.

   The whole run reads green except the last job. On the #124 merge, Build +
   type-check, Lint, Unit tests, Security audit and E2E all passed; **Deploy to
   production** then failed in two seconds at its first Vercel step:

   ```
   Retrieving project…
   Error: Project not found ({"VERCEL_PROJECT_ID":"prj_OE66Qpr8IdTXwLG6BOzevWYagRcl",
                             "VERCEL_ORG_ID":"team_mQlD3mcz32rsA4HcPOBRiW6b"})
   ```

   The project id there matches what Vercel's own bot reports on every PR; the
   team id does not — the bot's avatar URL carries
   `teamId=team_YDfGTQhOF3TYQa36p7LILfuB`. So the token authenticates fine and
   then looks for the project inside a team that does not hold it.

   Consequence: **everything merged today is on master and none of it is live.**
   The whole marketing rebuild, both `/compare` and `/status` removals, all of
   it. Production is still serving the 03:48 build. Once the secret is
   corrected, re-run the failed job on the latest master run — no new commit is
   needed.

   *This is a distinct failure from the Vercel upload-quota one in yesterday's
   notes. That one exhausted a 5,000-request budget and had to wait out a
   24-hour window; this one fails instantly with a project-not-found and will
   keep failing forever until the secret changes. Both produce the same
   symptom — merged but not shipped — which is why the log line matters more
   than the red X.*
2. ~~**Confirm `www` is a redirect in Vercel, not an alias.**~~ **Resolved —
   checked this session, no action needed.** `tryreviewbox.com` answers `308
   Permanent Redirect` to `www.tryreviewbox.com`. It is a redirect. The site now
   canonicalises to `www` to match.

   **New, optional (2 min):** set `NEXT_PUBLIC_MARKETING_URL` to
   `https://www.tryreviewbox.com` in Vercel → Settings → Environment Variables.
   The code no longer needs it — `marketingUrl()` corrects the apex and refuses
   the app host on its own — but setting it explicitly means the value is stated
   rather than inferred.

2b. **Submit the sitemap in Search Console, once this is deployed.** It has
   never been fetchable, so this is the first time there is anything to submit.
   Property `www.tryreviewbox.com` → Sitemaps → `sitemap.xml`. While there, use
   **Removals** on `/customers`, `/status` and `/compare` to clear them in about
   a day instead of waiting weeks for a recrawl.
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
