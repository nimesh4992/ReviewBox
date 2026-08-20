import { describe, expect, it } from "vitest";

import { parseCsv, parseCsvRecords, toCsv, toCsvCell } from "./csv";

describe("parseCsv", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps commas inside quoted review text", () => {
    // The failure this module exists to prevent: a split(",") loader turns one
    // angry review into three columns and the corruption reads as a clustering bug.
    expect(parseCsv('id,text\n1,"payment failed, ticket not issued, no refund"\n')).toEqual([
      ["id", "text"],
      ["1", "payment failed, ticket not issued, no refund"],
    ]);
  });

  it("keeps newlines inside quoted cells", () => {
    expect(parseCsv('id,text\n1,"line one\nline two"\n')).toEqual([
      ["id", "text"],
      ["1", "line one\nline two"],
    ]);
  });

  it('unescapes doubled quotes', () => {
    expect(parseCsv('id,text\n1,"he said ""fix it"" twice"\n')).toEqual([
      ["id", "text"],
      ["1", 'he said "fix it" twice'],
    ]);
  });

  it("preserves Devanagari and code-switched text unchanged", () => {
    const text = "payment कट गया but ticket nahi aaya 😤";
    expect(parseCsv(`id,text\n1,"${text}"\n`)[1][1]).toBe(text);
  });

  it("treats CRLF the same as LF", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual(parseCsv("a,b\n1,2\n"));
  });

  it("parses a final row with no trailing newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns no rows for empty input", () => {
    expect(parseCsv("")).toEqual([]);
  });

  it("keeps empty cells rather than dropping them", () => {
    expect(parseCsv("a,,c\n")).toEqual([["a", "", "c"]]);
  });
});

describe("parseCsvRecords", () => {
  it("keys cells by header name", () => {
    expect(parseCsvRecords("review_id,issue_id\nr1,payment\n")).toEqual([
      { review_id: "r1", issue_id: "payment" },
    ]);
  });

  it("fills missing trailing columns with empty strings", () => {
    // A labeller who leaves the last column blank should produce an empty
    // label, not undefined that later reads as the string "undefined".
    expect(parseCsvRecords("review_id,issue_id,severity\nr1,payment\n")).toEqual([
      { review_id: "r1", issue_id: "payment", severity: "" },
    ]);
  });

  it("returns nothing for a header-only file", () => {
    expect(parseCsvRecords("review_id,issue_id\n")).toEqual([]);
  });
});

describe("toCsv", () => {
  it("quotes only cells that need it", () => {
    expect(toCsvCell("plain")).toBe("plain");
    expect(toCsvCell("has,comma")).toBe('"has,comma"');
    expect(toCsvCell('has"quote')).toBe('"has""quote"');
    expect(toCsvCell("has\nnewline")).toBe('"has\nnewline"');
  });

  it("round-trips text that would break a naive writer", () => {
    const rows = [
      ["id", "text"],
      ["1", 'payment failed, "twice", and\nno refund'],
      ["2", "payment कट गया but ticket nahi aaya"],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});
