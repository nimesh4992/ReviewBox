import { describe, expect, it } from "vitest";

import {
  COMPANY,
  companyLine,
  entityDescription,
  formatRegisteredOffice,
  outstandingLegalFacts,
} from "./company";

/**
 * These tests guard the legal identity, not the law. They fail when a page
 * could render a broken or contradictory company identity — they deliberately
 * do NOT fail merely because the founder hasn't supplied the CIN yet, so the
 * site keeps deploying while those facts are gathered.
 */
describe("company legal identity", () => {
  it("names an India-registered entity", () => {
    expect(COMPANY.country).toBe("India");
    expect(COMPANY.jurisdiction.governingLaw).toBe("India");
  });

  it("describes the entity as a partnership, which has no CIN", () => {
    expect(COMPANY.entityType).toBe("Partnership firm");
    expect(COMPANY).not.toHaveProperty("cin");
    expect(entityDescription()).toContain("Indian Partnership Act, 1932");
  });

  it("never claims a jurisdiction outside India", () => {
    // The Terms previously named Delaware, USA while the company is Indian.
    const identity = JSON.stringify(COMPANY);
    for (const wrong of ["Delaware", "California", "United States", "England"]) {
      expect(identity).not.toContain(wrong);
    }
  });

  it("renders pending values as visible placeholders, never as null or undefined", () => {
    const office = formatRegisteredOffice();
    expect(office).not.toMatch(/null|undefined/);
    expect(office.length).toBeGreaterThan(0);
  });

  it("builds a company line from the registered name", () => {
    expect(companyLine()).toBe("AT WORK Inc, trading as ReviewBox");
  });

  it("reports which required facts the founder still owes", () => {
    const missing = outstandingLegalFacts();
    // Not an assertion that the list is empty — it is a visible checklist.
    if (missing.length > 0) {
      console.log(
        "\n  ⚠ Legal facts still required before these pages are complete:\n" +
          missing.map((m) => `     • ${m}`).join("\n") +
          "\n    Fill them in at src/lib/legal/company.ts\n",
      );
    }
    expect(Array.isArray(missing)).toBe(true);
  });
});
