import { describe, expect, it, vi } from "vitest";

import { apiError, migrationPendingError } from "./api-response";

describe("apiError", () => {
  it("returns the canonical envelope with code + message", async () => {
    const res = apiError("UNAUTHORIZED", 401);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({
      error: { code: "UNAUTHORIZED", message: "You must be signed in." },
    });
  });

  it("uses the override message when provided", async () => {
    const res = apiError("INVALID_INPUT", 400, "Custom reason");
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_INPUT");
    expect(body.error.message).toBe("Custom reason");
  });

  it("maps every supported code to a default message", async () => {
    // Sanity check — every code must have a default. If a code is missing,
    // defaultMessage() falls through the switch and returns undefined,
    // which would surface here as `message: undefined`.
    const codes = [
      "UNAUTHORIZED",
      "FORBIDDEN",
      "NO_WORKSPACE",
      "MISSING_FIELDS",
      "INVALID_INPUT",
      "NOT_FOUND",
      "SLUG_TAKEN",
      "SLUG_RESERVED",
      "PLAN_REQUIRED",
      "QUOTA_EXCEEDED",
      "RATE_LIMITED",
      "WORKSPACE_DELETED",
      "STORE_RATE_LIMITED",
      "STORE_SUBMIT_FAILED",
      "REVIEW_NOT_FOUND_ON_STORE",
      "APP_STORE_NOT_CONNECTED",
      "STRIPE_NOT_CONFIGURED",
      "INTERNAL_SERVER_ERROR",
      "SERVICE_UNAVAILABLE",
    ] as const;

    for (const code of codes) {
      const res = apiError(code, 400);
      const body = await res.json();
      expect(body.error.message).toBeTruthy();
      expect(typeof body.error.message).toBe("string");
    }
  });

  it("returns a 429 for RATE_LIMITED", async () => {
    const res = apiError("RATE_LIMITED", 429);
    expect(res.status).toBe(429);
  });

  it("returns a 403 for WORKSPACE_DELETED", async () => {
    const res = apiError("WORKSPACE_DELETED", 403);
    expect(res.status).toBe(403);
  });
});

describe("migrationPendingError", () => {
  it("returns null for an error that isn't about a missing column", () => {
    // Must fall through so the caller's own handling still runs. A helper that
    // swallowed every error would turn genuine faults into "try again later".
    expect(migrationPendingError({ code: "23505", message: "duplicate key" }, "Saving")).toBeNull();
    expect(migrationPendingError(null, "Saving")).toBeNull();
  });

  it("answers 503 MIGRATION_PENDING on the WRITE-path code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // PGRST204 is the one that matters here: PostgREST rejects the payload
    // before Postgres ever sees it, so 42703 never appears on a write.
    const res = migrationPendingError(
      { code: "PGRST204", message: "Could not find the 'brand_voice' column of 'workspaces' in the schema cache" },
      "Saving your workspace settings",
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);

    const body = await res!.json();
    expect(body.error.code).toBe("MIGRATION_PENDING");
    expect(body.error.message).toMatch(/^Saving your workspace settings/);
  });

  it("also handles the read-path code", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      migrationPendingError({ code: "42703", message: 'column "x" does not exist' }, "Saving"),
    ).not.toBeNull();
  });

  it("does not put the column name in the user-facing message", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = migrationPendingError(
      { code: "PGRST204", message: "Could not find the 'trial_ends_at' column of 'workspaces' in the schema cache" },
      "Extending the trial",
    );
    const body = await res!.json();
    // PGRST204 also fires when the column EXISTS and the schema cache is merely
    // stale, so naming it would point the reader at the wrong problem. It goes
    // to the server log instead.
    expect(body.error.message).not.toContain("trial_ends_at");
  });

  it("logs the column name for whoever is debugging", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    // Cleared: the spy is shared across this describe block, so without it the
    // assertion reads an earlier test's call and passes or fails by accident.
    spy.mockClear();
    migrationPendingError(
      { code: "PGRST204", message: "Could not find the 'store_country' column of 'apps' in the schema cache" },
      "Syncing",
    );
    expect(spy.mock.calls[0]?.[0]).toContain("store_country");
  });
});
