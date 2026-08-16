/**
 * Single source of truth for the company's legal identity.
 *
 * Every legal page, invoice, and email reads from here. Nothing about the
 * company's identity is hardcoded in a page — before this file existed the
 * Terms named a US state as the governing law while the company is registered
 * in India, and the entity name was spelled three different ways.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FOUNDER: the values marked PENDING are legally required to be published for
 * an Indian company and are checked by Stripe during account review. Fill them
 * in here and every page updates. `npm run test:unit` prints exactly which ones
 * are still outstanding (see company.test.ts) — it does not fail the build, so
 * the site keeps deploying while you gather them.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Marks a value the founder still has to supply. */
export const PENDING = null;

export type PendingOr<T> = T | typeof PENDING;

export const COMPANY = {
  /**
   * Must match the incorporation certificate EXACTLY, character for character.
   * Stripe verifies this against your registration documents and a mismatch is
   * one of the most common India account rejections. Confirmed by the founder
   * as "AT WORK Inc" — if the certificate reads anything else (for example a
   * "Private Limited" suffix), change it here before submitting to Stripe.
   */
  legalName: "AT WORK Inc",

  /** The brand customers know. */
  tradingAs: "ReviewBox",

  /** Where the entity is registered. Drives governing law and tax treatment. */
  country: "India",

  /** Corporate Identity Number from the MCA certificate. */
  cin: PENDING as PendingOr<string>,

  /** GST registration number. Required on invoices and for export-of-service. */
  gstin: PENDING as PendingOr<string>,

  /**
   * Registered office as recorded with the MCA. Must be a real, serviceable
   * address — it is where legal notice is delivered, so a PO box will not do.
   */
  registeredOffice: PENDING as PendingOr<{
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }>,

  /**
   * Publishing a Grievance Officer's name, email and address is a statutory
   * obligation in India, not a nicety. It must be a named human, not a role
   * mailbox alone.
   */
  grievanceOfficer: PENDING as PendingOr<{
    name: string;
    designation: string;
    email: string;
    address: string;
  }>,

  emails: {
    support: "hello@tryreviewbox.com",
    legal: "legal@tryreviewbox.com",
    privacy: "privacy@tryreviewbox.com",
    billing: "billing@tryreviewbox.com",
    grievance: "grievance@tryreviewbox.com",
  },

  /** Governing law and forum. India, per the founder. */
  jurisdiction: {
    governingLaw: "India",
    /** City whose courts have exclusive jurisdiction — follows the registered office. */
    courts: PENDING as PendingOr<string>,
  },

  site: {
    domain: "tryreviewbox.com",
    url: "https://tryreviewbox.com",
    app: "https://app.tryreviewbox.com",
  },
} as const;

/** Renders a pending value as an obvious placeholder rather than "null". */
export function orPending(value: string | null | undefined): string {
  return value ?? "[to be published]";
}

/** Formats the registered office for display, or an honest placeholder. */
export function formatRegisteredOffice(): string {
  const office = COMPANY.registeredOffice;
  if (!office) return "[registered office address to be published]";
  return [office.line1, office.line2, `${office.city}, ${office.state} ${office.postalCode}`, office.country]
    .filter(Boolean)
    .join(", ");
}

/** Full legal identity line, e.g. for legal page footers. */
export function companyLine(): string {
  return `${COMPANY.legalName}, trading as ${COMPANY.tradingAs}`;
}

/**
 * Which required identifiers are still missing. Used by the unit test to print
 * the founder's outstanding checklist, and by /legal-status in development.
 */
export function outstandingLegalFacts(): string[] {
  const missing: string[] = [];
  if (!COMPANY.cin) missing.push("CIN (Corporate Identity Number, from the MCA certificate)");
  if (!COMPANY.gstin) missing.push("GSTIN (GST registration number)");
  if (!COMPANY.registeredOffice) missing.push("Registered office address (as recorded with the MCA)");
  if (!COMPANY.grievanceOfficer) missing.push("Grievance Officer name, designation, email and address");
  if (!COMPANY.jurisdiction.courts) missing.push("City whose courts have exclusive jurisdiction");
  return missing;
}
