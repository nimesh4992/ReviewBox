# Today — 2026-08-19 (no code shipped — session spent on a VS Code / context-continuity question; the Aug 18 deploy blocker is still live)

**State of master:** `59556bf` — PR #126 merged, every quality gate green.
**Production still has not deployed since 03:48 UTC on 2026-08-18 (PR #118).**
Re-checked this session (workflow run `32209154150`, 2026-08-19 02:46 UTC, the
merge commit for PR #126): same job, same step fails — "Pull Vercel production
environment," in ~2 seconds — the same fast, first-step failure signature as
yesterday's diagnosis (a wrong secret fails auth immediately; an outage or
quota problem would look different). The fix below has not been applied yet.

---

## This session

No code changed. Branch `claude/visual-studio-context-sm0iqe` is even with
master (`59556bf`), working tree clean.

The founder asked how to keep working on this project in Visual Studio Code
without losing the context built up in a Claude Code web session. Answered:
web and local Claude Code sessions keep **separate conversation histories** —
there's no import path between them — but this project's own continuity
system (`CLAUDE.md` + this file + `docs/decisions.md` + `docs/backlog.md`)
auto-loads into *any* Claude Code session opened on this repo, cloud or
local, so nothing operationally important depends on chat history surviving.
Practical steps given: install the Claude Code VS Code extension, then
`git fetch && git checkout claude/visual-studio-context-sm0iqe`, open the
folder, start a new session — it reads this file first, same as this one did.

Spent the rest of the session re-verifying the deploy failure above rather
than assuming yesterday's diagnosis still held — that's the one item that
would be expensive to carry forward wrong.

---

## What shipped 2026-08-18 (detail lives in PRs #124–#126 and git log)

Marketing site rebuilt on the Envato-adapted design (PR #124); SEO fixes —
canonicals on all 22 indexable pages, `robots.txt`/`sitemap.xml`/
`opengraph-image` unblocked from Clerk auth, app host now serves
`Disallow: /` (PR #125); and the first two product pages,
`/app-review-management` + `/alternatives/appfollow` (PR #126). Full
narrative, numbers, and defects found/fixed along the way are in those PR
descriptions and commit messages — nothing here is more current than they are.

---

## Outstanding — founder only

1. **`VERCEL_ORG_ID` is wrong. Confirmed still broken this session — fix this first.**
1. **`VERCEL_ORG_ID` was wrong. Nothing deployed between #118 and the fix.**

   **Corrected 2026-08-19 — and my first instruction here was wrong.** I sent
   the founder to GitHub → Settings → Secrets and variables → Actions to change
   `VERCEL_ORG_ID`. **There is no such secret.** Both Vercel identifiers are
   plain literals in `.github/workflows/ci.yml`'s workflow-level `env` block —
   the file even says why (they are identifiers, not credentials, and Vercel's
   bot prints them publicly). The giveaway was in the log the whole time: the
   org id printed unmasked while `VERCEL_TOKEN` printed as `***`. GitHub masks
   secrets; it does not mask what it is not holding.

   So this was never founder-only. It is a one-line code change, made in
   `ci.yml` and shipped as a PR.

   | | |
   |---|---|
   | was | `team_mQlD3mcz32rsA4HcPOBRiW6b` |
   | now | `team_YDfGTQhOF3TYQa36p7LILfuB` |

   `VERCEL_PROJECT_ID` was correct and is unchanged.

   **One trap worth remembering.** A `VERCEL_TOKEN` scoped to the *right* team
   makes this look worse, not better. With a wrong-team token the CLI says
   `Project not found ({...ORG_ID})`, which names the culprit. With a
   right-team token and a wrong org id it says `Could not retrieve Project
   Settings. To link your Project, remove the .vercel directory` — which reads
   like a broken token and sends you to re-issue the one thing that is fine.
   Both were observed here, in that order, hours apart.

   Every other job on master's latest run is green (Security audit, Build +
   type-check, Unit tests, Lint, E2E). Only "Deploy to production" fails, at
   its "Pull Vercel production environment" step. **Nothing merged since
   2026-08-18 03:48 UTC is live** — the marketing rebuild, all SEO fixes, both
   product pages. Once the secret is corrected, re-run the failed job on the
   latest master run (id `32209154150`) — no new commit needed.

2. **Once deploy is fixed, submit the sitemap in Search Console.** Property
   `www.tryreviewbox.com` → Sitemaps → `sitemap.xml`. It has never been
   fetchable until this deploys. While there, use **Removals** on
   `/customers`, `/status` and `/compare` to clear them in about a day.
   Optional 2-min extra: set `NEXT_PUBLIC_MARKETING_URL` to
   `https://www.tryreviewbox.com` in Vercel env vars — the code no longer
   needs it (`marketingUrl()` self-corrects) but it's cleaner stated than inferred.

3. **`/blog/ai-cost-reduction` opens "We audited 10,000 reviews across our
   beta customers."** There are no customers. Same class as claims already
   removed from `/about` and `/compare`. Copy edit drafted, not applied —
   it's a public claim, so it's the founder's call.

4. **15 `NEXT_PUBLIC_APP_URL ??` sites** share the empty-string bug fixed on
   the Google Play guide (`??` doesn't catch `""`). Covers Stripe
   checkout/portal, Slack OAuth, team invites, five email templates.
   Untouched — D009 puts billing behind founder approval.
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

   Consequence while it was broken: **six merges sat on master and none were
   live** — the whole marketing rebuild, both the `/compare` and `/status`
   removals, the canonicals, and #126's product pages. Production served the
   03:48 build of 2026-08-18 throughout.

   *This is a distinct failure from the Vercel upload-quota one in yesterday's
   notes. That one exhausted a 5,000-request budget and had to wait out a
   24-hour window — re-running was useless. This one failed instantly on a
   wrong identifier and would have failed forever, but a re-run IS the right
   move once the id is fixed, because the input actually changed. Both produce
   the same symptom — merged but not shipped — which is why the log line
   matters more than the red X, and why "is re-running correct here?" has to be
   answered from the error, not from habit.*
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

Once the founder fixes `VERCEL_ORG_ID` and everything already merged actually
reaches production, resume at **SEO2** (reply template library, ~4,950/mo at
KD 19–33) — the highest-value content item and the best product fit we have.
Read **SEO5** first: the plan's own conclusion is that every KD 24–33 target
is gated on link acquisition, not content, and no agent session changes that.
