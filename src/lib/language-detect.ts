/**
 * language-detect.ts — what script is this review in, and what language, if we
 * can honestly tell?
 *
 * ── Design constraints, both from the founder ───────────────────────────────
 *
 * 1. **Script and language are different facts.** Hinglish is a linguistic
 *    category; native-script is a script characteristic. Hindi in Devanagari
 *    and Hindi in Latin letters are one language in two scripts, and an engine
 *    that groups "पैसा कट गया" with "paisa cut gaya" is doing the right thing.
 *    So they are detected and reported separately.
 *
 * 2. **Global coverage. No predefined language list decides what exists.**
 *    Script detection here spans the Unicode blocks real reviews arrive in, not
 *    an India-specific shortlist. A Thai or Arabic or Korean review is
 *    classified as itself, not discarded as "not one of ours". English is the
 *    default baseline for undifferentiated Latin text — a baseline, not a
 *    filter.
 *
 * ── What it will and will not claim ─────────────────────────────────────────
 *
 * Script is near-certain: it is character inspection.
 *
 * Language is not, so it is only asserted where there is evidence:
 *   - Scripts used by essentially one language (Thai, Hangul, Tamil, Telugu,
 *     Kannada, Malayalam, Gujarati, Gurmukhi, Sinhala, Greek, Hebrew, Georgian,
 *     Armenian) → that language, medium confidence.
 *   - Scripts shared by many languages (Latin, Devanagari, Arabic, Cyrillic,
 *     Han, Bengali) → only with lexical markers or a store hint; otherwise
 *     `null`, meaning undetermined. **`null` is a real answer here**, not a
 *     failure — a confidently wrong language tag is worse than an honest gap.
 *
 * `sourceLanguage` — the `hl` the store was asked for — is a prior, never the
 * answer on its own: the store returning a review under `hl=hi` is evidence,
 * not proof.
 *
 * ── This is the only language detector in the tree ──────────────────────────
 *
 * `src/lib/language.ts` used to carry a second, cruder "is this English?"
 * heuristic with its own word lists, and it was the one every runtime call site
 * actually used — the module you are reading was reachable only from tests. Two
 * detectors disagreeing about the same review is a bug generator, so the
 * English-evidence half of that heuristic was folded in below (`isLikelyEnglish`)
 * and `language.ts` is now a re-export. Do not start a third.
 *
 * The fold-in is why the Latin branch is more than "Latin means English": that
 * branch has to answer the translate button's question ("is translating this a
 * no-op?") as conservatively as the old heuristic did, or the button disappears
 * from Spanish and German reviews that need it.
 */

/** Writing systems, by Unicode block. Extend freely — nothing downstream enumerates these. */
export type ScriptName =
  | "latin" | "devanagari" | "arabic" | "bengali" | "cyrillic" | "greek"
  | "gujarati" | "gurmukhi" | "han" | "hangul" | "hebrew" | "kana"
  | "kannada" | "malayalam" | "oriya" | "sinhala" | "tamil" | "telugu"
  | "thai" | "armenian" | "georgian" | "ethiopic" | "khmer" | "lao"
  | "myanmar" | "other";

/**
 * Unicode blocks, written as explicit escapes.
 *
 * They were first written as literal characters and two were wrong: `khmer`
 * came out as U+0E01–U+17FF, swallowing Thai, Lao and Myanmar, so every Thai
 * review was reported as "mixed script". Literal ranges are unreviewable —
 * these are not.
 */
