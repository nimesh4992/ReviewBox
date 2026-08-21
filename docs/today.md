# Today — 2026-08-21 (three merges; and production AI had been dead the whole time)

> **Read this first:** a P0 outage was found today that nothing in the repo could
> have told you about. **Every AI call in production was returning 404** — replies,
> translation, summaries, sentiment, ASO and the public landing-page demo — while
> 944 unit tests passed, `tsc` was clean, and CI was green. It was found only
> because someone insisted on making one real model call. See **The outage** below;
> it is the most transferable thing in this file.

---

## What shipped

| PR | What | State |
|---|---|---|
| **#146** | P0 commercial readiness (5 items) + **P1-1 sub-daily sync** | merged `236265a`, live |
| **#148** | **Both AI providers 404ing**, and the AI tier inventing a support address | merged `ed5f00c`, live |
| **#147** | **P1-2 multilingual replies**, one canonical detector | merged `ddf9e41`, deployed |

Master went `d729faf → 236265a → ed5f00c → ddf9e41` in one session.

---

## The outage — the part worth keeping

Both model IDs had been retired by their providers:

```
llama-3.3-70b-versatile  ->  openai/gpt-oss-120b     (Groq retired the Llama family)
gemini-2.0-flash-exp     ->  gemini-2.5-flash        (Google shut down 2.0 Flash)
```

Neither `GROQ_MODEL` nor `GEMINI_MODEL` was set, so the dead defaults were live.

**Three things made it invisible, and each is a pattern, not an accident:**

1. **`catch { throw new Error("AI_UNAVAILABLE") }` discarded the cause.** Keys were
   valid throughout — **404, not 401** — but nothing in logs or UI could tell a bad
   key from a blocked network from a retired model name. `generateSummary` already
   carried a comment about exactly this ("nothing to look at either"); the same
   defect had survived in `generateReply`. Both now log and attach `cause`.
2. **The failure was silent by design.** Both providers failing falls through to the
   tier-4 composer, which returns a valid English reply. The symptom was "replies
   suddenly read like form letters" — not an error anyone would file.
3. **The test suite could not see it.** 944 tests verified that pure functions
   compute correct values. Nothing verified that a request left the building.

### Swapping the model ID alone would have shipped a second bug

`gpt-oss-120b` is a **reasoning** model: it spends output tokens thinking before
emitting visible text, and those count against `max_tokens`. At the old cap of 150
the whole budget went to reasoning and the API returned an **empty completion** —
reported as `AI_UNAVAILABLE`, i.e. indistinguishable from a dead provider.

Measured on a 5-language run: **1/5 replies survived at 150; 5/5 at
`reasoning_effort: "low"` with a 400 cap.** Effort is capped rather than the ceiling
raised further, because effort is the lever that bounds cost and latency. The same
applied to summaries (200) and translation (600); all three were raised.

### And a third bug the token increase exposed

With room to write a contact line, the model invented **`support@reviewbox.com`** —
an address that does not exist. Not random: **the AI tier was the only tier that
never received the support address.** `{supportEmail}` is substituted in 83 places
in tier-1 templates and 9 in the tier-4 composer; the system prompt had **zero**. At
150 tokens replies were too short to reach a contact line, so nobody saw it.

`buildSystemPrompt` now takes `supportEmail`, and the rule is **unconditional** —
absence of an address must never license invention. Replies publish publicly under
the customer's developer name, so a confabulated address is a reputational defect.

---

## P1-2 — multilingual replies

Detects the review's language **at reply time** and instructs the model to answer in
it. No ingestion change, no migration, no `reviews.language` write, no backfill.

**Two detectors became one.** `language-detect.ts` was consumed only by tests; every
runtime call site used `language.ts`'s cruder `isLikelyEnglish`, which carried its
own script ranges and word lists. The English-evidence rules folded into
`language-detect.ts`; `language.ts` is now a re-export, and `language.test.ts` runs
unchanged against the merged implementation as the proof English behaviour is intact.

The fold-in was **not optional**: `detectLanguage` treated all Latin script as
English at 0.9, so routing the translate route through it as-was would have hidden
the Translate button from every Spanish and German review.

### Product-verified against live models

Founder-run against real providers on the final configuration — the first evidence in
this repo that multilingual replies actually work:

