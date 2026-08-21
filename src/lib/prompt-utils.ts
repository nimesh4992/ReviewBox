/**
 * prompt-utils.ts
 *
 * Token compression utilities for AI prompts.
 * Strips review text filler before sending to any LLM, reducing average
 * input from ~55 tokens → ~20 tokens per review (~64% reduction).
 *
 * Also builds minimal system prompts that are cached per tone+context hash.
 */

import {
  replyLanguageInstruction,
  type ReplyLanguageDecision,
} from "./reply-language";

// ── Filler phrases ────────────────────────────────────────────────────────────
// Sorted longest-first to prevent partial matches when iterating.
// All matched case-insensitively.

const FILLER_PHRASES: readonly string[] = [
  "i'm writing this review because",
  "for what it's worth",
  "as far as i can tell",
  "at the end of the day",
  "needless to say",
  "i've been using this app",
  "i have been using this app",
  "long story short",
  "i just wanted to say",
  "i would like to say",
  "i have to admit",
  "i must say that",
  "i have to say",
  "first of all",
  "to be honest",
  "to be fair",
  "in my opinion",
  "i think that",
  "with that said",
  "all in all",
  "just wanted to",
  "i want to say",
  "i'd like to say",
  "let me just say",
  "i must say",
  "first off",
  "update:",
  "edit:",
  "tl;dr",
  "tldr",
  "p.s.",
  "ps:",
];