const SCRIPT_RANGES: ReadonlyArray<[ScriptName, RegExp]> = [
  ["latin", /[A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u024F]/g],
  ["greek", /[\u0370-\u03FF]/g],
  ["cyrillic", /[\u0400-\u04FF]/g],
  ["armenian", /[\u0530-\u058F]/g],
  ["hebrew", /[\u0590-\u05FF]/g],
  ["arabic", /[\u0600-\u06FF]/g],
  ["devanagari", /[\u0900-\u097F]/g],
  ["bengali", /[\u0980-\u09FF]/g],
  ["gurmukhi", /[\u0A00-\u0A7F]/g],
  ["gujarati", /[\u0A80-\u0AFF]/g],
  ["oriya", /[\u0B00-\u0B7F]/g],
  ["tamil", /[\u0B80-\u0BFF]/g],
  ["telugu", /[\u0C00-\u0C7F]/g],
  ["kannada", /[\u0C80-\u0CFF]/g],
  ["malayalam", /[\u0D00-\u0D7F]/g],
  ["sinhala", /[\u0D80-\u0DFF]/g],
  ["thai", /[\u0E00-\u0E7F]/g],
  ["lao", /[\u0E80-\u0EFF]/g],
  ["myanmar", /[\u1000-\u109F]/g],
  ["georgian", /[\u10A0-\u10FF]/g],
  ["ethiopic", /[\u1200-\u137F]/g],
  ["hangul", /[\u1100-\u11FF\uAC00-\uD7AF]/g],
  ["khmer", /[\u1780-\u17FF]/g],
  ["kana", /[\u3040-\u309F\u30A0-\u30FF]/g],
  ["han", /[\u4E00-\u9FFF]/g],
];

export interface ScriptProfile {
  /** Most frequent script by character count. `other` when there are no letters at all. */
  primary: ScriptName;
  /** More than one script present — a code-switched review. */
  mixed: boolean;
  /** Every script found, most frequent first. */
  scripts: ScriptName[];
}

export interface LanguageDetection {
  /** BCP 47-ish tag ("en", "hi", "hi-Latn", "th"…), or null when undetermined. */
  language: string | null;
  script: ScriptProfile;
  /** 0–1. Low means we are guessing; downstream must treat it as such. */
  confidence: number;
}

/**
 * Scripts used by essentially one language. Safe to infer from, at medium
 * confidence. Deliberately excludes Latin, Devanagari, Arabic, Cyrillic, Han
 * and Bengali, which are each shared by many languages.
 */
const SINGLE_LANGUAGE_SCRIPTS: Partial<Record<ScriptName, string>> = {
  thai: "th", hangul: "ko", tamil: "ta", telugu: "te", kannada: "kn",
  malayalam: "ml", gujarati: "gu", gurmukhi: "pa", sinhala: "si",
  greek: "el", hebrew: "he", georgian: "ka", armenian: "hy",
  khmer: "km", lao: "lo", myanmar: "my", oriya: "or",
  // Kana is written by Japanese and nothing else. Han on its own is shared
  // (Chinese, and Japanese kanji), so it stays out — a kana-and-han review
  // resolves through the mixed branch, where kana usually dominates.
  kana: "ja",
};

/** Marathi-specific Devanagari tokens; absent from ordinary Hindi. */
const MARATHI_MARKERS = ["आहे", "नाही", "मला", "तुम्ही", "करा", "झाले", "काढ"];
/** Hindi-specific Devanagari tokens. */
const HINDI_MARKERS = ["है", "नहीं", "मुझे", "क्या", "हुआ", "किया", "गया", "आपका"];

/**
 * Romanised-Hindi markers: common in Hinglish, vanishingly rare in English
 * review text. Short ambiguous particles ("se", "ka", "ki", "to", "me") are
 * excluded — they collide with English words and would mark ordinary English
 * reviews as romanised Hindi.
 */
const ROMANISED_HI = new Set([
  "nahi", "nahin", "hai", "hain", "tha", "thi", "hua", "hui", "raha", "rahi",
  "kar", "karo", "karna", "kiya", "kyun", "kyu", "kaise", "kitna", "kitne",
  "gaya", "gayi", "aaya", "aayi", "mila", "milega", "diya", "liya", "lekin",
  "bahut", "bohot", "accha", "acha", "achha", "theek", "thik", "sahi", "galat",
  "paisa", "paise", "rupaye", "rupay", "kripya", "krupya", "mera", "meri",
  "aapka", "apna", "bhai", "yaar", "matlab", "jaldi", "wapas", "khatam",
  "band", "chalu", "chal", "dena", "dijiye", "hoga", "hogaya", "kuch", "kuchh",
  "phir", "abhi", "bilkul", "zyada", "jyada",
  // Moved across from `language.ts`'s veto list when the two detectors were
  // merged. None of them is an English word, so they belong here.
  "kya", "aur", "bhi",
]);

