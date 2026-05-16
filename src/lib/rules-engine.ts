/**
 * rules-engine.ts
 *
 * Zero-API-call processing pipeline.
 * Handles tag detection, sentiment scoring, priority scoring, and escalation
 * detection using pure formulas and regex patterns.
 *
 * Called before any AI API is consulted — resolves ~80% of review analysis
 * without spending a single token.
 */

import type {
  AppReview,
  EscalationState,
  ReviewIssueTag,
  ReviewPriority,
  ReviewSentiment,
} from "@/types/review";

// ── Tag patterns ────────────────────────────────────────────────────────────

export const TAG_PATTERNS: Record<ReviewIssueTag, RegExp> = {
  crash:
    /crash|force.?close|stops.?working|closes.?itself|keeps.?crashing|app.?died|freezes.?and.?closes/i,
  login:
    /log.?in|sign.?in|password|can'?t.?access|locked.?out|account.*(issue|problem|error)|can'?t.?log/i,
  performance:
    /slow|lag(gy)?|freeze|hang(s|ing)?|battery.?drain|memory|loading.*(forever|long|slow)|takes.?forever/i,
  billing:
    /charge|payment|refund|subscription|billing|money|paid|purchase|invoice|overcharged|double.?charge/i,
  "feature-request":
    /\badd\b.*(option|feature|support|ability)|\bwould.?be.?(nice|great|helpful)\b|please.?add|wish.*(had|there|you)|feature.?request|suggestion/i,
  "release-regression":
    /after.?(the.?)?update|since.?(the.?)?update|new.?version|latest.?version|broke.?after|used.?to.?work|worked.?before/i,
  "support-delay":
    /no.?response|still.?waiting|days?.?ago|weeks?.?ago|ignored|nobody.?replied|support.*(never|hasn'?t|didn'?t)/i,
  localization:
    /language|translate|translation|locale|region|not.?in.*(my|our).?language|only.?(in.?)?english/i,
};

// ── Sentiment ────────────────────────────────────────────────────────────────

const NEGATIVE_WORDS = new Set([
  "crash", "crashed", "crashing", "bug", "bugs", "broken", "slow", "lag",
  "freeze", "error", "fail", "failed", "awful", "terrible", "worst", "hate",
  "disappointed", "frustrating", "frustration", "useless", "scam", "refund",
  "waste", "garbage", "trash", "horrible", "annoying", "unusable", "rubbish",
  "pathetic", "disaster", "uninstall", "deleted", "remove", "uninstalling",
  "glitch", "glitchy", "buggy", "broken", "not working", "doesn't work",
]);

const POSITIVE_WORDS = new Set([
  "love", "loved", "great", "amazing", "excellent", "best", "awesome",
  "perfect", "wonderful", "fantastic", "helpful", "easy", "smooth", "fast",
  "recommend", "outstanding", "superb", "brilliant", "magnificent", "flawless",
  "intuitive", "clean", "beautiful", "simple", "seamless", "incredible",
  "impressed", "enjoying", "enjoy", "happy", "satisfied", "pleasure",
]);

/**
 * Score sentiment from rating + keyword scan.
 * Formula: (rating/5)*0.7 + keywordScore*0.3
 * Thresholds: <0.25=critical, <0.45=negative, <0.65=mixed, >=0.65=positive
 */
export function scoreSentiment(
  rating: number,
  text: string,
): { score: number; sentiment: ReviewSentiment } {
  const words = text.toLowerCase().split(/\s+/);
  let pos = 0;
  let neg = 0;
  for (const w of words) {
    const clean = w.replace(/[^a-z]/g, "");
    if (POSITIVE_WORDS.has(clean)) pos++;
    if (NEGATIVE_WORDS.has(clean)) neg++;
  }

  const total = pos + neg;
  const keywordScore = total > 0 ? pos / total : rating / 5;
  const score = (rating / 5) * 0.7 + keywordScore * 0.3;

  let sentiment: ReviewSentiment;
  if (score < 0.25) sentiment = "critical";
  else if (score < 0.45) sentiment = "negative";
  else if (score < 0.65) sentiment = "mixed";
  else sentiment = "positive";

  return { score, sentiment };
}

// ── Issue tag detection ──────────────────────────────────────────────────────

/**
 * Auto-detect issue tags from review text using regex patterns.
 * Merges with any existing tags already on the review (deduplicates).
 */
