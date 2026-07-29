import { describe, expect, it } from "vitest";
import { ALL_APPS_LABEL, resolveSelectedApp } from "./selected-app";

const APPS = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Mumbai One" },
  { id: "22222222-2222-2222-2222-222222222222", name: "Delhi Two"  },
];

describe("resolveSelectedApp", () => {
  it("resolves an id to that app's filter and display name", () => {
    expect(resolveSelectedApp(APPS, APPS[0].id)).toEqual({
      appId: APPS[0].id,
      appName: "Mumbai One",
    });
  });

  it("treats empty selection as all apps", () => {
    expect(resolveSelectedApp(APPS, "")).toEqual({
      appId: undefined,
      appName: ALL_APPS_LABEL,
    });
  });

  // The bug this module exists to prevent: the store was migrated from names
  // to ids, and screens that kept matching on name silently stopped filtering.
  it("does not resolve a NAME as if it were a selection", () => {
    expect(resolveSelectedApp(APPS, "Mumbai One")).toEqual({
      appId: undefined,
      appName: ALL_APPS_LABEL,
    });
  });

  it("never returns a raw id as the display name", () => {
    const { appName } = resolveSelectedApp(APPS, "99999999-9999-9999-9999-999999999999");
    expect(appName).toBe(ALL_APPS_LABEL);
    expect(appName).not.toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("falls back to all apps when the selected app no longer exists", () => {
    expect(resolveSelectedApp(APPS, "deleted-app-id")).toEqual({
      appId: undefined,
      appName: ALL_APPS_LABEL,
    });
  });

  it("handles apps not yet loaded without filtering on an unverified id", () => {
    expect(resolveSelectedApp(undefined, APPS[0].id).appId).toBeUndefined();
    expect(resolveSelectedApp([], APPS[0].id).appName).toBe(ALL_APPS_LABEL);
  });

  it("ignores whitespace-only selections", () => {
    expect(resolveSelectedApp(APPS, "   ").appId).toBeUndefined();
  });
});