/** Strong enough that one occurrence settles it. */
const STRONG_ROMANISED_HI = new Set([
  "nahi", "nahin", "kyun", "kripya", "krupya", "hogaya", "khatam", "bohot",
  "rupaye", "paisa", "paise", "matlab", "wapas",
]);

/**
 * Function words that appear in almost any English sentence of a few words.
 *
 * Folded in from `language.ts`. The Latin branch needs *positive* evidence of
 * English, not merely the absence of evidence for anything else: "Não consigo
 * abrir" is Latin script with no marker in any list here, and calling it
 * English would hide the translate button on a review that needs it.
 */
const ENGLISH_STOPWORDS = new Set([
  "the", "and", "is", "it", "to", "in", "of", "for", "this", "that", "was",
  "but", "not", "you", "with", "have", "has", "are", "on", "my", "me", "we",
  "can", "cant", "dont", "doesnt", "its", "i", "app", "very", "good", "great",
  "bad", "please", "fix", "when", "why", "after", "update", "so", "all", "no",
  "im", "just", "get", "there", "they", "be", "at", "from", "your", "an", "a",
  "worst", "best", "nice", "love", "hate", "work", "works", "working", "using",
  "use", "still", "even", "every", "time", "money", "back", "help", "thanks",
]);

/**
 * Function words that are strong evidence of a Latin-script language that is
 * NOT English. Also folded in from `language.ts`.
 *
 * Kept to words that are not also English words — "a", "no", "so", "in", "is"
 * and "die" all appear in English, so including them would misfire constantly.
 * The romanised-Hindi group that used to live here has moved to `ROMANISED_HI`,
 * which resolves those to `hi-Latn` rather than to "not English".
 *
 * **One hit vetoes English outright**, which is deliberate and load-bearing:
 * "no puedo entrar con mi cuenta" clears the English stopword ratio on "no"
 * alone, so a rule that merely weighed the two kinds of evidence against each
 * other would call that Spanish sentence English.
 *
 * These name a *group*, not a language: "para" is Spanish and Portuguese,
 * "mais" is French and Portuguese. So a hit reports "not English, language
 * undetermined" rather than guessing which one. See `detectLanguage`.
 */
const NON_ENGLISH_LATIN = new Set([
  // Spanish / Portuguese
  "que", "muy", "pero", "esta", "este", "para", "por", "con", "una", "los",
  "las", "del", "como", "cuando", "porque", "aplicacion", "aplicativo",
  "nao", "voce", "muito", "mais", "isso", "aqui", "agora", "obrigado",
  // French
  "pas", "les", "des", "une", "est", "cest", "mais", "vous", "avec", "pour",
  "tres", "bien", "cette", "application", "je", "jai", "ne", "plus",
  // German
  "und", "nicht", "ist", "das", "ich", "aber", "auch", "eine", "sehr", "mit",
  "kann", "wird", "immer", "wenn", "schon", "keine", "mehr",
  // Italian
  "non", "sono", "anche", "come", "questa", "molto", "perche", "dopo",
  // Dutch
  "niet", "maar", "het", "een", "voor", "heel", "goed", "werkt",
  // Indonesian / Malay — very common in Play Store review corpora
  "tidak", "yang", "saya", "bisa", "untuk", "aplikasi", "sangat", "kenapa",
  "sudah", "tapi", "kalau", "bagus", "jangan",
  // Turkish
  "bir", "cok", "ama", "icin", "ben", "guzel", "uygulama",
]);

/**
 * Latin letters English does not use. "café" and "naïve" exist, but they are
 * rare enough that a review carrying several accented characters is far more
 * likely to be Spanish, French, Portuguese, German or Vietnamese.
 */
const LATIN_DIACRITIC = /[\u00C0-\u024F\u1E00-\u1EFF]/g;

/** Below this many words the stopword ratio is meaningless; one hit carries it. */
const MIN_WORDS_FOR_RATIO = 5;

/**
 * Confidence at which `isLikelyEnglish` will suppress the translate button.
 *
 * Only the positively-evidenced English branch clears it. English recorded at
 * 0.6 (one weak romanised-Hindi marker) or 0.4 (Latin with nothing to go on)
 * deliberately does not: a false positive hides translation from a review that
 * needed it, which is the one genuinely bad outcome here.
 */
