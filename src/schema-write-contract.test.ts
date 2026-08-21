/**
 * Every write that touches a late-added column must say what happens when the
 * column isn't there.
 *
 * ── The bug class ────────────────────────────────────────────────────────────
 *
 * PostgREST reports a missing column two different ways depending on direction
 * (see lib/db-errors.ts): `42703` on a read, `PGRST204` on a write. Every
 * pending-migration fallback in this repo was originally written against 42703
 * alone, so on the write path none of them had ever been reachable — which is
 * how onboarding 500'd for every new signup on 2026-08-16.
 *
 * All migrations are applied today, so "the column doesn't exist" is no longer
 * the live case. **PGRST204 also fires when the column DOES exist but
 * PostgREST hasn't reloaded its schema cache since the migration ran.** That
 * window reopens on every future migration, for every write, forever. So this
 * is not a one-off cleanup; it is a property each write has to keep.
 *
 * ── The two correct answers ──────────────────────────────────────────────────
 *
 * A write facing an unavailable column may:
 *
 *   1. **Drop the column and continue** — `writeWithOptionalColumns()`. Correct
 *      when the column is enrichment: a synced app is still a synced app
 *      without `store_country`.
 *   2. **Fail, and say why** — `migrationPendingError()` / an explicit
 *      `isMissingColumnError()` branch. Correct when the column IS the write.
 *
 * Choosing (1) everywhere is the trap, and it is what a literal reading of
 * backlog LT1 ("route every such write through writeWithOptionalColumns")
 * would produce. Dropping `deleted_at` from "cancel my account" leaves the
 * account live while the API reports it cancelled. Dropping
 * `slack_webhook_url` from "connect Slack" produces a green badge that never
 * delivers an alert — the exact defect M-8 was filed for. Silently succeeding
 * at nothing is worse than failing.
 *
 * This test does not decide which answer is right. It only insists that one of
 * them was chosen deliberately, so a new write site cannot inherit the generic
 * 500 by default.
 */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS = join(process.cwd(), "supabase/migrations");
const SRC = join(process.cwd(), "src");

// ── Which columns were added to an ALREADY-EXISTING table ────────────────────
// A column on a table created in the same migration isn't at risk: if that
// migration is missing, the whole table is, and that is a different guard
// (`isMissingTableError`, PGRST205/42P01).

function lateColumns(): Map<string, string> {
  const createdIn = new Map<string, string>();
  const late = new Map<string, string>(); // "table.column" -> migration

  for (const file of readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort()) {
    const num = file.split("_")[0];
    const sql = readFileSync(join(MIGRATIONS, file), "utf8");

    for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?(\w+)/gi)) {
      const t = m[1].toLowerCase();
      if (!createdIn.has(t)) createdIn.set(t, num);
    }

    for (const m of sql.matchAll(
      /alter\s+table\s+(?:public\.)?(\w+)\s+add\s+column\s+(?:if\s+not\s+exists\s+)?(\w+)/gi,
    )) {
      const table = m[1].toLowerCase();
      const column = m[2].toLowerCase();
      const created = createdIn.get(table);
      if (created && created < num) late.set(`${table}.${column}`, num);
    }
  }
  return late;
}

// ── Every write site in src/ ─────────────────────────────────────────────────

interface WriteSite {
  file: string;
  line: number;
  table: string;
  columns: string[];
  /** Drops unavailable columns and retries. */
  dropsAndContinues: boolean;
  /** Has an explicit missing-column branch. */
  failsLoudly: boolean;
}

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (/\.tsx?$/.test(entry) && !entry.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

/**
 * Blank out comments, preserving offsets and line breaks.
 *
 * Found by mutation-testing this file: deleting the `writeWithOptionalColumns`
 * call from a route left the sentence "this is the case
 * `writeWithOptionalColumns` exists for" in the comment above it, and the
 * file-level substring check stayed true. The test passed over a write it was
 * written to catch — a guard you can satisfy by *mentioning* it is not a guard.
 *
 * String CONTENTS are kept: the table a write targets is read from
 * `.from("reviews")`, so blanking them made every site undetectable — which the
 * "finds the write sites at all" case caught immediately. Strings are still
 * walked over rather than scanned, so a `//` inside a URL is not read as the
 * start of a comment.
 */
function stripComments(source: string): string {
  const out = source.split("");
  let i = 0;

  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < out.length; k++) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };

  while (i < source.length) {
    const two = source.slice(i, i + 2);

    if (two === "//") {
      const end = source.indexOf("\n", i);
      blank(i, end === -1 ? source.length : end);
      i = end === -1 ? source.length : end;
    } else if (two === "/*") {
      const end = source.indexOf("*/", i + 2);
      blank(i, end === -1 ? source.length : end + 2);
      i = end === -1 ? source.length : end + 2;
    } else if (source[i] === '"' || source[i] === "'" || source[i] === "`") {
      // Skip the literal without touching it.
      const quote = source[i];
      let j = i + 1;
      while (j < source.length && source[j] !== quote) {
        if (source[j] === "\\") j++;
        j++;
      }
      i = j + 1;
    } else {
      i++;
    }
  }
  return out.join("");
}

/** Text between the brace at `open` and its match. */
function braceBody(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}" && --depth === 0) return source.slice(open + 1, i);
  }
  return source.slice(open);
}

/**
 * The payload this write actually sends.
 *
 * Two forms, and both have to be handled precisely:
 *
 *   `.update({ a: 1 })`  — brace-match the literal.
 *   `.update(updates)`   — find where `updates` is built: `updates.x = …`,
 *                          `updates = { … }`, `updates.push({ … })`.
 *
 * An earlier version of this test just scanned the 60 lines above each call.
 * That caught the variable case, but it also reported `automation-executor.ts`
 * writing `action_label` when the payload is `{ times_run, last_run_at }` and
 * the match came from unrelated code above. A test whose failures are mostly
 * noise gets an allowlist bolted on until it stops meaning anything, so the
 * precision matters more than the extra code.
 */