| Input | Detected | Reply language | Routing |
|---|---|---|---|
| `Great app, very easy to use.` | `en` 0.90 | English | English canned template |
| `यह ऐप बहुत अच्छा है…` | `hi` 0.85 | **Hindi** | AI tier |
| `paisa cut gaya but ticket nahi aaya` | `hi-Latn` 0.80 | **Romanised Hindi** | AI tier |
| `இந்த ஆப் மிகவும் நன்றாக உள்ளது.` | `ta` 0.75 | **Tamil** | AI tier |
| `बहुत अच्छा` | `null` 0.30 | English | **AI tier, not canned** |

Every contact address emitted was the real `hello@tryreviewbox.com`.

### The defect that smoke test caught before launch

`बहुत अच्छा` was being answered **"Thank you for the 5 stars!" in English, from a
canned template, with AI generation never reached.**

The tier-1 gate read `replyLanguage.code === "en"`. **`code` is the language we will
WRITE IN**, and it reads `"en"` in five situations — English detected, detector
declined to name one, named one we don't publish in, named one below the confidence
bar, or no letters at all. Four of those five are fallbacks, and all four passed.

`mayServeEnglishCannedReply()` now asks what that line meant to ask. **Do not treat
`detected === null` as equivalent to `detected === "en"`** — and `detected === "en"`
alone is not enough either, because English is recorded at three confidence levels
(0.9 evidenced, 0.6 one weak marker, 0.4 Latin baseline). Only the first is evidence.

---

## Verified on evidence, not inference

- **The 3-hour cron fired at 15:00:35 UTC and returned 200** on the new deployment.
  `0 */3 * * *` registered and works.
- **`CRON_SECRET` authorizes.** No 401 or 403 anywhere on `/api/sync/reviews`. The
  request reached the handler and executed. This had been open since P0-4 made it
  load-bearing.

---

## Open — none of it blocking, all of it worth knowing

1. **🟠 Google Play sync is fetching nothing.** `The caller does not have permission`
   for `com.metroconnect3.app`, at 15:00:35 today and 08:01:06 yesterday — so it
   **predates every merge today**. The route returns 200 regardless, which is why it
   has been invisible. Check Play Console → Users and permissions for the service
   account; this likely also blocks one-click reply posting on Android.
2. **Nobody has watched a draft appear in the browser.** The smoke test exercised the
   functions, not the Inbox → `/api/reply/draft` → Groq round-trip. Everything points
   the right way; the gap between "the artifact is correct" and "someone watched it
   work" is exactly where this repo's four most expensive lessons live.
3. **Gemini's free tier is 5 requests/minute.** The smoke run hit it repeatedly. As
   the *fallback* it only matters when Groq is already failing, but under real load
   the fallback is not a full safety net.
4. **This change cold-starts every workspace's reply cache once.** The system prompt
   is part of the cache key and the prompt changed. One-off, no correctness impact.
5. **The provider-migration ADR is deferred, not forgotten.** Rationale is in #148's
   body; promote to `docs/adr/` now the outage is closed.
6. **Latin-script languages are still not named.** Spanish, French, German,
   Portuguese and Italian reviews get an English reply — the detector reports
   "not English, undetermined" rather than guessing between overlapping marker sets.
   Naming them moves those reviews from the `english` to the `hinglish` bake-off
   bucket, which is why it was deliberately left out of #147.
7. **Markerless Devanagari falls back to English AI generation, not Hindi.** The
   unsafe path (canned English) is closed; the reviewer is still not answered in
   their language. Needs the store's `hl` hint (ingestion) or a Devanagari default
   (would mislabel Marathi).

---

## What the next session should start on

**Unchanged from 2026-08-19 — the Issue Intelligence epic.** Nothing today touched
it. Per D023:

1. **II0a — the II1 ADR, architecture only.** The keystone. 13 questions, ≥3
   approaches, recommendation for an India-first SaaS
   (`docs/ISSUE_INTELLIGENCE.md` §7). Framing is *"what constitutes the identity of
   an issue?"*, not *"how do I generate a nice AI summary?"*. **No II1 code until
   this exists.**
2. **II0 — Phase 0 release-regression** on today's `issue_tags[]`. Small vertical
   slice, ships the story without waiting for clustering. Can run in parallel.

Before either, item 1 above (Google Play permissions) is worth ten minutes — a sync
that fetches nothing makes every downstream feature look broken.

---

## The lesson, stated once

**A green test suite, a clean `tsc`, and green CI were all true while every AI call
in production returned 404.** They were true about the artifact and silent about the
behaviour. The outage surfaced because the founder refused to accept detector output
as product verification and insisted on a real model call — and that same insistence
also surfaced the invented support address and the canned-English-reply defect.

Three real bugs, none of which any amount of static verification would have found.
