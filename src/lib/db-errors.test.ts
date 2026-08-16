import { describe, expect, it, vi } from "vitest";

import {
  isMissingColumnError,
  isMissingTableError,
  missingColumnName,
  writeWithOptionalColumns,
} from "./db-errors";

/** The exact error Vercel logged when onboarding 500'd for every new signup. */
const STORE_COUNTRY_PGRST204 = {
  code: "PGRST204",
  details: null,
  hint: null,
  message: "Could not find the 'store_country' column of 'apps' in the schema cache",
};

describe("isMissingColumnError", () => {
  it("accepts the Postgres read-path code", () => {
    expect(isMissingColumnError({ code: "42703" })).toBe(true);
  });

  it("accepts the PostgREST write-path code", () => {
    // The whole point: this is what an insert returns, and every fallback in
    // the codebase used to miss it.
    expect(isMissingColumnError(STORE_COUNTRY_PGRST204)).toBe(true);
  });

  it("rejects unrelated failures", () => {
    expect(isMissingColumnError({ code: "23505" })).toBe(false);
    expect(isMissingColumnError({ code: "42P01" })).toBe(false);
    expect(isMissingColumnError(null)).toBe(false);
    expect(isMissingColumnError(undefined)).toBe(false);
    expect(isMissingColumnError({})).toBe(false);
  });
});

describe("isMissingTableError", () => {
  it("accepts both missing-table codes", () => {
    expect(isMissingTableError({ code: "42P01" })).toBe(true);
    expect(isMissingTableError({ code: "PGRST205" })).toBe(true);
  });

  it("does not confuse a missing column for a missing table", () => {
    expect(isMissingTableError({ code: "42703" })).toBe(false);
    expect(isMissingTableError({ code: "PGRST204" })).toBe(false);
    expect(isMissingTableError(null)).toBe(false);
  });
});

describe("missingColumnName", () => {
  it("reads the column out of a PostgREST schema-cache miss", () => {
    expect(missingColumnName(STORE_COUNTRY_PGRST204)).toBe("store_country");
  });

  it("reads the column out of a Postgres write error", () => {
    expect(
      missingColumnName({
        code: "42703",
        message: 'column "brand_voice" of relation "workspaces" does not exist',
      }),
    ).toBe("brand_voice");
  });

  it("reads the column out of a table-qualified select error", () => {
    expect(
      missingColumnName({ code: "42703", message: "column apps.store_country does not exist" }),
    ).toBe("store_country");
  });

  it("returns null when the error is not about a column", () => {
    expect(missingColumnName({ code: "23502", message: "null value in column" })).toBeNull();
    expect(missingColumnName(null)).toBeNull();
  });

  it("returns null when the wording is unrecognised", () => {
    expect(missingColumnName({ code: "PGRST204", message: "something else entirely" })).toBeNull();
  });
});

describe("writeWithOptionalColumns", () => {
  it("sends everything when the schema is current", async () => {
    const run = vi.fn().mockResolvedValue({ data: { id: "a1" }, error: null });

    const result = await writeWithOptionalColumns(
      run,
      { name: "Mumbai One" },
      { icon_url: "i.png", store_country: "in" },
    );

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith({ name: "Mumbai One", icon_url: "i.png", store_country: "in" });
    expect(result.data).toEqual({ id: "a1" });
    expect(result.droppedColumns).toEqual([]);
  });

  it("drops only the column the database rejected", async () => {
    // The production failure: store_country absent, icon_url and developer fine.
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: STORE_COUNTRY_PGRST204 })
      .mockResolvedValueOnce({ data: { id: "a1" }, error: null });

    const result = await writeWithOptionalColumns(
      run,
      { workspace_id: "w1", name: "Mumbai One" },
      { icon_url: "i.png", developer: "Acme", store_country: "in" },
    );

    expect(run).toHaveBeenCalledTimes(2);
    // The retry keeps the metadata that the database can actually store —
    // the old all-or-nothing fallback threw the icon and developer away too.
    expect(run).toHaveBeenLastCalledWith({
      workspace_id: "w1",
      name: "Mumbai One",
      icon_url: "i.png",
      developer: "Acme",
    });
    expect(result.error).toBeNull();
    expect(result.droppedColumns).toEqual(["store_country"]);
  });

  it("drops several columns one at a time", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST204", message: "Could not find the 'brand_voice' column of 'workspaces' in the schema cache" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { code: "42703", message: 'column "app_category" of relation "workspaces" does not exist' },
      })
      .mockResolvedValueOnce({ data: { id: "w1" }, error: null });

    const result = await writeWithOptionalColumns(
      run,
      { name: "Acme", slug: "acme", plan: "trial" },
      { brand_voice: "warm", app_category: "travel", trial_ends_at: "2026-01-01" },
    );

    expect(run).toHaveBeenCalledTimes(3);
    expect(run).toHaveBeenLastCalledWith({
      name: "Acme",
      slug: "acme",
      plan: "trial",
      trial_ends_at: "2026-01-01",
    });
    expect(result.droppedColumns).toEqual(["brand_voice", "app_category"]);
  });

  it("sheds every optional column when the error names none", async () => {
    const run = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST204", message: "unparseable" } })
      .mockResolvedValueOnce({ data: { id: "a1" }, error: null });

    const result = await writeWithOptionalColumns(
      run,
      { name: "Acme" },
      { icon_url: "i.png", store_country: "in" },
    );

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith({ name: "Acme" });
    expect(result.droppedColumns).toEqual(["icon_url", "store_country"]);
  });

  it("gives up instead of looping when a required column is the problem", async () => {
    const run = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST204", message: "Could not find the 'slug' column of 'workspaces' in the schema cache" },
    });

    const result = await writeWithOptionalColumns(
      run,
      { name: "Acme", slug: "acme" },
      { brand_voice: "warm" },
    );

    // One full attempt, one shed-everything attempt — then stop and surface it.
    expect(run).toHaveBeenCalledTimes(2);
    expect(result.error?.code).toBe("PGRST204");
  });

  it("returns non-schema errors untouched on the first attempt", async () => {
    const run = vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key" } });

    const result = await writeWithOptionalColumns(run, { slug: "acme" }, { brand_voice: "warm" });

    expect(run).toHaveBeenCalledTimes(1);
    expect(result.error?.code).toBe("23505");
    expect(result.droppedColumns).toEqual([]);
  });

  it("handles a payload with no optional columns at all", async () => {
    const run = vi.fn().mockResolvedValue({ data: { id: "a1" }, error: null });
    const result = await writeWithOptionalColumns(run, { name: "Acme" }, {});
    expect(run).toHaveBeenCalledTimes(1);
    expect(result.data).toEqual({ id: "a1" });
  });
});
