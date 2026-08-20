import { describe, expect, it } from "vitest";

import { applyEnv, parseEnvFile, readEnvFile } from "./env-file";

const URL_KEY = "NEXT_PUBLIC_SUPABASE_URL";
const KEY_KEY = "SUPABASE_SERVICE_ROLE_KEY";

describe("parseEnvFile", () => {
  it("parses a Unix (LF) file", () => {
    expect(parseEnvFile(`${URL_KEY}=https://abc.supabase.co\n${KEY_KEY}=sk-test\n`)).toEqual({
      [URL_KEY]: "https://abc.supabase.co",
      [KEY_KEY]: "sk-test",
    });
  });

  it("parses a Windows (CRLF) file — the bug this module exists for", () => {
    // The original parser returned {} here, because `.` does not match `\r`
    // in JavaScript, so `(.*)$` failed on every line. The founder was then
    // told their present, correct .env.local was missing.
    expect(parseEnvFile(`${URL_KEY}=https://abc.supabase.co\r\n${KEY_KEY}=sk-test\r\n`)).toEqual({
      [URL_KEY]: "https://abc.supabase.co",
      [KEY_KEY]: "sk-test",
    });
  });

  it("parses old-Mac (CR-only) line endings", () => {
    expect(parseEnvFile(`${URL_KEY}=a\r${KEY_KEY}=b`)).toEqual({ [URL_KEY]: "a", [KEY_KEY]: "b" });
  });

  it("gives identical results for LF and CRLF versions of the same file", () => {
    const lf = `# comment\n${URL_KEY}=https://x.supabase.co\n\n${KEY_KEY}="quoted value"\n`;
    expect(parseEnvFile(lf.replace(/\n/g, "\r\n"))).toEqual(parseEnvFile(lf));
  });

  it("strips a UTF-8 BOM so the first key still parses", () => {
    // Windows editors write a BOM; without stripping it, the first key is lost.
    expect(parseEnvFile(`﻿${URL_KEY}=https://bom.supabase.co\r\n`)).toEqual({
      [URL_KEY]: "https://bom.supabase.co",
    });
  });

  it("removes surrounding double or single quotes", () => {
    expect(parseEnvFile(`A="dq"\nB='sq'\nC=bare\n`)).toEqual({ A: "dq", B: "sq", C: "bare" });
  });

  it("keeps quotes that are not a matching surrounding pair", () => {
    expect(parseEnvFile(`A="unbalanced\nB=say "hi"\n`)).toEqual({ A: '"unbalanced', B: 'say "hi"' });
  });

  it("keeps characters that appear inside real Supabase keys", () => {
    const jwt = "eyJhbGciOi.J9-_x==";
    expect(parseEnvFile(`${KEY_KEY}=${jwt}\r\n`)[KEY_KEY]).toBe(jwt);
  });

  it("does not truncate a value containing '='", () => {
    expect(parseEnvFile("A=b=c=d\n")).toEqual({ A: "b=c=d" });
  });

  it("ignores comments and blank lines", () => {
    expect(parseEnvFile("# a comment\n\n   \n#another\nA=1\n")).toEqual({ A: "1" });
  });

  it("accepts an `export` prefix", () => {
    expect(parseEnvFile("export A=1\r\n")).toEqual({ A: "1" });
  });

  it("tolerates spaces around the equals sign", () => {
    expect(parseEnvFile("A = 1\n")).toEqual({ A: "1" });
  });

  it("accepts lowercase and mixed-case keys", () => {
    expect(parseEnvFile("lower=1\nMiXeD=2\n")).toEqual({ lower: "1", MiXeD: "2" });
  });

  it("skips lines that are not KEY=value rather than guessing", () => {
    expect(parseEnvFile("just some prose\n=novalue\n123=numeric-start\nA=1\n")).toEqual({ A: "1" });
  });

  it("returns nothing for empty input", () => {
    expect(parseEnvFile("")).toEqual({});
  });

  it("keeps an empty value as an empty string", () => {
    expect(parseEnvFile("A=\r\n")).toEqual({ A: "" });
  });

  it("takes the last value when a key repeats", () => {
    expect(parseEnvFile("A=1\nA=2\n")).toEqual({ A: "2" });
  });
});

describe("readEnvFile", () => {
  it("reports found=false when the file does not exist", () => {
    const result = readEnvFile(".env.local", () => {
      throw new Error("ENOENT");
    });
    expect(result).toEqual({ values: {}, found: false });
  });

  it("reports found=true with no values for an empty file", () => {
    // "absent" and "present but empty" are different problems and must not
    // share an error message.
    expect(readEnvFile(".env.local", () => "")).toEqual({ values: {}, found: true });
  });

  it("returns parsed values when the file reads", () => {
    const result = readEnvFile(".env.local", () => `${URL_KEY}=https://x\r\n`);
    expect(result.found).toBe(true);
    expect(result.values[URL_KEY]).toBe("https://x");
  });
});

describe("applyEnv", () => {
  it("sets keys that are not already present", () => {
    const target: Record<string, string | undefined> = {};
    expect(applyEnv({ A: "1", B: "2" }, target)).toEqual(["A", "B"]);
    expect(target).toEqual({ A: "1", B: "2" });
  });

  it("never overwrites a variable already set in the environment", () => {
    const target: Record<string, string | undefined> = { A: "from-shell" };
    expect(applyEnv({ A: "from-file" }, target)).toEqual([]);
    expect(target.A).toBe("from-shell");
  });

  it("treats an empty existing value as unset and fills it", () => {
    const target: Record<string, string | undefined> = { A: "" };
    applyEnv({ A: "from-file" }, target);
    expect(target.A).toBe("from-file");
  });
});
