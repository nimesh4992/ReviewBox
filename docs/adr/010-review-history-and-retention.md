# ADR 010 — What review history we can offer, and how long we keep it

**Date:** 2026-08-17
**Status:** Proposed — decisions 1–3 taken by the founder in-session; **four open questions below need an answer before this is built**
**Relates to:** ADR 009 (W5A, the unenforced review-volume cap) · BUG-020 · `docs/decisions.md` D009 · `docs/PRODUCT_CONTEXT.md`

## Context

A founder testing round asked a reasonable question: Play Console reports **2,064
ratings with reviews** for Mumbai One, and ReviewBox holds **202**. Where are the
rest?

They are not reachable. This was verified against the installed API definitions
rather than inferred:

**`androidpublisher` v3** — the Play Developer API — exposes exactly these
resources:

```
applications · apprecovery · edits · externaltransactions · generatedapks ·
grants · inappproducts · internalappsharingartifacts · monetization · orders ·
purchases · reviews · systemapks · users
```

There is **no ratings resource, no statistics, no reports**. The aggregate
rating and ratings count shown in Play Console are not in the API at all — which
is why we read them by scraping the public listing.

**`reviews.list`** takes exactly: `maxResults`, `packageName`, `startIndex`,
`token`, `translationLanguage`. **There is no date parameter.** Older reviews
cannot be requested, because no argument expresses the request. Google's
documented behaviour is that it serves only recent reviews (roughly a week).

Supporting evidence from our own data: the sync already pages up to 10 × 100, so
it would accept **1,000** reviews from the API. We hold 202. The API is not
withholding them because we ask wrongly.

**`playdeveloperreporting` v1beta1** — checked in case ratings had moved there —
exposes `anomalies · apps · vitals`, and vitals is crash rate, ANR rate, slow
rendering and wakelocks. Nothing review-related.

**The limit is universal, not a ReviewBox deficiency.** The founder checked
AppFollow — a funded, paid competitor — against the same app: **272 reviews.**
We hold 202. Same wall, same side of it.

The complete history exists in exactly one place: **Play Console → Download
reports**, which publishes review exports as monthly CSVs into a Cloud Storage
bucket the developer owns. That is not part of either API; it is a file store,
and reading it needs the customer to grant our service account access to their
bucket. `googleapis` (already a dependency) includes the `storage` API, so no
new dependency and no new paid service would be required.

## Decision

**1. Capture whatever the store exposes at connect time. Never promise a
number.**

That figure is a property of the app and its storefront, not of our product.
Mumbai One gave 202; a smaller app may give 10, a larger one 500. Marketing and
UI copy describe the *mechanism* — "everything available when you connect, then
every new review from then on" — and never a count we cannot keep.

**2. New reviews are retained for 365 days on paid plans.**

The archive grows from the day the customer joins. This is the honest version of
the value proposition: we cannot give you back the past, and we can guarantee
you never lose the future.

**3. The platform limit is documented, not hidden.**

`docs/PRODUCT_CONTEXT.md`, a `/help/review-history` page, a `/faq` entry, and a
link at the point in the product where the two numbers differ. The AppFollow
data point goes in the customer-facing copy: a specific comparison earns more
trust than a paragraph of explanation, and the customer can verify it.

### Retention is packaging, not a cost control

Worth recording so the number is never re-derived from the wrong premise.

`reviews` declares `embedding vector(384)` — ~1.5KB per row, which would have
dominated storage. **It is never populated**: zero references anywhere in
`src/`. So a review row is text plus metadata, roughly 0.5–1KB.

At 50 reviews/day that is ~18,000 rows and **10–18MB per app-year**. Twenty such
customers is 200–350MB against Supabase's 500MB free tier. Not free forever, but
nowhere near a reason to delete anything at current scale.

**So 365 was chosen because "a year of history" is a clean thing to sell.** If it
had been chosen to save storage, it would have been chosen against a premise
that isn't true.

## Open questions — these need a founder answer

**A. At 365 days, hide or delete?**
*Recommendation: hide.* Hard deletion is irreversible and destroys the archive
that is the product's selling point. Restricting the view keeps the rows,
costs almost nothing at this scale, and means an upgrade *reveals* history
instantly rather than restarting the clock.

**B. What happens to a free or lapsed-trial workspace's reviews?**
*Recommendation: retain, restrict access.* Deleting at trial end makes upgrading
feel like a punishment and makes the sales moment worse — the customer returns
to an empty product rather than to their own data.

**C. Is the 365 days measured from the review's date, or from when we captured
it?**
*Recommendation: capture date.* It selects a different set of rows, and it is
the one that matches the promise. Review date would silently exclude old reviews
captured yesterday, which is exactly the history the customer just gained.

**D. Does retention replace the `reviewsPerMonth` cap (ADR 009 / W5A)?**
*Recommendation: yes — drop the volume claim.* If retention is the paid
boundary, a monthly volume cap is the wrong meter, and the answer to W5A becomes
"remove it from `/pricing` and Billing" rather than "build enforcement". These
two decisions should be taken together, not separately.

## Consequences

**If A is answered "delete", the deletion job is the most dangerous thing in the
product.** It would be the first scheduled, destructive, tenant-scoped write —
every existing cron only sends email. It would need soft-delete before hard, a
dry-run mode, a per-run cap, an audit row, and a test proving it cannot cross a
workspace boundary. That work is most of the feature, and it is the strongest
argument for answering "hide".

**The Play Console export moves from catch-up to differentiator.** AppFollow's
272 says they do not do it either. Building it would make ReviewBox the only
tool in this category showing complete history — a Pro-tier selling point rather
than parity work. Not scheduled; filed at that framing so it is judged correctly
when it comes up.

**Support gets a checkable answer.** "Google's API has no way to request older
reviews, and AppFollow shows 272 for this same app" is verifiable by the person
asking, which is the difference between an explanation and an excuse.
