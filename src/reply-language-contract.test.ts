import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * P1-2 wiring contract.
 *
 * The reply-language *logic* is unit-tested in `src/lib/reply-language.test.ts`.
 * This file guards the part a unit test cannot see: that the logic is actually
 * reached by the two runtime paths, that the language is decided on the server,
 * and that nobody starts a third language detector.
 *
 * Deliberately structural, in the same spirit as `tenant-isolation.test.ts` —
 * it cannot tell correct wiring from subtly wrong wiring, but the realistic
 * failure under this repo's autopilot is a call site quietly reverting to the
 * old heuristic or a client-supplied language field being added back, and that
 * is exactly what it catches.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const DRAFT_ROUTE = "src/app/api/reply/draft/route.ts";
const TRANSLATE_ROUTE = "src/app/api/reviews/[id]/translate/route.ts";
const COMPOSER_PANEL = "src/features/reviews/components/reply-composer-panel.tsx";

describe("one canonical detector", () => {
  it("keeps `language.ts` a re-export and not a second implementation", () => {
    // It used to carry its own script ranges, stopword lists and diacritic
    // rule, and it was the copy every runtime call site imported while
    // `language-detect.ts` was reachable only from tests. Two detectors
    // disagreeing about one review is a bug generator.
    const shim = read("src/lib/language.ts");
    expect(shim).toContain('from "./language-detect"');
    expect(shim).not.toMatch(/new Set\(\[/);
    expect(shim).not.toMatch(/function isLikelyEnglish/);
  });

  it("routes both runtime call sites through the canonical detector", () => {
    for (const file of [TRANSLATE_ROUTE, COMPOSER_PANEL]) {
      const src = read(file);
      expect(src, `${file} must import the canonical detector`).toContain(
        'from "@/lib/language-detect"',
      );
      expect(src, `${file} must not import the old shim`).not.toContain('from "@/lib/language"');
    }
  });

  it("defines `isLikelyEnglish` exactly once in the tree", () => {
    const detector = read("src/lib/language-detect.ts");
    expect(detector).toContain("export function isLikelyEnglish");
    // The threshold is the reason English behaviour survived the merge: English
    // recorded at lower confidence must not suppress the translate button.
    expect(detector).toContain("ENGLISH_CERTAINTY");
  });
});

describe("the reply language is decided on the server", () => {
  const src = read(DRAFT_ROUTE);

  it("derives it from the review body, not from the request", () => {
    expect(src).toContain('from "@/lib/reply-language"');
    expect(src).toMatch(/resolveReplyLanguage\(\s*reviewBody\s*\)/);
  });

  it("accepts no client-supplied language field", () => {
    // The resolved label is interpolated into the system prompt and the reply
    // is published on a public store listing under the customer's developer
    // name. A request that could name its own reply language would be both a
    // free text channel into the prompt and a way to make a customer publish in
    // a language they never chose.
    const body = src.slice(
      src.indexOf("interface DraftRequestBody"),
      src.indexOf("type ReplySource"),
    );
    expect(body.length).toBeGreaterThan(0);
    expect(body).not.toMatch(/\blanguage\b/i);
    expect(body).not.toMatch(/\blang\b/i);
    expect(body).not.toMatch(/\blocale\b/i);
  });

  it("passes the decision into the system prompt", () => {
    // Sliced to the call rather than matched with a lazy regex over the whole
    // file: `replyLanguage` also appears in the log payload further down, so an
    // unbounded pattern matched straight through a deleted argument and the
    // assertion passed on a broken route.
    const start = src.indexOf("buildSystemPrompt({");
    expect(start).toBeGreaterThan(-1);
    const call = src.slice(start, src.indexOf("});", start));
    expect(call).toMatch(/^\s*replyLanguage,?\s*$/m);
  });

  it("sends non-English reviews past the English-only built-in templates", () => {
    // `rating_only` matches any review under 15 words with no tags, which is
    // most short Hindi, Tamil or Thai reviews, and every built-in template is
    // written in English. Without this gate P1-2 would be silently bypassed for
    // exactly the reviews it exists to serve.
    expect(src).toMatch(
      /TRIVIAL_TEMPLATE_IDS\.has\(matchedDef\.id\)\s*&&\s*mayServeEnglishCannedReply\(replyLanguage\)/,
    );
  });

  it("gates that tier on established English, never on the language we will write in", () => {
    // The original gate was `replyLanguage.code === "en"`. `code` is the
    // language we WRITE IN and reads "en" for every English fallback too, so an
    // undetermined Devanagari review passed it and got a canned English reply.
    // A future edit that reaches for `code` here reintroduces exactly that bug.
    const start = src.indexOf("const matchedDef = getMatchedTemplate(review);");
    expect(start).toBeGreaterThan(-1);
    const gate = src.slice(start, src.indexOf("{", src.indexOf("if (matchedDef", start)));
    expect(gate).not.toMatch(/replyLanguage\.code\s*===/);
    expect(gate).not.toMatch(/replyLanguage\.detected\s*===/);
  });

  it("logs which language was chosen and why", () => {
    expect(src).toContain("replyLanguage: replyLanguage.code");
    expect(src).toContain("languageReason: replyLanguage.reason");
  });
});

describe("tenant isolation is unchanged by the language work", () => {
  it("keeps the translate route reading only this workspace's review", () => {
    const src = read(TRANSLATE_ROUTE);
    expect(src).toContain('.eq("workspace_id", workspaceId)');
    // The body it detects on comes from that scoped row, never from the request.
    expect(src).toMatch(/review\.body as string \| null/);
  });

  it("keeps the draft route's review lookup and reply cache workspace-scoped", () => {
    const src = read(DRAFT_ROUTE);
    expect(src).toContain('.eq("workspace_id", workspaceId)');
    expect(src).toMatch(/cacheScope\s*=\s*\{[\s\S]*?workspaceId[\s\S]*?\}/);
  });
});

describe("existing translate-button behaviour is preserved", () => {
  it("still short-circuits an English review before spending a Groq call", () => {
    const src = read(TRANSLATE_ROUTE);
    expect(src).toMatch(/if \(isLikelyEnglish\(body\)\)/);
    expect(src).toContain('sourceLang: "en"');
  });

  it("still decides button visibility locally, before any request", () => {
    const src = read(COMPOSER_PANEL);
    expect(src).toMatch(/needsTranslation\s*=\s*useMemo\(\(\)\s*=>\s*!isLikelyEnglish\(review\.text\)/);
  });
});
