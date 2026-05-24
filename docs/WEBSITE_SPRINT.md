# Website Repositioning Sprint — ReviewBox

**Goal:** Replace fabricated marketing with honest, sharp copy that positions ReviewBox
correctly for 40–50 paying customers at $5–8K MRR.
**Design stays the same.** Copy, data, and claims are what change.
**Coordinate with:** Claude Code running in the terminal on the same repo.

---

## The Positioning in One Sentence

> **ReviewBox is the AI-native review management tool for small product teams who want
> the work done — not another dashboard to manage.**

Against AppFollow: they're an enterprise platform priced and complexity-sized for agencies.
You're the thing a 3-person product team can set up in 5 minutes and actually use daily.

Your four real features, in order of customer value:

| # | Feature | Why it wins |
|---|---|---|
| 1 | **AI Draft** | KB-grounded, template-matched, ~3s. AppFollow bolted AI on. You built around it. |
| 2 | **Review Management** | Both stores, every market, one queue sorted by what matters. |
| 3 | **Sentiment + Topic Clusters** | Shows the *shape* of problems, not just a list of reviews. |
| 4 | **ASO Intelligence** | Only tool that connects review language to store listing gaps. |

---

## What to Remove vs Keep

### REMOVE — Fabricated (legal/trust risk)
- `312 apps shipping with us` CountUp animation
- `312 apps tracked · Jan–Apr 2026` attribution line
- `1.8M reviews` in State of App Reviews report card
- `State of App Reviews 2026` report card entirely
- All stats sourced from it: `73% of regressions hit reviews first`, `47% of 1★ reviews never get a reply`
- `Acme Banking` case study section + quote on homepage
- `4.21 → 4.58`, `38h → 11m`, `94% reply rate` metrics on homepage
- `FULL CASE STUDY` link
- Customer logo wall (Northwind, Helix Money, Trailhead, etc. — all fictional)
- `median: 11m · p95: 1h 06m · 1★ replied: 94%` stat bar in AI demo section
- `Roughly 30% of customers…` FAQ answer
- `/customers/acme-banking` page — delete or gate with `[DEMO]` disclaimer
- Blog listing card: "Case study: Acme Banking, 4.21 → 4.58 in 90 days"

### REMOVE — Features not built yet
- Slack from integrations logo row (M4)
- Linear from integrations logo row (M4)
- Jira from integrations logo row (M4)
- Zapier from integrations logo row (M4)
- `Auto-pages your Slack on-call` bullet under Incident Detection feature
- `Slack alerts on 1-star + escalation rules` bullet under Reply Operations
- `Linear / Jira ticket creation from any review` bullet under Sentiment
- `Slack + KB sync` from Pro plan feature list
- Free tools section on homepage (no `/tools` pages exist yet — one will be built in SW3)
- `Incident detection · generally available` badge — change to `Early access`

### FIX — Wrong technical claims
- FAQ answer: `AI prompts route through Anthropic` → `AI prompts route through Groq (Llama 3.3 70B) with zero-retention`
- Homepage hero feature card: `Real-time sync, 60-second connect` → `Syncs every 4h automatically, connects in under 5 minutes`
- FAQ answer: `SOC 2 (Type II, in progress)` → keep as-is, this is honest

### KEEP — Real and good
- AI reply demo (live, works, genuinely differentiating)
- Design system entirely
- Changelog (reflects real shipped work)
- About page (good founder voice)
- The blog posts (good SEO content, just unlink the fake case study)
- Pricing page structure (just fix the plan contents — see SW2)
- Compare page structure (fix specific false claims — see SW2)
- FAQ structure (fix the two wrong answers)

---

## Sprint Breakdown

### SW0 — Kill the Lies *(~3 hours, do this first)*
Pure removals. No creative decisions needed. Ship this immediately.
Claude Code can do all of these in one pass.

**File: `src/app/page.tsx`**
1. Remove the `CountUp` import and the `312 apps shipping with us` hero stat
2. Remove the customer logo wall section (`const logos = [...]` and its render block)
3. Remove the Acme Banking case study / quote section entirely
4. Remove the `4.21 → 4.58` metric row
5. Remove the `State of App Reviews 2026` report card from the free tools section
6. Remove the entire free tools section (the 4-card grid) — placeholder only until SW3
7. Remove `312 apps tracked · Jan–Apr 2026` attribution line from Pain stats section
8. Remove the `median: 11m · p95: 1h 06m` stat bar in the AI demo section
9. In the integrations row: remove Slack, Linear, Jira, Zapier entries
10. In Incident Detection bullets: remove `Auto-pages your Slack on-call`
11. In Reply Operations bullets: remove `Slack alerts on 1-star + escalation rules`
12. In Sentiment bullets: remove `Linear / Jira ticket creation from any review`
13. Change `Incident detection · generally available` badge text to `Early access`
14. In Pro plan features array: remove `Slack + KB sync`

