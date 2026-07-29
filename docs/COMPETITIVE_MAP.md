# Competitive map — the category's feature surface vs ours

**Purpose:** decide what to build, what to improve, and — most valuably —
what to **refuse to build**. Feature-parity chasing is how a half-working
product stays half-working; this map exists to make the "no" decisions
explicit and defensible.

**Method:** the capability list below is derived from AppFollow's public
marketing and support-centre article titles (sources at the bottom). It
records *facts about what the category offers*, written in our own words —
no competitor documentation is copied into this repo. Their direct pages
return 403 to automated fetches, so this was assembled from search results
and should be refreshed by hand when it matters.

**Reading rule:** AppFollow sells to enterprise mobile teams with dedicated
support staff at ~$399/mo. We sell to solo founders and small teams at $49
(`docs/PRODUCT_CONTEXT.md`). A feature that is essential for them can be
noise for us, and vice versa. Judge every row against **our** ICP.

---

## The map

Status: ✅ have · 🟡 partial · ❌ missing · 🚫 deliberately not building

### Core loop — review management

| Capability | Them | Us | Verdict |
|---|---|---|---|
| Aggregate reviews from App Store + Google Play | ✅ | 🟡 works, but only via public scrape unless Play Console is connected | **Our #1 risk, not a feature gap** — see audit finding A8 |
| Unified inbox with filters | ✅ | ✅ | Parity |
| Reply from the tool, posted to the store | ✅ | ✅ both stores | Parity |
| Reply templates | ✅ | ✅ Reply Kit | Parity |
| **Bulk reply** (one agent, thousands of reviews) | ✅ | ❌ | **Build** — a solo founder needs leverage more than an enterprise team does |
| Manual tags | ✅ | 🟡 issue tags are auto-derived; user can't create their own | Improve |
| Auto-tag rules (text, rating, language, length, sentiment) | ✅ | 🟡 rules engine tags automatically; no user-editable conditions | Improve |
| Featured/highlighted reviews | ✅ | ❌ | Low value for us |

### Intelligence

| Capability | Them | Us | Verdict |
|---|---|---|---|
| Sentiment analysis | ✅ | ✅ Gemini + zero-token rules fallback | Parity |
| Semantic/topic clustering | ✅ | 🟡 local transformers, thin | Improve |
| AI-generated reply drafts | ✅ (OpenAI) | ✅ (Groq, 3-tier with cache) | Parity — cheaper |
| AI period summary of sentiment | ✅ | ✅ AI summary panel | Parity |
| **Auto-translate reviews + reply in any language** | ✅ | ❌ **English only** | **Build — highest-value gap for us** (see below) |

### Automation & alerts

| Capability | Them | Us | Verdict |
|---|---|---|---|
| Rule builder | ✅ Automation Hub | ✅ | Parity |
| Auto-reply on rule match | ✅ | ✅ opt-in | Parity |
| Offensive-review reporting workflow | ✅ | ❌ | Later |
| Rating-spike / negative alerts | ✅ | ✅ email + Slack | Parity |
| Unreplied-review reminders | ✅ | ✅ daily cron | Parity |

### Insight & growth

| Capability | Them | Us | Verdict |
|---|---|---|---|
| Competitor review tracking | ✅ | 🟡 table shipped (migration 016), thin UI | Improve |
| ASO keyword research + traffic channels | ✅ (deep) | 🟡 keyword tracker + AI suggestions | 🚫 **Do not chase** — that is AppTweak's product, not ours |
| Release/version health | ✅ | ✅ | Parity |
| Exports & scheduled reports | ✅ | ✅ CSV + weekly digest | Parity |

### Team & enterprise

| Capability | Them | Us | Verdict |
|---|---|---|---|
| Multi-app workspaces | ✅ | ✅ (untested at scale) | Verify |
| User roles & permissions | ✅ | 🟡 enforced in 6 of 67 routes (`docs/ROLE_AUDIT.md`) | Fix before selling Team plan |
| **Agent performance dashboards** | ✅ | ❌ | 🚫 **Never** — our buyer IS the agent; measuring a team of one is theatre |
| Zendesk / Helpshift / Salesforce / Tableau | ✅ | ❌ | 🚫 for now — enterprise plumbing; revisit only if a paying customer asks |
| Slack | ✅ | ✅ | Parity |
| Webhooks / public API | ✅ | ❌ | Later (backlog S4.2) |

---

## What this map actually tells us

**1. We are not behind on features. We are behind on the core loop.**
Nearly every row is parity or better. The one that matters —
"reviews reliably arrive" — is 🟡, and every hour it stays 🟡 the rest of the
table is worth nothing. **Do not start any row below until the sync is proven
against the fixture apps.**

**2. The most valuable gap is invisible in a feature comparison: language.**
AppFollow translates reviews and replies in any language. We are English-only
(a tagged assumption in `src/services/bootstrap-reviews.ts`). For AppFollow's
US/EU enterprise buyer that is a convenience. For **our** ICP — India-first,
apps whose reviews arrive in Hindi, Marathi, Tamil — it is the difference
between a product that works and one that shows a fraction of the feedback
and drafts replies in the wrong language. It never appears as a "missing
feature" because the row exists on both sides; only the ICP reveals it.
That is the same blind spot as the Mumbai One storefront bug, one layer up.

**3. Three things we should explicitly refuse.** Deep ASO (a different
product), agent-performance analytics (our buyer is the only agent), and
enterprise BI/helpdesk connectors (wrong buyer). Saying no here is what keeps
$49/mo viable against a $399/mo competitor — every one of those features
would be built for a customer we do not have.

## Proposed order (once the core loop is proven)

| # | Item | Why it beats the alternatives for OUR customer |
|---|---|---|
| 1 | Multi-language reviews + replies | Unlocks the actual market we sell into |
| 2 | Bulk reply + user-editable tag rules | Leverage for a team of one |
| 3 | Role enforcement | Required before the Team plan can honestly be sold |
| 4 | Competitor screen on real data | Cheap; already has its table |

Added to `docs/backlog.md` with ICE scores as **CM1–CM4**.

## Sources

- [AppFollow — product overview](https://appfollow.io/)
- [Automation Hub](https://support.appfollow.io/hc/en-us/articles/360020979098-Automation-Hub)
- [Auto-tag conditions](https://support.appfollow.io/hc/en-us/articles/4403385795857-Auto-tag-Conditions)
- [Tags](https://support.appfollow.io/hc/en-us/articles/360020979178-Tags)
- [Reviews & Replies category](https://support.appfollow.io/hc/en-us/categories/360003758678)
- [Home Hub](https://support.appfollow.io/hc/en-us/articles/4416118653585-Home-Hub)
- [Agent Performance](https://support.appfollow.io/hc/en-us/articles/360020979678-Agent-Performance)
- [Semantic analysis explainer](https://appfollow.io/reviews-management-academy/automation-of-collecting-insights-through-reviews-semantic-analysis-and-auto-tagging)

_Refreshed: 2026-07-29. Re-verify before using it to justify a build decision._
