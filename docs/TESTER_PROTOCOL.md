# Walk scripts — AC-6, and the three non-founder testers

**Written 2026-08-22.** Two things only a human can do, written so they can be done
without reading anything else.

> **Nothing in this file has been performed.** No result below is filled in. An agent
> cannot walk either of these, and a passing test suite is not a substitute — that
> confusion is the reason `docs/SPINE.md` exists.

---

## 1. AC-6 — "does the product show what four hours of SQL showed?"

**Gate (`docs/PATH_TO_9.md` §2, M1):** a founder opens a real app's release and can name
its biggest complaint mover **in under 30 seconds**, with the direction and the size
shown — not computed in their head.

**Why this specific walk.** On 2026-08-22 the fixture app's own reviews were read
against the database to answer a real product question, and the answer was:
booking-failure complaints run at **24.0 per 100 reviews on v1.4.1** and **15.8 on
v1.5** — one bug, improving — while a **new refund-reporting problem** appeared in 1.5
(the app now says "Refunded" and the money still does not arrive). Full working:
`docs/PATH_TO_9.md` §10.

**AC-6 asks whether the release view surfaces any of that.** That is a much better test
than "does the card render", and it is why this script names v1.4.1 and v1.5.

### Before you start

- Sign in as yourself on **production**, not locally.
- Have a timer. Thirty seconds is the gate, and it is easy to be generous with yourself.
- Pick the **Google Play** "Mumbai One". There are two apps with that name in the *AT
  WORK* workspace — one per store — and the release table now appends the store to the
  name when two live apps share one. If you see two, take the Play one.

### The walk

| # | Do | Expect | Pass / fail |
|---|---|---|---|
| 1 | Open **Releases** | A list of versions, newest first. Each row shows a version, a review count, and a "vs previous" cell | ☐ |
| 2 | Note which versions are listed | 1.5, 1.4.1, 1.4, 1.3.1, … Nothing is duplicated. Rows show a store when two apps share a name | ☐ |
| 3 | **Start the timer.** Open **v1.5** | The release detail page | ☐ |
| 4 | Find the card **"What changed vs 1.4.1"** | Present, above the fold, without scrolling past the review list | ☐ |
| 5 | **Say the biggest mover out loud.** Stop the timer | You named one tag, its direction, and roughly its size, from the screen | ☐ **seconds: ___** |
| 6 | Check the number is a *rate* | The card reads per-100-reviews, not raw counts. A bigger release must not look like a worse one | ☐ |
| 7 | Look for a tag it refused to judge | At least one tag reads `low-n` / "too few to judge" rather than a percentage. **A card with a percentage on every row is a failure**, not a nicer card | ☐ |
| 8 | Look for a tag new in 1.5 | Reads "New in this release", never "+∞%" or "+100%" | ☐ |
| 9 | Open **v1.4.1** and repeat 4–5 | Its baseline is a version with enough reviews to judge — **not** the 1-review straggler v1.3.1 | ☐ |
| 10 | **The real question.** Against `docs/PATH_TO_9.md` §10: does what you just read tell you the payment/booking complaint is *receding*? | Answer honestly. "Billing moved −34%" is a pass. "Billing is red" without a direction is not | ☐ |

### Recording it

Write the outcome into `docs/PATH_TO_9.md` §2's table and §5's log — **the log row may
not claim a gate is green; only §2 may.** Capture:

- the seconds at step 5, and the tag you named
- a screenshot of the card
- **what you said out loud**, verbatim, including any hesitation. The hesitation is the
  finding; "I think it's… billing? no, payment" is a fail even inside 30 seconds

### What must not happen

Do not change product behaviour to make this pass. If the card is unreadable, that is
the result, and it is worth more than a green box.

### One limit to know before you judge it

The comparison buckets by version **name**, and this app reuses names: "1.4.1" is three
separate Play uploads over six weeks, "1.5" is two, three months apart (RV1). So "vs
1.4.1" is a comparison against a merged bucket. That is exactly what a customer sees on
their own store listing and is not wrong — but do not read the card as per-build.

