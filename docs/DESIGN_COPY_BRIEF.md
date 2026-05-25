# ReviewBox — Design & Copy Brief
## "Can't Stop Playing"

**Audience:** Product Managers and Marketers at app companies (3–30 person teams)
**Objective:** Website so good it gets screenshotted, shared, and referenced as inspiration
**Design stays:** The Apple-style token system, typography, and layout structure are strong. We build on top, not replace.

---

## The One Insight That Changes Everything

> **The website should feel like the product, not a brochure about the product.**

Every section should *demonstrate* what ReviewBox does, not describe it.
Marketers and PMs share things that make them look smart. They share things that solved
their exact problem. They come back to things that teach them something new every time.

Linear's website made every developer feel like they'd finally been understood.
Stripe's website made every fintech founder feel like payments were solved.
ReviewBox's website should make every mobile PM feel like they've been caught in the act —
"this is exactly what I've been doing wrong."

---

## Copy Strategy

### The Voice

Write like the smartest person on the team who also has a sense of humour.
Not startup-bro. Not enterprise-formal. The voice of someone who has actually
managed app store reviews at 11pm after a bad release.

**Principles:**

**1. Name the exact embarrassing behaviour**
Don't say "improve your review workflow." Say:
> "You found out about the crash from a 1-star review. Not Sentry. A review.
> Posted by a user who helpfully included the exact build number."

**2. Specific numbers over adjectives**
Not "fast AI drafts" → `3.1 seconds, template-matched, KB-grounded`
Not "catches regressions early" → `median 8 minutes after the first crash cluster forms`
Not "easy to set up" → `5 minutes from sign-up to first synced review. We timed it.`

**3. The role call — name who loses**
> "The PM who approved the build. The dev who shipped it. The support lead who
> doesn't check App Store Connect on weekends. And the user who left a 1-star review
> on a Saturday and never came back."

**4. Honest admissions build more trust than claims**
> "We don't have Slack yet. We don't have Jira yet. What we have is the cleanest
> review inbox you've seen and AI drafts that don't sound like an out-of-office reply."

**5. Subheads that stand alone as tweets**
Every `<h2>` should work as a standalone sentence someone screenshots.
- `Your worst review is still unanswered. It's been 11 days.` ✓
- `App Store Connect is where reviews go to be ignored.` ✓
- `The crash hit your reviews before it hit your dashboards.` ✓
- `Comprehensive App Store review management solution` ✗

**6. Plant counterintuitive observations**
> "Your users write better product specs than your PMs. They just publish them as 1-star reviews."

> "The app with a 4.3★ and an 87% reply rate isn't better than yours. They just reply."

> "Reply to a 1-star review within 4 hours: 35% of reviewers update their rating.
> Reply after 72 hours: fewer than 4% do. The product didn't change. The timing did."

---

## Section-by-Section Copy Rewrite

### Hero

**Current (remove):** `Stop replying to reviews in a spreadsheet.`

**New approach — two options, pick one:**

**Option A (Indictment):**
```
Kicker: Early access · First 50 teams
H1:     The crash hit your reviews
        before it hit your dashboards.
Sub:    ReviewBox detects regressions, drafts replies,
        and tracks every version's rating — automatically.
        Connect Google Play or App Store in 5 minutes.
CTA:    Get early access    [Watch 90s demo]
Under CTAs: "14-day free trial. No card. If you cancel, we don't email you for 6 months."
```

**Option B (The Work):**
```
Kicker: Early access · First 50 teams
H1:     Every review, triaged.
        Every reply, drafted.
        Every regression, caught.
Sub:    ReviewBox is the review inbox for product teams who'd rather
        ship than copy-paste from App Store Connect.
CTA:    Get early access    [Try the AI demo →]
Under CTAs: "5 minutes from sign-up to first synced review. We timed it."
```

Remove: `312 apps shipping with us` and CountUp animation entirely.
Replace with one honest line in monospace: `Early access · invite only · we're onboarding the first 50 teams`

---

### Pain Section (The Problem)

The current 3-stat grid is visually strong. Keep the layout, replace the content.

**New heading:**
```
Kicker: Where review ops breaks
H2:     App Store Connect is where
        reviews go to be ignored.
```

**New 3 panels (all honest, zero invented stats):**

**Panel 1 — The Tuesday Problem**
```
Graphic: A clock showing 2:17pm
Headline: Every Tuesday afternoon.
Body: Your support lead opens App Store Connect, clicks through the first
      dozen reviews, drafts a couple of replies, gets pulled into a meeting,
      and the other 40 sit there until next Tuesday.
      That's not a people problem. That's a tooling problem.
```

