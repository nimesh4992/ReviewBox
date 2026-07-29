import { describe, expect, it } from "vitest";

import { apiErrorMessage } from "./api-error-message";

describe("apiErrorMessage", () => {
  it("extracts the message from the canonical envelope", () => {
    // THE crash: components did setError(body.error) where body.error is this
    // object, React refused to render it (error #31) and the whole settings
    // page became "Something went wrong" — hiding the real reason.
    const body = { error: { code: "PLAN_REQUIRED", message: "Upgrade to add more apps" } };
    expect(apiErrorMessage(body, "fallback")).toBe("Upgrade to add more apps");
  });

  it("always returns a string, never an object", () => {
    const shapes: unknown[] = [
      { error: { code: "X", message: "m" } },
      { error: "RATE_LIMITED" },
      { message: "plain message" },
      { detail: "detail text" },
      "raw string body",
      {},
      null,
      undefined,
      42,
      { error: {} },
    ];
    for (const shape of shapes) {
      expect(typeof apiErrorMessage(shape, "fallback")).toBe("string");
    }
  });

  it("falls back to a humanized code when no message is present", () => {
    expect(apiErrorMessage({ error: { code: "RATE_LIMITED" } }, "fallback")).toBe("Rate limited");
    expect(apiErrorMessage({ error: "GOOGLE_PLAY_NOT_CONFIGURED" }, "fallback")).toBe(
      "Google play not configured",
    );
  });

  it("leaves human-written strings alone", () => {
    expect(apiErrorMessage({ error: "Something specific went wrong" }, "fallback")).toBe(
      "Something specific went wrong",
    );
  });

  it("uses the fallback for empty or unusable bodies", () => {
    expect(apiErrorMessage({}, "Failed to add app.")).toBe("Failed to add app.");
    expect(apiErrorMessage(null, "Failed to add app.")).toBe("Failed to add app.");
    expect(apiErrorMessage({ error: { message: "   " } }, "Failed to add app.")).toBe(
      "Failed to add app.",
    );
  });
});
