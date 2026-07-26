export type ReviewSentiment = "critical" | "negative" | "mixed" | "positive";
export type ReviewPriority = "urgent" | "high" | "normal" | "low";
export type ReplyStatus = "needs_reply" | "draft_ready" | "replied" | "waiting";
export type EscalationState = "none" | "support" | "product" | "engineering" | "incident";
export type ReviewIssueTag =
  | "crash"
  | "billing"
  | "login"
  | "performance"
  | "release-regression"
  | "feature-request"
  | "support-delay"
  | "localization";
export type ReviewSource = "Google Play" | "App Store";
export type IncidentStatus = "active" | "investigating" | "resolved";

export interface AppReview {
  id: string;
  /** Workspace app this review belongs to. Optional: rows cached before the
      API started returning it (and demo fixtures) may not carry one. */
  appId?: string;
  author: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  appVersion: string;
  device: string;
  country: string;
  issueTags: ReviewIssueTag[];
  sentiment: ReviewSentiment;
  priority: ReviewPriority;
  replyStatus: ReplyStatus;
  escalationState: EscalationState;
  createdAt: string;
  source: ReviewSource;
  hasAiSuggestion: boolean;
  /** Text of the reply that was sent, if any */
  replyText?: string;
}

export interface OperationalMetric {
  label: string;
  value: string;
  delta: string;
  trend: "up" | "down" | "neutral";
  state: "critical" | "warning" | "healthy" | "neutral";
  sparkline: number[];
  sparklineColor: string;
}

export interface IncidentAlert {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "high" | "medium";
  owner: string;
  detectedAt: string;
  status: IncidentStatus;
}

export interface InsightSignal {
  label: string;
  value: string;
  detail: string;
  state: "critical" | "warning" | "neutral" | "healthy";
}

export interface ReleaseHealth {
  version: string;
  status: "monitoring" | "degraded" | "healthy";
  ratingDelta: string;
  ratingDeltaNum: number;
  complaintDelta: string;
  rollout: string;
  rolloutNum: number;
  startedAt: string;
}

export interface PlatformHealth {
  platform: ReviewSource;
  rating: number;
  totalRatings: number;
  reviewsToday: number;
  responseRate: number;
  ratingDelta7d: number;
  pendingReplies: number;
  sparkline: number[];
  /** [1★, 2★, 3★, 4★, 5★] as percentages summing to 100 */
  ratingDistribution: [number, number, number, number, number];
}

// ── ASO ───────────────────────────────────────────────────────────────────────

export interface AsoKeyword {
  id: string;
  keyword: string;
  appId?: string;
  currentRank: number | null;
  previousRank: number | null;
  volumeEstimate: number | null;
  /** Last 6 rank snapshots, newest last (lower = better) */
  trendData: number[];
  addedAt: string;
}

// ── Automation Hub ────────────────────────────────────────────────────────────

export type AutomationAction =
  | "ai_reply"
  | "auto_reply"       // generates AI reply AND submits to store (opt-in via rule)
  | "template_reply"
  | "apply_tag"
  | "escalate"
  | "report_spam";

export type AutomationConditionField =
  | "rating"
  | "sentiment"
  | "tag"
  | "keyword"
  | "platform"
  | "country"
  | "version";

export interface AutomationCondition {
  field: AutomationConditionField;
  operator: "equals" | "contains" | "less_than" | "greater_than" | "in";
  value: string | number | string[];
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: AutomationCondition[];
  action: AutomationAction;
  actionLabel: string;
  /** Action-specific config: tag name for apply_tag, template ID for template_reply */
  actionConfig?: string;
  appsScope: "all" | string[];
  priority: number;
  timesRun: number;
  lastRunAt: string | null;
  createdAt: string;
  isRecommended?: boolean;
}

export interface AutomationExecutionLog {
  id: string;
  workspaceId: string;
  ruleId: string;
  ruleName: string;
  reviewId: string;
  reviewRating: number | null;
  reviewSnippet: string | null;
  action: AutomationAction;
  status: "success" | "error";
  errorMessage: string | null;
  executedAt: string;
}

export interface AutomationPreset {
  id: string;
  name: string;
  description: string;
  badges: ("AI" | "Reply" | "Tag" | "Report reviews")[];
  isFree: boolean;
  category: "featured" | "automation";
}

// ── Reply Kit ─────────────────────────────────────────────────────────────────

export type TagCategory = "bugs" | "user_feedback" | "monetization";

export interface TagDefinition {
  id: string;
  name: string;
  color: string;
  category: TagCategory;
}

export interface ReplyTemplate {
  id: string;
  name: string;
  content: string;
  tags: ReviewIssueTag[];
  ratingRange: [number, number];
  language: string;
  usageCount: number;
  createdAt: string;
}

export type AIReplyTone =
  | "professional"
  | "empathetic"
  | "casual"
  | "direct"
  | "enthusiastic";

export interface AIReplyStyle {
  id: string;
  name: string;
  description: string;
  tone: AIReplyTone;
  isDefault: boolean;
  exampleInput: string;
  exampleOutput: string;
}

export interface KnowledgeBaseEntry {
  id: string;
  title: string;
  content: string;
  category: "product" | "known_issue" | "faq" | "roadmap";
  createdAt: string;
}

// ── Alerts ────────────────────────────────────────────────────────────────────

export type AlertType =
  | "urgent_review"
  | "critical_spike"
  | "daily_digest"
  | "weekly_digest"
  | "monthly_report";

export interface AlertChannel {
  email: boolean;
  slack: boolean;
  slackWebhookUrl?: string;
}

export interface AlertPreference {
  type: AlertType;
  label: string;
  description: string;
  enabled: boolean;
  channels: AlertChannel;
  scheduleTime?: string;       // "09:00" HH:MM UTC
  scheduleDayOfWeek?: number;  // 0=Sun … 6=Sat
  scheduleDayOfMonth?: number; // 1–31
}
