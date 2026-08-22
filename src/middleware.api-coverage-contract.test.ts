/**
 * Every API route must be matched by one of the two middleware matchers.
 *
 * **A path in neither matcher does not error — it just stops working**, and
 * only for some callers, which is why this has now happened six times:
 *
 *   `/api/reports/daily-digest`  the cron silently never ran
 *   `/api/import`                AppFollow import "broken" in production only
 *   `/api/competitors`           add/remove silently dead (ROLE_AUDIT P0-5)
 *   `/api/auth/slack`            OAuth callback dead
 *   `/api/reports/send-now`      POST 307'd to the /dashboard HTML page
 *   `/api/sync`                  same, breaking "Sync now" and the self-heal kick
 *
 * The mechanism is always identical. On the production app host an unmatched
 * path falls through to a 307 to `/dashboard`. A `fetch()` follows it, gets
 * **200 OK with an HTML body**, so `res.ok` is true and every guard AU4 and AU5
 * added is satisfied — then `res.json()` throws into a `.catch` and the feature
 * silently does nothing. It works perfectly on localhost, which is not `isProd`.
 *
 * A seventh was caught by hand on 2026-08-22: `/api/billing/usage`, the
 * soft-cap banner's read, written in the same session that removed eleven
 * silent failures. Catching it by hand is not a strategy, so this file checks
 * every route instead.
 *
 * It reads `middleware.ts` as source rather than importing it, for the reason
 * `pricing-contract.test.ts` does: importing pulls in the whole Clerk/Next
 * surface, and exporting the matchers purely for a test would change the file
 * under test.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

const MIDDLEWARE = join(process.cwd(), "src", "middleware.ts");
const API_DIR = join(process.cwd(), "src", "app", "api");

/** Blank comments, keeping newlines — this file's own header lists route paths. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, " "))
    .replace(/\/\/[^\n]*/g, "");
}

/** The string literals inside one `createRouteMatcher([...])` array. */
function patternsFor(source: string, constName: string): string[] {
  const start = source.indexOf(`const ${constName} = createRouteMatcher([`);
  if (start === -1) return [];
  const end = source.indexOf("]);", start);
  if (end === -1) return [];
  return [...source.slice(start, end).matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Clerk's matcher takes path-to-regexp patterns. Only two forms appear in this
 * file — a literal path, and a literal followed by a wildcard group — so the
 * conversion stays deliberately narrow. A pattern using anything else fails
 * loudly in the test below rather than being mistranslated into something
 * permissive, which would make this whole guard quietly useless.
 */
function toRegExp(pattern: string): RegExp {
  const WILDCARD = "(.*)";
  const parts = pattern.split(WILDCARD);
  const escaped = parts
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escaped}$`);
}

/** Every `route.ts` under `src/app/api`, as the URL path it serves. */
function apiRoutePaths(dir: string = API_DIR): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...apiRoutePaths(full));
      continue;
    }
    if (entry.name !== "route.ts") continue;
    const rel = relative(join(process.cwd(), "src", "app"), dir).split(sep).join("/");
    // Route groups like `(app)` never appear in the URL; a dynamic segment
    // becomes a representative literal so the comparison means something.
    const url =
      "/" +
      rel
        .split("/")
        .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
        .map((seg) => (seg.startsWith("[") ? "sample" : seg))
        .join("/");
    found.push(url);
  }
  return found;
}

/**
 * Routes deliberately in neither matcher. **Empty, and it should stay that
 * way.** An entry here means a route is reachable without passing through
 * middleware on the production app host — write why, and be certain the route
 * authenticates itself.
 */
const KNOWN_UNMATCHED: Record<string, string> = {};

const source = stripComments(readFileSync(MIDDLEWARE, "utf8"));
const publicPatterns = patternsFor(source, "isPublicRoute");
const appPatterns = patternsFor(source, "isAppRoute");

describe("the matchers were actually parsed", () => {
  // Without these, every assertion below passes over an empty pattern list —
  // the vacuous pass that let ci-contract.test.ts stop guarding for months.
  it("finds both matchers with a plausible number of patterns", () => {
    expect(publicPatterns.length).toBeGreaterThanOrEqual(5);
    expect(appPatterns.length).toBeGreaterThanOrEqual(20);
  });

  it("finds a known pattern in each", () => {
    expect(appPatterns).toContain("/api/sync(.*)");
    expect(publicPatterns.some((p) => p.includes("sign-in"))).toBe(true);
  });

  it("uses only pattern forms this file can translate", () => {
    // path-to-regexp also has `:params`, `?`, `+` and brace groups. None are
    // used here, and mistranslating one would make the guard permissive
    // exactly where it needs to be strict.
    const unsupported = [...publicPatterns, ...appPatterns].filter((p) =>
      /[:?+{}[\]]/.test(p.split("(.*)").join("")),
    );
    expect(
      unsupported,
      "A matcher pattern uses syntax toRegExp() does not translate. Extend it " +
        "deliberately — do not let it fall through as a wildcard.",
    ).toEqual([]);
  });

  it("finds a plausible number of API routes", () => {
    expect(apiRoutePaths().length).toBeGreaterThanOrEqual(30);
  });
});

describe("no API route falls between the matchers", () => {
  it("matches every route against isPublicRoute or isAppRoute", () => {
    const all = [...publicPatterns, ...appPatterns].map(toRegExp);

    const unmatched = apiRoutePaths()
      .filter((path) => !(path in KNOWN_UNMATCHED))
      .filter((path) => !all.some((re) => re.test(path)))
      .sort();

    expect(
      unmatched,
      "These API routes are in NEITHER middleware matcher. On the production " +
        "app host they are 307'd to /dashboard, so a fetch gets 200 OK with an " +
        "HTML body — res.ok is true, res.json() throws, and the feature " +
        "silently does nothing while working fine on localhost.\n\n" +
        unmatched.join("\n") +
        "\n\nAdd each to isAppRoute (or isPublicRoute if it must be reachable " +
        "signed out), or to KNOWN_UNMATCHED with the reason.",
    ).toEqual([]);
  });

  it("keeps no allowlist entry for a route that is now matched", () => {
    const all = [...publicPatterns, ...appPatterns].map(toRegExp);
    const stale = Object.keys(KNOWN_UNMATCHED).filter((p) =>
      all.some((re) => re.test(p)),
    );
    expect(stale, "Now matched. Remove from KNOWN_UNMATCHED.").toEqual([]);
  });
});
