import { describe, it, expect } from "vitest";
import {
  ISSUE_TAGS,
  isIssueTag,
  tagLabel,
  effectiveTags,
  normalizeTagSelection,
  validateTagLabel,
  MAX_TAG_LABEL_LENGTH,
} from "./tag-labels";

describe("isIssueTag", () => {
  it("accepts the vocabulary and nothing else", () => {
    for (const t of ISSUE_TAGS) expect(isIssueTag(t)).toBe(true);
    expect(isIssueTag("payment-failure")).toBe(false);
    expect(isIssueTag("")).toBe(false);
    expect(isIssueTag(null)).toBe(false);
    expect(isIssueTag(42)).toBe(false);
  });
});

describe("tagLabel", () => {
  it("falls back to the humanised token", () => {
    expect(tagLabel("billing")).toBe("billing");
    expect(tagLabel("release-regression")).toBe("release regression");
  });

  it("prefers the workspace's own name", () => {
    expect(tagLabel("billing", { billing: "Payment failure" })).toBe("Payment failure");
  });

  it("ignores a blank custom label rather than rendering nothing", () => {
    expect(tagLabel("billing", { billing: "   " })).toBe("billing");
    expect(tagLabel("billing", {})).toBe("billing");
    expect(tagLabel("billing", null)).toBe("billing");
  });

  it("trims a stored label", () => {
    expect(tagLabel("crash", { crash: "  Crashes  " })).toBe("Crashes");
  });
});

describe("effectiveTags", () => {
  it("uses the engine's tags when nobody has corrected the review", () => {
    expect(effectiveTags(["crash"], null)).toEqual(["crash"]);
    expect(effectiveTags(["crash"], undefined)).toEqual(["crash"]);
  });

  it("honours a correction", () => {
    expect(effectiveTags(["crash"], ["billing"])).toEqual(["billing"]);
  });

  it("treats an empty correction as 'none of these apply', not as absent", () => {
    expect(effectiveTags(["crash", "login"], [])).toEqual([]);
  });

  it("survives a review with no tags at all", () => {
    expect(effectiveTags(null, null)).toEqual([]);
    expect(effectiveTags(undefined, undefined)).toEqual([]);
  });

  it("copies rather than aliasing the stored arrays", () => {
    const auto = ["crash"];
    const out  = effectiveTags(auto, null);
    out.push("billing");
    expect(auto).toEqual(["crash"]);
  });
});

describe("normalizeTagSelection", () => {
  it("drops unknown tokens instead of failing the edit", () => {
    expect(normalizeTagSelection(["crash", "not-a-tag", "billing"])).toEqual(["crash", "billing"]);
  });

  it("deduplicates", () => {
    expect(normalizeTagSelection(["crash", "crash"])).toEqual(["crash"]);
  });

  it("orders consistently regardless of input order", () => {
    expect(normalizeTagSelection(["billing", "crash"])).toEqual(
      normalizeTagSelection(["crash", "billing"]),
    );
  });

  it("returns an empty list for anything that is not an array", () => {
    expect(normalizeTagSelection(null)).toEqual([]);
    expect(normalizeTagSelection("crash")).toEqual([]);
    expect(normalizeTagSelection({})).toEqual([]);
  });
});

describe("validateTagLabel", () => {
  it("accepts and tidies a normal label", () => {
    expect(validateTagLabel("  Payment   failure ")).toEqual({ label: "Payment failure" });
  });

  it("treats empty as a reset to the default", () => {
    expect(validateTagLabel("")).toEqual({ label: null });
    expect(validateTagLabel("   ")).toEqual({ label: null });
  });

  it("rejects overlong labels", () => {
    const result = validateTagLabel("x".repeat(MAX_TAG_LABEL_LENGTH + 1));
    expect(result).toHaveProperty("error");
  });

  it("accepts a label at exactly the limit", () => {
    expect(validateTagLabel("x".repeat(MAX_TAG_LABEL_LENGTH))).toEqual({
      label: "x".repeat(MAX_TAG_LABEL_LENGTH),
    });
  });

  it("rejects angle brackets, since labels render inline in HTML email", () => {
    expect(validateTagLabel("<b>Billing</b>")).toHaveProperty("error");
  });

  it("rejects non-text", () => {
    expect(validateTagLabel(42)).toHaveProperty("error");
    expect(validateTagLabel(null)).toHaveProperty("error");
  });
});
