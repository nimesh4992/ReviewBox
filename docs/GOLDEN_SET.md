# The golden set — how to label it

**This is the two hours that decides the epic.** Everything downstream — which
clustering approach we pick, whether the Issues page tells the truth, whether
"ReviewBox identifies the issues customers are actually experiencing" is a real
claim — is measured against the file you produce here.

No agent can do this. Labelling it *is* the product knowledge.

**Related:** ADR 011 (`docs/adr/011-issue-identity-and-clustering.md`) §3, §9 ·
`docs/II_DELIVERY_PLAN.md` §3 · `docs/decisions.md` D025

---

## 1. Get the file

```bash
npm run eval:export                      # 200 reviews → eval/golden-set.csv
npm run eval:export -- --count 300       # more, if you have the appetite
```

Run it from the project root with `.env.local` present. It reads your real
reviews and writes a CSV.

**Author names are never exported.** The evaluation needs review text only, so
nothing in this file identifies a person. That is also why the bake-off is not
blocked on the sub-processor question (ADR 011 §12.3).

**Watch the language line it prints.** If it warns that the Hinglish quota
could not be filled, stop and sync more reviews first — a mostly-English sample
will certify an engine that fails for most of our customers, and you will not
find out until a customer does.

`eval/*.csv` is gitignored. The file stays on your machine.

---

## 2. The one rule you are applying

> **Two reviews belong to the same Issue if the same code change would resolve
> both.**

That is the whole job. Some worked examples, using the Theme → Issue split:

| Review | Theme | Issue | Why |
|---|---|---|---|
| "UPI payment failed" | Payments | `upi-payment-fails` | A payment that never went through |
| "Paid but no ticket generated" | Payments | `payment-taken-no-ticket` | Money left the account. **Different fix, different team.** Not the same Issue |
| "paisa cut gaya, ticket nahi aaya" | Payments | `payment-taken-no-ticket` | Same problem as the row above, different language. **This pairing is what the whole bake-off measures** |
| "Refund still not received" | Payments | `refund-not-received` | Third distinct failure under the same theme |

**Three Issues, one Theme.** If you had labelled all four `payments`, the
product would one day say *"Payment failures · 47 reviews · Critical"* and send
someone to fix the wrong thing.

**The nuance that resolves most hard cases:** this is *issue equivalence, not
implementation equivalence*. Two Issues may well be fixed in the same release,
by the same engineer, in the same file — that does not make them one Issue. Ask
only: **would fixing one, by itself, resolve the other?**

### When you genuinely cannot tell

**Separate them.** A false split is a click; a false merge is a confidently
wrong recommendation (D025). Label the way you want the engine to behave.

---

## 3. The six columns

The exporter fills everything up to `text`. You fill these:

| Column | What to write | Notes |
|---|---|---|
| `theme` | Coarse area — `payments`, `ticketing`, `crashes`, `login`, `performance`, `ux` | Invent themes as needed; keep them few |
| `issue_id` | **The grouping key.** Same id = same underlying problem | lowercase-with-hyphens, e.g. `payment-taken-no-ticket`. Consistency matters more than beauty |
| `issue_title` | The problem in plain words | Only needs filling once per issue; blank on later rows is fine |
| `is_actionable` | `yes` / `no` | `no` for "app is rubbish", star-only ratings, spam. Noise is a real category |
| `severity` | `critical` / `high` / `medium` / `low` | Your judgement as the person who would triage it |
| `language_bucket` | `english` / `native-script` / `hinglish` | **Pre-filled with a guess — correct it.** The guess is a crude heuristic; your value is what gets scored |

`native-script` = Devanagari (Hindi, Marathi). `hinglish` = romanised Hindi in
Latin script **and** anything code-switched mid-sentence.

**Leave `issue_id` blank to skip a row.** Unlabelled rows are ignored, not
counted wrong — so a review you cannot judge costs nothing.

Any spreadsheet will do. Save as CSV, keep the header row.

---

## 4. Check your work before the bake-off

```bash
npm run eval:score -- --check
```

Validates the file and refuses to score if anything is off — duplicate ids, an
`issue_id` with no `language_bucket`, a bucket spelled wrong. It prints how many
rows you labelled, the language split, and how many distinct issues you found.

Two hours of labelling deserve better than a silently skewed score caused by one
stray cell.

---

## 5. What happens next

Each candidate approach produces a predictions CSV (`review_id,issue_id`, blank
meaning *the engine declined to attach it*), and:

```bash
npm run eval:score -- --labels eval/golden-set-v2.csv \
    --predictions eval/run-groq.csv --name "Groq / LLM"
```

You get precision, recall, **false merges**, false splits, issue-discovery rate
and a weighted error score — **broken out by language slice**, including the
cross-bucket rows. The cross `english×hinglish` row is the one that matters
most: it measures whether a Hinglish review gets grouped with its English
equivalent, which is the capability the product is being sold on.

### Reading the report — three things that are not decoration

**All six slices always print.** A slice with no examples shows
`N/A — 0 examples`. That is not the same as a pass. If `within:native-script`
says N/A, native-script was never tested and the run says nothing about it.

**`low-n / exploratory` means "published, not evidence".** A slice needs 10
reviews on its *smaller* side and 30 pairs to count. The smaller side matters:
`cross:english×hinglish` on the current corpus has 1,164 pairs generated by six
Hinglish reviews, and six judgements cannot carry an engine choice however many
pairs they produce.

**Two numbers may not choose an engine** — `overall`, and the unsliced
`weightedErrors`. Both are marked *diagnostic only*. Reporting "overall 86%"
over a 42% Hinglish column is the failure D025 forbids, and the weighted-error
figure fails the same way more quietly: on a corpus that is 97% English it is an
English number with a global label. To compare engines, use:

```bash
npm run eval:score -- --labels eval/golden-set-v2.csv \
    --compare eval/run-groq.csv=Groq eval/run-embed.csv=Embeddings
```

That path reports a **winner only when every language bucket had an eligible
slice**. Otherwise it names a `leader` and explicitly withholds the
recommendation — because excluding weak evidence must raise the bar, not lower
it.

Those numbers go into **ADR 011 §10**, and only then does implementation start.
Record the eligibility footer with them: §10.2 requires the untested buckets to
be named, not omitted.

---

## 6. Sharing labels without sharing review text

The labelled CSV contains real customer review text and stays local. To produce
a committable, text-free projection later, keep only:

```
review_id, issue_id, theme, is_actionable, severity, language_bucket
```

That is enough to re-score any future engine change against the same ground
truth, and it identifies nobody. The full file never leaves your machine.
