import {
  IncidentAlert,
  InsightSignal,
  OperationalMetric,
  PlatformHealth,
  ReleaseHealth,
} from "@/types/review";

export const incidentAlerts: IncidentAlert[] = [
  {
    id: "inc_release_542",
    title: "Release 5.42.0 is damaging ratings",
    description:
      "1-star reviews are up 38% since staged rollout reached 45%. Crash and login complaints are concentrated on Android 14 devices.",
    severity: "critical",
    owner: "Mobile Platform",
    detectedAt: "Detected 18 min ago",
    status: "active",
  },
  {
    id: "inc_reply_sla",
    title: "Critical reply SLA at risk",
    description:
      "9 urgent reviews have no public response and 4 are tied to active subscription renewal failures.",
    severity: "high",
    owner: "Support Ops",
    detectedAt: "Updated 6 min ago",
    status: "investigating",
  },
  {
    id: "inc_localization_de",
    title: "German localization strings missing in v5.42.0",
    description:
      "3 German reviews flagged untranslated strings on the payment confirmation screen. Affects ~2% of EU users.",
    severity: "medium",
    owner: "Localization",
    detectedAt: "Detected 2 h ago",
    status: "investigating",
  },
  {
    id: "inc_android13_perf",
    title: "Android 13 startup latency spike",
    description:
      "Cold-start time increased by ~800ms on Android 13 devices after v5.41.2 rollout. Root cause identified — fix ships in 5.42.1.",
    severity: "medium",
    owner: "Performance",
    detectedAt: "Resolved 1 h ago",
    status: "resolved",
  },
];

export const operationalMetrics: OperationalMetric[] = [
  {
    label: "Avg. Rating",
    value: "3.8",
    delta: "↓ 0.4 since v5.42.0",
    trend: "down",
    state: "warning",
    sparkline: [4.2, 4.1, 4.0, 3.9, 3.8, 3.7, 3.8],
    sparklineColor: "#f59e0b",
  },
  {
    label: "Unresolved Reviews",
    value: "127",
    delta: "↑ 18 since 09:00",
    trend: "up",
    state: "warning",
    sparkline: [68, 74, 80, 95, 109, 118, 127],
    sparklineColor: "#f59e0b",
  },
  {
    label: "Critical Spikes",
    value: "3",
    delta: "Crash · login · billing",
    trend: "up",
    state: "critical",
    sparkline: [0, 1, 0, 1, 2, 2, 3],
    sparklineColor: "#ef4444",
  },
  {
    label: "AI Drafts Ready",
    value: "5",
    delta: "Reviews awaiting reply",
    trend: "neutral",
    state: "neutral",
    sparkline: [2, 3, 4, 3, 5, 4, 5],
    sparklineColor: "#6366f1",
  },
];

export const platformHealth: PlatformHealth[] = [
  {
    platform: "Google Play",
    rating: 3.8,
    totalRatings: 2764,
    reviewsToday: 84,
    responseRate: 79,
    ratingDelta7d: -0.4,
    pendingReplies: 38,
    sparkline: [4.2, 4.1, 4.0, 3.9, 3.8, 3.7, 3.8],
    ratingDistribution: [34, 11, 8, 12, 35],
  },
  {
    platform: "App Store",
    rating: 4.1,
    totalRatings: 245,
    reviewsToday: 43,
    responseRate: 91,
    ratingDelta7d: -0.1,
    pendingReplies: 8,
    sparkline: [4.2, 4.2, 4.3, 4.2, 4.1, 4.1, 4.1],
    ratingDistribution: [7, 5, 9, 21, 58],
  },
];

export const aiInsightSignals: InsightSignal[] = [
  {
    label: "Top cluster",
    value: "Payment crash",
    detail: "21 reviews mention renewal failure after tapping payment method.",
    state: "critical",
  },
  {
    label: "Sentiment shift",
    value: "−14 pts",
    detail: "Negative sentiment accelerating in India and Germany.",
    state: "warning",
  },
  {
    label: "Release impact",
    value: "5.42.0",
    detail: "Regression language appears in 64% of urgent reviews.",
    state: "critical",
  },
  {
    label: "Feature trend",
    value: "Saved filters",
    detail: "12 requests this week, mostly from power users.",
    state: "neutral",
  },
];

export const releaseHealth: ReleaseHealth[] = [
  {
    version: "5.42.0",
    status: "degraded",
    ratingDelta: "−0.34",
    ratingDeltaNum: -0.34,
    complaintDelta: "+38%",
    rollout: "45%",
    rolloutNum: 45,
    startedAt: "Today, 08:30",
  },
  {
    version: "5.41.2",
    status: "healthy",
    ratingDelta: "+0.03",
    ratingDeltaNum: 0.03,
    complaintDelta: "−6%",
    rollout: "100%",
    rolloutNum: 100,
    startedAt: "Apr 29",
  },
  {
    version: "5.41.0",
    status: "monitoring",
    ratingDelta: "−0.07",
    ratingDeltaNum: -0.07,
    complaintDelta: "+4%",
    rollout: "100%",
    rolloutNum: 100,
    startedAt: "Apr 21",
  },
  {
    version: "5.40.1",
    status: "healthy",
    ratingDelta: "+0.11",
    ratingDeltaNum: 0.11,
    complaintDelta: "−9%",
    rollout: "100%",
    rolloutNum: 100,
    startedAt: "Apr 14",
  },
];
