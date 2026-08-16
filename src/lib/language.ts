/**
 * Zero-cost "is this already English?" check.
 *
 * The Translate button used to fire on every review. On an English review that
 * meant a round trip to Groq, a slot out of the 100/hour rate limit, and then
 * the words "Already in English." — the user paid an AI call to be told nothing
 * happened. Most reviews in a US/UK/IN storefront are English, so most of the
 * translation budget was being spent on non-translations.
 *
 * This is a heuristic, deliberately biased toward saying "I don't know".
 * A false negative just shows the button (the behaviour we already had). A
 * false positive hides translation on a review that needed it, which is the
 * genuinely bad outcome — so English has to be positively evidenced, never
 * assumed from the absence of other signals.
 */

/** Scripts that settle the question on sight — none of them write English. */
const NON_LATIN_SCRIPT =
  /[Ѐ-ӿ֐-׿؀-ۿ܀-ݏऀ-ॿঀ-৿਀-੿஀-௿ఀ-౿ഀ-ൿ฀-๿က-႟぀-ヿ㐀-䶿一-鿿가-힯Ͱ-Ͽ]/;

/**
 * Latin letters English does not use. "café" and "naïve" exist, but they are
 * rare enough that a review containing several accented characters is far more
 * likely to be Spanish, French, Portuguese, German or Vietnamese.
 */
const LATIN_DIACRITIC = /[À-ɏḀ-ỿ]/g;

/** Function words that appear in almost any English sentence of a few words. */
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
 * Function words that are strong evidence of a specific non-English language.
 * Kept to words that are NOT also English words — "a", "no", "so", "in", "is"
 * and "die" all appear in English, so including them would misfire constantly.
 */
const NON_ENGLISH_STOPWORDS = new Set([
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
  // Romanised Hindi
  "nahi", "hai", "kya", "aur", "mera", "bahut", "karo", "kar", "bhi",
]);

const MIN_WORDS_FOR_RATIO = 5;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z]+/)
    .filter((w) => w.length > 0);
}

/**
 * True only when we are confident the text is English and translation would be
 * a no-op. Anything ambiguous returns false so the button stays available.
 */
export function isLikelyEnglish(text: string | null | undefined): boolean {
  if (typeof text !== "string") return false;

  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  // Another script settles it.
  if (NON_LATIN_SCRIPT.test(trimmed)) return false;

  // Accented Latin at any real density is not English. One stray character can
  // be an emoji-adjacent symbol or a name, so require a second one before
  // ruling English out on diacritics alone.
  const diacritics = trimmed.match(LATIN_DIACRITIC)?.length ?? 0;
  if (diacritics >= 2) return false;

  const words = tokenize(trimmed);
  if (words.length === 0) return false;

  // Any confident non-English function word ends it.
  for (const word of words) {
    if (NON_ENGLISH_STOPWORDS.has(word)) return false;
  }

  const englishHits = words.filter((w) => ENGLISH_STOPWORDS.has(w)).length;

  // Short reviews ("Crashes on launch", "Best app ever") never reach a useful
  // ratio, so a single unambiguous English function word carries them.
  if (words.length < MIN_WORDS_FOR_RATIO) return englishHits >= 1;

  // Longer text: real English prose is roughly a third function words. 15% is
  // well below that but far above what a non-English sentence hits by accident.
  return englishHits / words.length >= 0.15;
}
