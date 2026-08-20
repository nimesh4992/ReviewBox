#!/usr/bin/env node --experimental-strip-types
/**
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

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { createClient } from "@supabase/supabase-js";

import { classifyLanguageBucket } from "../../src/lib/eval/language-bucket.ts";
import { toCsv } from "../../src/lib/eval/csv.ts";
import {
  DEFAULT_TARGET_MIX,
  selectStratifiedSample,
} from "../../src/lib/eval/sampling.ts";
import { applyEnv, readEnvFile } from "../../src/lib/eval/env-file.ts";

const HEADER = [
  // --- filled by this script ---
  "review_id", "app", "source", "rating", "app_version", "country",
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

  const { data: apps, error: appsError } = await supabase
    .from("apps")
    .select("id,name")
    .is("deleted_at", null);
  if (appsError) throw new Error(`Could not read apps: ${appsError.message}`);
  if (!apps?.length) throw new Error("No live apps found — connect an app and sync first.");

  const appNames = new Map(apps.map((a) => [a.id, a.name]));

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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
