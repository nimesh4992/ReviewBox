import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Every page that renders <MarketingNav> must be inside <MarketingShell>.
 *
 * Background — this shipped broken and nothing caught it.
 *
 * `MarketingShell` puts the `.rb-marketing` class on its wrapper, and
 * `globals.css` hangs the ENTIRE --rb-mk-* palette off that class: the amber
 * action colour, the ink ramp, the hairline colours, the card radii. The
 * scoping is deliberate — it keeps the marketing site's gold CTA out of the
 * authenticated app, which stays on #0A84FF.
 *
 * The six /help pages rendered <MarketingNav> inside a plain
 * `<div className="min-h-screen bg-[#F5F5F7]">` instead. So on those pages
 * `--rb-mk-amber-500` resolved to nothing, and the nav's primary call to
 * action — `bg-[var(--rb-mk-amber-500)]` — painted no background at all.
 * "Start free" rendered as bare text that no longer read as a button.
 *
 * What makes this worth a test rather than a fix-and-move-on:
 *
 *   - Type-check passed. CSS variables are strings to TypeScript.
 *   - Lint passed. The class name is perfectly valid.
 *   - The build passed, and every unit test passed.
 *   - Contrast checks would have passed too: the TEXT was still legible.
 *     What was lost was the affordance, not the legibility — the same
 *     failure mode as the Billing plan CTAs noted in CLAUDE.md's
 *     design-system section, where two of three buttons looked disabled.
 *
 * Only rendering the page showed it. This test is the cheap standing
 * substitute for remembering to do that.
 *
 * If you are adding a marketing page: wrap it in <MarketingShell>. If you are
 * deliberately rendering the nav somewhere that must NOT get the marketing
 * palette, this test should fail — that combination has no correct rendering
 * today, so change the nav to stop depending on scoped tokens first.
 */

const APP_DIR = join(process.cwd(), "src", "app");

function pageFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...pageFiles(full));
    } else if (entry === "page.tsx" || entry === "layout.tsx") {
      out.push(full);
    }
  }
  return out;
}

/**
 * Resolved by reading the file, not by rendering. These pages are server
 * components in a Next app; standing up the router to assert a class name
 * would cost far more than it proves.
 */
function readsMarketingNav(source: string): boolean {
  return /\bMarketingNav\b/.test(source);
}

function providesMarketingShell(source: string): boolean {
  return /\bMarketingShell\b/.test(source);
}

describe("marketing pages are wrapped in MarketingShell", () => {
  const pages = pageFiles(APP_DIR);

  it("finds pages to check (guards against the walker silently matching nothing)", () => {
    expect(pages.length).toBeGreaterThan(10);
    expect(pages.some((p) => readsMarketingNav(readFileSync(p, "utf8")))).toBe(true);
  });

  it("never renders MarketingNav outside MarketingShell", () => {
    const offenders = pages
      .filter((p) => {
        const src = readFileSync(p, "utf8");
        return readsMarketingNav(src) && !providesMarketingShell(src);
      })
      .map((p) => p.replace(process.cwd() + "/", ""));

    expect(
      offenders,
      offenders.length
        ? `These render MarketingNav without MarketingShell, so every --rb-mk-* ` +
          `token is undefined on them and the nav's amber CTA paints no ` +
          `background:\n  ${offenders.join("\n  ")}`
        : "",
    ).toEqual([]);
  });
});

/**
 * The palette itself: the tokens the nav depends on have to be defined under
 * `.rb-marketing`, or wrapping pages in the shell fixes nothing.
 */
describe("the marketing palette is scoped where the shell can reach it", () => {
  const css = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

  it("defines the --rb-mk-* palette on .rb-marketing", () => {
    const block = css.slice(css.indexOf(".rb-marketing {"));
    expect(css).toContain(".rb-marketing {");
    for (const token of [
      "--rb-mk-amber-500:",
      "--rb-mk-ink:",
      "--rb-mk-line:",
      "--rb-mk-sunken:",
    ]) {
      expect(block.slice(0, block.indexOf("}"))).toContain(token);
    }
  });

  it("keeps the app's own action colour out of the marketing override", () => {
    // The marketing block may restyle --rb-fg-*, but it must not repoint
    // --rb-blue-500: the authenticated app's action colour is #0A84FF and
    // nothing under .rb-marketing should change that for the whole document.
    const block = css.slice(css.indexOf(".rb-marketing {"));
    const body = block.slice(0, block.indexOf("}"));
    expect(body).not.toContain("--rb-blue-500:");
  });
});
