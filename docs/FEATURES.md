# ReviewIQ — Feature Specs

Platform for managing app reviews across Google Play and Apple App Store.
Target users: mobile app teams (support ops, product managers, release engineers).

---

## Feature Modules

### 1. Review Queue (`/reviews`)

Purpose: Triage and respond to incoming reviews.

**Core capabilities:**
- List reviews filtered by: platform, rating, sentiment, priority, reply status, issue tag
- Sort by: date, rating, priority
- Bulk actions: mark replied, escalate, tag
- Single review: full text, device info, AI reply suggestion, reply editor, escalation controls
- Reply directly to Google Play / App Store via API

**Review states:**
```
needs_reply → draft_ready → replied
                  ↓
               escalated (support / product / engineering / incident)
```

**Data source:** `services/reviews/review-service.ts` → `reviews` table

---

### 2. Incidents (`/incidents`)

Purpose: Detect and manage review-driven incidents (crash spikes, billing issues, etc.).

**Core capabilities:**
- Auto-detect incidents from review pattern spikes (e.g., 10+ crash reports in 1hr)
- Create manual incidents
- Assign severity: critical / high / medium
- Assign owner
- Link to affected release version
- Resolve with notes
- Timeline view of incident events

**Incident severity thresholds (configurable per workspace):**
- critical: 1-star crash spike > 5% of daily volume
- high: rating drop > 0.3 in 24hr
- medium: repeated issue tag appearing in > 20 reviews/day

**Data source:** `services/incidents/incident-service.ts` → `incidents` table

---

### 3. Release Health (`/releases`)

Purpose: Monitor rating and complaint impact per app release.

**Core capabilities:**
- List releases with health status: healthy / monitoring / degraded
- Rating delta vs previous version
- Complaint volume delta
- Rollout percentage
- Drill into reviews linked to specific version
- Flag version for rollback consideration

**Status logic:**
- degraded: rating delta < -0.2 OR complaint delta > +30%
- monitoring: new release < 7 days old, insufficient data
- healthy: stable or improving

**Data source:** `services/releases/release-service.ts` → `releases` table

---

### 4. Dashboard (`/dashboard`)

Purpose: Executive overview of review operations health.

**Panels:**
- Critical Incident Banner — shows open critical incidents (dismissible per session)
- Operational Metrics — reply rate, avg response time, pending review count, escalation rate
- AI Insights — top emerging issues, sentiment trends, version-correlated spikes
- Release Summary — latest 3 releases health at a glance

**Data:** Aggregated from reviews, incidents, releases tables. Read-only, no actions.

---

### 5. Settings (`/settings`)

**Sections:**
- Workspace: name, apps list, team members
- Integrations: Google Play API credentials, App Store Connect credentials
- Notifications: email/slack alerts for critical incidents, unresponded reviews > N hours
- AI: enable/disable AI suggestions, custom reply tone, language preferences
- Thresholds: configure incident detection rules

---

## Platforms

### Google Play

API: Google Play Android Publisher API (OAuth 2.0)
- Fetch reviews: `reviews.list`
- Reply to review: `reviews.reply`
- Credentials: service account JSON → stored encrypted in settings

### Apple App Store

API: App Store Connect API (JWT auth)
- Fetch reviews: `/v1/apps/{id}/customerReviews`
- Reply: `/v1/customerReviewResponses` (POST)
- Credentials: API key + issuer ID + private key → stored encrypted in settings

---

## AI Features

### Review Triage (auto)
On new review ingestion:
- Classify sentiment: critical / negative / mixed / positive
- Assign priority: urgent / high / normal / low
- Tag issues: crash / billing / login / performance / etc.

### Reply Suggestions
Triggered when agent views review or on demand:
- Generate context-aware reply (tone: professional, empathetic, solution-focused)
- Incorporate known fix if issue tag matches release notes
- Editable before sending

### Insight Signals
Batch analysis run every 6hrs:
- Emerging issue clusters
- Version-correlated spikes
- Sentiment trend shifts
- Country-specific complaint patterns

---

## Non-Goals (v1)

- Native mobile app
- Public review widgets / embeds
- Competitor review monitoring
- Social media monitoring
- In-app survey tools

---

## Backlog Priority

| Priority | Feature |
|---|---|
| P0 | Supabase DB schema + migrations |
| P0 | Google Play API integration |
| P1 | Apple App Store API integration |
| P1 | Real review data in review queue |
| P1 | Reply sending (Google Play) |
| P2 | AI reply suggestions (Claude API) |
| P2 | Incident auto-detection |
| P2 | Supabase Auth + multi-user |
| P3 | Realtime review feed |
| P3 | Slack/email notifications |
| P3 | App Store reply sending |
| P4 | AI insight signals |
| P4 | Multi-workspace / team management |