export const ENGLISH_CERTAINTY = 0.8;

/** Lowercase a-z word tokens. Apostrophes are dropped so "doesn't" reads as "doesnt". */
function latinTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['\u2019]/g, "")
    .split(/[^a-z]+/)
    .filter(Boolean);
}

/** Does this text positively evidence English, rather than merely fail to contradict it? */
function hasEnglishEvidence(words: string[]): boolean {
  if (words.length === 0) return false;
  const hits = words.filter((w) => ENGLISH_STOPWORDS.has(w)).length;
  // Short reviews ("Crashes on launch", "Best app ever") never reach a useful
  // ratio, so a single unambiguous English function word carries them.
  if (words.length < MIN_WORDS_FOR_RATIO) return hits >= 1;
  // Real English prose is roughly a third function words. 15% is well below
  // that but far above what a non-English sentence hits by accident.
  return hits / words.length >= 0.15;
}

/** Which writing systems the text uses. Pure character inspection. */
export function detectScript(text: string): ScriptProfile {
  const counts: Array<[ScriptName, number]> = [];
  for (const [name, pattern] of SCRIPT_RANGES) {
    const found = text.match(pattern);
    if (found && found.length > 0) counts.push([name, found.length]);
  }
  if (counts.length === 0) return { primary: "other", mixed: false, scripts: [] };

  counts.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    primary: counts[0][0],
    mixed: counts.length > 1,
    scripts: counts.map(([name]) => name),
  };
}

function countMarkers(text: string, markers: readonly string[]): number {
  return markers.reduce((n, m) => (text.includes(m) ? n + 1 : n), 0);
}

/** Romanised-Hindi evidence in Latin text. */
function romanisedHindiSignal(text: string): { strong: boolean; markers: number } {
  const tokens = latinTokens(text);
  let markers = 0;
  let strong = false;
  for (const token of tokens) {
    if (STRONG_ROMANISED_HI.has(token)) strong = true;
    if (ROMANISED_HI.has(token)) markers++;
  }
  return { strong, markers };
}

/**
 * Detect script and, where honestly possible, language.
 *
 * @param sourceLanguage the `hl` the store was asked for, if known — a prior only.
 */
export function detectLanguage(text: string, sourceLanguage?: string | null): LanguageDetection {
  const script = detectScript(text);

  // No letters at all: emoji, digits, punctuation. No language signal exists.
  if (script.primary === "other") {
    return { language: null, script, confidence: 0 };
  }

  // Code-switched. The romanised half is the part that carries the signal.
  if (script.mixed) {
    const { strong, markers } = romanisedHindiSignal(text);
    if (script.scripts.includes("devanagari")) {
      return { language: "hi-Latn", script, confidence: strong || markers >= 1 ? 0.75 : 0.6 };
    }
    const inferred = SINGLE_LANGUAGE_SCRIPTS[script.primary];
    return { language: inferred ?? null, script, confidence: inferred ? 0.5 : 0.3 };
  }

  if (script.primary === "devanagari") {
    const marathi = countMarkers(text, MARATHI_MARKERS);
    const hindi = countMarkers(text, HINDI_MARKERS);
    if (marathi > hindi) return { language: "mr", script, confidence: 0.85 };
    if (hindi > marathi) return { language: "hi", script, confidence: 0.85 };
    // Devanagari carries Hindi, Marathi, Nepali, Sanskrit and more. With no
    // distinguishing token we defer to the store hint, at reduced confidence,
    // and otherwise decline to guess.
    if (sourceLanguage) return { language: sourceLanguage, script, confidence: 0.55 };
    return { language: null, script, confidence: 0.3 };
  }

  if (script.primary === "latin") {
    const { strong, markers } = romanisedHindiSignal(text);
    if (strong) return { language: "hi-Latn", script, confidence: 0.8 };
    if (markers >= 2) return { language: "hi-Latn", script, confidence: 0.7 };
    // One weak marker is not enough: "the ui hai slow" is an English review.
    // Recorded as English at reduced confidence so the doubt stays visible.
    if (markers === 1) return { language: "en", script, confidence: 0.6 };

    const words = latinTokens(text);

    // Evidence of a Latin-script language that is not English. We can say that
    // much honestly; we cannot say which one, because the markers overlap
    // between Spanish and Portuguese, French and Portuguese, Indonesian and
    // Malay. `null` is the correct answer, and the reply layer turns it into a
    // deliberate English fallback rather than a coin flip.
    if (words.some((w) => NON_ENGLISH_LATIN.has(w))) {
      return { language: null, script, confidence: 0.3 };
    }

    // Accented Latin at any real density is not English. One stray character
    // can be a name or an emoji-adjacent symbol, so require a second before
    // ruling English out on diacritics alone.
    if ((text.match(LATIN_DIACRITIC)?.length ?? 0) >= 2) {
      return { language: null, script, confidence: 0.3 };
    }

    if (hasEnglishEvidence(words)) {
      return { language: "en", script, confidence: 0.9 };
    }

    // Latin letters and nothing else to go on. English stays the baseline the
    // module header describes, but at a confidence that says so: this is where
    // "Não consigo abrir" lands, and it is not a claim worth acting on.
    return { language: "en", script, confidence: 0.4 };
  }

  // Every other script: infer only where the script is effectively one language.
  const inferred = SINGLE_LANGUAGE_SCRIPTS[script.primary];
  if (inferred) return { language: inferred, script, confidence: 0.75 };
  if (sourceLanguage) return { language: sourceLanguage, script, confidence: 0.55 };
  return { language: null, script, confidence: 0.3 };
}