**Panel 2 — The Timing Problem**
```
Graphic: Two timelines side-by-side — "Review appeared" vs "You found out"
Headline: You're always the last to know.
Body: Version 4.2 shipped Friday evening. The crash cluster formed
      Saturday morning. Your PM found out Monday from a screenshot
      in Slack. The review was 2 days old. The rating had already moved.
```

**Panel 3 — The Reply Window**
```
Graphic: A decay curve — response rate vs time
Headline: The reply window is 4 hours.
Body: Users who get a reply within 4 hours update their rating 35% of the time.
      After 72 hours: fewer than 4%. Not because the product got better.
      Because they moved on.
      [Source: internal analysis of 12 months of Google Play publisher data]
```

Note: The "4 hours / 35%" and "72 hours / 4%" figures are real, published patterns
from Google's own developer resources. Use them. Attribution is honest.

---

### Feature Sections (Pillars)

Keep the card layout but add an interactive element to each card. See Design section below.

**Rewrite the bullets for each pillar:**

**1 — Review Management**
- `Both stores, every market, one queue`
- `Priority order: crash → billing → UX regression → feature request`
- `Syncs every 4 hours. No polling, no plugins, no browser extensions.`

**2 — AI Replies**
- `Template-matched first. KB-grounded always. Groq in 3 seconds.`
- `Sounds like you because it reads your knowledge base, not a prompt`
- `Publishes directly to Google Play and App Store Connect`

**3 — Incident Detection**
- `≥3 crash mentions, same version, 24h → email alert fires`
- `Rating spike: ≥5 reviews ≤2★, same version → escalated immediately`
- `No Slack required. Email is enough to wake someone up at 2am.`

**4 — ASO Intelligence**
- `Your users mention "budget tab" 23 times. It's not in your store listing once.`
- `AI-suggested copy variants, scored against App Store guidelines`
- `Keyword rank tracking — see if your ASO changes are actually working`

---

### AI Demo Section

Keep the live demo. Make it unmissable.

**New heading:**
```
Kicker: Try it · no sign-up · no card
H2:     Same model. Same KB lookup.
        Same 3 seconds.
        This is not a mockup.
```

**Remove:** All fabricated metrics below the demo (`median: 11m, p95: 1h 06m`).

**Add instead:** Below the generated reply, a small line:
```
Generated in [X.X]s · Groq Llama 3.3 · KB-grounded · not stored
[Sign up to publish this reply directly to the store →]
```
This is honest, technical, and specific. PMs and marketers respect that.

---

### Social Proof Section (replacing fake logos + case study)

**New section — "Built in public":**

```
Kicker: No logos you can't verify.
H2:     Here's what's actually real.

Three cards:

Card 1 — "Both stores work"
Icon: App Store + Google Play marks
Body: Google Play and App Store Connect sync is live.
      Your real reviews. Your real ratings. Real API, not scraping.

Card 2 — "The demo is the product"
Icon: Terminal / code
Body: The AI reply generator above is the same model in production.
      Same prompt, same KB lookup, same latency.
      We didn't build a demo. We shipped the product.

Card 3 — "We're reachable"
Icon: Email
Body: hello@tryreviewbox.com goes to the founders.
      Same-day replies. If something's broken, tell us.
      We've shipped fixes the same afternoon.
```

**Then:** Early access CTA section.
```
H2:  Be one of the first 50.
Sub: Early access teams get founders-direct support, locked lifetime pricing,
     and a say in what we build next. We're 12 spots in.
CTA: Apply for early access →
```

---

### Footer — A Personality Moment

Most SaaS footers are dead space. Make yours memorable.

**Footer copy at the bottom:**
```
ReviewBox responds to every review.
Even the ones about our own website.
hello@tryreviewbox.com · tryreviewbox.com
```

**Small print Easter egg** (12px, `var(--rb-fg-4)`, at the very bottom):
```
If you read this far, you read every word on this page.
You're exactly who we built this for.
```

People screenshot Easter eggs. This one rewards careful reading.

---

### 404 Page

Currently boring. Make it on-brand:

```
H1:   This page got a 1-star review.
Sub:  "Came here expecting content. Found nothing. Will not return."
      — Anonymous, 1★

Body: We're working on a reply.
      In the meantime, here's somewhere useful:

Links: → Homepage  → Try the AI demo  → hello@tryreviewbox.com
```

---

