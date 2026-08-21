/**
 * NO SHEBANG, deliberately. This file is never executed directly - the only
 * entry point is `npm run eval:export`, which already passes
 * --experimental-strip-types on the command line, so a shebang here is dead
 * weight. It is also actively harmful: `src/eval-exporter-tenant-isolation.test.ts`
 * imports this module, and on a Windows checkout (CRLF) esbuild's shebang
 * stripping leaves the `#!` in the transformed output, so the whole test file
 * dies with `SyntaxError: Invalid or unexpected token`. Linux CI is unaffected,
 * which is why that failure reproduces only on the founder's machine.
 *
 * Golden-set exporter — the input to the ADR 011 §9 bake-off.
 *
 * Pulls a stratified sample of REAL reviews out of Supabase and writes a CSV
 * for a human to label. See docs/GOLDEN_SET.md for what to do with it.
 *
 *   npm run eval:export -- --count 200 --out eval/golden-set.csv
 *
 * Two properties that are not negotiable:
 *
 * 1. **Author names are never selected.** The evaluation needs review text
 *    only, so no personal data enters the golden set at all (ADR 011 §12.3).
 *    This is why the query names its columns instead of using select("*").
 *
 * 2. **Sampling is deterministic.** Same database, same sample — so a re-export
 *    does not quietly change what was labelled. No Math.random anywhere.
 *
 * The language split is enforced, not hoped for: an export that is 90% English
 * would certify an engine that fails for most of our customers. If the data
 * cannot fill the Hinglish quota, the script says so loudly rather than
 * silently handing back an English sample.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

import { createClient } from "@supabase/supabase-js";

import { classifyLanguageBucket } from "../../src/lib/language-detect.ts";
import { toCsv } from "../../src/lib/eval/csv.ts";
import {
  DEFAULT_TARGET_MIX,
  selectStratifiedSample,
} from "../../src/lib/eval/sampling.ts";
import { applyEnv, readEnvFile } from "../../src/lib/eval/env-file.ts";

const HEADER = [
  // --- filled by this script ---
  // workspace_id is provenance: it travels with the file, so a golden set can
  // always be traced to the tenant it came from. Without it, a CSV on disk is
  // indistinguishable from one drawn across tenants — which is exactly the
  // defect this column was added to make impossible to hide.
  "review_id", "workspace_id", "app", "source", "rating", "app_version", "country",
  "store_created_at", "bucket_guess", "text",
  // --- filled by the human labeller (see docs/GOLDEN_SET.md) ---
  "theme", "issue_id", "issue_title", "is_actionable", "severity", "language_bucket",
];

/**
 * Load .env.local into process.env, and REPORT what happened.
 *
 * The previous version swallowed every failure, so a Windows .env.local that
 * parsed to nothing (CRLF — see src/lib/eval/env-file.ts) was indistinguishable
 * from no file at all. The founder was told to add a file they already had.
 */
function loadEnvLocal() {
  const { values, found } = readEnvFile(".env.local", (p) => readFileSync(p, "utf8"));
  const applied = applyEnv(values, process.env);
  return { found, parsed: Object.keys(values).length, applied: applied.length };
}

/**
 * ── Tenant isolation ────────────────────────────────────────────────────────
 *
 * This exporter used to read `apps` with `deleted_at is null` and NO workspace
 * filter, so it aggregated every tenant in the database into one corpus. The
 * first real golden set drew 758 reviews from three workspaces at once: the
 * production one, a test account that had onboarded the same Play app, and a
 * scraper fixture app. 219 reviews were present twice under two `app_id`s
 * because two workspaces legitimately track the same public app.
 *
 * Two workspaces tracking one app is CORRECT multi-tenant behaviour and must
 * keep working — there is deliberately no global uniqueness rule on
 * (platform, store_id). The defect was entirely in this script's query.
 *
 * It runs with the service-role key, which bypasses RLS, so nothing in the
 * database would have stopped it. The guarantee therefore has to live here:
 * an explicit workspace is required, the query filters on it, and
 * `assertWorkspaceScoped` re-checks every row that comes back.
 */

