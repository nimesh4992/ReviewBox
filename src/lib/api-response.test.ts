import { describe, expect, it } from "vitest";

import { apiError } from "./api-response";

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
