# Today — 2026-08-19 (the VERCEL_ORG_ID fix landed but did NOT restore deploys — new evidence points at VERCEL_TOKEN — plus a VS Code context-continuity question, and a merge that silently corrupted this file)

**State of master:** `0a4af8a` — PR #127 (org/project ID fix) and PR #128
(product knowledge docs) both merged, every quality gate green **except
Deploy**, which is still red on this exact commit.

**Production has still not deployed since 03:48 UTC on 2026-08-18 (PR #118) —
nine merges in now (#119–#128), none of them live.** PR #127 was right that
`VERCEL_ORG_ID` had been wrong, and its fix is real: both the org id and
project id in `ci.yml` are now independently confirmed correct — checked
directly against the Vercel API on a separate credentialed path, not just
inferred from a bot comment (`list_teams` shows this account belongs to
exactly one team, "Amnex Infotechnologies" / `amnexweb` /
`team_YDfGTQhOF3TYQa36p7LILfuB`; `get_project` on that team confirms it owns
`reviewbox` / `prj_OE66Qpr8IdTXwLG6BOzevWYagRcl`). Both values in `ci.yml`
match exactly.

**The very next run on that exact fix still failed at the same step**
(workflow run `32221034591`, commit `0a4af8a`, 2026-08-19 05:56 UTC), with a
**different** error than before:

**State of master:** every quality gate green on every merge.
**But master has not reached production since 03:48 UTC on 2026-08-18 (PR #118).**
The deploy job has failed on every merge since — #119, #120, #121, #123, #124,
#125, #127 — at `vercel pull`, the first Vercel step.

**Still open as of 05:56 UTC on 2026-08-19, and my diagnosis was incomplete.**
`VERCEL_ORG_ID` genuinely was wrong and is now fixed and verified in the log.
The next deploy failed anyway, with both identifiers provably correct. So the
ids were *a* fault, not *the* fault. The remaining candidate is the scope of
`VERCEL_TOKEN` — which unlike the ids really is a GitHub secret. Rather than
guess a third time, the job now prints `vercel whoami` and `vercel teams ls`
into the run summary whenever the pull fails. See item 1 below.
`tsc` clean, lint 0 errors, full `next build` passes, **609 unit tests** (was 591).

Two things shipped today, in order.
```
Retrieving project…
Error: Could not retrieve Project Settings. To link your Project, remove the `.vercel` directory and deploy again.
```

Full diagnosis and the likely next fix are under "Outstanding" item 1 below
— short version: the IDs are no longer suspects, so `VERCEL_TOKEN` itself
is. That one is genuinely founder-only; it's a credential, not a literal.

`tsc` clean, lint 0 errors, full `next build` passes, unit tests green
(all reconfirmed on this run).

---

## This session (2026-08-19)

No code shipped from this branch. Four things happened, in order, and the
honest record of a couple of missteps is worth keeping — that's the point of
this file.

**1. I repeated a diagnosis instead of re-deriving it.** Earlier this session
I re-checked the Aug-18 deploy failure, saw the same job fail the same way,
and told the founder in chat to fix `VERCEL_ORG_ID` in GitHub → Settings →
Secrets. That was wrong — carried forward from the Aug-18 doc without
independently checking where the value actually lives. It is a literal in
`ci.yml`, not a secret. A concurrent session (PR #127) had already found and
fixed the real thing by the time I said it.

**2. "Update branch" silently corrupted this file.** PR #127 corrected the
Aug-18 `docs/today.md` in place; this branch, in parallel, had replaced the
whole file with a shorter rewrite. This PR's branch got updated against
master (most likely via the PR's "Update branch" button), and the merge
produced **no conflict markers anywhere in the tree** (checked with
`git grep` across the full merged tree) but silently interleaved both
rewrites anyway — two different opening lines for "Outstanding" item 1 back
to back, stale paragraphs sitting next to their own correction. Per this
file's own standing rule for exactly this situation ("take ONE side's file
whole, never hand-blend the two"), this version starts from master's clean
`docs/today.md` and adds only new sections — nothing from my interim
rewrite survives except what's written here.

**3. Checking whether PR #127's fix actually worked turned up more.** It
hadn't, fully. See "Outstanding" item 1 — the IDs are now provably right and
the deploy still fails, on a different error string than before.

**4. The actual founder-facing question this session answered:** how to keep
working on this project in VS Code without losing context from a Claude Code
web session. Web and local Claude Code sessions keep **separate conversation
histories** — no import path between them — but this project's own
continuity system (`CLAUDE.md` + this file + `docs/decisions.md` +
`docs/backlog.md`) auto-loads into any session opened on this repo, cloud or
local, which is what actually carries continuity. Practical steps given:
install the Claude Code VS Code extension, then — PowerShell 5.1 doesn't
support `&&`, use separate lines — `git fetch origin`, then
`git checkout claude/visual-studio-context-sm0iqe`, open the folder, start a
new session; it reads this file first, same as this one did. This session's
own detour is itself the demonstration of why chat history isn't what
matters: everything worth keeping is in this file, not in a transcript.

---

## What shipped 2026-08-18 (detail lives in PRs #124–#126 and git log)

Marketing site rebuilt on the Envato-adapted design (PR #124); SEO fixes —
canonicals on all 22 indexable pages, `robots.txt`/`sitemap.xml`/
`opengraph-image` unblocked from Clerk auth, app host now serves
`Disallow: /` (PR #125); and the first two product pages,
`/app-review-management` + `/alternatives/appfollow` (PR #126). Full
narrative, numbers, and defects found/fixed along the way are in those PR
descriptions and commit messages.

---

## Outstanding — founder only

1. **`VERCEL_ORG_ID` was wrong, is now fixed, and it wasn't enough — deploy is still red.**

   **Update 2026-08-19 ~05:56 UTC.** The fix described below (both ids
   corrected in `ci.yml`) is real and independently verified — confirmed
   directly against the Vercel API rather than just inferred from a bot
   comment: `list_teams` shows this account belongs to exactly one team,
   "Amnex Infotechnologies" / `amnexweb` / `team_YDfGTQhOF3TYQa36p7LILfuB`;
   `get_project` on that team confirms it owns `reviewbox` /
   `prj_OE66Qpr8IdTXwLG6BOzevWYagRcl`. Both values now in `ci.yml` are
   correct.

   The next run on master after the fix (workflow run `32221034591`, commit
   `0a4af8a`, 2026-08-19 05:56 UTC) failed anyway, at the same step, with a
   **different** error than before:

   ```
   Retrieving project…
   Error: Could not retrieve Project Settings. To link your Project, remove the `.vercel` directory and deploy again.
   ```

   This is the exact symptom this file's own "trap worth remembering" note
   (right below) predicted for "a token scoped to the right team, wrong org
   id" — but the org id is no longer wrong. With both ids independently
   confirmed correct and the same error still firing, the remaining variable
   is the credential itself: **`VERCEL_TOKEN` (the GitHub secret) is most
   likely not scoped to the `amnexweb` team**, or has been revoked or expired.
   That is genuinely founder-only this time — it is a real credential, not a
   literal, so it can't be verified or rotated from here.

   **To fix:** Vercel → Amnex Infotechnologies (amnexweb) team → Settings →
   Tokens. Create a new token scoped to that **team** specifically (not a
   personal-account token — that mismatch is the most common way this exact
   error happens when the ids are otherwise correct), with access to the
   `reviewbox` project. Then GitHub → Settings → Secrets and variables →
   Actions → update `VERCEL_TOKEN`. No re-run needed after — the next merge
   picks it up, or re-run the failed job on run `32221034591` directly.

   **Corrected 2026-08-19 — and my first instruction here was wrong.** I sent
   the founder to GitHub → Settings → Secrets and variables → Actions to change
   `VERCEL_ORG_ID`. **There is no such secret.** Both Vercel identifiers are
   plain literals in `.github/workflows/ci.yml`'s workflow-level `env` block —
   the file even says why (they are identifiers, not credentials, and Vercel's
   bot prints them publicly). The giveaway was in the log the whole time: the
   org id printed unmasked while `VERCEL_TOKEN` printed as `***`. GitHub masks
   secrets; it does not mask what it is not holding.

   So this specific mixup was never founder-only. It was a one-line code
   change, made in `ci.yml` and shipped as a PR — see the fix above for why
   it alone wasn't the whole story.

   | | |
   |---|---|
   | was | `team_mQlD3mcz32rsA4HcPOBRiW6b` |
   | now | `team_YDfGTQhOF3TYQa36p7LILfuB` |

   `VERCEL_PROJECT_ID` was correct throughout and is unchanged.

   **It did not fix the deploy, and here is the honest version of why I
   thought it would.** Two errors were observed hours apart — `Project not
   found ({...ORG_ID})` and then `Could not retrieve Project Settings` — and I
   built a rule out of them: wrong-team token gives the first, right-team token
   plus wrong org id gives the second. That was inference from two data points
   presented as fact. The #127 merge disproved it: both identifiers printed
   correctly in the log and the pull failed on the same step, same message.

   So the two messages do **not** distinguish "wrong id" from "token cannot
   reach the team", and neither ever reports the token's own scope — the one
   thing that cannot be read anywhere else and the only remaining candidate.

   **What replaces the guess.** A `Who is this token?` step, running only when
   the pull fails, writes into the run's step summary: the ids it targeted, the
   account `vercel whoami` reports, and every team `vercel teams ls` can reach.

   - Team holding `VERCEL_ORG_ID` **absent** from that list → the token is the
     fault. Re-issue at Vercel → Account Settings → Tokens **scoped to that
     team**, then replace `VERCEL_TOKEN` in GitHub → Settings → Secrets and
     variables → Actions. This one really is a secret, so it really is
     founder-only.
   - Team **present** → an identifier is still wrong, and the ids are in
     `ci.yml`, so it is mine to fix.

   Either way the next failed deploy names its own cause instead of needing a
   third round of inference.

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
   **One trap worth remembering.** A `VERCEL_TOKEN` scoped to the *right* team
   makes this look worse, not better. With a wrong-team token the CLI says
   `Project not found ({...ORG_ID})`, which names the culprit. With a
   right-team token and a wrong org id it says `Could not retrieve Project
   Settings. To link your Project, remove the .vercel directory` — which reads
   like a broken token and sends you to re-issue the one thing that is fine.
   **Both have now actually been observed here**, in that order, across two
   separate fixes.

   Every non-deploy job passes on every run since #124 (Security audit, Build
   + type-check, Unit tests, Lint, E2E). Only "Deploy to production" fails.
   **Nothing merged since 2026-08-18 03:48 UTC is live** — the marketing
   rebuild, all SEO fixes, both product pages, and the ci.yml fix itself.

   *This is a distinct failure class from the Vercel upload-quota one noted
   below. That one exhausts a 5,000-request budget and has to wait out a
   24-hour window — re-running is useless. Identifier and credential failures
   fail instantly and predictably, and re-running IS the right move once the
   actual input changes — but only once you've confirmed which input was
   wrong. Two different "fixes" have now each resolved one real problem and
   left the deploy red, which is exactly why the log line matters more than
   the red X, every single time, not just the first time.*

2. **Once deploy is fixed, submit the sitemap in Search Console.** Property
   `www.tryreviewbox.com` → Sitemaps → `sitemap.xml`. It has never been
   fetchable until this deploys. While there, use **Removals** on
   `/customers`, `/status` and `/compare` to clear them in about a day.
   Optional 2-min extra: set `NEXT_PUBLIC_MARKETING_URL` to
   `https://www.tryreviewbox.com` in Vercel env vars — the code no longer
   needs it (`marketingUrl()` self-corrects) but it's cleaner stated than
   inferred.

3. **`/blog/ai-cost-reduction` opens "We audited 10,000 reviews across our
   beta customers."** There are no customers. Same class as claims already
   removed from `/about` and `/compare`. Copy edit drafted, not applied —
   it's a public claim, so it's the founder's call.

4. **15 `NEXT_PUBLIC_APP_URL ??` sites** share the empty-string bug fixed on
   the Google Play guide (`??` doesn't catch `""`). Covers Stripe
   checkout/portal, Slack OAuth, team invites, five email templates.
   Untouched — D009 puts billing behind founder approval.

## Next

`SEO2` (reply template library, ~4,950/mo at KD 19–33) is the highest-value
content item and the best product fit we have. But read **SEO5** first: the
plan's own conclusion is that every KD 24–33 target is gated on link
acquisition, not on content, and nothing an agent does changes that. This is
still blocked behind item 1 above being *actually* resolved, not just
attempted twice.
