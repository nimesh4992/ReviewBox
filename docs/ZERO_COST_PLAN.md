# Revi — Zero-Cost Survival Plan
> Run the entire product for $0/month until $1K MRR. Then spend <5% of revenue on infra forever.
> Last updated: 2026-05-10

---

## The only rule

**Do not pay for anything until a customer pays you first.**

Every tool below has a free tier that covers 0–20 customers.
The moment revenue > $500/month, infra costs are still <$30/month.

---

## Complete free stack

| Service | What it does | Free limit | Breaks at | Monthly cost |
|---|---|---|---|---|
| **Vercel** | Hosting, API routes, middleware | 100GB bandwidth, 3.2M fn invocations | ~500 customers | $0 |
| **Supabase** | DB, auth, Edge Functions, pg_cron, pgvector, realtime | 500MB DB, 50K edge fn calls, unlimited auth users | ~50K reviews stored | $0 |
| **Clerk** | Auth, org management, Google OAuth | 5,000 MAU | 5,000 users | $0 |
| **Resend** | Transactional email (alerts, welcome) | 3,000 emails/month | ~300 customers getting 10 alerts/month | $0 |
| **PostHog** | Analytics, session replay, feature flags | 1M events/month | ~1,000 customers | $0 |
| **Sentry** | Error monitoring | 5,000 errors/month | Never (healthy app) | $0 |
| **Groq** | AI draft generation (Llama 3.3 70B) | 6,000 req/day, 500K tokens/day | ~200 active users | $0 |
| **@xenova/transformers** | Local ML (semantic tags, sentiment, clusters) | Unlimited | Never — runs on your server | $0 |
| **Upstash Redis** | Rate limiting | 10,000 commands/day | ~100 customers hammering AI | $0 |
| **GitHub Actions** | CI/CD, any extra cron triggers | 2,000 min/month | Never for a small project | $0 |
| **Cloudflare** | DNS, DDoS protection | Unlimited | Never | $0 |
| **Domain** | yourdomain.com | — | — | ~$1/month |
| **TOTAL** | | | | **~$1/month** |

---

## The AI cost problem — solved permanently

### Why Groq is right for phase 1

AppFollow uses proprietary ML. We use Groq's free Llama 3.3 70B.
Quality difference for reply drafts: minimal. Cost difference: $0 vs $0.001/call.

```
Groq free tier: 6,000 requests/day
20 customers × avg 10 review drafts/day = 200 calls/day
Headroom remaining: 5,800 calls/day
You hit the limit at ~600 active customers — well past $1K MRR
```

### The 3-layer system (most calls never reach Groq)

```
Review needs a reply
       │
       ▼
Layer 1: Template match (regex)          FREE, <1ms
  5★ review → "Thank you" template        Covers 60% of reviews
  crash + 1★ → crash template
  feature request → feature template
       │ no match
       ▼
Layer 2: Similarity search (pgvector)    FREE, ~10ms
  Find approved reply to similar review   Covers 25% of remaining
  Cosine distance < 0.15 → suggest it     Gets smarter over time
       │ no similar found
       ▼
Layer 3: Groq Llama 3.3 70B              FREE (within limits)
  Novel review, no template               Covers ~15% of reviews
  Rate-limited per user per day
```

**Effective cost: 15% of reviews hit Groq. Still free.**

### The upgrade trigger

| MRR | AI provider | Monthly AI cost |
|---|---|---|
| $0 – $1K | Groq free tier | $0 |
| $1K – $5K | Claude Haiku 3.5 + prompt caching | ~$5–25 |
| $5K+ | Claude Haiku (bulk) + Groq as fallback | ~$25–75 |

Switch to Claude Haiku the week revenue exceeds $1K MRR. Not before.

---

## Anti-exploitation — hard limits

Never let a single user burn your free quotas.

### Per-user daily AI limits (enforced in Supabase)

```sql
create table ai_usage (
  workspace_id  uuid references workspaces(id),
  date          date not null,
  draft_count   int default 0,
  primary key (workspace_id, date)
);
```

```ts
// Enforced before every Groq call
const PLAN_LIMITS = {
  trial:   3,   // 3 AI drafts/day during trial
  starter: 10,  // 10 AI drafts/day
  pro:     50,  // 50 AI drafts/day
  team:    200, // 200 AI drafts/day
};
```

### Rate limiting per IP (Upstash Redis — free)

```ts
// src/lib/rate-limit.ts
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 req/min per IP
});
```

### Honeypot detection

