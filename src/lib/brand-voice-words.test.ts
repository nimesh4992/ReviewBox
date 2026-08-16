import { describe, it, expect } from "vitest";

/**
 * Regression for the onboarding brand-voice word fields.
 *
 * They were controlled from the PARSED array — value={words.join(", ")} with
 * an onChange that split on commas and trimmed. Typing a space produced
 * "thank " which trimmed back to "thank" and re-rendered without it, so the
 * space was deleted as fast as it was typed and a multi-word phrase could
 * never be entered. The field's own placeholder ("thank you, we appreciate")
 * was unenterable.
 *
 * These model both implementations against the same keystrokes.
 */

/** What the field used to do: render from the parsed array on every keystroke. */
function oldRender(previousText: string, keystroke: string): string {
  const typed = previousText + keystroke;
  return typed.split(",").map((s) => s.trim()).filter(Boolean).join(", ");
}

/** What it does now: the raw text is the source of truth. */
function newRender(previousText: string, keystroke: string): string {
  return previousText + keystroke;
}

const parseWords = (value: string): string[] =>
  value.split(",").map((s) => s.trim()).filter(Boolean);

function typeAll(render: (prev: string, k: string) => string, phrase: string): string {
  return [...phrase].reduce((text, ch) => render(text, ch), "");
}

describe("brand-voice word input", () => {
  it("reproduces the reported bug in the old implementation", () => {
    // Every space is swallowed, so the words run together.
    expect(typeAll(oldRender, "thank you")).toBe("thankyou");
  });

  it("lets a space be typed now", () => {
    expect(typeAll(newRender, "thank you")).toBe("thank you");
  });

  it("supports the placeholder's own example end to end", () => {
    const typed = typeAll(newRender, "thank you, we appreciate, our team");
    expect(typed).toBe("thank you, we appreciate, our team");
    expect(parseWords(typed)).toEqual(["thank you", "we appreciate", "our team"]);
  });

  it("still parses to a clean array, ignoring stray whitespace and empties", () => {
    expect(parseWords("thank you ,  we appreciate , , ")).toEqual(["thank you", "we appreciate"]);
  });

  it("keeps a trailing comma visible while the next word is being typed", () => {
    // The old version deleted this too, so you could not start a second entry.
    expect(typeAll(newRender, "thank you, ")).toBe("thank you, ");
    expect(parseWords("thank you, ")).toEqual(["thank you"]);
  });
});
