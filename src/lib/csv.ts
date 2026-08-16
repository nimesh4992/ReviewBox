/**
 * CSV escaping for exports.
 *
 * Two different problems live here and only one of them is about CSV.
 *
 * QUOTING is the CSV part: a value containing a comma, newline or quote has to
 * be wrapped so the file still parses.
 *
 * FORMULA INJECTION is not about CSV at all — it is about what Excel, Numbers
 * and Google Sheets do when they open one. A cell whose text begins with
 * `=`, `+`, `-` or `@` is treated as a formula and evaluated on open. Review
 * bodies and author names in this export are written by members of the public
 * on the App Store and Google Play; anyone can post a review beginning with
 * `=HYPERLINK(...)` or a DDE payload and have it execute in the spreadsheet of
 * the customer who exports their reviews. Correct quoting does not prevent
 * this — the value is still a well-formed cell, and the spreadsheet still runs
 * it.
 *
 * The standard mitigation is to prefix the value with an apostrophe, which
 * spreadsheets read as "this cell is text" and do not display.
 */

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_LEAD = /^[=+\-@\t\r]/;

export function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";

  let str = String(value);

  // Neutralise before quoting, so the apostrophe ends up inside the quotes
  // rather than outside them.
  if (FORMULA_LEAD.test(str)) str = `'${str}`;

  if (str.includes(",") || str.includes("\n") || str.includes("\r") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowToCsv(cols: unknown[]): string {
  return cols.map(escapeCsv).join(",");
}
