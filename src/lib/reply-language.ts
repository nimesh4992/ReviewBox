/**
 * reply-language.ts — which language do we write the reply in?
 *
 * Detection answers "what did the reviewer write?". This answers the separate,
 * *product* question "what will we publish?", and the two are not the same:
 * the reply is posted publicly on the store under the customer's developer
 * name, so a language we cannot write well is a reputational cost they pay,
 * not a nice-to-have we get to attempt.
 *
 * Kept apart from `language-detect.ts` for the same reason `toEvalBucket` is:
 * detection is a claim about the world and must stay honest, while this is
 * ReviewBox policy and is allowed to be conservative. Changing the policy must
 * never mean editing the detector.
 *
 * ── The decision, in order ──────────────────────────────────────────────────
 *
 *   1. The detector names a language we support  → reply in it.
 *   2. The detector declines to name one (`null`) → English.
 *   3. It names one we do not support            → English.
 *   4. It names one below `MIN_REPLY_CONFIDENCE`  → English.
 *
 * English is the fallback in every branch, and the fallback is *explicit*: the
 * prompt says "write in English" rather than staying silent. Silence is not
 * neutral — an LLM handed a Thai review with no language instruction answers in
 * Thai. So saying nothing would make the fallback depend on model mood, which
 * is exactly what "deterministic" rules out.
 *
 * The one case that stays silent is a review already detected as English at
 * full confidence. That leaves the system prompt byte-identical to what it was
 * before this module existed, which keeps the Redis reply cache warm and keeps
 * English output unchanged — the overwhelmingly common path.
 */

import { detectLanguage, ENGLISH_CERTAINTY, type LanguageDetection } from "./language-detect";

/** Reply language we fall back to whenever the answer is not clear-cut. */
export const DEFAULT_REPLY_LANGUAGE = "en";

/**
 * Below this, a named language is treated as a guess and not acted on.
 *
 * Today `detectLanguage` never returns a non-null language under 0.5, so this
 * rejects nothing — which is the point. It is a standing guard, so that a
 * future detector change that starts emitting low-confidence guesses cannot
 * silently begin steering what we publish on a customer's store listing.
 */
export const MIN_REPLY_CONFIDENCE = 0.5;

/**
 * Languages we are willing to publish a reply in, and how to name each one to
 * the model.
 *
 * **The cut is by model coverage, and it is deliberately conservative.** Groq
 * Llama 3.3 70B and Gemini Flash write these fluently. Languages the detector
 * can name but that are not here — Sinhala, Khmer, Lao, Burmese, Odia,
 * Georgian, Armenian — are low-resource for both, and nobody on a one-person
 * support team can proofread the result before it goes public. Those fall back
 * to English on purpose.
 *
 * Latin-script Spanish, French, German, Portuguese and Italian are absent for a
 * different reason: the detector reports "not English, undetermined" for them
 * rather than naming them (its marker lists overlap across those languages), so
 * there is nothing here for an entry to match. Naming them is the natural next
 * step and is tracked in the handoff, not silently half-done here.
 */
export const REPLY_LANGUAGES: Readonly<Record<string, string>> = {
  en:        "English",
  hi:        "Hindi",
  // The script matters as much as the language. A reviewer who wrote "paisa
  // cut gaya" is not necessarily a Devanagari reader, and answering them in a
  // script they may not read is worse than answering in English.
  "hi-Latn": "Hindi in Latin script (romanised, the way the reviewer wrote it)",
  mr:        "Marathi",
  ta:        "Tamil",
  te:        "Telugu",
  kn:        "Kannada",
  ml:        "Malayalam",
  gu:        "Gujarati",
  pa:        "Punjabi",
  ja:        "Japanese",
  ko:        "Korean",
  th:        "Thai",
  el:        "Greek",
  he:        "Hebrew",
};

