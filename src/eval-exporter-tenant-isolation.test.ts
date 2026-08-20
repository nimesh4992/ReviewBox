/**
 * The golden-set exporter must read exactly one tenant.
 *
 * It runs with SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS, so nothing in the
 * database will stop it reading every workspace at once — and for the first
 * real export, nothing did. `scripts/eval/export-golden-set.mjs` selected apps
 * with `deleted_at is null` and no workspace filter, and produced a 758-row
 * corpus spanning three tenants: the production workspace, a test account that
 * had onboarded the same Google Play app, and a scraper fixture app. 219 of
 * those reviews appeared twice, under two `app_id`s, because two workspaces
 * legitimately track the same public listing.
 *
 * Two workspaces tracking one app is correct multi-tenant behaviour. There is
 * deliberately no global uniqueness rule on (platform, store_id), and these
 * tests assert the exporter copes with the duplicate rather than that the
 * duplicate is prevented.
 *
 * These tests drive the real code path with a stand-in Supabase client, so they
 * fail if the `.eq()` is dropped, if the fail-closed default is softened, or if
 * a fixture workspace can reach a production export.
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  assertWorkspaceScoped,
  fetchWorkspaceApps,
  parseWorkspaceId,
  requireWorkspaceId,
} from "../scripts/eval/export-golden-set.mjs";

// The shape of the incident, with readable ids. Both PROD and TEST_ACCOUNT
// track store_id com.mmrda — that is the duplicate that contaminated the first
// export, and it must stay representable.
const PROD = "ws-prod-mumbai-one";
const TEST_ACCOUNT = "ws-at-work";
const FIXTURE = "ws-metroconnect3";

const APPS = [
  { id: "app-prod", name: "Mumbai One", workspace_id: PROD, store_id: "com.mmrda", deleted_at: null },
  { id: "app-test", name: "Mumbai One", workspace_id: TEST_ACCOUNT, store_id: "com.mmrda", deleted_at: null },
  { id: "app-fixture", name: "MetroConnect3", workspace_id: FIXTURE, store_id: "com.metroconnect3", deleted_at: null },
  { id: "app-gone", name: "Retired", workspace_id: PROD, store_id: "com.retired", deleted_at: "2026-01-01" },
];

const REVIEWS = [
  { id: "rev-prod-1", app_id: "app-prod", body: "The train times are wrong every morning." },
  { id: "rev-test-1", app_id: "app-test", body: "Testing the onboarding scrape, ignore." },
  { id: "rev-fixture-1", app_id: "app-fixture", body: "Fixture review from the scraper trial." },
];

type Row = Record<string, unknown>;

/**
 * Minimal stand-in for the PostgREST builder — only the operators the exporter
 * actually uses.
 *
 * `honourEq: false` simulates the bug: a client (or a future edit) that returns
 * every row regardless of the filter. The exporter must still refuse.
 */
function fakeSupabase(tables: Record<string, Row[]>, { honourEq = true } = {}) {
  const calls: string[] = [];
  return {
    calls,
    from(table: string) {
      let rows = [...(tables[table] ?? [])];
      const builder = {
        select(cols: string) {
          calls.push(`select ${table} ${cols}`);
          return builder;
        },
        eq(col: string, value: unknown) {
          calls.push(`eq ${col}=${String(value)}`);
          if (honourEq) rows = rows.filter((r) => r[col] === value);
          return builder;
        },
        is(col: string, value: unknown) {
          calls.push(`is ${col}=${String(value)}`);
          rows = rows.filter((r) => (r[col] ?? null) === value);
          return builder;
        },
        then(resolve: (r: { data: Row[]; error: null }) => unknown) {
          return resolve({ data: rows, error: null });
        },
      };
      return builder;
    },
  };
}

/** What the exporter does next: reviews are read only for the scoped app ids. */
function reviewsForApps(apps: Array<{ id: string }>) {
  const ids = new Set(apps.map((a) => a.id));
  return REVIEWS.filter((r) => ids.has(r.app_id));
}