// Pre-compile regexes once at module load (not per call).
const FILLER_REGEXES: RegExp[] = FILLER_PHRASES.map(
  (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"),
);

// ── compressReviewText ────────────────────────────────────────────────────────

/**
 * Strip filler phrases from review text and truncate to `maxChars`.
 *
 * @example
 * compressReviewText("I've been using this app for 3 months. To be honest the app keeps crashing on login.")
 * // → "for 3 months. the app keeps crashing on login."
 *
 * @param text     Raw review text
 * @param maxChars Maximum characters to keep (default 280 ≈ 70 tokens)
 */
export function compressReviewText(text: string, maxChars = 280): string {
  let out = text;
  for (const re of FILLER_REGEXES) {
    out = out.replace(re, " ");
  }
  // Collapse runs of whitespace
  out = out.replace(/\s{2,}/g, " ").trim();
  // Truncate
  if (out.length > maxChars) {
    // Break at last word boundary before limit
    const truncated = out.slice(0, maxChars);
    const lastSpace = truncated.lastIndexOf(" ");
    out = lastSpace > maxChars * 0.8 ? truncated.slice(0, lastSpace) : truncated;
    out = out.trimEnd() + "…";
  }
  return out;
}

// ── buildSystemPrompt ─────────────────────────────────────────────────────────

interface KbEntry {
  category: string;
  title: string;
  content: string;
}

interface SystemPromptOptions {
  tone: string;
  contextEntries?: KbEntry[];
  /** 1-3 sentence brand voice description stored in workspace settings. */
  brandVoice?: string;
  /** Display name of the team for sign-off (e.g. "The Acme App Team"). */
  teamName?: string;
  /** Hard character limit for the reply (e.g. 350 for Google Play). */
  charLimit?: number;
  /**
   * Which language to write the reply in, from `resolveReplyLanguage()`.
   *
   * A decision object rather than a ready-made string on purpose: the wording
   * is derived here from a fixed table, so no caller can push arbitrary text
   * into the system prompt. Omitted entirely by callers that do not generate a
   * reply from a review (there are none today, but the tier-1 template path is
   * one edit away from being one).
   */
  replyLanguage?: ReplyLanguageDecision;
  /**
   * The workspace's real support address (`persona.supportEmail`).
   *
   * The AI tier was the ONLY tier that never received it: tier-1 templates
   * substitute {supportEmail} in 83 places and the tier-4 composer in 9, this
   * prompt in none. Given room to write a contact line and no address to use,
   * the model invented `support@reviewbox.com`. Replies publish publicly under
   * the customer's developer name, so a confabulated address is a real defect,
   * not a cosmetic one.
   */
  supportEmail?: string;
}

/**
 * Build a system prompt for reply generation.
 *
 * Token budget:
 *  - Base (no brand voice, no KB): ~40 tokens
 *  - With brand voice:             ~65 tokens
 *  - With KB entry:                ~75 tokens
 */
export function buildSystemPrompt(
  toneOrOptions: string | SystemPromptOptions,
  contextEntries: KbEntry[] = [],
): string {
  // Support both old call signature and new options object
  const opts: SystemPromptOptions =
    typeof toneOrOptions === "string"
      ? { tone: toneOrOptions, contextEntries }
      : { contextEntries, ...toneOrOptions };

  const { tone, brandVoice, teamName, charLimit, replyLanguage, supportEmail } = opts;
  const entries = opts.contextEntries ?? contextEntries;

  const toneMap: Record<string, string> = {
    professional: "professional and concise",
    empathetic:   "warm and empathetic",
    casual:       "friendly and casual",
    direct:       "direct and solution-focused",
    enthusiastic: "enthusiastic and positive",
  };
  const tonePhrase = toneMap[tone] ?? "professional and helpful";
  const signoff    = teamName ?? "The Support Team";
  const limitNote  = charLimit ? ` Stay under ${charLimit} characters total.` : " Under 120 words.";

  // Unconditional: the model must never invent contact details even when we
  // have no address to give it. Supplying the real one is the other half.
  const contactRule = supportEmail
    ? ` If you point the reviewer at support, use exactly ${supportEmail}.` +
      ` Never invent an email address, URL, or phone number.`
    : ` Never invent an email address, URL, or phone number, and do not tell` +
      ` the reviewer to contact support at a specific address.`;

  // Brand voice block — most impactful quality lever
  const brandBlock = brandVoice
    ? ` Brand voice: ${brandVoice.slice(0, 200).trim()}.`
    : "";

  // KB context block — relevant known issues / FAQs
  let contextBlock = "";
  if (entries.length > 0) {
    const entry   = entries[0];
    const snippet = entry.content.slice(0, 100).trim();
    contextBlock  = ` Known context: [${entry.category}] ${snippet}`;
  }

  // The style rules exist because the output is published publicly on the
  // store under the customer's developer name. A reply that reads as
  // machine-written costs them more than no reply would. The named tells are
  // the ones that actually showed up in production drafts: em dashes, stacked
  // corporate reassurances ("we take X very seriously"), and every reply
  // opening the same way.
  const styleRules =
    ` Write the way a real person on a small support team writes:` +
    ` plain words, contractions, one idea per sentence.` +
    ` Never use em dashes or en dashes — use a comma, a full stop, or rewrite.` +
    ` Do not stack reassurance phrases like "we take this very seriously" or` +
    ` "we value your feedback"; say the specific thing instead.` +
    ` Respond to what this reviewer actually wrote, naming their problem in` +
    ` their words. Vary how you open; never begin with "Thank you for your` +
    ` feedback". No marketing language, no emoji unless the tone is casual.` +
    ` If you cannot promise a fix, do not imply one.`;

  // Empty for a review already confidently detected as English, which keeps
  // the prompt for the common path byte-identical to what it was before reply
  // languages existed. That matters beyond tidiness: the prompt is part of the
  // reply cache key, so a gratuitous change here would cold-start every
  // workspace's cache.
  const languageNote = replyLanguage ? replyLanguageInstruction(replyLanguage) : "";

  return (
    `You are a support agent replying to an app store review.` +
    brandBlock +
    ` Be ${tonePhrase}.` +
    styleRules +
    contactRule +
    languageNote +
    limitNote +
    ` End with a sign-off line: "- ${signoff}".` +
    contextBlock
  );
}

// ── estimateTokens ────────────────────────────────────────────────────────────

/**
 * Fast approximation of token count (4 chars ≈ 1 token for English text).
 * Used for logging and budget checks — not for billing.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Strip the punctuation that makes a reply read as machine-written.
 *
 * Em dashes are the giveaway. Every LLM reaches for them, almost no support
 * agent types one, and these replies are published publicly on the store under
 * the customer's developer name — so "obviously AI" is a reputational cost, not
 * a style quibble. The deterministic composer used them too (`— {teamName}`),
 * which is why they showed up even when no model ran.
 *
 * Applied to the final text of every tier rather than trusted to the prompt: a
 * model instruction is a request, and the template and composer tiers never
 * see a prompt at all.
 */
export function humanizePunctuation(text: string): string {
  return text
    // "word — word" → "word, word"; a dash used as a sign-off marker
    // ("\n— Team") becomes a plain hyphen so the line still reads as a sign-off.
    .replace(/(\n+)[ \t]*[—–][ \t]*/g, "$1- ")
    .replace(/\s+[—–]\s+/g, ", ")
    // Any survivors (no surrounding spaces, e.g. "word—word").
    .replace(/[—–]/g, "-")
    // The comma substitution can create ", ," or ",," in text that already had
    // punctuation next to the dash.
    .replace(/,\s*,/g, ",")
    .replace(/,\s*\./g, ".");
}
