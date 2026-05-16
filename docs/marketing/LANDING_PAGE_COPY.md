# ReviewBox — Landing Page Copy

> Drop-in copy for `tryreviewbox.com` (`src/app/page.tsx`). Bold + punchy
> voice. Pulled from `BRAND_MESSAGING.md`.
>
> Every section labels what it is in `[SECTION]` brackets so it maps cleanly to
> a React component (Hero, Trust, Features, etc.) — matches the components
> already in the Claude Design project (`Homepage.jsx`, `Trust.jsx`,
> `Revenue.jsx`, `BoldUI.jsx`, etc.).

---

## [NAV]

Logo · Product · ASO · Pricing · Changelog · Sign in · **Start free →**

---

## [HERO]

> Eyebrow (small caps, brand blue): **App review ops + ASO. AI-native.**

# Reviews → Revenue. One tool.

### Triage every review, reply at scale, and surface ranking keywords — from one workspace built for the way modern app teams actually work.

**[Start free — no card required]**   **[See it in 60 seconds →]**

> Sub-line under CTAs (text-fg-3, small):
> Connected to the official Google Play + App Store Connect APIs. 14-day free trial.
> Cancel anytime.

---

## [TRUST STRIP]

> Six logos, greyscale, with one line above:

**Built for app teams shipping every week.**

*(Customer logos go here once we have permission. Until then, run with social
proof line: "Trusted by indie devs and growth teams across 12 countries.")*

---

## [PROBLEM]

> Section eyebrow: **The old way**

# Three tools. Five tabs. Zero context.

Your reviews sit in the Play Console. Your keywords sit in AppTweak. Your crashes
sit in Sentry. Your replies sit in a Notion doc your support lead maintains by hand.

Every Monday you stitch the picture together. By Friday it's stale.

**Sound familiar?**

- Reading 200 reviews to find the 3 that matter
- Re-typing the same "thanks for the feedback!" reply 40 times
- Realising a v5.42 crash is wrecking your rating *three days* after it shipped
- Paying $300/mo for a tool that does 30% of what you need

---

## [SOLUTION]

> Section eyebrow: **The ReviewBox way**

# One workspace. Both stores. Every signal.

ReviewBox pulls every review from Google Play and the App Store, tags it with AI,
prioritises it, drafts a reply, alerts you on rating spikes, and turns it all into
ASO insight — automatically, every four hours.

> Big visual: dashboard screenshot or animated GIF of the review queue. Use the
> existing `BoldUI.jsx` / `Animations.jsx` components from the Design project.

---

## [FEATURE — TRIAGE]

> Two-column. Copy left, screenshot right.

## Triage 1,000 reviews in two minutes.

Every review hits the queue pre-sorted by sentiment, priority, and issue tag.
Crash reports, billing complaints, feature requests — separated before you've
opened your laptop.

- Sentiment: critical · negative · mixed · positive
- Priority: urgent · high · normal · low
- Tags: crash · billing · login · performance · feature request · 12 more

**[Tour the review queue →]**

---

## [FEATURE — REPLIES]

> Reverse two-column. Screenshot left, copy right.

## Reply at scale. Sound like a human.

Three-tier reply pipeline: templates first, cache second, AI third. Most teams
serve 60–80% of replies without a single AI call — which is why we can charge
$49, not $299.

- Four built-in tones: professional · empathetic · direct · casual
- Knowledge base baked into every draft so nothing hallucinates
- Auto-draft for new reviews matching saved rules. Auto-reply when you're ready.

**[See AI replies in action →]**

---

## [FEATURE — ASO]

> Two-column. Copy left, keyword visual right.

## ASO that actually listens.

Keyword tools don't read your reviews. ReviewBox does. We surface the exact
phrases your 5★ fans repeat and the bugs your 1★ detractors are screaming about —
and rank them by frequency, rating impact, and country.

- Discover keywords from your real reviewers, not a black box
- See the gap between what people search for and what your store listing says
- Track rank movements weekly without a separate ASO subscription

**[Tour the ASO module →]**

---

## [FEATURE — INCIDENTS]

