import { describe, it, expect } from "vitest";

import { exportFileName, slugifyAppName } from "./export-filename";

const DAY = new Date("2026-08-16T21:40:00.000Z");

describe("slugifyAppName", () => {
  it("lowercases and hyphenates", () => {
    expect(slugifyAppName("Mumbai One")).toBe("mumbai-one");
  });

  it("strips punctuation and collapses separators", () => {
    expect(slugifyAppName("Acme  Pay+ (Beta)!")).toBe("acme-pay-beta");
  });

  it("falls back to 'app' for a name that slugifies to nothing", () => {
    // A non-Latin app name must still produce a usable filename rather than
    // `reviews--2026-08-16.csv`.
    expect(slugifyAppName("日本語")).toBe("app");
    expect(slugifyAppName("")).toBe("app");
    expect(slugifyAppName(undefined)).toBe("app");
  });
});

describe("exportFileName", () => {
  it("names the selected app", () => {
    expect(exportFileName("Mumbai One", "app-1", DAY)).toBe("reviews-mumbai-one-2026-08-16.csv");
  });

  it("says all-apps when nothing is selected", () => {
    // The scope is what distinguishes two otherwise identically-named files.
    expect(exportFileName("All apps", undefined, DAY)).toBe("reviews-all-apps-2026-08-16.csv");
  });

  it("gives two scopes two different filenames on the same day", () => {
    expect(exportFileName("Mumbai One", "app-1", DAY)).not.toBe(
      exportFileName("All apps", undefined, DAY),
    );
  });
});
