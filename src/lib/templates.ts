/**
 * templates.ts
 *
 * Tone-aware, workspace-personalised reply templates.
 *
 * Each template has:
 *   - toneVariants: explicit copy per tone for the 10 highest-traffic templates
 *   - variants: professional fallback for lower-traffic templates (still valid)
 *
 * All text uses {appName}, {supportEmail}, {teamName} placeholders.
 * Call personalizeText() from workspace-persona.ts before returning to the user.
 *
 * Matched in priority order — first match wins (~75% of real-world reviews).
 * Remaining ~25% fall through to Tier-2 reply-composer.ts.
 */

import { TAG_PATTERNS } from "@/lib/rules-engine";
import type { AppReview, ReviewIssueTag } from "@/types/review";

// ── Types ─────────────────────────────────────────────────────────────────────

export type AIReplyTone = "professional" | "empathetic" | "casual" | "direct";

export interface TemplateDefinition {
  id: string;
  /** Tone-specific variants (preferred). Present for high-traffic templates. */
  toneVariants?: Partial<Record<AIReplyTone, string[]>>;
  /** Professional fallback variants — used when toneVariants not set for the requested tone. */
  variants: string[];
  matchFn: (review: AppReview) => boolean;
  /**
   * Pick a reply variant, preferring the requested tone.
   * Deterministic: same review + tone always returns same text.
   */
  pick: (review: AppReview, tone?: AIReplyTone) => string;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

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

function pickTone(
  def: TemplateDefinition,
  review: AppReview,
  tone?: AIReplyTone,
): string {
  if (tone && def.toneVariants?.[tone]?.length) {
    return pickVariant(def.toneVariants[tone]!, review);
  }
  return pickVariant(def.variants, review);
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

// ── Template definitions ──────────────────────────────────────────────────────

const TEMPLATES: TemplateDefinition[] = [

  // ── 1. crash_critical (1★ + crash) ──────────────────────────────────────
  {
    id: "crash_critical",
    toneVariants: {
      professional: [
        "We sincerely apologise for the crash — that is completely unacceptable and we are investigating it as a top priority. Please email us at {supportEmail} with your device model and OS version so our engineering team can look into your specific case.\n\n— {teamName}",
        "A crash is never okay and we take this seriously. Our engineering team is actively investigating. Please reach out at {supportEmail} with your device details and we will follow up directly.\n\n— {teamName}",
      ],
      empathetic: [
        "We're so sorry the app is crashing for you — that's completely unacceptable and we genuinely want to fix it. Please email us at {supportEmail} with your device model and OS version so our team can investigate your specific case right away.\n\n— {teamName}",
        "A crash experience is the last thing you should have to deal with, and we're truly sorry. Our engineers are on it. Could you email {supportEmail} with your device details? We'll follow up personally.\n\n— {teamName}",
      ],
      casual: [
        "Oh no — so sorry about the crash! That's definitely not the experience we want for you. Drop us an email at {supportEmail} with your device model and we'll get our engineers looking at it right away.\n\n— {teamName}",
        "Crashes are the worst — really sorry about that! Our team is on it. Email us at {supportEmail} with your device info and we'll sort this out for you!\n\n— {teamName}",
      ],
      direct: [
        "Sorry for the crash. Our engineering team is investigating. Email {supportEmail} with device model + OS version.\n\n— {teamName}",
        "Crash reported — engineers are on it. Send device details to {supportEmail} for a direct follow-up.\n\n— {teamName}",
      ],
    },
    variants: [
      "We're so sorry to hear the app is crashing for you — that's completely unacceptable and we want to fix it right away. Please reach out to us at {supportEmail} with your device model and OS version so our engineering team can investigate. We'll keep you updated.\n\n— {teamName}",
      "A crash is never okay, and we sincerely apologise for the experience. Our engineers are actively investigating stability issues. Could you email us at {supportEmail} with your device details? We'll follow up directly.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      r.rating === 1 &&
      (hasTag(r, "crash") || textMatches(r, TAG_PATTERNS.crash)),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 2. crash_negative (2★ + crash) ──────────────────────────────────────
  {
    id: "crash_negative",
    toneVariants: {
      professional: [
        "Thank you for letting us know about the crash — we take stability seriously and this has been flagged to our engineering team. Please email {supportEmail} with your device model so we can investigate.\n\n— {teamName}",
        "We're sorry the app crashed on you. Our team is working on stability improvements. Please reach out at {supportEmail} with your device and OS version.\n\n— {teamName}",
      ],
      empathetic: [
        "We're really sorry to hear about the crash — that sounds incredibly frustrating. Our engineers are actively looking into stability issues. Please email us at {supportEmail} with your device details and we'd love to resolve this for you directly.\n\n— {teamName}",
        "Crashes are so disruptive and we genuinely apologise. Our team is working on a fix. If you could email {supportEmail} with your device model, we'll investigate your specific case.\n\n— {teamName}",
      ],
      casual: [
        "Ugh, so sorry about the crash! Our engineers are already on it. Drop us an email at {supportEmail} with your device info and we'll look into it specifically for you!\n\n— {teamName}",
        "Really sorry to hear that — crashes are the worst! Email us at {supportEmail} with your device and OS version and we'll get it sorted.\n\n— {teamName}",
      ],
      direct: [
        "Crash flagged to engineering. Email {supportEmail} with device model + OS.\n\n— {teamName}",
        "Sorry about the crash. Send device details to {supportEmail} — we'll investigate.\n\n— {teamName}",
      ],
    },
    variants: [
      "Thank you for letting us know about the crash — we take stability seriously and this has been flagged to our engineering team. Please email {supportEmail} with your device model so we can look into it specifically for you.\n\n— {teamName}",
      "We're sorry the app crashed on you. Our team is working on stability improvements. If it continues, please reach out at {supportEmail} with your device and OS version.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      r.rating === 2 &&
      (hasTag(r, "crash") || textMatches(r, TAG_PATTERNS.crash)),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 3. billing_refund_request ────────────────────────────────────────────
  {
    id: "billing_refund_request",
    toneVariants: {
      professional: [
        "We're sorry to hear about the billing issue and completely understand your frustration. Please contact us at {supportEmail} with your order details and we'll process a resolution as quickly as possible.\n\n— {teamName}",
        "Thank you for bringing this to our attention. Billing issues are our top priority to resolve. Please email {supportEmail} with your account email and transaction details and our team will get back to you within 24 hours.\n\n— {teamName}",
      ],
      empathetic: [
        "We're genuinely sorry for any billing issue — that's really stressful and we want to make it right as quickly as possible. Please email {supportEmail} with your order details and we'll personally ensure this is resolved for you.\n\n— {teamName}",
        "Billing problems are incredibly frustrating and we sincerely apologise. Please reach out at {supportEmail} with your account email and we'll sort this out for you within 24 hours.\n\n— {teamName}",
      ],
      casual: [
        "So sorry about the billing issue — that's super stressful! Email us at {supportEmail} with your order info and we'll get it sorted for you right away.\n\n— {teamName}",
        "Oh no — billing problems are the worst! Drop us an email at {supportEmail} with your details and we'll fix this for you within 24 hours.\n\n— {teamName}",
      ],
      direct: [
        "Billing issue noted. Email {supportEmail} with order details — resolved within 24h.\n\n— {teamName}",
        "Send transaction details to {supportEmail}. We'll process a resolution within 24 hours.\n\n— {teamName}",
      ],
    },
    variants: [
      "We're sorry to hear about the billing issue and completely understand your frustration. Please contact us at {supportEmail} with your order details and we'll process a resolution as quickly as possible.\n\n— {teamName}",
      "Thank you for bringing this to our attention. Billing issues are our top priority to resolve. Please email {supportEmail} with your account email and transaction details and our team will get back to you within 24 hours.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      hasTag(r, "billing") && /refund|charged.?twice|overcharg|money.?back/i.test(r.text ?? ""),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 4. billing_dispute ──────────────────────────────────────────────────
  {
    id: "billing_dispute",
    variants: [
      "We're sorry for any confusion around billing. Please reach out to us at {supportEmail} with your account details and we'll clarify your charges and make things right.\n\n— {teamName}",
      "Thank you for flagging this. Our team is happy to walk you through your billing details. Please contact {supportEmail} and we'll get back to you within one business day.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      hasTag(r, "billing") &&
      !/refund|charged.?twice|overcharg|money.?back/i.test(r.text ?? ""),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 5. data_privacy_concern ──────────────────────────────────────────────
  {
    id: "data_privacy_concern",
    variants: [
      "We take data privacy very seriously. All user data is processed in accordance with GDPR and our Privacy Policy. If you'd like to request a data export or deletion, please email {supportEmail} and we'll respond within 72 hours.\n\n— {teamName}",
      "Thank you for raising this. Your privacy matters deeply to us. We'd be happy to walk you through our data practices or process any request — simply email {supportEmail} with the subject 'Privacy Request'.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      /data.*(privacy|gdpr|personal|delete.?my|remove.?my)|privacy.?concern|my.?data/i.test(
        r.text ?? "",
      ),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 6. login_issue ──────────────────────────────────────────────────────
  {
    id: "login_issue",
    toneVariants: {
      professional: [
        "We're sorry you're experiencing login difficulties. Please try resetting your password via the 'Forgot password' link. If the issue persists, email us at {supportEmail} with your account email and we'll help you regain access immediately.\n\n— {teamName}",
        "Login issues are a top priority for us. Please try the 'Forgot password' flow first. If that doesn't help, contact {supportEmail} with your account details and we'll resolve this for you right away.\n\n— {teamName}",
      ],
      empathetic: [
        "Being locked out of an app is incredibly frustrating, and we're truly sorry you're going through this. Please try the 'Forgot password' link first. If that doesn't work, email us at {supportEmail} and we'll personally get you back in as quickly as possible.\n\n— {teamName}",
        "We understand how stressful it is when you can't log in — we want to get this sorted for you immediately. Try resetting your password first, or email us at {supportEmail} and we'll take care of it.\n\n— {teamName}",
      ],
      casual: [
        "So sorry you're locked out — that's super annoying! Try the 'Forgot password' link first. If that doesn't work, drop us an email at {supportEmail} and we'll get you back in right away!\n\n— {teamName}",
        "Ugh, login issues are the worst! Try resetting your password, and if that doesn't do the trick, email us at {supportEmail} with your account details — we'll sort it!\n\n— {teamName}",
      ],
      direct: [
        "Try: 1) Forgot password link. 2) Clear app cache. 3) Email {supportEmail} with account email if still stuck.\n\n— {teamName}",
        "Reset password via 'Forgot password'. Still stuck? Email {supportEmail} with account details.\n\n— {teamName}",
      ],
    },
    variants: [
      "We're sorry you're having trouble signing in — that's incredibly frustrating. Please try resetting your password via the 'Forgot password' link. If the issue persists, email us at {supportEmail} and we'll help you regain access immediately.\n\n— {teamName}",
      "Login issues are a top priority for us. Please try the 'Forgot password' flow first. If that doesn't help, reach out at {supportEmail} with your account email and we'll sort this out for you right away.\n\n— {teamName}",
    ],
    matchFn: (r) => hasTag(r, "login") || textMatches(r, TAG_PATTERNS.login),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 7. performance_issue ────────────────────────────────────────────────
  {
    id: "performance_issue",
    toneVariants: {
      professional: [
        "We're sorry {appName} isn't performing well for you. Performance is a top priority for our team. Clearing the app cache may help in the meantime. Please email {supportEmail} with your device model and OS version if the issue persists.\n\n— {teamName}",
        "Thank you for flagging the performance issue. We're actively working on speed improvements and a fix is in progress. Clearing the app cache may help while we push the update.\n\n— {teamName}",
      ],
      empathetic: [
        "A slow or unresponsive app is really frustrating, and we're sorry about that. Our team is actively working on performance improvements. Clearing the app cache often helps — and please email {supportEmail} if it continues.\n\n— {teamName}",
        "We hear you on the performance issues — that shouldn't be happening and we're genuinely sorry. We're working on it and clearing the cache may give you some relief in the meantime.\n\n— {teamName}",
      ],
      casual: [
        "Slowdowns are super annoying — sorry about that! Try clearing the app cache; it usually helps. Our team is already working on a performance fix. Email {supportEmail} if it keeps up!\n\n— {teamName}",
        "Ugh, nobody wants a slow app! We're on it — clear the cache for now and watch for our next update. Drop us an email at {supportEmail} if it's still buggy!\n\n— {teamName}",
      ],
      direct: [
        "Performance fix in progress. Try: clear app cache + fresh install. Email {supportEmail} with device model if still slow.\n\n— {teamName}",
        "Known issue — fix shipping soon. Clear cache to help in the meantime.\n\n— {teamName}",
      ],
    },
    variants: [
      "We're sorry the app isn't performing well for you. Performance is a top priority for our team. Trying a fresh install often helps — but if it continues, please email {supportEmail} with your device model and OS version so we can investigate further.\n\n— {teamName}",
      "Thank you for the feedback on performance. We're actively working on speed improvements. In the meantime, clearing the app cache may help. Please reach out at {supportEmail} if the issue persists.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      r.rating <= 3 &&
      (hasTag(r, "performance") || textMatches(r, TAG_PATTERNS.performance)),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 8. update_complaint (release regression) ─────────────────────────────
  {
    id: "update_complaint",
    variants: [
      "We're sorry the recent update hasn't been smooth for you. We work hard to improve with every release, but sometimes things don't go as planned. Please email {supportEmail} with details of what broke — it helps us fix it faster for everyone.\n\n— {teamName}",
      "Thank you for letting us know about this regression. We've flagged it to our engineering team for investigation. Please reach out at {supportEmail} with your app version and device so we can prioritise a fix.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      hasTag(r, "release-regression") ||
      textMatches(r, TAG_PATTERNS["release-regression"]),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 9. support_delay_apology ─────────────────────────────────────────────
  {
    id: "support_delay_apology",
    variants: [
      "We sincerely apologise for the delay in getting back to you — that's not the standard we hold ourselves to. Please email {supportEmail} directly with your original query and we'll respond within 24 hours.\n\n— {teamName}",
      "We're really sorry you've been waiting. Your issue matters to us and should never have gone unanswered this long. Please email {supportEmail} and we'll make this right.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      hasTag(r, "support-delay") ||
      textMatches(r, TAG_PATTERNS["support-delay"]),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 10. localization_feedback ────────────────────────────────────────────
  {
    id: "localization_feedback",
    variants: [
      "Thank you for this feedback! We're actively working on improving our language support. Please email {supportEmail} to let us know your preferred language so we can prioritise it.\n\n— {teamName}",
      "We appreciate you flagging this. Better localisation is important to us. Please reach out at {supportEmail} with your language preference and we'll keep you updated on our progress.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      hasTag(r, "localization") || textMatches(r, TAG_PATTERNS.localization),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 11. feature_request_acknowledged (≥3★) ───────────────────────────────
  {
    id: "feature_request_acknowledged",
    toneVariants: {
      professional: [
        "Thank you for the suggestion and for the kind words! We log all feature requests and share them with our product team. Stay tuned — our best updates come from feedback exactly like yours.\n\n— {teamName}",
        "What a great idea! We've added your suggestion to our product roadmap. Thank you for taking the time to share it — and for your support.\n\n— {teamName}",
      ],
      empathetic: [
        "We love that you care enough to suggest this — it really helps us build something you'll love! Your request has been logged and shared with our product team. Thank you so much.\n\n— {teamName}",
        "This is exactly the kind of feedback that shapes what we build next. Thank you for taking the time — and for your kind words! We've noted your suggestion for the roadmap.\n\n— {teamName}",
      ],
      casual: [
        "Love the idea — thanks for sharing! We've logged it for the product team. You might just see it in a future update! 😊\n\n— {teamName}",
        "Great suggestion! Our team loved reading this. We've added it to the roadmap — keep the ideas coming!\n\n— {teamName}",
      ],
      direct: [
        "Feature logged. Good suggestion — thank you.\n\n— {teamName}",
        "Noted for the roadmap. Appreciate the feedback.\n\n— {teamName}",
      ],
    },
    variants: [
      "Thank you for the suggestion and for the kind words! We love hearing ideas from users. This has been noted and shared with our product team. Stay tuned — our best updates come from feedback exactly like yours.\n\n— {teamName}",
      "What a great idea! We've logged your suggestion for our product roadmap. Thank you for taking the time to share it — and for your support.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      r.rating >= 3 &&
      (hasTag(r, "feature-request") ||
        textMatches(r, TAG_PATTERNS["feature-request"])),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 12. feature_request (frustrated, <3★) ───────────────────────────────
  {
    id: "feature_request",
    toneVariants: {
      empathetic: [
        "We hear you — and we appreciate you taking the time to share this even when the experience has been frustrating. Your suggestion has been logged for our product team. You can also email {supportEmail} to be notified when it ships.\n\n— {teamName}",
      ],
      casual: [
        "Thanks for the suggestion even amid the frustration — we really appreciate it! We've logged it for the product team. Email {supportEmail} if you want to be notified when it ships!\n\n— {teamName}",
      ],
      direct: [
        "Feature logged. Email {supportEmail} to be notified when it ships.\n\n— {teamName}",
      ],
    },
    variants: [
      "Thank you for the feedback — we hear you! This feature is on our radar and your input helps us prioritise. We'll share this with our product team. You can also email us at {supportEmail} to be notified when it ships.\n\n— {teamName}",
      "We appreciate you sharing this. Our team reviews all feature requests and this one has been logged. Thank you for helping us build a better product.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      r.rating < 3 &&
      (hasTag(r, "feature-request") ||
        textMatches(r, TAG_PATTERNS["feature-request"])),
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 13. general_negative_1star ──────────────────────────────────────────
  {
    id: "general_negative_1star",
    toneVariants: {
      professional: [
        "We're very sorry to hear about your experience — this is not the standard we aim for. Please email us at {supportEmail} with details of what went wrong and we'll do everything we can to make it right.\n\n— {teamName}",
        "Thank you for the honest feedback. We're sorry we let you down. Please reach out at {supportEmail} so we can understand what happened and work to resolve it for you.\n\n— {teamName}",
      ],
      empathetic: [
        "We're really sorry to hear this — your experience should have been so much better, and we genuinely want to make it right. Please email us at {supportEmail} with the details and we'll personally look into it.\n\n— {teamName}",
        "We hear you, and we're truly sorry. This isn't the experience we work hard to deliver. Please reach out at {supportEmail} — we'd love to turn things around for you.\n\n— {teamName}",
      ],
      casual: [
        "So sorry to hear this — that's definitely not the experience we want for you! Please email us at {supportEmail} with what happened and we'll do our best to make it right.\n\n— {teamName}",
        "Really sorry about this! Email us at {supportEmail} with the details and we'll get on it right away.\n\n— {teamName}",
      ],
      direct: [
        "Sorry for the bad experience. Email {supportEmail} with details — we'll fix it.\n\n— {teamName}",
        "We'll make this right. Email {supportEmail}.\n\n— {teamName}",
      ],
    },
    variants: [
      "We're really sorry to hear about your experience — this is not the standard we aim for. Please email us at {supportEmail} with details of what went wrong and we'll do everything we can to make it right.\n\n— {teamName}",
      "Thank you for the honest feedback. We're sorry we let you down. Please reach out at {supportEmail} so we can understand what happened and work to resolve it for you.\n\n— {teamName}",
    ],
    matchFn: (r) => r.rating === 1,
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 14. general_negative_2star ──────────────────────────────────────────
  {
    id: "general_negative_2star",
    variants: [
      "Thank you for taking the time to leave feedback. We're sorry things haven't been smooth. Please email {supportEmail} with more details — we'd love to turn this experience around for you.\n\n— {teamName}",
      "We appreciate you letting us know. We're sorry {appName} hasn't met your expectations. Please get in touch at {supportEmail} so we can look into this for you.\n\n— {teamName}",
    ],
    matchFn: (r) => r.rating === 2,
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 15. general_mixed ────────────────────────────────────────────────────
  {
    id: "general_mixed",
    variants: [
      "Thank you for the balanced feedback! We're glad some parts are working well and we're actively working on the areas that need improvement. Please feel free to reach out at {supportEmail} with specifics.\n\n— {teamName}",
      "We appreciate the honest review! We'll take your comments on board as we continue to improve. Feel free to email {supportEmail} if you'd like to share more details.\n\n— {teamName}",
    ],
    matchFn: (r) => r.rating === 3,
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 16. positive_5star_detailed ──────────────────────────────────────────
  {
    id: "positive_5star_detailed",
    toneVariants: {
      professional: [
        "Thank you for such a detailed and positive review! Feedback like this is exactly what keeps our team motivated. We're thrilled {appName} is working so well for you.\n\n— {teamName}",
        "This genuinely made our day. Thank you for taking the time to share such a thoughtful review. We'll keep working hard to deserve it.\n\n— {teamName}",
      ],
      empathetic: [
        "Wow, this genuinely made our day — thank you so much for taking the time to write this! It means so much to everyone who works on {appName}.\n\n— {teamName}",
        "We're so happy to read this — thank you for such a wonderful review! Reviews like yours are what remind us why we do what we do.\n\n— {teamName}",
      ],
      casual: [
        "This is amazing — thank you so much! 🙌 Reviews like yours make all the hard work worth it. We'll keep making {appName} even better!\n\n— {teamName}",
        "You made our whole team smile — thank you! We really appreciate you taking the time to share this. More great things to come! 🚀\n\n— {teamName}",
      ],
      direct: [
        "Thank you — this means a lot to the team. We'll keep shipping.\n\n— {teamName}",
        "Really appreciate the kind words. More good stuff coming.\n\n— {teamName}",
      ],
    },
    variants: [
      "Wow, thank you so much for this amazing review! Feedback like yours is what keeps our team motivated. We're thrilled {appName} is working so well for you, and we'll keep raising the bar.\n\n— {teamName}",
      "This genuinely made our day! Thank you for taking the time to share such a detailed review. We're so glad you're enjoying the app and we'll keep working hard to deserve it.\n\n— {teamName}",
      "Thank you so much — we really appreciate the kind words and the detail you shared. It means a lot to everyone on the team. We'll keep delivering!\n\n— {teamName}",
    ],
    matchFn: (r) => r.rating === 5 && wordCount(r) >= 15,
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 17. positive_5star_short ────────────────────────────────────────────
  {
    id: "positive_5star_short",
    toneVariants: {
      empathetic: [
        "Thank you so much for the 5 stars — it genuinely means a lot to our team! 🌟\n\n— {teamName}",
      ],
      casual: [
        "5 stars!! You're amazing — thank you! 🙌\n\n— {teamName}",
        "Thank you!! Reviews like yours really make our day! 😊\n\n— {teamName}",
      ],
      direct: [
        "Thank you for the 5 stars!\n\n— {teamName}",
      ],
    },
    variants: [
      "Thank you so much for the 5 stars! We really appreciate your support.\n\n— {teamName}",
      "Thank you! Reviews like yours mean the world to us. We're so happy you're enjoying {appName}!\n\n— {teamName}",
    ],
    matchFn: (r) => r.rating === 5 && wordCount(r) < 15,
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 18. positive_4star ──────────────────────────────────────────────────
  {
    id: "positive_4star",
    toneVariants: {
      empathetic: [
        "Thank you for the 4-star review — we're so glad you're enjoying {appName}! We'd love to know what would make it a 5-star experience for you. Please email {supportEmail} anytime.\n\n— {teamName}",
      ],
      casual: [
        "4 stars — thank you! We'd love to earn that 5th star from you. Got any ideas? Email us at {supportEmail}!\n\n— {teamName}",
      ],
      direct: [
        "Thank you for 4 stars. What would make it 5? Email {supportEmail}.\n\n— {teamName}",
      ],
    },
    variants: [
      "Thank you for the 4-star review! We're really glad you're enjoying {appName}. If there's anything we can do to make it a 5-star experience, please let us know at {supportEmail}.\n\n— {teamName}",
      "Thank you! We appreciate the feedback. If you have any suggestions for how we can do even better, we'd love to hear them at {supportEmail}.\n\n— {teamName}",
    ],
    matchFn: (r) => r.rating === 4,
    pick(r, tone) { return pickTone(this, r, tone); },
  },

  // ── 19. rating_only ─────────────────────────────────────────────────────
  {
    id: "rating_only",
    variants: [
      "Thank you for rating {appName}! If you'd ever like to share more about your experience, we'd love to hear from you at {supportEmail}.\n\n— {teamName}",
      "Thanks for the rating! Feel free to reach out at {supportEmail} if there's anything we can help you with.\n\n— {teamName}",
    ],
    matchFn: (r) =>
      wordCount(r) < 15 &&
      (r.issueTags ?? []).length === 0 &&
      !textMatches(r, TAG_PATTERNS.crash) &&
      !textMatches(r, TAG_PATTERNS.billing),
    pick(r, tone) { return pickTone(this, r, tone); },
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * How many built-in reply templates ship with the product.
 *
 * Exported so the marketing site can state the number without retyping it.
 * `/help/ai-replies` claims 25; the array has had 19 for some time, and nothing
 * connected the sentence to the data — the same class of drift that let the
 * pricing page advertise an annual discount the prices did not give (see the
 * "Derived pricing" note in `lib/plans.ts`).
 *
 * Any page quoting this must import it. `marketing-claims-contract.test.ts`
 * fails if a marketing page hardcodes a template count instead.
 */
export const TEMPLATE_COUNT = TEMPLATES.length;

/**
 * Backward-compatible function — accepts raw fields.
 * Used by the existing reply/draft route.
 * NOTE: does NOT apply workspace personalisation — call personalizeText() on the result.
 */
export function matchTemplate(review: {
  rating: number;
  body: string;
  tags: string[];
  tone?: AIReplyTone;
}): string | null {
  const mapped: AppReview = {
    id:             "",
    author:         "",
    rating:         review.rating as AppReview["rating"],
    text:           review.body,
    appVersion:     "",
    device:         "",
    country:        "",
    issueTags:      review.tags as ReviewIssueTag[],
    sentiment:      "mixed",
    priority:       "normal",
    replyStatus:    "needs_reply",
    escalationState:"none",
    createdAt:      new Date().toISOString(),
    source:         "Google Play",
    hasAiSuggestion:false,
  };
  return matchTemplateForReview(mapped, review.tone);
}

/**
 * Full AppReview matcher — preferred for new code.
 * Returns the reply string (with placeholders) or null if no template matches.
 * Call personalizeText() on the result.
 */
export function matchTemplateForReview(
  review: AppReview,
  tone?: AIReplyTone,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _workspaceCompetitors?: string[],
): string | null {
  const def = getMatchedTemplate(review);
  return def ? def.pick(review, tone) : null;
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