**File: `src/app/faq/page.tsx`**
15. Fix answer: replace `AI prompts route through Anthropic` with `AI prompts route through Groq (Llama 3.3 70B), with no data retention`
16. Remove the answer that begins `Roughly 30% of customers use us as a read-only signal layer` — replace with: `Some teams use ReviewBox as a read-only signal layer — incident alerts, release health, sentiment trends — and reply directly in App Store Connect or Play Console. That works fine.`

**File: `src/app/blog/page.tsx`**
17. Remove the blog card: `Case study: Acme Banking, 4.21 → 4.58 in 90 days`

**File: `src/app/compare/page.tsx`**
18. In Automation category: change `Slack alerts` for ReviewBox from `true` to `"Coming soon"`
19. In Automation category: change `Zapier / Make` for ReviewBox from `"Coming Q3"` to `false`

**File: `src/app/customers/acme-banking/page.tsx`**
20. Add a banner at the top: `⚠️ This is a simulated demo walkthrough, not a real customer story.` OR delete the page and redirect `/customers/acme-banking` → `/`

**File: `src/app/customers/page.tsx`**
21. Replace the customers page with an early-access waitlist page (see SW1 for copy)

---

### SW1 — Homepage Reposition *(~1 day)*
The design stays. The copy and data sections change. Work section by section.

#### Hero Section
**Current:** Vague "inbox for your app stores" positioning
**New positioning:**

```
Kicker: Early access · Invite only · First 50 teams
H1:     The review inbox that replies, triages,
        and spots regressions — automatically.
Sub:    Built for product teams, not agencies. Connect Google Play or App Store
        in 5 minutes. AI drafts your first reply in 3 seconds.
CTA:    Get early access  →   (primary, #0A84FF)
CTA:    See how it works  →   (secondary, scroll to demo)
```

Remove the `312 apps shipping with us` stat. Replace with a single honest line:
`Used by early-access teams. Invite-only while we get the first 50 right.`

#### Features Section (4 cards)
Keep the card layout. Rewrite bullets to remove fake integrations.

**Card 1 — Review Management**
- Title: `One queue, both stores`
- Body: `Every Google Play and App Store review, every market, sorted by what actually needs your attention.`
- Bullets:
  - `Syncs every 4h automatically`
  - `Priority scoring: crash > billing > feature request`
  - `Filter by version, country, rating, sentiment`

**Card 2 — AI Replies**  
- Title: `AI drafts, not AI slop`
- Body: `Template-matched first, KB-grounded always. Every draft sounds like you — because it references your tone and your product knowledge.`
- Bullets:
  - `~3 seconds end-to-end, including KB lookup`
  - `Rate drafts — the model gets sharper over time`
  - `Publish directly to Google Play and App Store`
- Remove: `Tone trained on your past replies` (not built yet) → replace with `Rate drafts — the model gets sharper over time`

**Card 3 — Incident Detection**
- Title: `Catch regressions in the reviews, not Sentry`
- Body: `ReviewBox correlates every review with its app version. When a crash cluster forms, you get an alert before it bakes into the rating.`
- Bullets:
  - `Crash cluster detection: ≥3 crash mentions, same version, 24h`
  - `Rating spike alert: ≥5 reviews ≤2★, same version, 24h`
  - `Email alert to workspace owner — no integrations required`
- Remove: `Auto-pages your Slack on-call` (Slack not built)

**Card 4 — ASO Intelligence**
- Title: `Close the gap between reviews and your store listing`
- Body: `Your users keep mentioning "budget tab" but it doesn't appear once in your store description. ReviewBox finds those gaps.`
- Bullets:
  - `AI-suggested copy variants for title, subtitle, description`
  - `Keyword tracking: monitor ranks over time`
  - `Best-practice scoring: length, density, prohibited terms`

#### Pain Stats Section
Remove all stats sourced from fake "312 apps" research.
Replace the three stats with three honest product facts:

```
Stat 1: < 5 min     — Time from sign-up to first synced review
Stat 2: ~3 sec      — AI draft generation, template-matched + KB-grounded  
Stat 3: 4h          — Review sync cadence, both stores
```

Small attribution line: `Measured on our own infrastructure · Updated as we ship`

#### AI Demo Section
Keep the demo — it's real and it works. Remove the `median: 11m · p95: 1h 06m · 1★ replied: 94%` stat bar below it. Nothing replaces it — the demo speaks for itself.

