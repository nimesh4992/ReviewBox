# Today — 2026-08-19 (the deploy was never broken; the check was)

**State of master:** `8727de3`. Every quality gate green on every merge.

**Production is live and current, and has been throughout.** The claim that
dominated yesterday's notes and this file's last three revisions — that nine
merges were sitting on master unshipped — was **wrong**. It was inferred from a
red "Deploy to production" check and never verified against Vercel.

Verified now, against the Vercel API rather than a bot comment or a CI log:

| | |
|---|---|
| deployment | `dpl_F8nMNiuuMogC8RiT7Mmu3VFqWvKw` (commit `0a4af8a`, the #127 merge) |
| state | `READY` · `target: production` · `source: git` |
| aliases | **tryreviewbox.com**, **www.tryreviewbox.com**, app.tryreviewbox.com |

Every master merge from **#123 onward is `READY` in production the same way**.
The only two that are not — #120 and #121 — errored at Vercel's own build
because master was genuinely broken then (the JSX merge-fusion), which is a
code fault, not a credential one.

## Why nobody noticed

There are two deploy paths and only one of them is the GitHub Actions job.

Vercel's Git integration used to refuse this repo — *"the commit author did not
have contributing access · The Hobby Plan does not support collaboration for
**private** repositories"* — and that refusal is the entire reason the CLI
deploy job was written. **The repo is public now.** Every Vercel deployment
record carries `githubRepoVisibility: "public"`. The block lapsed, the
integration resumed, and nothing updated the comment that said otherwise.

So the CLI job has been failing on a bad `VERCEL_TOKEN` scope, turning master
red on every merge, while the site shipped fine without it.

## The mistakes, in order, because they rhyme

1. **I trusted a stale comment over a live check.** `ci.yml` said the Git
   integration refuses to build master. It was true when written. I never
   tested it, and built two days of diagnosis on top.
2. **I had the tool to settle it and didn't reach for it.** The Vercel MCP
   tools (`list_teams` → `list_deployments` → `get_deployment`) answer "is this
   live?" directly. I reached for them only after the third failed fix. The
   agent egress proxy blocks `tryreviewbox.com`, so curl was never an option —
   but the API always was.
3. **I turned two observations into a rule.** `Project not found (…)` vs
   `Could not retrieve Project Settings` do not distinguish a wrong id from a
   wrong token scope. I wrote that they did, into `CLAUDE.md`, as fact. The
   next run disproved it.
4. **The fix I shipped for that wrote to the wrong place.** The "Who is this
   token?" step logged only to `$GITHUB_STEP_SUMMARY` — invisible to anything
   reading the job log through the API, which is how an agent reads it. It ran,
   succeeded, and answered nobody. Now `tee`d to both.

The common shape: **a check that reports something other than what it measures.**
Same family as the e2e job that was green because zero tests ran, and the
deploy job that reported success while deploying nothing.

## What actually shipped 2026-08-18 → 19

All of it live. Marketing site rebuilt on the Envato-adapted design (#124);
canonicals on all 22 indexable pages and `/sign-in`+`/sign-up` dropped from the
sitemap (#125); `robots.txt` / `sitemap.xml` / `opengraph-image` unblocked from
Clerk auth, app host serving `Disallow: /`, and the first two product pages
(#126); the org-id correction (#127); the token diagnostic (#130).

`docs/SEO_KEYWORD_PLAN.md` is new — the founder's Semrush-backed plan against
`appfollow.io`, which is the missing half of the July `SEO_CONTENT_PLAN.md`.
Its actions are backlog **SEO1**–**SEO5**; SEO1 shipped, SEO2–SEO5 are queued.

## Outstanding

1. **~~Decide what the CLI deploy job is for~~ — DONE. Founder chose remove.**
   `deploy-production` is gone from `ci.yml`. Merging to master ships; Vercel's
   Git integration builds it directly. Two consequences to hold onto: **CI
   green is still the merge gate but is no longer a deploy gate** (the
   integration builds master whatever CI says), and the pulled-production-env
   guard went with the job — though that guard only ever protected against a
   hazard the CLI path itself created. The `NEXT_PUBLIC_*` placeholder rule
   above `jobs:` now guards nothing and must be kept anyway; it is the
   precondition for adding a deploy job back safely.

2. **`www.tryreviewbox.com` is an alias, not a redirect** — confirmed in that
   deployment's alias list, so it genuinely serves a second copy of every page.
   The canonicals shipped in #125 are what makes that survivable. Making it a
   redirect in Vercel is still the cleaner fix.

3. **`/blog/ai-cost-reduction` opens "We audited 10,000 reviews across our beta
   customers."** There are no customers. Same class as the claims already
   removed from `/about`, `/compare` and `/status`. It is a public claim, so it
   is the founder's call, not mine.

4. **15 `NEXT_PUBLIC_APP_URL ??` sites** share the empty-string bug fixed on the
   Google Play guide (`??` does not catch `""`). Stripe checkout and portal,
   Slack OAuth, team invites, five email templates. Untouched — D009 puts
   billing behind founder approval.

## Next

**SEO2** — the reply template library, ~4,950/mo at KD 19–33 — is the best
demand-to-product fit available. But read **SEO5** first: the plan's own
conclusion is that every KD 24–33 target is gated on link acquisition rather
than content, and no agent can do that part.