```ts
// Flag abuse patterns
if (draftCountThisHour > 20) {
  await flagWorkspaceForReview(workspaceId);
  throw new Error("Rate limit exceeded");
}
```

---

## AppFollow feature parity — what we build and when

### Phase 1: Launch (weeks 1–4, $0 cost)

These cover the core product loop. No AppFollow subscription needed.

| Feature | AppFollow tier | Our cost | Build week |
|---|---|---|---|
| Review feed with filters | Basic | $0 | ✅ Done |
| Sentiment color coding | Paid add-on | $0 (local ML) | ✅ Done |
| AI reply draft (inline) | Pro | $0 (Groq) | Week 3 |
| Reply submission to Google Play | Pro | $0 (Play API) | Week 3 |
| Email alerts on urgent reviews | Pro | $0 (Resend) | Week 3 |
| Template library | Pro | $0 | Week 3 |
| Stats strip with deltas | Basic | $0 | Week 2 |
| Platform health dashboard | Basic | $0 | ✅ Done |
| Connected apps (1 app) | Basic | $0 | Week 2 |

### Phase 2: Retention features (months 2–3, still $0)

| Feature | AppFollow tier | Our cost | Why it matters |
|---|---|---|---|
| Semantic auto-tagging (ML) | Paid add-on ($$$) | $0 (xenova) | Differentiator — we give free what they charge for |
| Sentiment score 0–100 | Paid add-on | $0 (xenova) | Replaces star rating as health indicator |
| Topic clustering | Paid add-on | $0 (xenova + ml-kmeans) | "21 reviews about payments" → actionable |
| Sentiment trend chart | Pro | $0 (pgvector aggregation) | Shows improvement over time |
| Automation rules (basic) | Pro | $0 (Supabase rule engine) | First competitive moat |
| Slack alerts | Pro | $0 (Slack webhooks) | Reduces email noise |
| Reply templates CRUD | Pro | $0 | Improves reply speed |
| AI reply styles (tone config) | Pro | $0 (Groq prompt param) | Brand voice consistency |

### Phase 3: Power features (months 4–6, <$50/month)

| Feature | AppFollow tier | Our cost | Notes |
|---|---|---|---|
| Knowledge base (RAG) | Enterprise | ~$5/month (Claude Haiku) | Inject product context into AI replies |
| Automation presets library | Pro | $0 | 12 pre-built rule templates |
| Multi-app support (3–10 apps) | Pro/Enterprise | $0 | DB already supports it |
| App Store Connect (read) | Pro | $0 (Apple API) | Reply not supported by Apple yet |
| Custom tag categories | Pro | $0 | Bugs / User Feedback / Monetization |
| Export (CSV) | Basic | $0 | Simple Supabase query → CSV |
| User identity in sidebar | All tiers | $0 | Clerk user data |
| Plan usage metrics | All tiers | $0 | Track against limits |

### Skip entirely (for now)

| AppFollow feature | Why skip |
|---|---|
| ASO / keyword tracking | Different product. 3+ months of work. |
| Competitor benchmarking | Needs data pipeline. Nobody's asked yet. |
| Benchmark reports | Needs competitor data. Skip. |
| Phrase analysis | Claude clustering is better. |
| Microsoft Store / Samsung | Low demand. Add if 3 customers ask. |
| Salesforce / Zendesk integration | Enterprise sales cycle. Post-$10K MRR. |
| Custom dashboards | Build Notion-like complexity. Not yet. |
| Real-time WebSocket updates | 30-second polling is fine for SMB. |

---

## Semantic analysis — $0 forever

AppFollow charges for this. We give it on all plans. Our moat.

### How it runs for free

Models live on Supabase Edge Functions (WASM build of transformers.js).
Downloads once. Runs on Supabase's servers. Included in free tier.

```
Supabase pg_cron → every night at 2am
  → calls Edge Function: analyze-new-reviews
    → for each unanalyzed review (batch of 100):
        1. Keyword regex classify → tags (instant, $0)
        2. If no keyword match → xenova zero-shot classify → tags ($0, local)
        3. xenova sentiment model → score 0-100 ($0, local)
        4. xenova embedding → 384-dim vector ($0, local)
    → k-means cluster all embeddings → topic groups ($0, ml-kmeans)
    → store results in Supabase
```

### What it produces (on screen)

```
Dashboard → Topic clusters:
  🔴 Payment crash     21 reviews  ↑ +8 this week
  🟡 Login loop        14 reviews  → stable
  🟢 Offline mode      9 reviews   ↑ positive
  ⚪ Feature requests  31 reviews  → stable

Reviews feed → each card:
  [Negative 67]  — ML sentiment score
  [crash] [billing]  — ML-assigned tags, color coded
```

