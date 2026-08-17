/**
 * Every service-role query must be workspace-scoped.
 *
 * `getServiceClient()` uses SUPABASE_SERVICE_ROLE_KEY, which **bypasses RLS
 * entirely**. The schema defines careful workspace-scoped RLS policies on every
 * tenant table, but they are unreachable in production: the anon-key client
 * they depend on has exactly one reference in the whole tree (its own
 * definition), and no Clerk token is ever forwarded to Supabase as a request
 * JWT. So RLS has never once been the thing standing between a request and
 * another customer's data (audit finding M-5).
 *
 * That leaves tenant isolation resting entirely on each route handler
 * remembering `.eq("workspace_id", …)` by hand, with no independent backstop.
 * A new route that forgets it leaks one customer's reviews, app credentials or
 * automation rules to another — and nothing in the stack notices, because tsc
 * and lint cannot see a missing filter and RLS never engages.
 *
 * This test is that backstop. It is deliberately structural, not semantic: it
 * asserts that a route touching the service client mentions workspace scoping
 * AT ALL. It cannot tell a correct filter from a wrong one — but the realistic
 * failure mode under this repo's autopilot is forgetting entirely, which is
 * exactly what it catches. A route that legitimately queries across workspaces
 * must be listed below with a reason, so the exemption is a deliberate,
 * reviewable act rather than an oversight.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const API_DIR = join(ROOT, "src/app/api");

/**
 * Routes that legitimately use the service client without a workspace filter.
 * Each needs a reason. Adding to this list should feel like a decision.
 */
const GLOBAL_BY_DESIGN: Record<string, string> = {
  "health/route.ts":
    "Liveness probe. Pings Supabase to prove the connection works and reads no tenant data.",
  "onboarding/slug-check/route.ts":
    "Workspace slug uniqueness is global by definition — it must look across every " +
    "workspace, which is the whole point of the check.",
};

function routeFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) routeFiles(full, acc);
    else if (entry === "route.ts") acc.push(full);
  }
  return acc;
}

/** Mentions workspace scoping in any of the forms the codebase uses. */
function mentionsWorkspaceScope(src: string): boolean {
  return /workspace_id|getWorkspaceId|workspaceId/.test(src);
}

describe("tenant isolation", () => {
  const files = routeFiles(API_DIR);

  it("finds the API routes", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("every service-role route is workspace-scoped, or explicitly exempted", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!src.includes("getServiceClient")) continue;

      const rel = relative(API_DIR, file);
      if (rel in GLOBAL_BY_DESIGN) continue;
      if (!mentionsWorkspaceScope(src)) offenders.push(rel);
    }

    if (offenders.length > 0) {
      throw new Error(
        "These routes use getServiceClient() (which bypasses RLS) but never " +
          "mention a workspace filter:\n" +
          offenders.map((o) => `  - ${o}`).join("\n") +
          "\n\nScope the query with .eq(\"workspace_id\", workspaceId), deriving " +
          "the id server-side from the session via getWorkspaceId(clerkUserId) — " +
          "never from a request body or query param. If the route genuinely must " +
          "read across workspaces, add it to GLOBAL_BY_DESIGN in this file with a " +
          "reason.",
      );
    }
    expect(offenders).toEqual([]);
  });

  it("the exemption list has no stale entries", () => {
    // A stale exemption silently un-guards a route that has since changed.
    for (const rel of Object.keys(GLOBAL_BY_DESIGN)) {
      const full = join(API_DIR, rel);
      expect(
        files.includes(full),
        `${rel} is exempted but no longer exists — remove it from GLOBAL_BY_DESIGN`,
      ).toBe(true);
    }
  });

  it("every exemption carries a reason", () => {
    for (const [rel, reason] of Object.entries(GLOBAL_BY_DESIGN)) {
      expect(reason.trim().length, `${rel} needs a justification`).toBeGreaterThan(30);
    }
  });

  it("no route takes its workspace id straight from user input", () => {
    // The core IDOR shape: trusting a client-supplied workspace id instead of
    // deriving it from the session. /api/sync/reviews accepts one for the cron
    // caller and explicitly overrides it for everyone else, so it is checked
    // rather than banned.
    const suspicious: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      if (!src.includes("getServiceClient")) continue;

      const takesFromInput =
        /(?:body|json\(\))[^;]{0,80}\.workspaceId/.test(src) ||
        /searchParams\.get\(\s*["']workspace(_?)[Ii]d["']\s*\)/.test(src);

      if (!takesFromInput) continue;

      // Acceptable only if the handler also derives the real id from the session.
      if (!/getWorkspaceId\s*\(/.test(src)) suspicious.push(relative(API_DIR, file));
    }

    expect(
      suspicious,
      "These routes read a workspace id from the request without also deriving " +
        "it from the authenticated session — the classic IDOR shape:\n" +
        suspicious.join("\n"),
    ).toEqual([]);
  });
});
