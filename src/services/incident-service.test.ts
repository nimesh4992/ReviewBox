/**
 * The incident detail read — one function, two callers.
 *
 * Audit finding M-2: the detail page and `GET /api/incidents/[id]` were two
 * independent copies of the same query, with two independently hand-maintained
 * column lists. Nothing made them drift loudly, so a migration adding a column
 * would reach whichever copy the next agent happened to be editing and leave
 * the other silently short a field.
 *
 * So these tests cover two things: that the function scopes correctly, and —
 * the part that actually prevents the finding recurring — that neither caller
 * has grown its own copy of the query again.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

interface QueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

let result: QueryResult = { data: null, error: null };
let selectedColumns = "";
let appliedFilters: string[] = [];
let usedMaybeSingle = false;

function chain() {
  const thenable = {
    eq: (col: string, val: unknown) => {
      appliedFilters.push(`eq:${col}=${String(val)}`);
      return thenable;
    },
    maybeSingle: async () => {
      usedMaybeSingle = true;
      return result;
    },
    single: async () => result,
  };
  return thenable;
}

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: () => ({
      select: (cols: string) => {
        selectedColumns = cols;
        return chain();
      },
    }),
  }),
}));

import { getIncidentDetail, INCIDENT_COLUMNS } from "./incident-service";

const ROW = {
  id: "inc_1",
  workspace_id: "ws_1",
  app_id: null,
  title: "Checkout crash on 4.2.0",
  description: null,
  severity: "critical",
  status: "active",
  owner: null,
  detected_at: "2026-08-01T00:00:00Z",
  resolved_at: null,
  created_at: "2026-08-01T00:00:00Z",
};

beforeEach(() => {
  result = { data: null, error: null };
  selectedColumns = "";
  appliedFilters = [];
  usedMaybeSingle = false;
  vi.restoreAllMocks();
});

describe("getIncidentDetail", () => {
  it("returns the row when it exists", async () => {
    result = { data: ROW, error: null };
    await expect(getIncidentDetail("ws_1", "inc_1")).resolves.toEqual(ROW);
  });

  it("scopes the read to the workspace as well as the id", async () => {
    result = { data: ROW, error: null };
    await getIncidentDetail("ws_1", "inc_1");

    // Every route in this codebase carries tenant scoping by hand — RLS never
    // engages, because everything runs through the service-role client. The
    // id filter alone would serve any workspace's incident to any signed-in
    // user who guessed a uuid.
    expect(appliedFilters).toContain("eq:id=inc_1");
    expect(appliedFilters).toContain("eq:workspace_id=ws_1");
  });

  it("returns null — not an error — when nothing matches", async () => {
    result = { data: null, error: null };
    await expect(getIncidentDetail("ws_1", "missing")).resolves.toBeNull();
    // `.single()` reports zero rows AS an error, which is how four PATCH
    // routes ended up answering 500 for a row deleted in another tab.
    expect(usedMaybeSingle).toBe(true);
  });

  it("returns null and logs when the query fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    result = { data: null, error: { message: "connection reset" } };

    await expect(getIncidentDetail("ws_1", "inc_1")).resolves.toBeNull();
    expect(spy).toHaveBeenCalled();
  });

  it("selects every column the table has", async () => {
    result = { data: ROW, error: null };
    await getIncidentDetail("ws_1", "inc_1");

    expect(selectedColumns).toBe(INCIDENT_COLUMNS);
    // The API route used to `select("*")`. Naming the columns keeps the
    // response stable, but only if the list is actually complete — a short
    // list is the M-2 bug wearing a different hat.
    for (const col of Object.keys(ROW)) {
      expect(INCIDENT_COLUMNS.split(",")).toContain(col);
    }
  });
});

describe("no caller has its own copy of the query", () => {
  const CALLERS = [
    "src/app/(app)/incidents/[id]/page.tsx",
    "src/app/api/incidents/[id]/route.ts",
  ];

  it.each(CALLERS)("%s reads incidents through the service", async (file) => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const source = readFileSync(join(process.cwd(), file), "utf8");

    expect(source).toContain("getIncidentDetail");
    // A second `.from("incidents").select(...)` here is the finding coming
    // back. PATCH may still update the table directly — it is a write, and
    // writes are not what drifted.
    expect(source).not.toMatch(/from\(["']incidents["']\)\s*\.\s*select/);
  });
});
