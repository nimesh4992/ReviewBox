/**
 * Zero-cost "is this already English?" check — now a re-export.
 *
 * This module used to carry its own heuristic: script ranges, an English
 * stopword list, a non-English stopword list and a diacritic rule, all
 * duplicating `language-detect.ts` and all disagreeing with it. That mattered
 * because the duplicate was the one every runtime call site imported, while
 * `language-detect.ts` — the better, script-aware, globally-scoped detector —
 * was reachable only from its own tests.
 *
 * The English-evidence rules moved into `language-detect.ts` unchanged, where
 * `isLikelyEnglish` is now a policy over `detectLanguage`. Nothing about the
 * answer changed; `language.test.ts` still runs against this export and is the
 * regression gate proving it.
 *
 * Prefer importing from `@/lib/language-detect` directly. This file exists so
 * that gate keeps testing the shipped path, and is the place to look if a third
 * detector is ever tempting.
 */

export { isLikelyEnglish, ENGLISH_CERTAINTY } from "./language-detect";