### Free tier math

```
50K Supabase Edge Function calls/month (free tier)
÷ 100 reviews per batch call
= 5,000,000 reviews you can process for free
Your 20 customers will generate maybe 10,000 reviews total
Headroom: 499x
```

---

## Pricing strategy — hit $1K MRR with fewest customers

### Tiers

| Plan | Price | Apps | Reviews | AI drafts/day | Features |
|---|---|---|---|---|---|
| **Starter** | $49/month | 1 | 2,000/month | 10 | Core feed, templates, email alerts |
| **Pro** | $99/month | 5 | Unlimited | 50 | + Automation rules, Slack, semantic analysis, clusters |
| **Team** | $199/month | Unlimited | Unlimited | 200 | + Knowledge base, priority support, custom tags |

### How many customers to $1K MRR

| Mix | Customers needed | Realistic timeline |
|---|---|---|
| All Starter ($49) | 21 customers | Month 3–4 |
| All Pro ($99) | 11 customers | Month 2–3 |
| Mixed (8 Pro + 2 Starter) | 10 customers | Month 2–3 |
| 5 Team customers | 5 customers | Month 2 (enterprise) |

**Target: 10 Pro customers. Focus outreach there.**

### 14-day free trial, no credit card

- Trial: 3 AI drafts/day, 1 app, 500 reviews
- Trial ends → hard gate → billing page
- No soft expiry. Hard block. People don't upgrade without friction.

### Where to find first 10 customers

1. **IndieHackers** — post "Built X for Y" thread with real screenshots
2. **r/androiddev** — "How I cut review response time by 80%"
3. **r/startups** — your story as a solo dev
4. **ProductHunt** — launch on a Tuesday, 8am PST
5. **Cold email** — apps with 100–1000 reviews, poor response rate
   - Use Play Store search: find apps with 3.5★ and unanswered reviews
   - Email the developer directly (often in the app listing)
6. **Twitter/X** — build in public, share screenshots weekly

---

## Supabase free tier — the one real constraint

**Problem:** Supabase free projects pause after 1 week of inactivity.
**Our solution:** pg_cron runs every 15 minutes → keeps project permanently awake.

```sql
-- This job runs every 15 min for review sync
-- Side effect: keeps Supabase from ever pausing
select cron.schedule('sync-reviews', '*/15 * * * *',
  $$select sync_all_apps()$$
);
```

**500MB database limit:**
```
1 review row ≈ 1KB (text + metadata)
500MB ÷ 1KB = 500,000 reviews before limit
20 customers × 1,000 reviews/month × 12 months = 240,000 reviews
You're safe for 12+ months on free tier.
```

Upgrade to Supabase Pro ($25/month) only when you hit $1K MRR.

---

## The upgrade ladder — spend nothing until forced

```
Revenue $0 → $500/month
  Infrastructure: $1/month (domain only)
  AI: Groq free tier
  Everything else: free tiers

Revenue $500 → $1,000/month
  Infrastructure: $1/month
  AI: still Groq (limit not hit yet)
  Action: none required

Revenue $1,000/month  ← UPGRADE TRIGGER
  + Supabase Pro: $25/month (reliability, no auto-pause)
  + Claude Haiku: ~$10/month (better quality than Groq)
  Total infra: ~$36/month = 3.6% of $1K revenue

Revenue $2,000/month
  + Vercel Pro: $20/month (cron jobs native, better logs)
  Total infra: ~$56/month = 2.8% of $2K revenue

Revenue $5,000/month
  Everything comfortable. Infra still <$100/month.
  Total infra: <2% of revenue forever.
```

---

## What NOT to pay for (ever, until $10K MRR)

| Tool | Free alternative |
|---|---|
| Datadog / New Relic | Sentry (free) + Vercel logs |
| Auth0 | Clerk (free to 5K MAU) |
| SendGrid | Resend (free 3K/month) |
| Mixpanel | PostHog (free 1M events) |
| AWS / GCP | Vercel + Supabase |
| OpenAI GPT-4 | Groq Llama 3.3 70B (free) then Claude Haiku |
| Dedicated Redis | Upstash (free 10K commands) |
| Separate cron service | Supabase pg_cron (included) |
| Background job queue | Supabase Edge Functions + pg_cron |
| Vector database | Supabase pgvector (included) |

---

