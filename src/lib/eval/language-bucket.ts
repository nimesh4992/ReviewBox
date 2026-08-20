/**
 * language-bucket.ts — which language slice a review belongs to.
 *
 * ⚠️ READ THIS BEFORE TRUSTING IT.
 *
 * This heuristic exists to **stratify the export sample**, so the golden set
 * contains enough Hinglish to be worth measuring. It is NOT the source of truth
 * for scoring: `scoreClustering()` reads the bucket the human labeller wrote in
 * the CSV, never this function.
 *
 * That separation is deliberate. A mediocre language detector feeding the
 * scorer would move the Hinglish column for reasons that have nothing to do
 * with clustering quality — the metric would drift with the detector and
 * nobody would be able to tell which had changed. So: heuristic picks the
 * sample, human decides the label.
 *
 * See `docs/GOLDEN_SET.md` and ADR 011 §9.
 */

export type LanguageBucket = "english" | "native-script" | "hinglish";

export const LANGUAGE_BUCKETS: readonly LanguageBucket[] = [
  "english",
  "native-script",
  "hinglish",
] as const;

export function isLanguageBucket(value: string): value is LanguageBucket {
  return (LANGUAGE_BUCKETS as readonly string[]).includes(value);
}

/** Devanagari block — Hindi and Marathi both sit here. */
const DEVANAGARI = /[ऀ-ॿ]/g;
const LATIN_LETTER = /[A-Za-z]/g;

/**
 * Romanised-Hindi markers: tokens that are common in Hinglish and vanishingly
 * rare in English review text. Deliberately excludes short ambiguous ones
 * ("se", "ka", "ki", "to", "me") which collide with English words and would
 * mark ordinary English reviews as Hinglish.
 */
const ROMANISED_MARKERS = new Set([
  "nahi", "nahin", "hai", "hain", "tha", "thi", "hua", "hui", "raha", "rahi",
  "kar", "karo", "karna", "kiya", "kyun", "kyu", "kaise", "kitna", "kitne",
  "gaya", "gayi", "aaya", "aayi", "mila", "milega", "diya", "liya", "lekin",
  "bahut", "bohot", "accha", "acha", "achha", "theek", "thik", "sahi", "galat",
  "paisa", "paise", "rupaye", "rupay", "kripya", "krupya", "mera", "meri",
  "aapka", "apna", "bhai", "yaar", "matlab", "jaldi", "wapas", "khatam",
  "band", "chalu", "chal", "dena", "dijiye", "karna", "hoga", "hogaya",
  "problem_hai", "kuch", "kuchh", "phir", "abhi", "bilkul", "zyada", "jyada",
]);

/** Tokens strong enough that one occurrence is enough. */
const STRONG_MARKERS = new Set([
  "nahi", "nahin", "kyun", "kripya", "krupya", "hogaya", "khatam", "bohot",
  "rupaye", "paisa", "paise", "matlab", "wapas",
]);

function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Classify review text into a language slice.
 *
 * - Any Devanagari **and** Latin letters → code-switched → `hinglish`.
 * - Devanagari only → `native-script`.
 * - Latin only → `hinglish` if romanised markers are present, else `english`.
 */
export function classifyLanguageBucket(text: string): LanguageBucket {
  const devanagari = countMatches(text, DEVANAGARI);
  const latin = countMatches(text, LATIN_LETTER);

  if (devanagari > 0) {
    // "payment कट गया but ticket nahi aaya" — the case the whole epic turns on.
    return latin > 0 ? "hinglish" : "native-script";
  }

  const tokens = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  let markers = 0;
  for (const token of tokens) {
    if (STRONG_MARKERS.has(token)) return "hinglish";
    if (ROMANISED_MARKERS.has(token)) markers++;
    if (markers >= 2) return "hinglish";
  }

  return "english";
}
