/**
 * env-file.ts — read `.env.local` for the eval CLIs.
 *
 * ⚠️ This exists because of a real bug, and the bug is worth remembering.
 *
 * The first version split on "\n" and matched each line with
 * `/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/`. On Windows every line ends "\r\n", so each
 * line kept a trailing "\r" — and **in JavaScript `\r` is a line terminator, so
 * `.` does not match it**. `(.*)$` therefore failed on every single line, the
 * parser returned nothing, and the exporter reported "Missing
 * NEXT_PUBLIC_SUPABASE_URL … run with .env.local present" at a founder whose
 * .env.local was present and correct.
 *
 * Two lessons, both encoded below:
 *   1. Normalise line endings before parsing anything line-based. `csv.ts` in
 *      this same folder already did; this file did not.
 *   2. "File missing" and "file unreadable" must never share an error message.
 *      `readEnvFile` reports which one happened.
 */

export interface EnvFileResult {
  /** Parsed keys. Empty when the file is absent. */
  values: Record<string, string>;
  /** False when the file does not exist — a different problem from an empty one. */
  found: boolean;
}

/**
 * Parse dotenv-style text.
 *
 * Handles CRLF and LF, a UTF-8 BOM, `export FOO=bar`, `#` comments, blank
 * lines, and single- or double-quoted values. Ignores anything that is not a
 * plain `KEY=value` line rather than guessing.
 */
export function parseEnvFile(text: string): Record<string, string> {
  const values: Record<string, string> = {};

  // Normalise first — see the module header for what happens when you don't.
  const normalised = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");

  for (const line of normalised.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(trimmed);
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim();
    const unquoted =
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
        ? value.slice(1, -1)
        : value;

    values[key] = unquoted;
  }

  return values;
}

/**
 * Read and parse a dotenv file, distinguishing "absent" from "empty".
 *
 * `readFile` is injected so this is testable without touching a filesystem.
 */
export function readEnvFile(
  path: string,
  readFile: (p: string) => string,
): EnvFileResult {
  let text: string;
  try {
    text = readFile(path);
  } catch {
    return { values: {}, found: false };
  }
  return { values: parseEnvFile(text), found: true };
}

/**
 * Apply parsed values to a target environment without overwriting anything
 * already set — an explicitly exported variable beats the file, as it should.
 */
export function applyEnv(
  values: Readonly<Record<string, string>>,
  target: Record<string, string | undefined>,
): string[] {
  const applied: string[] = [];
  for (const [key, value] of Object.entries(values)) {
    if (target[key]) continue;
    target[key] = value;
    applied.push(key);
  }
  return applied;
}