describe("golden-set exporter — tenant isolation", () => {
  it("does not let one workspace export another's reviews", async () => {
    const db = fakeSupabase({ apps: APPS });
    const apps = await fetchWorkspaceApps(db, PROD);

    expect(apps.map((a) => a.id)).toEqual(["app-prod"]);

    const exported = reviewsForApps(apps).map((r) => r.id);
    expect(exported).toEqual(["rev-prod-1"]);
    expect(exported).not.toContain("rev-test-1");
    expect(exported).not.toContain("rev-fixture-1");
  });

  it("filters on workspace_id in the query, not only after the fact", async () => {
    const db = fakeSupabase({ apps: APPS });
    await fetchWorkspaceApps(db, PROD);
    expect(db.calls).toContain(`eq workspace_id=${PROD}`);
  });

  it("keeps the same store_id in two workspaces from leaking across them", async () => {
    // com.mmrda exists under PROD and TEST_ACCOUNT. Both are valid rows; an
    // export must see exactly the one belonging to the workspace it was asked for.
    for (const [workspace, appId] of [
      [PROD, "app-prod"],
      [TEST_ACCOUNT, "app-test"],
    ] as const) {
      const apps = await fetchWorkspaceApps(fakeSupabase({ apps: APPS }), workspace);
      expect(apps).toHaveLength(1);
      expect(apps[0].id).toBe(appId);
      expect(apps[0].store_id).toBe("com.mmrda");
    }
  });

  it("excludes a fixture workspace from a production export", async () => {
    const apps = await fetchWorkspaceApps(fakeSupabase({ apps: APPS }), PROD);
    const names = apps.map((a) => a.name);
    expect(names).not.toContain("MetroConnect3");
    expect(apps.map((a) => a.workspace_id)).toEqual([PROD]);
  });

  it("excludes soft-deleted apps within the workspace", async () => {
    const apps = await fetchWorkspaceApps(fakeSupabase({ apps: APPS }), PROD);
    expect(apps.map((a) => a.id)).not.toContain("app-gone");
  });

  it("refuses to export if the filter stops working", async () => {
    // The backstop for the failure that actually happened: rows arrive from
    // every tenant. Throwing beats writing a mixed corpus nobody can detect.
    const db = fakeSupabase({ apps: APPS }, { honourEq: false });
    await expect(fetchWorkspaceApps(db, PROD)).rejects.toThrow(/Tenant isolation violated/);
  });

  it("names the offending rows so the failure is diagnosable", () => {
    expect(() => assertWorkspaceScoped(APPS, PROD)).toThrow(/app-test \(workspace ws-at-work\)/);
  });

  it("accepts a correctly scoped set", () => {
    const scoped = APPS.filter((a) => a.workspace_id === PROD);
    expect(assertWorkspaceScoped(scoped, PROD)).toEqual(scoped);
  });

  it("fails when the workspace has no live apps rather than widening the search", async () => {
    const db = fakeSupabase({ apps: APPS });
    await expect(fetchWorkspaceApps(db, "ws-empty")).rejects.toThrow(/No live apps/);
  });
});

describe("golden-set exporter — fail closed without a workspace", () => {
  it("throws when no workspace is supplied anywhere", () => {
    expect(() => requireWorkspaceId(["node", "export.mjs", "--count", "200"], {})).toThrow(
      /No workspace specified/,
    );
  });

  it("never defaults to all workspaces", () => {
    // Guards the shape of the fix, not just its message: there must be no
    // sentinel value that means "every tenant".
    expect(parseWorkspaceId(["node", "export.mjs"], {})).toBeNull();
  });

  it("rejects --workspace with no value", () => {
    expect(parseWorkspaceId(["node", "export.mjs", "--workspace", "--count", "10"], {})).toBeNull();
    expect(() =>
      requireWorkspaceId(["node", "export.mjs", "--workspace", "--count", "10"], {}),
    ).toThrow(/No workspace specified/);
  });

  it("rejects a blank or whitespace-only workspace", () => {
    expect(parseWorkspaceId(["node", "export.mjs", "--workspace", "   "], {})).toBeNull();
    expect(parseWorkspaceId(["node", "export.mjs"], { EVAL_WORKSPACE_ID: "  " })).toBeNull();
  });

  it("accepts --workspace <id>", () => {
    expect(parseWorkspaceId(["node", "export.mjs", "--workspace", PROD], {})).toBe(PROD);
  });

  it("accepts EVAL_WORKSPACE_ID as a fallback", () => {
    expect(parseWorkspaceId(["node", "export.mjs"], { EVAL_WORKSPACE_ID: PROD })).toBe(PROD);
  });

  it("prefers the explicit flag over the environment", () => {
    expect(
      parseWorkspaceId(["node", "export.mjs", "--workspace", PROD], { EVAL_WORKSPACE_ID: FIXTURE }),
    ).toBe(PROD);
  });

  it("tells the reader how to find their workspace id", () => {
    expect(() => requireWorkspaceId(["node", "export.mjs"], {})).toThrow(/--list-workspaces/);
  });
});

describe("golden-set exporter — provenance recorded in the file", () => {
  const source = readFileSync("scripts/eval/export-golden-set.mjs", "utf8");

  it("carries workspace_id as a CSV column", () => {
    // A golden set on disk must be traceable to the tenant it came from.
    // Without this column, a contaminated file looks exactly like a clean one.
    const header = source.slice(source.indexOf("const HEADER"), source.indexOf("];"));
    expect(header).toContain('"workspace_id"');
  });

  it("writes the workspace into every row", () => {
    expect(source).toMatch(/rows\.push\(\[\s*\n\s*review\.id,\s*\n\s*workspaceId,/);
  });

  it("has no all-workspaces escape hatch in the apps query", () => {
    const query = source.slice(source.indexOf('.from("apps")'));
    expect(query.slice(0, 300)).toContain('.eq("workspace_id", workspaceId)');
  });
});