/** Read `--workspace <id>`, or the EVAL_WORKSPACE_ID environment variable. */
export function parseWorkspaceId(argv = process.argv, env = process.env) {
  const index = argv.indexOf("--workspace");
  const fromArg = index === -1 ? undefined : argv[index + 1];
  const value = (fromArg ?? env.EVAL_WORKSPACE_ID ?? "").trim();
  // A flag with no value ("--workspace --count 10") must not silently pass.
  if (!value || value.startsWith("--")) return null;
  return value;
}

/**
 * Fail closed. There is no "all workspaces" mode and there must never be one:
 * a default that spans tenants is how the first corpus was contaminated.
 */
export function requireWorkspaceId(argv = process.argv, env = process.env) {
  const workspaceId = parseWorkspaceId(argv, env);
  if (!workspaceId) {
    throw new Error(
      "No workspace specified.\n\n" +
        "  A golden set must come from exactly one tenant. There is no\n" +
        "  all-workspaces mode — an export spanning tenants mixes real customer\n" +
        "  reviews with test accounts and duplicates the same review under two\n" +
        "  app rows.\n\n" +
        "  Pass one:  npm run eval:export -- --workspace <workspace_id>\n" +
        "  Or set:    EVAL_WORKSPACE_ID=<workspace_id>\n\n" +
        "  Run with --list-workspaces to see the choices.",
    );
  }
  return workspaceId;
}

/**
 * Belt and braces: verify every app row actually belongs to the requested
 * workspace, even though the query already filtered on it.
 *
 * The SQL filter is the mechanism; this is the guarantee. If a future edit
 * drops the `.eq()`, or the client is swapped, or a join reshapes the result,
 * this throws instead of silently exporting another tenant's reviews.
 */
export function assertWorkspaceScoped(apps, workspaceId) {
  const foreign = (apps ?? []).filter((a) => a.workspace_id !== workspaceId);
  if (foreign.length) {
    const ids = foreign.map((a) => `${a.id} (workspace ${a.workspace_id})`).join(", ");
    throw new Error(
      `Tenant isolation violated: ${foreign.length} app row(s) outside workspace ` +
        `${workspaceId} — ${ids}. Refusing to export.`,
    );
  }
  return apps ?? [];
}

/**
 * Read the live apps for ONE workspace.
 *
 * Both halves matter and they guard different failures: the `.eq()` is what
 * makes the database return one tenant's rows, and `assertWorkspaceScoped` is
 * what notices if it ever stops doing so. Keeping them together in one exported
 * function is what lets a test drive the real path with a stand-in client.
 */
export async function fetchWorkspaceApps(supabase, workspaceId) {
  const { data, error } = await supabase
    .from("apps")
    .select("id,name,workspace_id")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);
  if (error) throw new Error(`Could not read apps: ${error.message}`);

  const apps = assertWorkspaceScoped(data, workspaceId);
  if (!apps.length) {
    throw new Error(
      `No live apps in workspace ${workspaceId}.\n` +
        `  Check the id with --list-workspaces.`,
    );
  }
  return apps;
}

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