export function detectIssueTags(
  text: string,
  existing: ReviewIssueTag[] = [],
): ReviewIssueTag[] {
  const detected = new Set<ReviewIssueTag>(existing);
  for (const [tag, pattern] of Object.entries(TAG_PATTERNS) as [
    ReviewIssueTag,
    RegExp,
  ][]) {
    if (pattern.test(text)) detected.add(tag);
  }
  return Array.from(detected);
}

// ── Priority scoring ─────────────────────────────────────────────────────────

interface PriorityInput {
  rating: number;
  sentiment: ReviewSentiment;
  issueTags: ReviewIssueTag[];
  /** ISO string, epoch ms, or relative strings like "12 min ago" / "2h ago" / "3 days ago" */
  createdAt: string | number;
  replyStatus: string;
}

/** Parse createdAt to a Date, supporting ISO strings and relative "N unit ago" strings. */
function parseCreatedAt(createdAt: string | number): Date {
  if (typeof createdAt === "number") return new Date(createdAt);
  const str = String(createdAt).trim();

  // Relative: "12 min ago", "2h ago", "1 day ago", "3 days ago", "1 hour ago"
  const relMatch = str.match(/(\d+)\s*(min|hour|hr|h|day|d)s?\s*ago/i);
  if (relMatch) {
    const amount = parseInt(relMatch[1], 10);
    const unit = relMatch[2].toLowerCase();
    const ms =
      unit.startsWith("d")
        ? amount * 86_400_000
        : unit.startsWith("h") || unit === "hr"
          ? amount * 3_600_000
          : amount * 60_000;
    return new Date(Date.now() - ms);
  }

  return new Date(str); // ISO 8601 fallback
}

/**
 * Score priority using a deterministic formula — no AI needed.
 * Returns both the numeric score (useful for sorting) and the enum bucket.
 */
export function scorePriority(review: PriorityInput): {
  score: number;
  priority: ReviewPriority;
} {
  let score = 6 - review.rating; // 5 for 1★, 1 for 5★

  // Sentiment bonus
  if (review.sentiment === "critical") score += 3;
  else if (review.sentiment === "negative") score += 1;

  // Tag bonuses
  if (review.issueTags.includes("crash")) score += 3;
  if (review.issueTags.includes("billing")) score += 2;
  if (review.issueTags.includes("login")) score += 1;

  // Recency bonus
  const ageMs = Date.now() - parseCreatedAt(review.createdAt).getTime();
  if (ageMs < 86_400_000) score += 2;       // < 24 h
  else if (ageMs < 259_200_000) score += 1; // < 72 h

  // Unreplied bonus
  if (review.replyStatus === "needs_reply") score += 1;

  let priority: ReviewPriority;
  if (score > 8) priority = "urgent";
  else if (score > 5) priority = "high";
  else if (score > 2) priority = "normal";
  else priority = "low";

  return { score, priority };
}

// ── Escalation detection ─────────────────────────────────────────────────────

/**
 * Determine escalation state from issue tags and optional crash window count.
 * crashWindowCount = number of crash reviews in the last 24 h for the same app.
 */
export function detectEscalation(
  issueTags: ReviewIssueTag[],
  crashWindowCount = 0,
): EscalationState {
  if (crashWindowCount >= 3) return "incident";
  if (issueTags.includes("crash")) return "engineering";
  if (
    issueTags.includes("billing") ||
    issueTags.includes("support-delay")
  )
    return "support";
  return "none";
}

// ── enrichReview ─────────────────────────────────────────────────────────────

/**
 * One-call enrichment: derive tags, sentiment, priority, and escalation
 * from a raw AppReview with zero API calls.
 *
 * Returns only the derived fields so callers can spread-merge into the review.
 */
export function enrichReview(
  review: AppReview,
  crashWindowCount = 0,
): Pick<
  AppReview,
  "issueTags" | "sentiment" | "priority" | "escalationState"
> {
  const issueTags = detectIssueTags(review.text ?? "", review.issueTags ?? []);
  const { sentiment } = scoreSentiment(review.rating, review.text ?? "");
  const { priority } = scorePriority({
    rating: review.rating,
    sentiment,
    issueTags,
    createdAt: review.createdAt,
    replyStatus: review.replyStatus,
  });
  const escalationState = detectEscalation(issueTags, crashWindowCount);

  return { issueTags, sentiment, priority, escalationState };
}
