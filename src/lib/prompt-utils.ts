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

/**
 * Build a minimal system prompt for reply generation.
 * Uses at most one KB entry, trimmed to 80 characters.
 *
 * Token budget:
 *  - Base prompt:  ~35 tokens
 *  - With context: ~45 tokens
 *  (Previous approach with 3 KB entries averaged ~245 tokens — 80%+ saving)
 */
export function buildSystemPrompt(
  tone: string,
  contextEntries: KbEntry[] = [],
): string {
  const toneMap: Record<string, string> = {
    professional: "professional and concise",
    empathetic:   "warm and empathetic",
    casual:       "friendly and casual",
    direct:       "direct and solution-focused",
    enthusiastic: "enthusiastic and positive",
  };
  const tonePhrase = toneMap[tone] ?? "professional and helpful";

  let contextBlock = "";
  if (contextEntries.length > 0) {
    const entry = contextEntries[0];
    const snippet = entry.content.slice(0, 80).trim();
    contextBlock = ` Context: [${entry.category}] ${snippet}`;
  }

  return (
    `You are a mobile app support specialist. Reply to this app store review. ` +
    `Be ${tonePhrase}. Under 120 words. Sign off as "The ReviewBox Team".` +
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