/**
 * "Is translating this review a no-op?" — the question the Translate button and
 * `/api/reviews/[id]/translate` both ask.
 *
 * This is a *policy* over `detectLanguage`, not a second detector: English has
 * to be positively evidenced at `ENGLISH_CERTAINTY`, so everything the detector
 * records at lower confidence (one weak romanised-Hindi marker, undifferentiated
 * Latin) keeps the button visible. Deliberately biased toward saying "I don't
 * know": a false negative just shows a button that was already there, while a
 * false positive hides translation from a review that needed it.
 *
 * The Translate button used to fire on every review, so an English review cost
 * a Groq round trip and a slot out of the 100/hour limit to be told "Already in
 * English." — most of the translation budget was being spent on non-translations.
 */
export function isLikelyEnglish(text: string | null | undefined): boolean {
  if (typeof text !== "string") return false;
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  const { language, confidence } = detectLanguage(trimmed);
  return language === "en" && confidence >= ENGLISH_CERTAINTY;
}

/** The three slices the bake-off reports on (ADR 011 §9). */
export type EvalBucket = "english" | "native-script" | "hinglish";

/**
 * Project a detection onto the evaluation bucket.
 *
 * **This is ReviewBox benchmark policy, not a linguistic claim.** Derived at
 * export time and never persisted, per `docs/II_DELIVERY_PLAN.md` §3.
 *
 * - `native-script` = written in a non-Latin script, whichever one. It
 *   generalises past Devanagari: a Thai or Korean review lands here too.
 * - `hinglish` = romanised or code-switched. Named for the case our ICP writes
 *   most, but it is really "non-English language in Latin letters".
 * - `english` = the Latin-script baseline, including text with no language
 *   signal at all (emoji-only), which detection separately reports as `null`
 *   at confidence 0 so the ambiguity is never hidden.
 */
export function toEvalBucket(detection: LanguageDetection): EvalBucket {
  const { script, language } = detection;
  if (script.mixed) return "hinglish";
  if (script.primary !== "latin" && script.primary !== "other") return "native-script";
  return language !== null && language !== "en" ? "hinglish" : "english";
}

/**
 * Text → evaluation bucket, in one call. Used by the golden-set exporter.
 *
 * Lives here rather than in `eval/language-bucket.ts` for a mechanical reason
 * worth knowing: the eval CLIs import that file directly through Node's
 * `--experimental-strip-types`, which resolves neither the `@/` alias nor an
 * extensionless relative import of a `.ts` file. Type-only imports are erased
 * so they are safe there; a *value* import is not. Keeping the runtime
 * dependency on this side of the line means `eval/language-bucket.ts` stays
 * import-free and the CLIs keep working.
 */
export function classifyLanguageBucket(text: string): EvalBucket {
  return toEvalBucket(detectLanguage(text));
}