## Updated environment variables (zero-cost stack)

```bash
# Supabase (free)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Clerk (free to 5K MAU)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Groq (free — replace with Anthropic at $1K MRR)
GROQ_API_KEY=
GROQ_MODEL=llama-3.3-70b-versatile

# Anthropic (add at $1K MRR milestone)
# ANTHROPIC_API_KEY=

# Google Play (free API)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Stripe (no monthly cost)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_STARTER=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_TEAM=

# Resend (free 3K/month)
RESEND_API_KEY=
RESEND_FROM_EMAIL=alerts@revi.app

# Upstash Redis (free — rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# PostHog (free 1M events)
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# Sentry (free 5K errors)
SENTRY_DSN=
```

---

## Feature flags — gate by plan

```ts
// src/lib/plans.ts
export const PLANS = {
  trial: {
    appsLimit:        1,
    reviewsPerMonth:  500,
    aiDraftsPerDay:   3,
    semanticAnalysis: false,  // keyword-only tags (free to compute)
    automationRules:  false,
    slackAlerts:      false,
    knowledgeBase:    false,
    exportCsv:        false,
  },
  starter: {
    appsLimit:        1,
    reviewsPerMonth:  2000,
    aiDraftsPerDay:   10,
    semanticAnalysis: true,   // local ML, $0
    automationRules:  false,
    slackAlerts:      false,
    knowledgeBase:    false,
    exportCsv:        true,
  },
  pro: {
    appsLimit:        5,
    reviewsPerMonth:  -1,     // unlimited
    aiDraftsPerDay:   50,
    semanticAnalysis: true,
    automationRules:  true,
    slackAlerts:      true,
    knowledgeBase:    false,
    exportCsv:        true,
  },
  team: {
    appsLimit:        -1,     // unlimited
    reviewsPerMonth:  -1,
    aiDraftsPerDay:   200,
    semanticAnalysis: true,
    automationRules:  true,
    slackAlerts:      true,
    knowledgeBase:    true,   // RAG with Claude Haiku — only cost at scale
    exportCsv:        true,
  },
} as const;

export type Plan = keyof typeof PLANS;
export type PlanFeature = keyof typeof PLANS.trial;

export function canUse(plan: Plan, feature: PlanFeature): boolean {
  const val = PLANS[plan][feature];
  return val === true || (typeof val === "number" && val !== 0);
}

export function getLimit(plan: Plan, feature: "appsLimit" | "reviewsPerMonth" | "aiDraftsPerDay"): number {
  return PLANS[plan][feature] as number; // -1 = unlimited
}
```

---

## Build order (zero-cost first)

### Now (this week)
- [ ] `src/lib/templates.ts` — keyword reply templates (Layer 1, $0)
- [ ] `src/lib/classifier.ts` — keyword tag classifier (regex, $0)
- [ ] `src/lib/groq.ts` — Groq API client (Layer 3, free)
- [ ] `src/lib/rate-limit.ts` — Upstash rate limiter
- [ ] `src/lib/plans.ts` — plan feature flags
- [ ] `src/app/api/reply/draft/route.ts` — 3-layer draft pipeline
- [ ] DB: add `ai_usage` table

### Month 2 (after first customer)
- [ ] Supabase Edge Function: `analyze-reviews` (xenova WASM)
- [ ] DB: add `embedding vector(384)`, `sentiment_score`, `cluster_id` to reviews
- [ ] pg_cron: nightly analysis job
- [ ] Dashboard: topic clusters panel
- [ ] Dashboard: sentiment trend chart
- [ ] `src/lib/similarity.ts` — pgvector similarity search (Layer 2, $0)

### Month 3 (after $500 MRR)
- [ ] Automation rules engine
- [ ] Reply Kit UI (templates, AI styles)
- [ ] Slack webhook integration
- [ ] Knowledge base (text blocks stored in Supabase)
- [ ] Switch AI from Groq → Claude Haiku at $1K MRR trigger

---

## Weekly check — are we still $0?

Every Monday, check:
1. Groq dashboard — daily request count (alert if >4,000/day = 67% of limit)
2. Supabase — DB size (alert if >400MB = 80% of free limit)
3. Resend — monthly email count (alert if >2,400 = 80% of limit)
4. Clerk — MAU count (alert if >4,000 = 80% of limit)
5. Upstash — daily commands (alert if >8,000 = 80% of limit)

If any metric hits 80%, decide: throttle usage or upgrade.
Decision rule: **only upgrade if there's paying revenue to cover it.**