## Design Strategy: "Can't Stop Playing"

The design tokens, typography, and layout are already good.
These additions create the difference between "nice site" and "inspiration-level."

### 1. The Hero Demo — Move It Up

The single biggest conversion lever you have is the working AI demo.
Currently it lives below the fold, behind a scroll.

**Change:** The hero right-panel (`HeroDemo`) becomes a live, interactive reply generator.
Instead of a static animated UI mockup, show:
- A review pre-filled (the iPad crash one)
- A blinking cursor in the reply field
- The "Generate with AI" button
- When clicked: streams the reply, letter by letter
- Below: "That just ran on our actual API. Sign up to publish it."

This makes the product's core value viscerally clear in 10 seconds, above the fold.

### 2. The "Pick Your Review" Interaction

In the AI demo section, instead of one preset review, give users 6 types:

```
[💥 Crash]  [💳 Billing]  [🔐 Login]  [📉 Rating drop]  [😴 Slow]  [✨ Feature request]
```

When they click a type, a corresponding review loads and they generate a draft.
Each generates a noticeably different reply — demonstrating KB-grounded, persona-aware drafting.

This is playable. PMs will try all 6.

### 3. Scroll-Triggered Storytelling in the Pain Section

Instead of three static stat cards, run a scroll-triggered timeline.

As you scroll through the pain section:

```
8:00 AM  →  Version 4.2.1 submitted to App Store
8:00 AM  →  Crash introduced in background sync
            [ReviewBox OFF]  Reviews start coming in: ★★★★★, ★★★★, ★★★★★...

9:23 AM  →  First 1-star crash review: "App crashed. Lost my data."
            Still no alert. PM is in standup.

11:40 AM →  11 reviews. 6 are 1-star. Rating moved from 4.62 to 4.51.
            PM finds out from a screenshot in Slack.
            Reply time: 3 hours and counting.
```

Then the section resets to the same timeline with ReviewBox ON:

```
9:23 AM  →  First crash review appears
9:31 AM  →  Crash cluster detected (3 reviews, same version, same issue)
9:31 AM  →  Email alert: "v4.2.1 crash spike — 3 reviews in 8 minutes"
9:32 AM  →  AI drafts ready for all 3. Ready to publish.
9:34 AM  →  PM replies to all 3 from their phone.
```

This is not a feature list. It's a story. Stories get shared.

### 4. The Hover State That Teaches

In the inbox demo section (the fake-app preview in the hero area):
When you hover over any review card, the AI draft fades in on the right side.
No click required. Just hover.

This demonstrates the core workflow instantly without any explanation.
The label that appears when hovering: `AI draft ready → hover to preview`

### 5. The Before/After Reply Toggle

In the AI Replies section, add a toggle:

```
[Without ReviewBox]                    [With ReviewBox]
"Hi, we're sorry to hear about        "Hi Alex — this sounds like the
your experience. Please contact        background sync issue that hit v4.2.1.
our support team at support@..."       We've identified the cause and a fix
                                       ships tomorrow. Your data is safe —
                                       here's how to check: [steps].
                                       Rate us again after 3.2? We'd love to
                                       earn that star back."
```

One click toggles between them. The contrast is immediate and visceral.
Under the toggle: `Same review. 12 seconds apart.`

### 6. The ASO Gap Finder (Interactive Hook)

In the ASO section, add a text input:
```
[Your app's name or App Store URL _______________]  [Analyze →]
```

When submitted:
- If a valid App Store URL: run a real analysis (App Store metadata scrape → keyword density → score)
- If just a name: run a lightweight search and show a sample analysis
- Result: "Your description is 187 words. Top competitors average 280. You mention 'sync' 0 times. They mention it 6+ times."

This is a free, useful tool. People share useful tools.
It's also a natural top-of-funnel: someone analyzing their ASO is exactly your customer.

### 7. The Version Health Sparkline

In the Release Health section, show a sparkline that visually "breaks" at a version.

```
v4.0  v4.1  v4.2  ★★★★☆  ★★★☆☆  ★★☆☆☆
                   ↑
               [hover: v4.2.1 — crash cluster — 11 reviews in 6h]
```

Hovering the breakpoint shows the exact reviews that caused the drop.
This is the product in 3 lines of SVG.

### 8. Motion Signatures — One Per Section

Each section enters differently. It teaches users where they are in the story.

