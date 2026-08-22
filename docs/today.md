# Today — 2026-08-22 (a launch-readiness pass, and the worst thing it found was already shipped)

> One controlled session against `b1b6d41`. Four behaviour/copy commits, two new
> documents, and **four things the plan said that the code disagreed with**.
>
> **Read `docs/LAUNCH_READINESS_2026-08-22.md` §2.1 before anything else.** A billing
> gate that ADR 009 says in writing not to build is live, defended by tests, and the two
> public pages describing it promise a warning the product does not send.

---

## 1. The handover list was stale in four places, and the corrections matter

| Handed over as | Actually |
|---|---|
| "PR #150 — verify, decide whether to merge" | **Merged.** `7417d03`. #151 and #152 merged after it |
| "W5A — undecided, `checkReviewLimit()` has zero call sites" | **Decided by implementation**, as the option the ADR rejects. Commit `fc53682` |
| "AU4 carried over" | Finished 2026-08-17. AU5 was the open half, and it is now done |
| "Pricing FAQ promises a 30-day full refund; Pro is $99 on one page and $129 on another" | **Neither exists in master.** All three refund surfaces say non-refundable; $99 is Pro's *annual per-month* price and `lib/plans.ts` documents that exact confusion as a fixed bug |

The last row needs a human check: `tryreviewbox.com` is blocked by this environment's
egress proxy, so everything was verified against the repository. **If the deployed pages
really do say those things, the deployment is stale** — which is its own finding.

---

## 2. The finding

**`syncWorkspaceApps()` stops the entire workspace's sync when the calendar-month review
count passes the plan limit** — every app, every scheduled run, until the 1st. The count
is on `created_at`, so a first import can spend the whole allowance at once: a Starter
customer connecting a 5,000-review app is over on day one.

`docs/adr/009-review-volume-limit.md` lists that as Option A and says, verbatim,
**"Do not do this."** It is still marked `Status: Proposed — needs a founder decision`.
The guard test that existed to keep the decision visible was inverted to assert the
wiring, and a new suite now locks the behaviour in.

**And it is silent.** The cron path drops the message into `summary.errors` and discards
it — no email, no banner, no `last_sync_error`; the app row still reads healthy. Only a
manual "Sync now" surfaces it, as a 402. Meanwhile `/pricing` and `/faq` both promise
*"We'll notify you when you hit 80% of your quota"*, and grep finds **no such
notification anywhere in the codebase** — only the two sentences promising it.

Nothing was changed. Reverting a live gate is a billing change; rewording `/pricing` is a
pricing change. Both are D009. Three options, costed:
`docs/LAUNCH_READINESS_2026-08-22.md` §3.3.

---

## 3. What shipped

| Commit | What |
|---|---|
| `104e73f` | **Slack no longer receives a reviewer's name or their review text.** The urgent-review alert sent both to a webhook whose recipient is on neither `/sub-processors` nor the DPA. Now metadata only; the signature refuses `author`/`text` so it cannot regress. 5 mutations, 5 caught |
| `3fd3d59` | **R2 — "Topic clustering" → "Topic breakdown"**, your decision, applied. Three surfaces, not one: searching for the *claim* rather than the row found the same sentence in the pricing page's body copy and in Settings → Alerts. `KNOWN_UNBACKED` is now empty. 3 mutations, 3 caught |
| `5f82417` | **AU5** — eleven load paths. Two were data-loss, not just misleading. 27 tests, 6 mutations, 6 caught |
| `969c353` | **LT3** — the app-delete warning now says the reviews are not coming back. Copy only |

**Verified:** `tsc` clean · **1029 tests in 90 files** · eslint 0 errors (the same 13
pre-existing warnings) · `next build` exit 0. The build was run twice — the first exited
0 while writing an empty log, which in this repo is the signature of a job reporting
success for work it did not do.

### The two that were nearly expensive

- **Workspace defaults** rendered an empty support email and brand voice on a 500, under
  an amber *"Without this, AI uses a generic voice"* hint. Save posts what is in the box.
  A customer who believed the hint **overwrote their real brand voice with a guess.**
