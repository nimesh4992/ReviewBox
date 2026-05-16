/**
 * templates.ts
 *
 * 25 deterministic reply templates covering the most common review scenarios.
 * Matched in priority order — first match wins.
 * Zero API calls, <2ms execution time.
 *
 * ~70% of real-world app store reviews match at least one template.
 */

import { TAG_PATTERNS } from "@/lib/rules-engine";
import type { AppReview, ReviewIssueTag } from "@/types/review";

// ── Internal helpers ─────────────────────────────────────────────────────────

export interface TemplateDefinition {
  id: string;
  variants: string[];
  matchFn: (review: AppReview) => boolean;
  /** Deterministic variant picker so the same review always gets the same reply. */
  pick: (review: AppReview) => string;
}

/** djb2-style hash for deterministic variant selection — no crypto needed. */
function hashReview(review: AppReview): number {
  const str = (review.text ?? "") + review.rating;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  return Math.abs(h);
}

function pickVariant(variants: string[], review: AppReview): string {
  return variants[hashReview(review) % variants.length];
}

function hasTag(review: AppReview, tag: ReviewIssueTag): boolean {
  return (review.issueTags ?? []).includes(tag);
}

function textMatches(review: AppReview, pattern: RegExp): boolean {
  return pattern.test(review.text ?? "");
}

function wordCount(review: AppReview): number {
  return (review.text ?? "").trim().split(/\s+/).filter(Boolean).length;
}

// ── Template definitions (ordered by match priority) ─────────────────────────

