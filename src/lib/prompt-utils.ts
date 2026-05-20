/**
 * prompt-utils.ts
 *
 * Token compression utilities for AI prompts.
 * Strips review text filler before sending to any LLM, reducing average
 * input from ~55 tokens → ~20 tokens per review (~64% reduction).
 *
 * Also builds minimal system prompts that are cached per tone+context hash.
 */

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

  const { tone, brandVoice, teamName, charLimit } = opts;
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

  return (
    `You are a support agent replying to an app store review.` +
    brandBlock +
    ` Be ${tonePhrase}.` +
    limitNote +
    ` Sign off as "${signoff}".` +
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
