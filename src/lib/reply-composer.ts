/**
 * reply-composer.ts
 *
 * Tier-2 deterministic reply composer.
 *
 * Assembles a coherent, persona-aware reply from building blocks when no
 * single template matches. Covers the ~30% of reviews that fall through
 * Tier-1 templates without touching any AI API.
 *
 * Structure of every composed reply:
 *   [Opening]  — tone × rating bucket
 *   [Issue Ack] — tone × primary tag (if tags present)
 *   [Resolution] — static hint per tag, optionally overridden by KB entry
 *   [CTA]       — contact prompt (always)
 *   [Sign-off]  — workspace persona
 *
 * All building blocks use {appName}, {supportEmail}, {teamName} placeholders
 * resolved by personalizeText() before returning.
 */

import type { AppReview, ReviewIssueTag } from "@/types/review";
import type { WorkspacePersona } from "@/lib/workspace-persona";
import { personalizeText } from "@/lib/workspace-persona";

export type AIReplyTone = "professional" | "empathetic" | "casual" | "direct";

// ── Opening sentences ────────────────────────────────────────────────────────
// Keyed by tone → rating bucket (1 | 2 | 3 | 4 | 5)

const OPENINGS: Record<AIReplyTone, Record<number, string[]>> = {
  professional: {
    1: [
      "Thank you for taking the time to share your experience.",
      "We appreciate you letting us know about this issue.",
    ],
    2: [
      "Thank you for your feedback.",
      "We appreciate you bringing this to our attention.",
    ],
    3: [
      "Thank you for the balanced review.",
      "We appreciate your honest feedback.",
    ],
    4: [
      "Thank you for the positive review!",
      "We're glad you're enjoying {appName}.",
    ],
    5: [
      "Wow — thank you so much for the 5-star review!",
      "Thank you for such a wonderful review!",
    ],
  },
  empathetic: {
    1: [
      "We're really sorry to hear about your experience — this is not okay.",
      "We hear you, and we sincerely apologise for what you went through.",
    ],
    2: [
      "We're sorry things haven't been going smoothly — that's frustrating.",
      "That sounds frustrating, and we're genuinely sorry about it.",
    ],
    3: [
      "Thank you for the honest feedback — we really appreciate you sharing both sides.",
      "We value you taking the time to share your thoughts with us.",
    ],
    4: [
      "That's so great to hear — thank you for letting us know!",
      "We're really glad {appName} is working well for you!",
    ],
    5: [
      "This genuinely made our day — thank you so much!",
      "We're so happy to hear this — it means a lot to the whole team.",
    ],
  },
  casual: {
    1: [
      "Ugh, so sorry about that — that's definitely not the experience we want for you.",
      "Oh no — we're really sorry this happened!",
    ],
    2: [
      "Sorry to hear things haven't been great — let's fix that!",
      "That's not ideal at all — sorry about that!",
    ],
    3: [
      "Thanks for the honest take — we love hearing what's working and what isn't!",
      "Appreciate the balanced feedback — really helpful to know!",
    ],
    4: [
      "Awesome — so glad you're enjoying it!",
      "Love to hear it — thanks for the kind words!",
    ],
    5: [
      "Wow, thank you so much — you made our day! 🙌",
      "This is amazing — thank you for taking the time to share!",
    ],
  },
  direct: {
    1: [
      "Sorry for the bad experience.",
      "This shouldn't have happened — we'll fix it.",
    ],
    2: [
      "Thanks for the feedback.",
      "Noted — we'll work on this.",
    ],
    3: [
      "Thanks for the feedback.",
      "Appreciate the honest review.",
    ],
    4: [
      "Thanks for the review!",
      "Glad it's working well.",
    ],
    5: [
      "Thank you — this means a lot to the team.",
      "Really appreciate the 5 stars.",
    ],
  },
};

// ── Issue acknowledgments ─────────────────────────────────────────────────────
// Keyed by tag → tone