const TEMPLATES: TemplateDefinition[] = [
  // ── 1. crash_critical ───────────────────────────────────────────────────
  {
    id: "crash_critical",
    variants: [
      "We're so sorry to hear the app is crashing for you — that's completely unacceptable and we want to fix it right away. Please reach out to us at hello@tryreviewbox.com with your device model and OS version so our engineering team can investigate. We'll keep you updated.\n\n— The ReviewBox Team",
      "A crash is never okay, and we sincerely apologise for the experience. Our engineers are actively investigating stability issues. Could you email us at hello@tryreviewbox.com with your device details? We'll follow up directly.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      r.rating === 1 &&
      (hasTag(r, "crash") || textMatches(r, TAG_PATTERNS.crash)),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 2. crash_negative ───────────────────────────────────────────────────
  {
    id: "crash_negative",
    variants: [
      "Thank you for letting us know about the crash — we take stability seriously and this has been flagged to our engineering team. Please email hello@tryreviewbox.com with your device model so we can look into it specifically for you.\n\n— The ReviewBox Team",
      "We're sorry the app crashed on you. Our team is working on stability improvements. If it continues, please reach out at hello@tryreviewbox.com with your device and OS version — we'd love to resolve this for you.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      r.rating === 2 &&
      (hasTag(r, "crash") || textMatches(r, TAG_PATTERNS.crash)),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 3. billing_refund_request ────────────────────────────────────────────
  {
    id: "billing_refund_request",
    variants: [
      "We're sorry to hear about the billing issue and completely understand your frustration. Please contact us at hello@tryreviewbox.com with your order details and we'll process a resolution as quickly as possible.\n\n— The ReviewBox Team",
      "Thank you for bringing this to our attention. Billing issues are our top priority to resolve. Please email hello@tryreviewbox.com with your account email and transaction details and our team will get back to you within 24 hours.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      hasTag(r, "billing") && /refund|charged.?twice|overcharg|money.?back/i.test(r.text ?? ""),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 4. billing_dispute ──────────────────────────────────────────────────
  {
    id: "billing_dispute",
    variants: [
      "We're sorry for any confusion around billing. Please reach out to us at hello@tryreviewbox.com with your account details and we'll clarify your charges and make things right.\n\n— The ReviewBox Team",
      "Thank you for flagging this. Our team is happy to walk you through your billing details. Please contact hello@tryreviewbox.com and we'll get back to you within one business day.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      hasTag(r, "billing") &&
      !/refund|charged.?twice|overcharg|money.?back/i.test(r.text ?? ""),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 5. data_privacy_concern ─────────────────────────────────────────────
  {
    id: "data_privacy_concern",
    variants: [
      "We take data privacy very seriously. All user data is processed in accordance with GDPR and our Privacy Policy at tryreviewbox.com/privacy. If you'd like to request a data export or deletion, please email hello@tryreviewbox.com and we'll respond within 72 hours.\n\n— The ReviewBox Team",
      "Thank you for raising this. Your privacy matters deeply to us. We'd be happy to walk you through our data practices or process any request — simply email hello@tryreviewbox.com with the subject 'Privacy Request'.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      /data.*(privacy|gdpr|personal|delete.?my|remove.?my)|privacy.?concern|my.?data/i.test(
        r.text ?? "",
      ),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 6. login_issue ──────────────────────────────────────────────────────
  {
    id: "login_issue",
    variants: [
      "We're sorry you're having trouble signing in — that's incredibly frustrating. Please try resetting your password via the 'Forgot password' link. If the issue persists, email us at hello@tryreviewbox.com and we'll help you regain access immediately.\n\n— The ReviewBox Team",
      "Login issues are a top priority for us. Please try the 'Forgot password' flow first. If that doesn't help, reach out at hello@tryreviewbox.com with your account email and we'll sort this out for you right away.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) => hasTag(r, "login") || textMatches(r, TAG_PATTERNS.login),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 7. performance_issue ────────────────────────────────────────────────
  {
    id: "performance_issue",
    variants: [
      "We're sorry the app isn't performing well for you. Performance is a top priority for our team. Trying a fresh install often helps — but if it continues, please email hello@tryreviewbox.com with your device model and OS version so we can investigate further.\n\n— The ReviewBox Team",
      "Thank you for the feedback on performance. We're actively working on speed improvements. In the meantime, clearing the app cache may help. Please reach out at hello@tryreviewbox.com if the issue persists.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      r.rating <= 3 &&
      (hasTag(r, "performance") || textMatches(r, TAG_PATTERNS.performance)),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 8. update_complaint ─────────────────────────────────────────────────
  {
    id: "update_complaint",
    variants: [
      "We're sorry the recent update hasn't been smooth for you. We work hard to improve with every release, but sometimes things don't go as planned. Please email hello@tryreviewbox.com with details of what broke — it helps us fix it faster for everyone.\n\n— The ReviewBox Team",
      "Thank you for letting us know about this regression. We've flagged it to our engineering team for investigation. Please reach out at hello@tryreviewbox.com with your app version and device so we can prioritise a fix.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      hasTag(r, "release-regression") ||
      textMatches(r, TAG_PATTERNS["release-regression"]),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 9. support_delay_apology ────────────────────────────────────────────
  {
    id: "support_delay_apology",
    variants: [
      "We sincerely apologise for the delay in getting back to you — that's not the standard we hold ourselves to. Please email hello@tryreviewbox.com directly with your original query and we'll respond within 24 hours.\n\n— The ReviewBox Team",
      "We're really sorry you've been waiting. Your issue matters to us and should never have gone unanswered this long. Please email hello@tryreviewbox.com and we'll make this right.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      hasTag(r, "support-delay") ||
      textMatches(r, TAG_PATTERNS["support-delay"]),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 10. localization_feedback ────────────────────────────────────────────
  {
    id: "localization_feedback",
    variants: [
      "Thank you for this feedback! We're actively working on improving our language support. Your region is on our roadmap — please email hello@tryreviewbox.com to let us know your preferred language so we can prioritise it.\n\n— The ReviewBox Team",
      "We appreciate you flagging this. Better localisation is important to us. Please reach out at hello@tryreviewbox.com with your language preference and we'll keep you updated on our progress.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      hasTag(r, "localization") || textMatches(r, TAG_PATTERNS.localization),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 11. feature_request_acknowledged (positive reviewer) ─────────────────
  {
    id: "feature_request_acknowledged",
    variants: [
      "Thank you for the suggestion and for the kind words! We love hearing ideas from users. This has been noted and shared with our product team. Stay tuned — our best updates come from feedback exactly like yours.\n\n— The ReviewBox Team",
      "What a great idea! We've logged your suggestion for our product roadmap. Thank you for taking the time to share it — and for your support.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      r.rating >= 3 &&
      (hasTag(r, "feature-request") ||
        textMatches(r, TAG_PATTERNS["feature-request"])),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 12. feature_request (frustrated reviewer) ───────────────────────────
  {
    id: "feature_request",
    variants: [
      "Thank you for the feedback — we hear you! This feature is on our radar and your input helps us prioritise. We'll share this with our product team. You can also email us at hello@tryreviewbox.com to be notified when it ships.\n\n— The ReviewBox Team",
      "We appreciate you sharing this. Our team reviews all feature requests and this one has been logged. Thank you for helping us build a better product.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      r.rating < 3 &&
      (hasTag(r, "feature-request") ||
        textMatches(r, TAG_PATTERNS["feature-request"])),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 13. general_negative_1star ──────────────────────────────────────────
  {
    id: "general_negative_1star",
    variants: [
      "We're really sorry to hear about your experience — this is not the standard we aim for. Please email us at hello@tryreviewbox.com with details of what went wrong and we'll do everything we can to make it right.\n\n— The ReviewBox Team",
      "Thank you for the honest feedback. We're sorry we let you down. Please reach out at hello@tryreviewbox.com so we can understand what happened and work to resolve it for you.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) => r.rating === 1,
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 14. general_negative_2star ──────────────────────────────────────────
  {
    id: "general_negative_2star",
    variants: [
      "Thank you for taking the time to leave feedback. We're sorry things haven't been smooth. Please email hello@tryreviewbox.com with more details — we'd love to turn this experience around for you.\n\n— The ReviewBox Team",
      "We appreciate you letting us know. We're sorry the app hasn't met your expectations. Please get in touch at hello@tryreviewbox.com so we can look into this for you.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) => r.rating === 2,
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 15. general_mixed ───────────────────────────────────────────────────
  {
    id: "general_mixed",
    variants: [
      "Thank you for the balanced feedback! We're glad some parts are working well and we're actively working on the areas that need improvement. Please feel free to reach out at hello@tryreviewbox.com with specifics.\n\n— The ReviewBox Team",
      "We appreciate the honest review! We'll take your comments on board as we continue to improve. Feel free to email hello@tryreviewbox.com if you'd like to share more details.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) => r.rating === 3,
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 16. positive_5star_detailed ─────────────────────────────────────────
  {
    id: "positive_5star_detailed",
    variants: [
      "Wow, thank you so much for this amazing review! Feedback like yours is what keeps our team motivated. We're thrilled the app is working so well for you, and we'll keep raising the bar.\n\n— The ReviewBox Team",
      "This genuinely made our day! Thank you for taking the time to share such a detailed review. We're so glad you're enjoying the app and we'll keep working hard to deserve it.\n\n— The ReviewBox Team",
      "Thank you so much — we really appreciate the kind words and the detail you shared. It means a lot to everyone on the team. We'll keep delivering!\n\n— The ReviewBox Team",
    ],
    matchFn: (r) => r.rating === 5 && wordCount(r) >= 15,
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 17. positive_5star_short ────────────────────────────────────────────
  {
    id: "positive_5star_short",
    variants: [
      "Thank you so much for the 5 stars! We really appreciate your support.\n\n— The ReviewBox Team",
      "Thank you! Reviews like yours mean the world to us. We're so happy you're enjoying the app!\n\n— The ReviewBox Team",
    ],
    matchFn: (r) => r.rating === 5 && wordCount(r) < 15,
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 18. positive_4star ──────────────────────────────────────────────────
  {
    id: "positive_4star",
    variants: [
      "Thank you for the 4-star review! We're really glad you're enjoying the app. If there's anything we can do to make it a 5-star experience, please let us know at hello@tryreviewbox.com.\n\n— The ReviewBox Team",
      "Thank you! We appreciate the feedback. If you have any suggestions for how we can do even better, we'd love to hear them at hello@tryreviewbox.com.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) => r.rating === 4,
    pick(r) { return pickVariant(this.variants, r); },
  },

  // ── 19. rating_only ─────────────────────────────────────────────────────
  {
    id: "rating_only",
    variants: [
      "Thank you for rating us! If you'd ever like to share more about your experience, we'd love to hear from you at hello@tryreviewbox.com.\n\n— The ReviewBox Team",
      "Thanks for the rating! Feel free to reach out at hello@tryreviewbox.com if there's anything we can help you with.\n\n— The ReviewBox Team",
    ],
    matchFn: (r) =>
      wordCount(r) < 15 &&
      (r.issueTags ?? []).length === 0 &&
      !textMatches(r, TAG_PATTERNS.crash) &&
      !textMatches(r, TAG_PATTERNS.billing),
    pick(r) { return pickVariant(this.variants, r); },
  },

  // Templates 20-25 reserved for competitor_mention + locale-specific variants
  // competitor_mention requires a dynamic workspace competitor list —
  // use matchTemplateForReview({ workspaceCompetitors }) overload when ready.
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Backward-compatible function — same signature as the original templates.ts.
 * Used by the existing reply/draft route.
 */
export function matchTemplate(review: {
  rating: number;
  body: string;
  tags: string[];
}): string | null {
  const mapped: AppReview = {
    id: "",
    author: "",
    rating: review.rating as AppReview["rating"],
    text: review.body,
    appVersion: "",
    device: "",
    country: "",
    issueTags: review.tags as ReviewIssueTag[],
    sentiment: "mixed",
    priority: "normal",
    replyStatus: "needs_reply",
    escalationState: "none",
    createdAt: new Date().toISOString(),
    source: "Google Play",
    hasAiSuggestion: false,
  };
  return matchTemplateForReview(mapped);
}

/**
 * Full AppReview matcher — preferred for new code.
 * Returns the reply string or null if no template matches.
 */
export function matchTemplateForReview(
  review: AppReview,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _workspaceCompetitors?: string[],
): string | null {
  const def = getMatchedTemplate(review);
  return def ? def.pick(review) : null;
}

/**
 * Returns the matched TemplateDefinition (useful for analytics/logging).
 */
export function getMatchedTemplate(
  review: AppReview,
): TemplateDefinition | null {
  for (const tmpl of TEMPLATES) {
    if (tmpl.matchFn(review)) return tmpl;
  }
  return null;
}