#### Integrations Row
Only list what's real and connected today:
- Google Play (publisher API)
- App Store Connect (API)
- Resend (email alerts)
- Supabase (your own infra, skip this one)
- Coming soon label for: Slack, Zapier (don't remove the row, just be honest)

Format: `Google Play · App Store · Email alerts · Slack (coming) · Zapier (coming)`
One line, no logos that imply they're live today.

#### Social Proof Section (replace fake logos + case study)
Replace the entire logo wall + case study with:

```
Heading: Built in public. Launching to 50 teams.

Body: We're not going to show you logos of companies you can't verify.
      We're building this in the open — here's what's real:

Three honest cards:
  Card 1: "Both stores, real data"
          Google Play and App Store sync is live. Your real reviews, your real ratings.
          
  Card 2: "AI drafts that ship"
          The AI demo above is the same model in production. Not a mockup.
          
  Card 3: "We read every reply"
          hello@tryreviewbox.com goes to a real person. We reply same day.

CTA: Get early access — we're accepting the first 50 teams
```

#### Free Tools Section
Remove the 4-card grid entirely for now. In SW3 you'll build one real tool (`/tools/reply`).
After SW3, add back a single card pointing to it.

#### Customers / Case Study Section
Remove entirely. Replace with:

```
Heading: Be one of the first.

Body: We're onboarding 50 teams before we open to everyone.
      You get direct access to the founders, weekly calls if you want them,
      and pricing that locks for life.

CTA: Apply for early access  →  /contact?source=early-access
```

---

### SW2 — Pricing & Compare *(~3 hours)*

#### Pricing Page (`/pricing`)
**Simplify to 2 plans.** Team plan complexity is not needed for your target.

| | Starter | Pro |
|---|---|---|
| **Price** | $79/mo | $149/mo |
| **Apps** | 2 apps | Up to 8 apps |
| **Reviews** | 10K/mo | 100K/mo |
| **AI Drafts** | 50/day | 300/day |
| **Stores** | Google Play | Both stores |
| **Seats** | 2 | 10 |
| **Knowledge Base** | — | ✓ |
| **Sentiment clusters** | — | ✓ |
| **Release health** | — | ✓ |
| **ASO module** | — | ✓ |
| **Crash detection** | ✓ | ✓ |
| **Email alerts** | ✓ | ✓ |
| **Automation rules** | — | ✓ |

**Remove from pricing page:**
- Team plan card
- `Zapier / Make integration` row (not built)
- `Webhook output` row (not built for Pro)
- `SSO` row (not built)
- `Dedicated CSM` (nobody to staff it)
- `Slack alerts` row (not built)

**Add below plans:**
```
Need more than 8 apps or a custom contract? → hello@tryreviewbox.com
```

**Trial language:** `14-day free trial. No credit card. Cancel any time with one click.`

#### Compare Page (`/compare`)
Fix these specific rows:

| Row | Current (wrong) | Fix |
|---|---|---|
| Slack alerts | ✓ (ReviewBox) | "Coming soon" |
| Zapier / Make | "Coming Q3" | — (remove or "Coming soon") |
| Auto-publish rules | ✓ | "Pro plan" (be specific) |
| SLA dashboard | ✓ | Remove row entirely (you don't have this, don't want it) |

Keep everything else — the honest advantages are real:
- Template matching (zero tokens) ✓
- Reply cache ✓
- Crash cluster detection ✓
- ASO keyword suggestions ✓
- Automation rule builder ✓
- GDPR self-serve export ✓

---

### SW3 — One Real Free Tool *(~1 day)*

The AI reply demo on the homepage already works. Extract it into a standalone page.

**New page: `/tools/reply`**

```
Title:  AI Reply Generator — Free, no sign-up
Meta:   Generate a professional reply to any app store review in 3 seconds.
        Powered by ReviewBox. Free forever.

Layout:
  - Paste or type a review (textarea, max 500 chars)
  - Select tone: Professional / Empathetic / Concise
  - Hit Generate
  - Shows draft, Copy button, "Sign up to reply directly from ReviewBox" CTA

Backend: POST /api/demo/reply (already exists)
Rate limit: 5 requests per IP per hour (Upstash — already wired)
No sign-up required.
```

**After SW3:** Add one card to the homepage where the free tools section was:
```
Free tool → AI Reply Generator
Paste any review. Get a reply in 3 seconds. No sign-up, no card.
[Try it free →]
```

This is your best acquisition driver. Someone Googles "app store review reply template", lands here, generates a reply, and sees ReviewBox is what produces it.

---

### SW4 — Supporting Pages Cleanup *(~2 hours)*

**`/about`** — Good as-is. One change: the founder team section says "San Francisco and London" — make sure this matches reality.

**`/faq`** — Already handled in SW0 (Groq fix, 30% stat fix). No other changes needed.

**`/blog`** — Remove the Acme Banking card (SW0). The other posts are good:
- "How we reduced AI reply costs by 94%" → real, ship it
- "The app store reply playbook" → good SEO content
- "Rating spikes: how to detect them" → good SEO content
- "Why your App Store rating is lower than Google Play" → good SEO content

Consider writing one real post before launch: `"We're building ReviewBox in public. Here's what's real."`
This is your trust anchor. Link to it from the homepage social proof section.

**`/changelog`** — Excellent as-is. The work reflected (v1.0–v1.4) matches real shipped features. Keep it.

**`/customers`** — Replace entirely with early access page:
```
Heading: Early access is open.
Body:    We're onboarding 50 teams before general availability.
         You get direct access to the founders, a locked lifetime price,
         and the chance to shape what we build next.
Form:    Name · Email · Company · "What's your biggest review ops problem?"
CTA:     Apply for early access
```
Wire the form to send to `hello@tryreviewbox.com` via Resend — same email client already wired.

**`/customers/acme-banking`** — Two options:
- **Option A (fast):** Delete the route, add redirect in `next.config.js` → `/`
- **Option B (safer):** Add a top banner: `This is a simulated product walkthrough, not a verified customer story.` and rename the page title to "Product Demo: What ReviewBox looks like for a fintech team"

Recommendation: **Option A**. The page creates trust risk if a real prospect verifies it.

---

### SW5 — Pre-Launch Checklist *(~1 hour)*

Before calling the website done, verify:

- [ ] No mention of "312" anywhere on the site (`grep -r "312" src/app --include="*.tsx"`)
- [ ] No mention of "Acme Banking" except optionally gated `/customers/acme-banking` with disclaimer
- [ ] No "Anthropic" in any user-facing copy (use "Groq")
- [ ] No "Slack" in feature lists unless marked "coming soon"
- [ ] No "Linear" or "Jira" in feature lists
- [ ] No customer logos that don't represent real paying customers
- [ ] `/tools/reply` resolves and works end-to-end
- [ ] `/customers` shows early access page, not fake logo wall
- [ ] Pricing page shows 2 plans (not 3), no Zapier/SSO/CSM rows
- [ ] Compare page Slack row shows "Coming soon"
- [ ] All CTA buttons pointing to `/sign-up` work through Clerk
- [ ] `hello@tryreviewbox.com` is verified in Resend and receives test email
- [ ] Run `npm run build` — zero type errors
- [ ] Run `npm run lint` — zero lint errors
- [ ] Open Graph image renders correctly (check `/opengraph-image`)
- [ ] Mobile layout — test homepage on 375px width

---

## Positioning vs AppFollow — Quick Reference for Copy

Use this when writing any feature copy. Your genuine advantages:

| Claim | Evidence | Use in |
|---|---|---|
| AI is built in, not bolted on | Groq + KB + template pipeline from day 1 | Hero, features, compare |
| Connects in under 5 minutes | Self-serve, no sales call required | Hero, pricing, compare |
| Publishes directly to both stores | Reply API wired for Play + App Store | Features, FAQ |
| Catches crashes before Sentry fires | Crash cluster detection on every sync | Incident Detection feature |
| Closes the loop between reviews and ASO | Only tool that does this | ASO feature, compare |
| Priced for product teams, not agencies | $79 vs AppFollow $199+ | Pricing, compare, hero |

What you do NOT claim until it's true:
- Slack/Linear/Jira/Zapier integrations
- Real customer results or logos  
- SOC 2 certification (only "in progress · Q3 target")
- "Real-time" sync (it's every 4 hours)

---

## File Change Summary for Claude Code

```
MODIFY  src/app/page.tsx                    — major copy rewrite (SW0 + SW1)
MODIFY  src/app/pricing/page.tsx            — 2 plans, remove fake features (SW2)
MODIFY  src/app/compare/page.tsx            — fix Slack/Zapier rows (SW2)
MODIFY  src/app/faq/page.tsx                — fix Groq/Anthropic, remove 30% stat (SW0)
MODIFY  src/app/blog/page.tsx               — remove Acme Banking card (SW0)
MODIFY  src/app/customers/page.tsx          — early access page (SW4)
DELETE  src/app/customers/acme-banking/     — or add disclaimer banner (SW0)
CREATE  src/app/tools/reply/page.tsx        — free tool, no sign-up (SW3)
MODIFY  next.config.js                      — redirect /customers/acme-banking → / (SW0)
```

---

## What "Done" Looks Like

A technical founder lands on the homepage. They see:

1. An honest early-access framing — no fake "312 apps"
2. A working AI demo that generates a real reply in 3 seconds
3. Four features that are actually built
4. $79/$149 pricing, no surprises
5. A compare page where every ReviewBox ✓ is actually true
6. A free tool at `/tools/reply` that works without signing up

They sign up. They connect Google Play. They see their real reviews in under 5 minutes.
That's the bar.

---

*Last updated: 2026-05-19 · Active sprint: Website Reposition*
*Companion docs: `docs/LAUNCH_PLAN.md` · `docs/ZERO_COST_PLAN.md`*