- **Alert preferences** seeds its `useState` from `mock-alerts.ts`, so a failed read left
  a fixture file on screen looking like saved settings, Save live beneath it.

Both now return the failure **before** the form. The contract test asserts that ordering
specifically — because the first version of that assertion compared source positions and
**passed** a mutation that moved the error banner above the form. It was caught by
mutation-testing my own test, which is the only reason it is not still wrong.

---

## 4. Three more claims that do not match the code

Filed, not fixed — each needs a wording decision and one touches a legal page.

- **CP1** · Four pages sell **auto-publish on the Team plan**. Neither exists. The Team
  price **$199/month** is still in the **Terms of Service**; `automation-actions.test.ts`
  asserts `auto_reply` is *deliberately* excluded, and `sync-lock.ts` explains why it
  cannot simply be added. The homepage — *"nothing reaches the store until a human clicks
  Post"* — is the one that is right.
- **CP2** · `/faq` and `/help/ai-replies` list **five tones**; the engine has four, and
  three of the five listed do not exist. Homepage is correct.
- **SP1** · `/sub-processors` lists ten providers, `/dpa` §4 lists eight — in the same
  paragraph that calls the other page authoritative. Plus two published claims nobody
  here can verify: *"each is bound by a data processing agreement with us"* and *"Groq
  (AI inference, no data retention)"*.

---

## 5. What we need from you

| # | Ask | Blocks | Why only you |
|---|---|---|---|
| 1 | **W5A** — pick one of three (keep the stop + build the warning · revert to a soft cap · drop the claim) | Stripe, and a live contradiction | D009. §3.3 has the costs |
| 2 | **Walk AC-6** — script ready at `docs/TESTER_PROTOCOL.md` §1, built around the payment-complaint finding so it tests something real | M1 → R1 | No agent can do this |
| 3 | **CP1 wording** — the Terms line is yours (D009 §9); the three help/FAQ strings should land in the same pass | Truthfulness before testers | Legal page |
| 4 | **W6B / ADR 010** — and note `/privacy` §4 already publishes a **2-year** retention commitment that the recommended 365-day answer would breach | Retention, and W6B(D) touches W5A | Not on record anywhere |
| 5 | **Corpus** — A (English-certified, say so) or B (block M4/M5/M7). §4 argues both, and neither is being chosen for you | M4, M5, M7 | Methodology + licensing |
| 6 | **Slack disclosure** — the data exposure is closed; whether it is still a sub-processor is a legal call | SP1 | Legal determination |
| 7 | **PR #153** — 6/6 green, docs-only, `mergeable_state: clean`. Merge-ready, unmerged | — | No authorisation was given |
| 8 | Carried: `ADMIN_CLERK_USER_ID` in Vercel prod · LT2 Clerk keys. Runbook with verification steps: §6 | admin probe; e2e | Config |
| 9 | **Three testers** — package at `docs/TESTER_PROTOCOL.md` §2, with the four preconditions listed | M3 → R3 | Recruitment |

Also: **PR #149** is open, draft, and three merges stale. It needs a rebase or a close.

---

## 6. Notes for the next session

- **Do not re-derive the Vercel Hobby cron cap.** The project is on Pro. A stale "Hobby"
  comment still sits above `FEATURE_MATRIX` in `src/app/pricing/page.tsx`, and it is
  exactly the shape of premise this repo keeps paying for.
- **`/pricing` sells "Daily automatic sync"; `vercel.json` runs every 3 hours.** An
  understatement, so no exposure — but it is drift, and it is in the same file as CP1.
- **The AU5 sweep's allowlist is empty**, meaning there is currently no unguarded
  `fetch(...).then(r => r.json())` anywhere in `src/`. That is a state worth keeping; the
  test fails the moment a new one appears.
- Everything in this session is on `claude/nifty-bardeen-qprl0k` as four separate
  commits. The session's branch policy pinned all of it to one branch, so AU5 is a
  distinct commit rather than a distinct branch as the backlog anticipated.
