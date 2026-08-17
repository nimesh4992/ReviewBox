/**
 * Guards for the automation action vocabulary.
 *
 * The list used to be hand-copied into two route files, and drifted from the
 * UI that offers the options: the rule builder advertised "Auto-reply (AI)"
 * while both routes rejected it with a 400, so the option could be selected
 * but never saved. There is now one definition, and these tests plus the
 * `SelectableAutomationAction` type on the UI's option array keep it that way.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { ISSUE_TAGS } from "./tag-labels";
import {
  AUTOMATION_ACTIONS,
  SELECTABLE_AUTOMATION_ACTIONS,
  isSelectableAutomationAction,
} from "./automation-actions";

describe("automation action vocabulary", () => {
  it("only offers actions that are actually implemented", () => {
    for (const a of SELECTABLE_AUTOMATION_ACTIONS) {
      expect(AUTOMATION_ACTIONS).toContain(a);
    }
  });

  it("covers every case the executor implements", () => {
    // Parses the executor's switch so a newly-implemented action can't be
    // added there and silently left out of the vocabulary (or vice versa).
    const src = readFileSync(join(process.cwd(), "src/lib/automation-executor.ts"), "utf8");
    const cases = [...src.matchAll(/case\s+"([a-z_]+)":/g)].map((m) => m[1]);
    const implemented = cases.filter((c) => (AUTOMATION_ACTIONS as readonly string[]).includes(c));

    // Every action we claim exists is handled by the executor…
    for (const a of AUTOMATION_ACTIONS) {
      expect(implemented).toContain(a);
    }
    // …and the executor handles nothing outside the vocabulary.
    const actionCases = cases.filter((c) => c.includes("_") || c === "escalate");
    for (const c of actionCases) {
      expect(AUTOMATION_ACTIONS as readonly string[]).toContain(c);
    }
  });

  describe("auto_reply is implemented but deliberately not selectable", () => {
    // It publishes straight to the live store with no human approval. Until
    // the per-workspace sync lock (AS1) ships, two concurrent syncs can both
    // treat the same new review as new — which for this action means two
    // different AI replies posted to one real listing. Re-enabling it before
    // that lock turns an internal race into a customer-visible one.
    it("is a real, implemented action", () => {
      expect(AUTOMATION_ACTIONS).toContain("auto_reply");
    });

    it("cannot be saved through the API", () => {
      expect(SELECTABLE_AUTOMATION_ACTIONS).not.toContain("auto_reply");
      expect(isSelectableAutomationAction("auto_reply")).toBe(false);
    });
  });

  it("neither route keeps its own hand-copied allowlist any more", () => {
    // The two copies drifting from each other and from the UI is the whole
    // reason this module exists.
    for (const route of [
      "src/app/api/automations/rules/route.ts",
      "src/app/api/automations/rules/[id]/route.ts",
    ]) {
      const src = readFileSync(join(process.cwd(), route), "utf8");
      expect(src).not.toMatch(/const VALID_ACTIONS/);
      expect(src).toMatch(/isSelectableAutomationAction/);
    }
  });

  it("the rule builder offers exactly what the API accepts", () => {
    // The type on ACTION_OPTIONS makes a mismatch a compile error; this also
    // catches the case where someone re-adds a raw literal list.
    const src = readFileSync(
      join(process.cwd(), "src/features/automations/components/rule-builder-modal.tsx"),
      "utf8",
    );
    const offered = [...src.matchAll(/\{\s*value:\s*"([a-z_]+)",\s*label:/g)].map((m) => m[1]);
    const offeredActions = offered.filter((v) =>
      (AUTOMATION_ACTIONS as readonly string[]).includes(v),
    );
    expect(offeredActions.length).toBeGreaterThan(0);
    for (const a of offeredActions) {
      expect(SELECTABLE_AUTOMATION_ACTIONS as readonly string[]).toContain(a);
    }
  });

  it("rejects unknown values", () => {
    expect(isSelectableAutomationAction("nope")).toBe(false);
    expect(isSelectableAutomationAction("")).toBe(false);
    expect(isSelectableAutomationAction(undefined)).toBe(false);
    expect(isSelectableAutomationAction(null)).toBe(false);
    expect(isSelectableAutomationAction(42)).toBe(false);
  });

  it("accepts each selectable action", () => {
    for (const a of SELECTABLE_AUTOMATION_ACTIONS) {
      expect(isSelectableAutomationAction(a)).toBe(true);
    }
  });
});

describe("issue tag vocabulary has one definition", () => {
  it("the rule builder imports the canonical list rather than re-typing it", () => {
    // It previously carried its own copy — in a different order, so the picker
    // disagreed with the canonical vocabulary, and a new tag added to
    // tag-labels.ts would never have appeared in an automation condition.
    const src = readFileSync(
      join(process.cwd(), "src/features/automations/components/rule-builder-modal.tsx"),
      "utf8",
    );
    expect(src).toMatch(/import \{ ISSUE_TAGS \} from "@\/lib\/tag-labels"/);
    expect(src).not.toMatch(/const ISSUE_TAGS\s*=/);
  });

  it("the canonical list covers every tag in the ReviewIssueTag union", () => {
    const types = readFileSync(join(process.cwd(), "src/types/review.ts"), "utf8");
    const union = types.match(/export type ReviewIssueTag =([\s\S]*?);/);
    expect(union).not.toBeNull();
    const fromType = [...union![1].matchAll(/"([a-z-]+)"/g)].map((m) => m[1]);

    expect([...ISSUE_TAGS].sort()).toEqual([...fromType].sort());
  });
});
