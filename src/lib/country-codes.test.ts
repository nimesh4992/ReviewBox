import { describe, it, expect } from "vitest";

import { toAlpha2 } from "./country-codes";

describe("toAlpha2", () => {
  it("passes through alpha-2 codes, upper-cased", () => {
    expect(toAlpha2("in")).toBe("IN");
    expect(toAlpha2("US")).toBe("US");
    expect(toAlpha2(" gb ")).toBe("GB");
  });

  it("converts App Store Connect alpha-3 territories", () => {
    // The whole point: "IND" in a char(2) column raises 22001 and fails the
    // entire insert batch, so App Store sync broke for the whole app.
    expect(toAlpha2("IND")).toBe("IN");
    expect(toAlpha2("USA")).toBe("US");
    expect(toAlpha2("GBR")).toBe("GB");
    expect(toAlpha2("DEU")).toBe("DE");
  });

  it("extracts the region from BCP 47 locales", () => {
    expect(toAlpha2("en-IN")).toBe("IN");
    expect(toAlpha2("pt_BR")).toBe("BR");
  });

  it("maps common country names from CSV exports", () => {
    expect(toAlpha2("United States")).toBe("US");
    expect(toAlpha2("india")).toBe("IN");
  });

  it("returns null rather than an over-long value for anything unresolvable", () => {
    for (const input of [null, undefined, "", "   ", "Nowhere Land", "XYZ", "12345"]) {
      expect(toAlpha2(input)).toBeNull();
    }
  });

  it("never returns a string longer than 2 characters", () => {
    const inputs = ["IND", "en-IN", "United States", "us", "ZZZ", "a very long country name"];
    for (const input of inputs) {
      const out = toAlpha2(input);
      if (out !== null) expect(out.length).toBe(2);
    }
  });
});