const TAG_ACKS: Partial<Record<ReviewIssueTag, Record<AIReplyTone, string>>> = {
  crash: {
    professional: "We're aware that some users are experiencing crashes and our engineering team is actively investigating.",
    empathetic:   "Crashes are completely unacceptable and we understand how disruptive they are.",
    casual:       "Crashes are the worst — we totally get how annoying that is.",
    direct:       "We know about the crash issue.",
  },
  billing: {
    professional: "We take billing concerns very seriously and want to resolve this for you promptly.",
    empathetic:   "Billing issues are especially stressful and we want to make this right as quickly as possible.",
    casual:       "Billing stuff is always stressful — we really want to sort this out for you.",
    direct:       "We'll sort the billing issue.",
  },
  login: {
    professional: "We understand how disruptive login issues can be and we want to resolve this immediately.",
    empathetic:   "Being locked out of an app is incredibly frustrating, and we're sorry you're going through that.",
    casual:       "Being locked out is the worst — let's get you back in asap.",
    direct:       "We'll get your login sorted.",
  },
  performance: {
    professional: "Performance is a top priority for our team and we're actively working on improvements.",
    empathetic:   "A slow or unresponsive app is really frustrating, and we hear you.",
    casual:       "Slowdowns are super annoying — we're on it!",
    direct:       "Performance fix is in progress.",
  },
  "release-regression": {
    professional: "We're aware that the recent update has introduced some regressions and a fix is being prioritised.",
    empathetic:   "It's really frustrating when an update makes things worse instead of better — we're sorry for that.",
    casual:       "Ugh, update regressions are the worst — we're working on a fix!",
    direct:       "Known regression — fix shipping soon.",
  },
  "feature-request": {
    professional: "Feature requests from users like you directly shape our product roadmap.",
    empathetic:   "We love that you care enough to suggest this — it really helps us build something you'll love.",
    casual:       "Love the idea — this is exactly the kind of feedback that shapes what we build next.",
    direct:       "Feature logged for the roadmap.",
  },
  "support-delay": {
    professional: "We sincerely apologise for the delay in responding — that's not the standard we hold ourselves to.",
    empathetic:   "We're really sorry you've had to wait — that's not the experience we want for you.",
    casual:       "So sorry for the slow reply — that's on us!",
    direct:       "Sorry for the delay.",
  },
  localization: {
    professional: "Improving language support is on our roadmap and your feedback helps us prioritise specific regions.",
    empathetic:   "We want everyone to have a great experience in their own language, and we appreciate you flagging this.",
    casual:       "Good point — we're working on better language support!",
    direct:       "Language support is on the roadmap.",
  },
};

// ── Resolution hints ──────────────────────────────────────────────────────────
// Static per-tag fallback when no KB entry is available.

const TAG_RESOLUTIONS: Partial<Record<ReviewIssueTag, string>> = {
  crash:               "A fix is being worked on — please update to the latest version to get improvements as soon as they ship.",
  billing:             "Please contact us directly and we'll resolve this within 24 hours.",
  login:               "Try clearing the app cache or resetting your password via the 'Forgot password' link. If that doesn't work, email us and we'll get you back in.",
  performance:         "Clearing the app cache and doing a fresh install often helps while we push a performance update.",
  "release-regression":"Our team has flagged this and a hotfix is being prioritised.",
  "feature-request":   "We'll keep you posted as it moves closer to shipping.",
  "support-delay":     "Please email us again with your original query and we'll respond within 24 hours.",
  localization:        "Please email us with your preferred language so we can prioritise it on our roadmap.",
};

// ── CTAs ─────────────────────────────────────────────────────────────────────

const CTA_BY_TONE: Record<AIReplyTone, string> = {
  professional: "Please email us at {supportEmail} with any additional details and we'll follow up personally.",
  empathetic:   "Please reach out at {supportEmail} — we'd love to make this right for you.",
  casual:       "Drop us an email at {supportEmail} and we'll sort it out!",
  direct:       "Email {supportEmail} if you need immediate help.",
};

