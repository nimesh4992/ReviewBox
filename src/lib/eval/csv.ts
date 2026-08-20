/**
 * csv.ts — RFC 4180 parse/serialise, no dependency.
 *
 * This exists because the golden set is real review text: commas, quotes,
 * newlines, emoji and Devanagari all appear in it. A split(",") loader would
 * silently mangle exactly the rows we care most about (the long, angry,
 * code-switched ones), and the corruption would look like a clustering failure
 * rather than a parsing failure. Hence a real parser, with tests.
 */

/** Parse CSV text into rows of raw cell strings. Handles quoted commas, quoted newlines and "" escapes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  // Normalise newlines so a CRLF file and an LF file parse identically.
  const src = text.replace(/\r\n?/g, "\n");

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];

    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }

  // A file not ending in a newline still has a final cell to flush. Skip the
  // single empty row a trailing newline would otherwise produce.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows;
}

/** Parse CSV whose first row is a header, into objects keyed by column name. */
export function parseCsvRecords(text: string): Record<string, string>[] {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((key, i) => {
      record[key] = cells[i] ?? "";
    });
    return record;
  });
}

/** Quote a single cell only when it needs it. */
export function toCsvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Serialise rows to CSV text, with a trailing newline. */
export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(toCsvCell).join(",")).join("\n") + "\n";
}
