import { describe, expect, it } from "vitest";

import {
  ENGLISH_CERTAINTY,
  detectLanguage,
  detectScript,
  isLikelyEnglish,
  toEvalBucket,
} from "./language-detect";

describe("detectScript", () => {
  it("identifies Latin", () => {
    expect(detectScript("payment failed")).toEqual({
      primary: "latin",
      mixed: false,
      scripts: ["latin"],
    });
  });

  it("identifies Devanagari", () => {
    expect(detectScript("पैसा कट गया").primary).toBe("devanagari");
  });

  it("identifies scripts far outside the India-first shortlist", () => {
    // Global coverage: a Thai or Korean or Arabic review is classified as
    // itself, not discarded as "not one of ours".
    expect(detectScript("แอปใช้ไม่ได้").primary).toBe("thai");
    expect(detectScript("결제가 안 됩니다").primary).toBe("hangul");
    expect(detectScript("الدفع فشل").primary).toBe("arabic");
    expect(detectScript("Платёж не прошёл").primary).toBe("cyrillic");
    expect(detectScript("付款失败").primary).toBe("han");
    expect(detectScript("பணம் கட்டப்பட்டது").primary).toBe("tamil");
  });

  it("flags a code-switched review as mixed and lists both scripts", () => {
    const profile = detectScript("payment कट गया but ticket nahi aaya");
    expect(profile.mixed).toBe(true);
    expect(profile.scripts).toContain("latin");
    expect(profile.scripts).toContain("devanagari");
  });

  it("picks the dominant script as primary", () => {
    expect(detectScript("ok पैसा कट गया लेकिन टिकट नहीं आया").primary).toBe("devanagari");
  });

  it("reports `other` when there are no letters at all", () => {
    expect(detectScript("😤😤 12345 !!!")).toEqual({ primary: "other", mixed: false, scripts: [] });
    expect(detectScript("")).toEqual({ primary: "other", mixed: false, scripts: [] });
  });

  it("is deterministic for the same input", () => {
    const text = "payment कट गया but ticket nahi aaya";
    expect(detectScript(text)).toEqual(detectScript(text));
  });
});

describe("detectLanguage", () => {
  it("calls plain Latin text English at high confidence", () => {
    const d = detectLanguage("Payment failed and no ticket was issued");
    expect(d.language).toBe("en");
    expect(d.confidence).toBeGreaterThan(0.8);
  });

  it("detects romanised Hindi in Latin script", () => {
    expect(detectLanguage("paisa cut ho gaya lekin ticket nahi mila").language).toBe("hi-Latn");
  });

  it("detects code-switching", () => {
    const d = detectLanguage("payment कट गया but ticket nahi aaya");
    expect(d.language).toBe("hi-Latn");
    expect(d.script.mixed).toBe(true);
  });

  it("needs two weak markers, not one, before calling Latin text non-English", () => {
    const weak = detectLanguage("the ui hai slow");
    expect(weak.language).toBe("en");
    expect(weak.confidence).toBeLessThan(0.9); // the doubt stays visible
    expect(detectLanguage("app hai bahut slow").language).toBe("hi-Latn");
  });

  it("separates Hindi from Marathi in Devanagari", () => {
    expect(detectLanguage("पैसा कट गया लेकिन टिकट नहीं आया").language).toBe("hi");
    expect(detectLanguage("पैसे कापले पण तिकीट आले नाही, मला परत हवे आहे").language).toBe("mr");
  });

  it("declines to guess Devanagari it cannot distinguish, rather than guessing", () => {
    // Devanagari carries Hindi, Marathi, Nepali, Sanskrit. A confident wrong
    // tag is worse than an honest gap.
    const d = detectLanguage("अच्छा");
    expect(d.language).toBeNull();
    expect(d.confidence).toBeLessThan(0.5);
    expect(d.script.primary).toBe("devanagari");
  });

  it("uses the store hint only to break a tie it cannot settle", () => {
    expect(detectLanguage("अच्छा", "mr").language).toBe("mr");
    // ...and never to override actual textual evidence.
    expect(detectLanguage("पैसे कापले मला परत हवे आहे", "hi").language).toBe("mr");
  });

  it("infers language for scripts used by essentially one language", () => {
    expect(detectLanguage("แอปใช้ไม่ได้").language).toBe("th");
    expect(detectLanguage("결제가 안 됩니다").language).toBe("ko");
    expect(detectLanguage("பணம் கட்டப்பட்டது").language).toBe("ta");
    expect(detectLanguage("ચુકવણી નિષ્ફળ").language).toBe("gu");
  });

  it("declines to name a language for scripts shared by many", () => {
    // Arabic script covers Arabic, Persian, Urdu; Cyrillic covers Russian,
    // Ukrainian, Bulgarian and more. Script is recorded either way.
    const arabic = detectLanguage("الدفع فشل");
    expect(arabic.language).toBeNull();
    expect(arabic.script.primary).toBe("arabic");

    const cyrillic = detectLanguage("Платёж не прошёл");
    expect(cyrillic.language).toBeNull();
    expect(cyrillic.script.primary).toBe("cyrillic");
  });

  it("reports no language and zero confidence for text with no letters", () => {
    expect(detectLanguage("😤😤😤")).toMatchObject({ language: null, confidence: 0 });
    expect(detectLanguage("")).toMatchObject({ language: null, confidence: 0 });
  });

  it("is deterministic", () => {
    const text = "paisa nahi mila";
    expect(detectLanguage(text)).toEqual(detectLanguage(text));
  });
});

