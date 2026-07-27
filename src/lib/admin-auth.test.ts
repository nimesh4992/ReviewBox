import { describe, expect, it } from "vitest";

import { isAdminUser } from "./admin-auth";

describe("isAdminUser", () => {
  it("accepts an exact match", () => {
    expect(isAdminUser("user_abc123", "user_abc123")).toBe(true);
  });

  it("rejects a different user", () => {
    expect(isAdminUser("user_intruder", "user_abc123")).toBe(false);
  });

  it("fails closed when the admin env var is unset", () => {
    expect(isAdminUser("user_abc123", undefined)).toBe(false);
    expect(isAdminUser("user_abc123", null)).toBe(false);
  });

  it("fails closed when the admin env var is blank or whitespace", () => {
    expect(isAdminUser("user_abc123", "")).toBe(false);
    expect(isAdminUser("user_abc123", "   ")).toBe(false);
  });

  it("fails closed for signed-out callers, even with env unset on both sides", () => {
    expect(isAdminUser(null, undefined)).toBe(false);
    expect(isAdminUser(undefined, undefined)).toBe(false);
    expect(isAdminUser("", "")).toBe(false);
  });

  it("tolerates copy-paste whitespace around the env value", () => {
    expect(isAdminUser("user_abc123", "  user_abc123\n")).toBe(true);
  });

  it("never treats the empty-string user as admin", () => {
    expect(isAdminUser("", "user_abc123")).toBe(false);
  });
});