---

## 2. Three non-founder testers

**Gate (M3 → R3):** **2 of 3** outsiders sign up unaided and name their app's top
problem. Recorded verbatim, including what they said out loud.

### 2.1 · Do not start until these are true

| | Why |
|---|---|
| **AC-6 has been walked** | §1. Testing the release view before you have looked at it yourself wastes three people |
| **The pricing page is truthful** | Done: "Topic breakdown", `KNOWN_UNBACKED` empty. Running the test on a page that overclaims turns three testers into three people who learned the product lies (`docs/PATH_TO_9.md` L1) |
| **You have decided the Team-plan / auto-publish copy** | `docs/LAUNCH_READINESS_2026-08-22.md` §2.2–§2.3. Four public pages currently offer auto-publish on a plan that does not exist. A tester who asks about it gets a false answer from your own site |
| **`ADMIN_CLERK_USER_ID` is set in production** | Otherwise you cannot run the store probe when a tester's app misbehaves, and you will be debugging blind in front of them |

### 2.2 · Who

Three people who are **not you** and have not seen the product. Each must:

- own or work on a **real** app that is live on Google Play or the App Store, with
  reviews on it — their own app, not a demo one
- be willing to connect it (Play needs a Play Console invite; budget ~10 minutes and
  warn them in advance)
- be able to think aloud for 30 minutes

Aim for at least one who is **not** an engineer, and at least one whose app has
**non-English reviews** — that second one is how you find out what the English-only tag
vocabulary costs in front of a real person, which no test in this repo can tell you.

### 2.3 · What you say at the start, verbatim

> "I'm going to give you a link and then be quiet. Please say out loud what you're
> thinking, including when you're confused or annoyed. If you get stuck, stay stuck for
> a minute before asking me — the stuck bit is the useful part. There are no wrong
> moves; I'm testing the product, not you."

Then **stop talking.** The most common way this test is wasted is the founder
explaining.

### 2.4 · The tasks — read them one at a time, do not hand over the list

1. Sign up and connect your app.
2. Tell me how many reviews came in and how far back they go.
3. Find the worst review from the last month.
4. Draft a reply to it. Do not post it.
5. **Tell me the single biggest thing your users are complaining about.**
6. Tell me what your last release changed, for better or worse.
7. Tell me what this would cost you per month.

### 2.5 · Success criteria — fixed now, so they cannot be softened afterwards

| # | Criterion | Threshold |
|---|---|---|
| 1 | Completed sign-up and connect **unaided** | 3 of 3 |
| 2 | **Named their app's top problem from the product** (task 5) | **2 of 3 — this is the gate** |
| 3 | Reached a draft reply they would be willing to send | 2 of 3 |
| 4 | Correctly stated what they would pay | 2 of 3 |
| 5 | Nobody hit a screen that stated something false about their data | 3 of 3 |

Criterion 2 is R3. The others are diagnostics.

### 2.6 · Record, per tester

- Time from sign-up to first review on screen
- **Verbatim quotes** at every hesitation — not your paraphrase
- Every place they asked "is this right?" — a truth problem, not a UX one
- Every place they were wrong about what the product had done
- The exact sentence they used for task 5, whether it passed or failed

### 2.7 · What is not being tested

Say so up front, so feedback lands where it can be used:

- visual design and polish
- billing (Stripe keys are not set; nobody will be charged)
- multilingual coverage — **known unvalidated**, `docs/LAUNCH_READINESS_2026-08-22.md` §4
- anything on the Issues screens — unbuilt (M4/M5)
- preview environments — disabled

### 2.8 · Bugs

One line each, in `docs/BUGS.md`: what they did, what happened, what they expected, and
their verbatim words. **Do not fix anything mid-session.** A tester who watches you fix
something starts reporting to be helpful instead of honestly.

### 2.9 · Filling in the result

Write the outcome into `docs/PATH_TO_9.md` §2's M3 row and `docs/PRODUCT_READINESS.md`
R3. **Three real names or none** — an invented participant is worth less than an empty
table, because the empty table is at least true.
