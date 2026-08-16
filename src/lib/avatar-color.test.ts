import { describe, expect, it } from "vitest";

import { AVATAR_COLOR_COUNT, avatarColorIndex, avatarColorVar } from "./avatar-color";

describe("avatarColorIndex", () => {
  it("always lands inside the palette", () => {
    for (const name of ["Vandita Sharma", "mikhail dsouza", "R", "छत्रपती", "🙂", "a".repeat(300)]) {
      const i = avatarColorIndex(name);
      expect(i).toBeGreaterThanOrEqual(1);
      expect(i).toBeLessThanOrEqual(AVATAR_COLOR_COUNT);
    }
  });

  it("gives the same reviewer the same colour every time", () => {
    // The point of hashing rather than Math.random(): an avatar that changes
    // colour between the list row and the detail pane reads as a bug.
    expect(avatarColorIndex("Ravindra Panchal")).toBe(avatarColorIndex("Ravindra Panchal"));
  });

  it("ignores case and surrounding whitespace", () => {
    expect(avatarColorIndex("  Priyanka Khatri ")).toBe(avatarColorIndex("priyanka khatri"));
  });

  it("handles a blank author without throwing", () => {
    // Google Play returns an empty author for reviews left without a profile.
    expect(avatarColorIndex("")).toBe(1);
    expect(avatarColorIndex("   ")).toBe(1);
  });

  it("separates short similar names instead of clustering them", () => {
    // A naive char-code sum puts these in adjacent or identical buckets, which
    // is exactly the flat-looking inbox the palette is meant to fix.
    const names = ["Ravi", "Ravindra", "Rahul", "Raj", "Rajesh", "Ramesh"];
    const buckets = new Set(names.map(avatarColorIndex));
    expect(buckets.size).toBeGreaterThanOrEqual(3);
  });

  it("spreads a realistic inbox across most of the palette", () => {
    const names = [
      "Vandita Sharma", "Ravindra Panchal", "Swapnil Gupta", "Priyanka Khatri",
      "Ranveer Suryavanshi", "mikhail dsouza", "Sagar Mujumdar", "Anita Desai",
      "Karan Mehta", "Neha Joshi", "Vikram Rao", "Sunita Patil",
    ];
    const buckets = new Set(names.map(avatarColorIndex));
    expect(buckets.size).toBeGreaterThanOrEqual(5);
  });
});

describe("avatarColorVar", () => {
  it("returns a design token, never a raw colour", () => {
    expect(avatarColorVar("Vandita Sharma")).toMatch(/^var\(--rb-avatar-[1-8]\)$/);
  });
});