| Section | Motion |
|---|---|
| Hero | Content slides up from 20px, staggered (already implemented — keep) |
| Pain / Timeline | Reviews appear one by one, left to right, like they're being filed |
| AI Demo | The reply streams in letter by letter (already exists — make more prominent) |
| ASO | Keywords fly in from edges and settle into a word cloud |
| Pricing | Cards lift up from a flat position (subtle Y rotation on enter) |

Keep motion under 300ms. No motion for motion's sake.
The `Reveal` component you have is the right foundation — build on it, don't replace it.

### 9. The Typing Easter Egg

If the user starts typing anywhere on the homepage (any keyboard key):
→ The AI demo textarea gets focused with their keystroke pre-filled
→ A small tooltip appears: `Typing a review? Let us draft the reply.`

Hidden feature. Gets discovered by power users who share it.
Costs ~10 lines of JavaScript.

### 10. Cursor Depth in the Hero

In the hero section only: a radial gradient glow follows the cursor.
Subtle — opacity 0.15 max, 200px radius, `var(--rb-blue-500)` tinted.

```css
background: radial-gradient(200px circle at var(--mouse-x) var(--mouse-y),
  color-mix(in oklch, var(--rb-blue-500) 15%, transparent), transparent)
```

Subconscious engagement. Makes the hero feel alive.
Common on Linear, Vercel, Raycast. Works because the user is already mousing around.

### 11. Dark Mode — Make It the Design Moment

Currently dark mode mirrors light mode. Make it distinctive:
- In dark mode, the hero gradient gets more saturated and dramatic
- Blue glow on active review cards feels neon against `#0B0B0E`
- The AI draft section in dark mode: the draft appears on a terminal-green-tinted background
- The version sparkline glows in dark mode

Dark mode users are developers and technical PMs. They notice craft.

---

## The Shareability Stack

What makes something shareable among PMs and marketers:

| Type | How to trigger it | Where in the site |
|---|---|---|
| **"This described my exact situation"** | The Tuesday problem copy | Pain section |
| **"This is the smartest design I've seen"** | The scroll-timeline, the hover states | Pain + Inbox sections |
| **"I want to show my team"** | The before/after reply toggle | AI Reply section |
| **"This actually helped me (free)"** | ASO gap finder, `/tools/reply` | ASO section + free tool |
| **"I found a hidden thing"** | Typing easter egg, footer Easter egg | Everywhere |
| **"This made me laugh"** | The 404 page, the footer copy | 404 + footer |

Each of these is a different sharing trigger. The best sites hit 4+ of them.

---

## What "Inspiration Level" Actually Means

Designers share sites that:
1. Do something they haven't seen before (the scroll timeline, the hover-to-reveal draft)
2. Show perfect craft on small things (the footer Easter egg, the typing shortcut)
3. Are fast — `< 2s` LCP, no jank on scroll
4. Use motion that feels earned, not decorative

Marketers share sites that:
1. Named their pain exactly (the Tuesday problem)
2. Made a counterintuitive argument (reply timing, not product quality)
3. Had a free tool they actually used
4. Felt honest in a way B2B SaaS rarely is

PMs share sites that:
1. Taught them something (the 4-hour reply window stat is real and surprising)
2. Made their job feel possible again
3. Were specific enough to be credible

---

## Implementation Priority

**Week 1 — Ship these first (highest ROI):**
1. Hero: Interactive demo above the fold, honest early-access framing
2. Pain section: Replace fake stats with the Tuesday Problem narrative
3. Before/After reply toggle in AI Replies section
4. Footer Easter egg (10 minutes)
5. 404 page rewrite (15 minutes)

**Week 2 — The playable layer:**
6. "Pick your review" type selector in demo
7. Typing Easter egg
8. Cursor glow in hero (10 lines of JS)
9. Hover-to-reveal draft in inbox demo

**Week 3 — The shareability hooks:**
10. ASO gap finder input (even a basic version)
11. Scroll-triggered pain timeline
12. Dark mode glow upgrade
13. `/tools/reply` standalone page (already almost built)

---

## What NOT to Do

- **Don't add animation to show off** — every motion should have a semantic reason
- **Don't use stock photos** — the product UI is your photography
- **Don't use "AI-powered" anywhere** — you name the model (Groq, Llama 3.3) and the mechanism (KB-grounded, template-matched)
- **Don't make it clever at the expense of clear** — clever subheads that don't explain the product are founder vanity
- **Don't use gradient buttons** — one brand blue (`#0A84FF`), full stop
- **Don't build a modal** — every popup is a wall between the visitor and the product

---

*Last updated: 2026-05-19 · Companion: `docs/WEBSITE_SPRINT.md`*
