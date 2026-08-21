# Spec: Release regression ("what changed in this release")

**Status:** implemented, **not yet walked**. The gate is a founder opening a real
app's release — see AC-6. Until then this is a compile-time claim, per `CLAUDE.md`.
**Owner promise:** PRODUCT_CONTEXT promise #5 ("we tell you when something is
wrong, in plain English") and `docs/PRODUCT_READINESS.md` gate **R1**.
**Backlog:** II0 · **Plan:** `docs/PATH_TO_9.md` §3 · **Code:**
`src/lib/release-regression.ts`, `src/features/releases/components/release-regression-card.tsx`

The first thing in this product that reads *across* reviews instead of listing
them. It answers "what did my last release break?" using the existing eight-tag
vocabulary, with no clustering and no schema change.

## Scope

Comparing per-tag complaint volume between one release and the release
immediately before it, **for the same app**, and naming probable regressions.

Out of scope: discovering new issue categories (that is II1), cross-app
comparison, alerting on the result (II7).

---

## Acceptance criteria

### AC-1 — A bigger release is not called a worse one
**Given** v1.4 had 10 billing complaints in 50 reviews and v1.5 has 30 in 150
**When** the release page is opened for v1.5
**Then** billing reads **Steady, 0%** — both are 20 per 100 reviews.
*Verified by:* `release-regression.test.ts` → "does not call a bigger release a
regression when the complaint RATE is flat"; mutation-checked by replacing rates
with raw counts (1 test fails).

### AC-2 — A real increase is named, sized and ranked
**Given** billing complaints go from 8 to 38 per 100 reviews
**Then** the card shows `+375%`, marks it **Regression**, and puts it first.
*Verified by:* unit test; the ordering assertion is separate from the percentage.

### AC-3 — A handful of reviews may not raise a flag
**Given** a tag goes from 1 review to 2
**Then** it is shown, labelled **Too few to judge**, and is excluded from the
"Probable regression" line.
*Verified by:* two tests — one that it is not flagged, one that it is still
displayed. Hiding it would be a quieter lie than showing it.

### AC-4 — A complaint that is new is not an infinite percentage
**Given** a tag absent from v1.4 appears in v1.5
**Then** the row reads **New in this release** with no percentage, and is
critical only once it reaches 5 per 100 reviews.

### AC-5 — The comparison refuses itself when it would be meaningless
**Given** either release has fewer than 10 reviews, or this is the app's first
release
**Then** the card explains which, in a sentence naming the counts — never an
empty state that reads as "nothing is wrong".

### AC-6 — A founder can name the biggest mover in under 30 seconds *(the gate)*
**Given** a real app with at least two releases and ≥10 reviews each
**When** the founder opens `/releases/<version>?appId=…`
**Then** they can say out loud which complaint grew most, and by how much,
without doing arithmetic.
*Verified by:* **a human. Not yet done.**

---

## Deliberate design decisions

| Decision | Why |
|---|---|
| Rates per 100 reviews, never raw counts | AC-1. Review volume moves independently of quality |
| `MIN_VERSION_REVIEWS = 10`, `MIN_TAG_REVIEWS = 3` | Product-policy floors, not significance tests. Same rule as ADR 011 §10.1: weak evidence is published, never decisive |
| New tags get their own direction | Division by zero is not a product statement |
| `findPreviousVersion` chains within one app id | Version numbers are unique only within an app — the bug `release-versions.ts` exists to prevent |
| Human tag overrides win | `effectiveTags()`; an empty override means "none apply", not "no opinion" |
| Row cap disclosed in the footer | An undisclosed sample makes a percentage mean something other than what it reads as |

## Known gaps

1. **Not walked** (AC-6). The only claim that matters is unproven.
2. **Tag vocabulary is still 8 English regexes.** A Hinglish complaint about
   payment may carry no tag at all, so it cannot move any bar here. II1 is the
   fix; this feature inherits that ceiling and must not be described as
   "what your users are complaining about" — only as "how these tags moved".
3. **No alerting.** Seeing this requires opening the page (II7).
4. The release detail page's own review list is capped at 100 rows; the
   comparison reads its own, larger query rather than that slice.
