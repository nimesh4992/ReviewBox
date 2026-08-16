import { describe, it, expect } from "vitest";
import { isLikelyEnglish } from "./language";

describe("isLikelyEnglish", () => {
  it("recognises ordinary English reviews", () => {
    expect(isLikelyEnglish("The app keeps crashing when I open the wallet tab.")).toBe(true);
    expect(isLikelyEnglish("Best app ever")).toBe(true);
    expect(isLikelyEnglish("Please fix the login bug")).toBe(true);
    expect(isLikelyEnglish("Worst update. It doesn't work after the latest version.")).toBe(true);
  });

  it("rejects non-Latin scripts outright", () => {
    expect(isLikelyEnglish("इस ऐप में लॉगिन नहीं हो रहा है")).toBe(false);
    expect(isLikelyEnglish("这个应用一直崩溃")).toBe(false);
    expect(isLikelyEnglish("アプリが起動しません")).toBe(false);
    expect(isLikelyEnglish("Приложение постоянно вылетает")).toBe(false);
    expect(isLikelyEnglish("التطبيق لا يعمل")).toBe(false);
  });

  it("rejects Latin-script languages by function word", () => {
    expect(isLikelyEnglish("no puedo entrar con mi cuenta")).toBe(false);
    expect(isLikelyEnglish("Die App startet nicht mehr nach dem update")).toBe(false);
    expect(isLikelyEnglish("aplikasi tidak bisa dibuka sama sekali")).toBe(false);
    expect(isLikelyEnglish("cette application ne marche pas du tout")).toBe(false);
  });

  it("rejects Latin script carrying diacritics", () => {
    expect(isLikelyEnglish("Não consigo abrir")).toBe(false);
    expect(isLikelyEnglish("Aplicación pésima")).toBe(false);
  });

  it("tolerates a single accented character in otherwise English text", () => {
    expect(isLikelyEnglish("The café booking screen is broken and I can't check out")).toBe(true);
  });

  it("stays undecided (false) when there is nothing to go on", () => {
    expect(isLikelyEnglish("")).toBe(false);
    expect(isLikelyEnglish("   ")).toBe(false);
    expect(isLikelyEnglish(null)).toBe(false);
    expect(isLikelyEnglish(undefined)).toBe(false);
    expect(isLikelyEnglish("👍👍👍")).toBe(false);
    expect(isLikelyEnglish("5/5")).toBe(false);
  });

  it("does not claim English for a short foreign phrase with no English marker", () => {
    expect(isLikelyEnglish("bagus sekali")).toBe(false);
    expect(isLikelyEnglish("sehr gut")).toBe(false);
  });
});
