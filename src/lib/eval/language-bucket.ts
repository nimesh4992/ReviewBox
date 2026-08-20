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

/**
 * The three slices the bake-off reports on (ADR 011 §9).
 *
 * ⚠️ **This file must contain no runtime imports.** The eval CLIs load it
 * directly via Node's `--experimental-strip-types`, which resolves neither the
 * `@/` alias nor an extensionless relative `.ts` import. Type-only imports are
 * erased and therefore safe; a value import breaks `npm run eval:score` while
 * leaving `tsc` and vitest green, because both of those resolve aliases.
 * `src/eval-cli-import-contract.test.ts` enforces this.
 *
 * The classifier itself lives in `src/lib/language-detect.ts` — script and
 * language are detected as two independent facts and this is a projection
 * over them. Import `classifyLanguageBucket` from there.
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
