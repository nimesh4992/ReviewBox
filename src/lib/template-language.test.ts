import { describe, it, expect } from "vitest";

import { normalizeTemplateLanguage, TEMPLATE_LANGUAGES } from "./template-language";

/**
 * `reply_templates.language` is char(5). The form used to send display names,
 * every one of which is longer than that, so every template save failed with
 * Postgres 22001 and surfaced as "Couldn't save — try again".
 */
describe("normalizeTemplateLanguage", () => {
  it("never returns more than 5 characters", () => {
    const inputs = [
      "English", "Portuguese", "Japanese", "en", "en-GB", "pt_BR",
      "", "   ", null, undefined, 42, {}, "not a language at all",
    ];
    for (const input of inputs) {
      expect(normalizeTemplateLanguage(input).length).toBeLessThanOrEqual(5);
    }
  });

  it("maps the display names the old UI sent", () => {
    // These are the exact values that were failing every save.
    expect(normalizeTemplateLanguage("English")).toBe("en");
    expect(normalizeTemplateLanguage("Portuguese")).toBe("pt");
    expect(normalizeTemplateLanguage("Japanese")).toBe("ja");
  });

  it("passes through codes and reduces locales to their base", () => {
    expect(normalizeTemplateLanguage("en")).toBe("en");
    expect(normalizeTemplateLanguage("en-GB")).toBe("en");
    expect(normalizeTemplateLanguage("pt_BR")).toBe("pt");
  });

  it("falls back to en rather than failing the save", () => {
    for (const junk of ["", "   ", "klingon", null, undefined, 42]) {
      expect(normalizeTemplateLanguage(junk)).toBe("en");
    }
  });

  it("only ever returns a supported code", () => {
    for (const input of ["English", "en-GB", "klingon", "ja"]) {
      expect(TEMPLATE_LANGUAGES).toContain(normalizeTemplateLanguage(input));
    }
  });
});