/** Why we ended up with the language we did. Logged, and asserted in tests. */
export type ReplyLanguageReason =
  /** The detector named a supported language confidently. */
  | "detected"
  /** No letters to go on at all — empty, emoji-only, digits. */
  | "no-text"
  /** The detector declined to name a language. */
  | "undetermined"
  /** Named, but below `MIN_REPLY_CONFIDENCE`. */
  | "low-confidence"
  /** Named confidently, but not one we publish in. */
  | "unsupported";

export interface ReplyLanguageDecision {
  /** Always a key of `REPLY_LANGUAGES`. "en" whenever we fell back. */
  code: string;
  /** How to name `code` to the model. */
  label: string;
  /** What detection actually said, including languages we do not support. */
  detected: string | null;
  confidence: number;
  /** True when `code` is not what was detected. */
  fallback: boolean;
  reason: ReplyLanguageReason;
}

function decide(detection: LanguageDetection): ReplyLanguageDecision {
  const { language, confidence } = detection;

  const base = { detected: language, confidence };
  const englishFallback = (reason: ReplyLanguageReason): ReplyLanguageDecision => ({
    ...base,
    code: DEFAULT_REPLY_LANGUAGE,
    label: REPLY_LANGUAGES[DEFAULT_REPLY_LANGUAGE],
    fallback: true,
    reason,
  });

  if (language === null) {
    // Confidence 0 means there were no letters at all, which is a different
    // situation from "letters we could not place" and worth telling apart in
    // the logs: one is an emoji-only review, the other is a detector gap.
    return englishFallback(confidence === 0 ? "no-text" : "undetermined");
  }
  if (confidence < MIN_REPLY_CONFIDENCE) return englishFallback("low-confidence");

  const label = REPLY_LANGUAGES[language];
  if (!label) return englishFallback("unsupported");

  return { ...base, code: language, label, fallback: false, reason: "detected" };
}

/**
 * Decide the reply language for a review, from the review text alone.
 *
 * **Server-side only, and never from client input.** The caller passes the
 * review body it is replying to; there is deliberately no parameter for a
 * client-supplied language. A request that could name its own reply language
 * could also name one whose `label` lands in the system prompt, which is a free
 * text channel into the prompt — and the value is published on a public store
 * listing under the customer's name. Everything here is derived, and `label`
 * only ever comes from the fixed `REPLY_LANGUAGES` table.
 *
 * @param text          the review body being replied to
 * @param sourceLanguage the `hl` the store was asked for, if known — a prior only
 */
export function resolveReplyLanguage(
  text: string | null | undefined,
  sourceLanguage?: string | null,
): ReplyLanguageDecision {
  if (typeof text !== "string" || text.trim().length === 0) {
    return {
      code: DEFAULT_REPLY_LANGUAGE,
      label: REPLY_LANGUAGES[DEFAULT_REPLY_LANGUAGE],
      detected: null,
      confidence: 0,
      fallback: true,
      reason: "no-text",
    };
  }
  return decide(detectLanguage(text.trim(), sourceLanguage));
}

/**
 * The sentence appended to the system prompt for this decision.
 *
 * Returns "" for a review already confidently detected as English — see the
 * module header: that keeps English prompts, and so the reply cache, exactly as
 * they were. Every other case gets an explicit instruction, including the
 * English fallbacks, because silence would hand the choice to the model.
 *
 * No em dashes: the style rules in `buildSystemPrompt` forbid them in output,
 * and a prompt that uses the punctuation it bans is a mixed signal.
 */
export function replyLanguageInstruction(decision: ReplyLanguageDecision): string {
  if (decision.code !== DEFAULT_REPLY_LANGUAGE) {
    return (
      ` The reviewer wrote in ${decision.label}.` +
      ` Write the whole reply in ${decision.label}, not in English.` +
      ` Leave the sign-off name exactly as given.`
    );
  }

  const confidentlyEnglish =
    decision.detected === DEFAULT_REPLY_LANGUAGE &&
    decision.confidence >= ENGLISH_CERTAINTY;
  if (confidentlyEnglish) return "";

  return " Write the reply in English.";
}