// ── Positive CTA (no issue — just appreciation) ───────────────────────────────

const POSITIVE_CTA_BY_TONE: Record<AIReplyTone, string> = {
  professional: "If you ever have suggestions or questions, feel free to reach out at {supportEmail}.",
  empathetic:   "If there's ever anything we can do even better, we'd love to hear from you at {supportEmail}.",
  casual:       "If you ever have ideas or need anything, hit us up at {supportEmail} anytime!",
  direct:       "Any feedback? {supportEmail}.",
};

// ── Sign-offs ─────────────────────────────────────────────────────────────────

const SIGNOFF_BY_TONE: Record<AIReplyTone, string> = {
  professional: "\n\n— {teamName}",
  empathetic:   "\n\nWith appreciation,\n{teamName}",
  casual:       "\n\n— {teamName} 👋",
  direct:       "\n\n— {teamName}",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** djb2 hash for deterministic variant selection. */
function hashStr(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], review: AppReview): T {
  return arr[hashStr(review.id + review.text) % arr.length];
}

function ratingBucket(rating: number): 1 | 2 | 3 | 4 | 5 {
  const r = Math.round(rating);
  return (r >= 1 && r <= 5 ? r : 3) as 1 | 2 | 3 | 4 | 5;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ComposerOptions {
  /**
   * Optional knowledge-base snippet to use as the resolution hint.
   * When provided, replaces the static TAG_RESOLUTIONS entry.
   * Should be a single actionable sentence (≤ 120 chars).
   */
  kbHint?: string;
}

/**
 * Compose a deterministic, persona-aware reply for any review.
 * Never calls any external API — safe to use as a fallback at any time.
 *
 * @param review  The AppReview to reply to
 * @param tone    Desired tone (defaults to "professional")
 * @param persona Workspace-specific identity values
 * @param opts    Optional KB hint for resolution sentence
 */
export function composeReply(
  review: AppReview,
  tone: AIReplyTone = "professional",
  persona: WorkspacePersona,
  opts: ComposerOptions = {},
): string {
  const bucket  = ratingBucket(review.rating);
  const isPos   = bucket >= 4;
  const tags    = (review.issueTags ?? []) as ReviewIssueTag[];
  const primary = tags[0] as ReviewIssueTag | undefined;

  const parts: string[] = [];

  // ── Opening ──────────────────────────────────────────────────────────────
  const openingPool = OPENINGS[tone]?.[bucket] ?? OPENINGS.professional[3];
  parts.push(pick(openingPool, review));

  if (!isPos || tags.length > 0) {
    // ── Issue acknowledgment ────────────────────────────────────────────────
    if (primary && TAG_ACKS[primary]) {
      parts.push(TAG_ACKS[primary]![tone]);
    }

    // ── Resolution hint ─────────────────────────────────────────────────────
    const resolution =
      opts.kbHint ??
      (primary ? TAG_RESOLUTIONS[primary] : undefined);

    if (resolution) {
      parts.push(resolution);
    }

    // ── Multi-tag note (if more than 1 tag) ─────────────────────────────────
    if (tags.length > 1) {
      const secondary = tags[1] as ReviewIssueTag;
      if (TAG_ACKS[secondary]) {
        parts.push(TAG_ACKS[secondary]![tone]);
      }
    }

    // ── CTA ─────────────────────────────────────────────────────────────────
    parts.push(CTA_BY_TONE[tone]);
  } else {
    // Positive review — lighter CTA
    parts.push(POSITIVE_CTA_BY_TONE[tone]);
  }

  // ── Sign-off ──────────────────────────────────────────────────────────────
  const body     = parts.join(" ");
  const signoff  = SIGNOFF_BY_TONE[tone];
  const raw      = body + signoff;

  return personalizeText(raw, persona);
}