async function main() {
  const env = loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const missing = [
      !url && "NEXT_PUBLIC_SUPABASE_URL",
      !key && "SUPABASE_SERVICE_ROLE_KEY",
    ].filter(Boolean);

    console.error(`\nCannot connect to Supabase — missing ${missing.join(" and ")}.\n`);
    console.error(`  working directory : ${process.cwd()}`);
    console.error(
      `  .env.local        : ${env.found ? `found, ${env.parsed} key(s) parsed, ${env.applied} applied` : "NOT FOUND here"}`,
    );

    if (!env.found) {
      console.error(
        "\n  Run this from the project root (the folder containing package.json),\n" +
          "  or create .env.local there with the two values above.",
      );
    } else if (env.parsed === 0) {
      console.error(
        "\n  The file was read but no KEY=value lines were understood.\n" +
          "  Check it is a plain-text .env file, not renamed from something else.",
      );
    } else {
      console.error(
        "\n  The file parsed, but those two keys were not in it. Check the spelling\n" +
          "  of the key names — they must match exactly.",
      );
    }
    process.exit(1);
  }

  const count = Number(arg("count", "200"));
  const out = arg("out", "eval/golden-set.csv");
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Discovery mode, so the fail-closed path below is actionable rather than a
  // dead end for someone who does not know their workspace id.
  if (process.argv.includes("--list-workspaces")) {
    const { data, error: wErr } = await supabase
      .from("workspaces")
      .select("id,name,slug")
      .order("created_at");
    if (wErr) throw new Error(`Could not read workspaces: ${wErr.message}`);
    console.log("\nWorkspaces:\n");
    for (const w of data ?? []) console.log(`  ${w.id}  ${w.name}${w.slug ? ` (${w.slug})` : ""}`);
    console.log("\nExport one with:  npm run eval:export -- --workspace <id>\n");
    return;
  }

  const workspaceId = requireWorkspaceId();

  // Refuse to clobber an existing export. The first golden set is kept as an
  // audit artefact of what the un-scoped exporter produced; overwriting it
  // would destroy the evidence.
  if (existsSync(out) && !process.argv.includes("--force")) {
    throw new Error(
      `${out} already exists. Refusing to overwrite.\n\n` +
        `  Write elsewhere:  --out eval/golden-set-v2.csv\n` +
        `  Or overwrite:     --force`,
    );
  }

  const apps = await fetchWorkspaceApps(supabase, workspaceId);

  const appNames = new Map(apps.map((a) => [a.id, a.name]));
  console.log(
    `\nWorkspace ${workspaceId} — ${apps.length} live app(s): ` +
      apps.map((a) => a.name).join(", "),
  );

  // Author is deliberately absent from this column list. Do not add it.
  const { data: reviews, error } = await supabase
    .from("reviews")
    .select("id,app_id,body,rating,app_version,country,source,store_created_at")
    .in("app_id", [...appNames.keys()])
    .order("store_created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`Could not read reviews: ${error.message}`);

  const usable = (reviews ?? []).filter((r) => (r.body ?? "").trim().length >= 15);
  console.log(`Read ${reviews?.length ?? 0} reviews, ${usable.length} long enough to label.`);

  const buckets = { english: [], "native-script": [], hinglish: [] };
  for (const review of usable) buckets[classifyLanguageBucket(review.body)].push(review);

  console.log(
    "Available by language guess: " +
      Object.entries(buckets).map(([k, v]) => `${k} ${v.length}`).join(" · "),
  );

  // Quota fill, top-up and the no-duplicates guarantee all live in
  // src/lib/eval/sampling.ts, where they are unit-tested.
  const { selected, shortfalls } = selectStratifiedSample({
    byBucket: buckets,
    count,
    mix: DEFAULT_TARGET_MIX,
  });

  const rows = [HEADER];
  for (const { item: review, bucket } of selected) {
    rows.push([
      review.id,
      workspaceId,
      appNames.get(review.app_id) ?? "",
      review.source ?? "",
      String(review.rating ?? ""),
      review.app_version ?? "",
      review.country ?? "",
      review.store_created_at ?? "",
      bucket,
      review.body ?? "",
      "", "", "", "", "", bucket, // labeller's columns; language_bucket pre-filled to correct
    ]);
  }

  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, toCsv(rows), "utf8");

  console.log(`\nWrote ${rows.length - 1} reviews to ${out}`);
  console.log(`Provenance: workspace ${workspaceId} only — recorded in every row.`);
  console.log("No author names were selected — nothing in this file identifies a person.");
  if (shortfalls.length) {
    console.log("\n⚠ Language quota not met:");
    for (const { bucket, wanted, got } of shortfalls) {
      console.log(`   ${bucket}: wanted ${wanted}, got ${got}`);
    }
    console.log(
      "   A sample without enough Hinglish will certify an engine that fails for\n" +
        "   most of our customers. Consider syncing more reviews before labelling.",
    );
  }
  console.log("\nNext: docs/GOLDEN_SET.md");
}

// Only run when invoked as a CLI. Importing this module (from a test) must
// not connect to Supabase or write files.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
