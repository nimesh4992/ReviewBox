import { describe, it, expect } from "vitest";

import { deriveVersions, type ReleaseReviewRow } from "./release-versions";

function row(
  app_id: string,
  app_version: string | null,
  rating: number,
  day: string,
): ReleaseReviewRow {
  return { app_id, app_version, rating, store_created_at: `2026-08-${day}T00:00:00.000Z` };
}

const NAMES = new Map([
  ["app-a", "Mumbai One"],
  ["app-b", "Acme Pay"],
]);

describe("deriveVersions", () => {
  it("never merges the same version number across two apps", () => {
    // The regression: both apps shipped 2.1.0, and keying on the version
    // string alone fused them into one row with a blended average.
    const versions = deriveVersions(
      [
        row("app-a", "2.1.0", 5, "01"),
        row("app-a", "2.1.0", 5, "02"),
        row("app-b", "2.1.0", 1, "03"),
      ],
      NAMES,
    );

    expect(versions).toHaveLength(2);
    const a = versions.find((v) => v.appId === "app-a")!;
    const b = versions.find((v) => v.appId === "app-b")!;
    expect(a.version).toBe("2.1.0");
    expect(a.avgRating).toBe(5);
    expect(a.reviewCount).toBe(2);
    expect(b.avgRating).toBe(1);
    expect(b.reviewCount).toBe(1);
  });

  it("labels each row with its app name", () => {
    const [v] = deriveVersions([row("app-a", "1.0.0", 4, "01")], NAMES);
    expect(v.appName).toBe("Mumbai One");
  });

  it("computes 'vs previous' against the same app's prior release only", () => {
    // app-b's release sits between app-a's two chronologically. Chaining by
    // recency across the workspace would measure app-a's 3.0 against app-b.
    const versions = deriveVersions(
      [
        row("app-a", "1.0.0", 2, "01"),
        row("app-b", "9.9.9", 5, "02"),
        row("app-a", "1.1.0", 4, "03"),
      ],
      NAMES,
    );

    const newer = versions.find((v) => v.version === "1.1.0")!;
    const older = versions.find((v) => v.version === "1.0.0")!;
    const other = versions.find((v) => v.version === "9.9.9")!;

    expect(newer.ratingDelta).toBe(2); // 4 − 2, both app-a
    expect(older.ratingDelta).toBeNull(); // app-a's oldest
    expect(other.ratingDelta).toBeNull(); // app-b's only release
  });

  it("orders newest first and keeps the earliest sighting as firstSeen", () => {
    const versions = deriveVersions(
      [
        row("app-a", "1.0.0", 3, "05"),
        row("app-a", "1.0.0", 3, "01"),
        row("app-a", "2.0.0", 3, "09"),
      ],
      NAMES,
    );

    expect(versions.map((v) => v.version)).toEqual(["2.0.0", "1.0.0"]);
    expect(versions[1].firstSeen).toBe("2026-08-01T00:00:00.000Z");
  });

  it("skips rows with no version and rows with no app", () => {
    const versions = deriveVersions(
      [
        row("app-a", null, 3, "01"),
        row("app-a", "   ", 3, "02"),
        row("", "1.0.0", 3, "03"),
        row("app-a", "1.0.0", 3, "04"),
      ],
      NAMES,
    );

    expect(versions).toHaveLength(1);
    expect(versions[0].reviewCount).toBe(1);
  });
});
