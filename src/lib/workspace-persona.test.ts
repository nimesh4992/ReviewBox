import { describe, expect, it } from "vitest";

import { DEFAULT_PERSONA, personalizeText, type WorkspacePersona } from "./workspace-persona";

const ACME: WorkspacePersona = {
  appName: "Acme",
  supportEmail: "hello@acme.com",
  teamName: "The Acme Team",
};

describe("personalizeText", () => {
  it("replaces all three placeholders", () => {
    const out = personalizeText(
      "Hi from {teamName}! Reach us at {supportEmail} about {appName}.",
      ACME,
    );
    expect(out).toBe("Hi from The Acme Team! Reach us at hello@acme.com about Acme.");
  });

  it("replaces multiple occurrences of the same placeholder", () => {
    const out = personalizeText("{appName} {appName} {appName}", ACME);
    expect(out).toBe("Acme Acme Acme");
  });

  it("is case-insensitive on placeholder names", () => {
    const out = personalizeText("{APPNAME} {AppName} {appname}", ACME);
    expect(out).toBe("Acme Acme Acme");
  });

  it("leaves unrelated text untouched", () => {
    expect(personalizeText("no placeholders here", ACME)).toBe("no placeholders here");
    expect(personalizeText("{unknown} stays", ACME)).toBe("{unknown} stays");
  });

  it("falls back to defaults when persona uses them", () => {
    const out = personalizeText("From {teamName} at {supportEmail}", DEFAULT_PERSONA);
    expect(out).toContain("The Support Team");
    expect(out).toContain("hello@tryreviewbox.com");
  });

  it("handles empty input safely", () => {
    expect(personalizeText("", ACME)).toBe("");
  });
});
