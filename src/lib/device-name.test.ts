import { describe, it, expect } from "vitest";
import { formatDeviceName } from "./device-name";

describe("formatDeviceName", () => {
  it("prefers the readable name over the build codename", () => {
    expect(formatDeviceName("spacewar", { manufacturer: "Google", productName: "Pixel 7" }))
      .toBe("Google Pixel 7");
    expect(formatDeviceName("klte", { manufacturer: "Samsung", productName: "Galaxy S5" }))
      .toBe("Samsung Galaxy S5");
  });

  it("does not repeat a manufacturer the product name already carries", () => {
    expect(formatDeviceName("fuxi", { manufacturer: "Xiaomi", productName: "Xiaomi 13" }))
      .toBe("Xiaomi 13");
    expect(formatDeviceName("x", { manufacturer: "OnePlus", productName: "OnePlus Nord" }))
      .toBe("OnePlus Nord");
  });

  it("uses the product name alone when there is no manufacturer", () => {
    expect(formatDeviceName("flounder", { productName: "Nexus 9" })).toBe("Nexus 9");
  });

  it("pairs manufacturer with codename when the product name is missing", () => {
    expect(formatDeviceName("a51", { manufacturer: "Samsung" })).toBe("Samsung (a51)");
  });

  it("falls back to the codename rather than dropping the field", () => {
    expect(formatDeviceName("spacewar")).toBe("spacewar");
    expect(formatDeviceName("spacewar", {})).toBe("spacewar");
    expect(formatDeviceName("spacewar", null)).toBe("spacewar");
  });

  it("returns null when there is nothing at all", () => {
    expect(formatDeviceName(null)).toBeNull();
    expect(formatDeviceName(undefined, { manufacturer: "  ", productName: "" })).toBeNull();
    expect(formatDeviceName("   ", { productName: "   " })).toBeNull();
  });
});