> Reverse two-column. Alert mockup left, copy right.

## Spot incidents before the store does.

Rating spikes, crash clusters, billing storms — detected in real time, alerted
by email before the App Store hides your rating from search results.

- Default: 5 reviews ≤2★ on the same version in 24h → email
- Auto-creates an incident with linked reviews, affected version, suggested owner
- Slack webhook for the team channel (Team plan)

**[See alert previews →]**

---

## [PROOF / NUMBERS]

> Four-up stat band, brand blue accents.

| **4-hour** | **Sub-2s** | **73%** | **$49** |
| --- | --- | --- | --- |
| sync from both stores, every cycle | AI draft generation, p99 | token compression — the math behind our pricing | the price of replacing three tools |

---

## [ICP ROW — ASO MANAGERS]

> Personalised section. Four cards in a horizontal row, each with an icon, headline,
> two-sentence value prop, and a "More for…" link.

### For ASO Managers

**Your keyword tools don't read your reviews. We do.**
Surface what your real users say, not what a vendor's database thinks they're
saying. Push the winners straight into your store listing.

**[Read the ASO Manager guide →]**

### For Mobile Growth Leads

**Every star you save converts more installs.**
Watch the rating-to-CVR loop in one dashboard. Catch a release regression before
it shows up in your paid acquisition CAC report.

**[Read the Growth Lead guide →]**

### For Indie & Solo Devs

**Reply to every review in 10 minutes a week.**
No support hire. No spreadsheet. Climb from 4.1★ to 4.6★ on the same hours you're
already working.

**[Read the Indie guide →]**

### For Mobile Product Managers

**Crash signal hits reviews before it hits Sentry.**
The earliest signal of a regression isn't in your error tracker — it's in the
review feed. Triage it before support escalates.

**[Read the PM guide →]**

---

## [COMPETITIVE — "MORE FOR LESS"]

> Side-by-side comparison. Bold checkmarks. Use brand blue for our column.

## More tool. Less invoice.

|  | **ReviewBox** | AppFollow | Sensor Tower | AppTweak |
| --- | --- | --- | --- | --- |
| Review sync (both stores) | ✅ | ✅ | ✅ | Partial |
| AI auto-triage | ✅ Native | ❌ Add-on | ❌ Add-on | ❌ |
| AI reply drafting | ✅ Native | $$ Add-on | ❌ | ❌ |
| Auto-reply rules | ✅ | ❌ | ❌ | ❌ |
| ASO keywords from reviews | ✅ | ❌ | Separate product | ✅ Separate |
| Slack + email alerts | ✅ | ✅ | Limited | ❌ |
| Starts at | **$49/mo** | $299/mo | $1,000+/mo | $349/mo |

> Footnote (small text):
> Competitor pricing as of mid-2026; check their sites for current rates. We update
> this comparison quarterly.

---

## [TESTIMONIALS]

> Three cards. Photo left, quote + name + role right. Replace with real quotes
> the moment we have them; until then, *do not invent testimonials*. Use the
> outcome stories from BRAND_MESSAGING as roleplays under a "What teams say"
> framing — clearly labelled scenarios.

> Until real testimonials land, use this section as a "scenarios" band:

### What ReviewBox looks like on a Tuesday

**11:04am** — Rating spike alert. v5.42 crash cluster on Pixel 7.
**11:09am** — You forward the alert to engineering with three sample reviews.
**1:32pm** — Hot-patch rolling out. Rating slide saved before paid CAC noticed.

**Saturday morning** — You catch up on 84 reviews from the week in 22 minutes.
Every one replied to, in your tone, with the known-issue context baked in.

---

## [SECONDARY CTA / SCROLL TRAP]

> Mid-page CTA banner. Use after the proof/numbers section.

## Try it on your own reviews.

Connect your store, get 60 days of history back, and see what's been hiding in
your queue. Takes about 5 minutes.

**[Start free — no card required]**

---

## [PRICING]

> Three cards, equal width, "Most popular" badge on Pro.

## Honest pricing. Real plans.

> Sub: 14-day free trial on every plan. No card required. Cancel anytime.