describe("toEvalBucket", () => {
  const bucket = (text: string, hint?: string) => toEvalBucket(detectLanguage(text, hint));

  it("buckets plain English as english", () => {
    expect(bucket("Payment failed, no ticket")).toBe("english");
  });

  it("buckets any non-Latin script as native-script, not just Devanagari", () => {
    expect(bucket("पैसा कट गया लेकिन टिकट नहीं आया")).toBe("native-script");
    expect(bucket("แอปใช้ไม่ได้")).toBe("native-script");
    expect(bucket("결제가 안 됩니다")).toBe("native-script");
    expect(bucket("الدفع فشل")).toBe("native-script");
  });

  it("buckets romanised and code-switched text as hinglish", () => {
    expect(bucket("paisa cut ho gaya lekin ticket nahi mila")).toBe("hinglish");
    expect(bucket("payment कट गया but ticket nahi aaya")).toBe("hinglish");
  });

  it("keeps script and language as separate facts behind the bucket", () => {
    // The whole point of the rework: same language, two scripts, two buckets —
    // and an engine that groups them is doing the right thing.
    const devanagari = detectLanguage("पैसा नहीं मिला मुझे");
    const latin = detectLanguage("paisa nahi mila");

    expect(devanagari.language).toBe("hi");
    expect(latin.language).toBe("hi-Latn");
    expect(devanagari.script.primary).toBe("devanagari");
    expect(latin.script.primary).toBe("latin");
    expect(toEvalBucket(devanagari)).toBe("native-script");
    expect(toEvalBucket(latin)).toBe("hinglish");
  });

  it("buckets letterless text as english while detection still reports null", () => {
    const d = detectLanguage("😤😤😤");
    expect(d.language).toBeNull();
    expect(d.confidence).toBe(0);
    expect(toEvalBucket(d)).toBe("english");
  });
});

/**
 * The Latin branch absorbed `language.ts`'s English-evidence heuristic when the
 * two detectors were merged. Before that it treated every Latin-script review
 * as English at 0.9, which was fine for the eval bucket it was written for and
 * would have been wrong the moment a runtime call site used it: the translate
 * button would have vanished from Spanish and German reviews.
 */
describe("detectLanguage — Latin is not automatically English", () => {
  it("needs positive evidence before calling Latin text English with confidence", () => {
    // "Não consigo abrir": Latin, one diacritic, no marker in any list, and no
    // English function word either. English stays the baseline, but the
    // confidence says how little that is worth.
    const d = detectLanguage("Não consigo abrir");
    expect(d.language).toBe("en");
    expect(d.confidence).toBeLessThan(ENGLISH_CERTAINTY);
  });

  it("reports non-English Latin languages as an honest gap, not as English", () => {
    for (const text of [
      "no puedo entrar con mi cuenta",
      "Die App startet nicht mehr nach dem update",
      "aplikasi tidak bisa dibuka sama sekali",
      "cette application ne marche pas du tout",
      "sehr gut",
      "bagus sekali",
    ]) {
      const d = detectLanguage(text);
      expect(d.language, text).toBeNull();
      expect(d.script.primary, text).toBe("latin");
    }
  });

  it("rules English out on accented Latin at any real density", () => {
    expect(detectLanguage("Aplicación pésima").language).toBeNull();
    // ...but one accent is a name or a loanword, not a language switch.
    expect(detectLanguage("The café booking screen is broken and I can't check out").language).toBe("en");
  });

  it("keeps romanised Hindi ahead of the non-English check", () => {
    // Both signals can be present at once. Hindi is the one our ICP writes, and
    // "hi-Latn" is a more useful answer than "not English".
    expect(detectLanguage("app hai bahut slow").language).toBe("hi-Latn");
    expect(detectLanguage("kya hua, paisa nahi mila").language).toBe("hi-Latn");
  });

  it("leaves the eval buckets exactly where they were", () => {
    // The new "not English, undetermined" answer must not move anything between
    // buckets: `toEvalBucket` maps both `en` and `null` on Latin script to
    // "english", so the bake-off's slices are unaffected by the merge.
    expect(toEvalBucket(detectLanguage("no puedo entrar con mi cuenta"))).toBe("english");
    expect(toEvalBucket(detectLanguage("sehr gut"))).toBe("english");
    expect(toEvalBucket(detectLanguage("Não consigo abrir"))).toBe("english");
  });
});

describe("isLikelyEnglish", () => {
  it("suppresses translation only on positively-evidenced English", () => {
    expect(isLikelyEnglish("The app keeps crashing when I open the wallet tab.")).toBe(true);
    expect(isLikelyEnglish("Best app ever")).toBe(true);
  });

  it("keeps the button visible wherever English is merely the baseline", () => {
    // A false negative shows a button that was already there. A false positive
    // hides translation from a review that needed it, which is the bad one.
    expect(isLikelyEnglish("Não consigo abrir")).toBe(false);   // en, low confidence
    expect(isLikelyEnglish("the ui hai slow")).toBe(false);     // en, one weak marker
    expect(isLikelyEnglish("no puedo entrar con mi cuenta")).toBe(false);
    expect(isLikelyEnglish("पैसा कट गया")).toBe(false);
  });

  it("treats absent or letterless text as unknown, never as English", () => {
    for (const text of ["", "   ", null, undefined, "👍👍👍", "5/5"]) {
      expect(isLikelyEnglish(text)).toBe(false);
    }
  });
});