function payloadText(source: string, afterCall: number): string {
  const rest = source.slice(afterCall);

  const literal = /^\s*\{/.exec(rest);
  if (literal) return braceBody(source, afterCall + literal[0].length - 1);

  const variable = /^\s*([A-Za-z_$][\w$]*)/.exec(rest);
  if (!variable) return "";

  const name = variable[1];
  const before = source.slice(0, afterCall);
  const assignments: string[] = [];

  // `name.column = …` and `name.column ??= …`
  for (const m of before.matchAll(new RegExp(`\\b${name}\\.(\\w+)\\s*=`, "g"))) {
    assignments.push(m[1]);
  }
  // `name = { … }`, `name.push({ … })`, `const name: X = { … }`
  for (const m of before.matchAll(new RegExp(`\\b${name}(?:\\.push)?\\s*(?:=|\\()\\s*\\{`, "g"))) {
    assignments.push(braceBody(before, m.index! + m[0].length - 1));
  }
  return assignments.join("\n");
}

function writeSites(late: Map<string, string>): WriteSite[] {
  const sites: WriteSite[] = [];

  for (const file of tsFiles(SRC)) {
    // Comments blanked out — a guard has to be CODE, not a mention. See the
    // note on stripComments for the mutation that proved it matters.
    const source = stripComments(readFileSync(file, "utf8"));
    const dropsAndContinues = /\bwriteWithOptionalColumns\s*\(/.test(source);
    const failsLoudly =
      /\bmigrationPendingError\s*\(/.test(source) || /\bisMissingColumnError\s*\(/.test(source);

    for (const m of source.matchAll(/\.(insert|update|upsert)\(/g)) {
      // Nearest preceding .from("table") — how the query builder reads.
      const preceding = [...source.slice(0, m.index).matchAll(/\.from\(["'](\w+)["']\)/g)];
      const table = preceding.at(-1)?.[1];
      if (!table) continue;

      const payload = payloadText(source, m.index! + m[0].length);
      const columns = [...late.keys()]
        .filter((key) => key.startsWith(`${table}.`))
        .map((key) => key.slice(table.length + 1))
        .filter((col) => new RegExp(`\\b${col}\\b`).test(payload));

      if (columns.length) {
        sites.push({
          file: file.slice(process.cwd().length + 1).replace(/\\/g, "/"),
          line: source.slice(0, m.index).split("\n").length,
          table,
          columns,
          dropsAndContinues,
          failsLoudly,
        });
      }
    }
  }
  return sites;
}

/**
 * Writes that legitimately need neither answer, each with the reason.
 *
 * Keep this list short and argued. "It's probably fine" is not a reason — the
 * whole point is that the next agent has to write down why.
 */
const NO_GUARD_NEEDED: Record<string, string> = {
  "src/app/api/auth/slack/callback/route.ts":
    "Checks its write and redirects to ?slack=error rather than reporting success. " +
    "It answers with a redirect, not JSON, so it can't use the shared helper — but it " +
    "does fail loudly, which is what matters. Do not 'fix' this into a silent continue.",
};

describe("writes touching a late-added column", () => {
  const late = lateColumns();
  const sites = writeSites(late);

  it("finds the migrations and the write sites at all", () => {
    // A regex that silently stops matching would make every assertion below
    // vacuously pass — the same shape as the e2e suite that was green because
    // zero tests ran.
    expect(late.size).toBeGreaterThan(10);
    expect(sites.length).toBeGreaterThan(5);
  });

  it("every one either drops-and-continues or fails loudly", () => {
    const unclassified = sites.filter(
      (s) => !s.dropsAndContinues && !s.failsLoudly && !(s.file in NO_GUARD_NEEDED),
    );

    const detail = unclassified
      .map((s) => `  ${s.file}:${s.line} → ${s.table} (${s.columns.join(", ")})`)
      .join("\n");

    expect(
      unclassified,
      unclassified.length === 0
        ? ""
        : `These writes touch a column added by a later migration and don't say what happens if it's unavailable.\n` +
            `PGRST204 fires here whenever PostgREST's schema cache is stale after a migration — not only when the column is genuinely missing.\n\n` +
            `${detail}\n\n` +
            `Pick one, deliberately:\n` +
            `  • the column is enrichment  → writeWithOptionalColumns() from @/lib/db-errors\n` +
            `  • the column IS the write   → migrationPendingError() from @/lib/api-response\n` +
            `Do NOT default to the first. Dropping deleted_at from "cancel my account" leaves the account live.\n`,
    ).toEqual([]);
  });

  it("keeps every exemption pointing at a real file", () => {
    // An exemption for a file that has been renamed or deleted silently widens
    // the allowlist, which is how allowlists rot into no-ops.
    for (const file of Object.keys(NO_GUARD_NEEDED)) {
      expect(() => statSync(join(process.cwd(), file)), `stale exemption: ${file}`).not.toThrow();
    }
  });

  it("does not let an exemption stand in for a guard that exists", () => {
    // If a file grows a real guard, its exemption should be removed rather
    // than left as a second, weaker justification.
    const redundant = sites.filter(
      (s) => s.file in NO_GUARD_NEEDED && (s.dropsAndContinues || s.failsLoudly),
    );
    expect(
      redundant.map((s) => s.file),
      "these files now have a real guard — drop them from NO_GUARD_NEEDED",
    ).toEqual([]);
  });
});