### Starter — $49 / month
For solo devs and 1-app teams.

- 1 app
- 250 AI replies / month
- AI triage on every review
- Templates + knowledge base
- Email alerts
- 1 seat

**[Start free →]**

### Pro — $99 / month *(Most popular)*
For growth teams running 2–3 apps.

- 3 apps
- 2,000 AI replies / month
- Everything in Starter, plus:
- Automation rules (auto-draft)
- Slack alerts
- ASO keyword tracking
- 3 seats

**[Start free →]**

### Team — $199 / month
For studios and gaming companies.

- 10 apps
- Unlimited AI replies
- Everything in Pro, plus:
- Auto-reply (opt-in)
- Custom AI tone built from your samples
- Priority support
- 10 seats

**[Start free →]**

> Below the cards:
> **Need more apps, more seats, or a custom contract?** Email
> hello@tryreviewbox.com — we'll put together what makes sense.

---

## [FAQ]

> Accordion. Mirror the help center FAQ but shorter and sales-flavoured.

### Which app stores do you support?
Google Play and Apple App Store — both at full feature parity. Other stores aren't
on the roadmap.

### How is this different from AppFollow / Sensor Tower / AppTweak?
We replace all three for most teams under 1,000 employees. AI is native, not an
expensive add-on. Pricing starts at $49 instead of $300+.

### Do I need a credit card to start?
No. 14-day trial, no card. When the trial ends, you keep your data — the workspace
just becomes read-only until you pick a plan.

### How does the AI sound like our brand?
You pick from four built-in tones, write a knowledge base in your own words, and
(on Team) request a custom tone built from samples of your existing replies.

### Is my Play Console / App Store Connect data secure?
Credentials are encrypted at rest. We use the minimum permissions Google and Apple
allow. GDPR data export and deletion are built in.

### Can I cancel anytime?
Yes. One click in Settings → Billing. You keep full access until the end of the
current billing period.

---

## [FINAL CTA]

> Full-width band. Big type. Two CTAs.

# Stop stitching tabs. Start shipping reviews.

The command center your app team has been duct-taping together. Built. Live. From $49.

**[Start free — no card required]**   **[Book a 15-minute demo →]**

> Below CTAs (text-fg-3, small):
> Questions? hello@tryreviewbox.com · We reply within one business day.

---

## [FOOTER]

> Standard footer. Four columns.

**Product** — Reviews · Replies · ASO · Incidents · Automations · Pricing · Changelog

**Compare** — vs AppFollow · vs Sensor Tower · vs AppTweak · vs Manual

**Resources** — Help center · API docs (soon) · Status · Blog

**Company** — About · Contact · Privacy · Terms

> Bottom strip:
> © 2026 ReviewBox. Built for app teams. **Made with Claude.** *(or omit)*

---

## Voice check — before we ship this page

Run through this list. If any answer is "no", rewrite.

- [ ] Every headline uses a verb in the first three words
- [ ] No instance of: leverage, empower, synergy, unlock, next-gen, best-in-class
- [ ] Every claim ($, %, time) maps to a number in `BRAND_MESSAGING.md` proof points
- [ ] No invented customer names or testimonials
- [ ] Pricing matches `docs/STRIPE_SETUP.md` exactly ($49 / $99 / $199)
- [ ] Both stores referenced consistently (Google Play, App Store)
- [ ] Final CTA appears at least twice above the fold and once at the bottom

---

## Hand-off notes

- Hero copy is the most-tested piece. Plan to A/B the three tagline candidates
  (`Reviews → Revenue`, `Review ops meets ASO`, `More signal. Less spend.`) once
  we have traffic.
- The "More tool. Less invoice." comparison table is the highest-converting
  section in this category. Treat it as a tier-one priority for design polish.
- Don't shrink the pricing section — pricing transparency is a wedge against the
  enterprise tools. Show all three plans, full feature lists, no "contact sales"
  hidden tier.
- ICP rows are designed to deep-link from ads and LinkedIn — make sure each "Read
  the X guide" link goes to a dedicated ICP page (next deliverable).

Last updated: 2026-05-16
