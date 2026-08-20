#!/usr/bin/env node --experimental-strip-types
/**
 * Bake-off scorer — turns a labelled golden set plus one engine's output into
 * the numbers ADR 011 §10 is waiting for.
 *
 *   npm run eval:score -- --labels eval/golden-set.csv --predictions eval/run-groq.csv --name "Groq / LLM"
 *   npm run eval:score -- --labels eval/golden-set.csv --check      # validate labels only
 *
 * Compare two or more engines — the ONLY supported way to pick one:
 *
 *   npm run eval:score -- --labels eval/golden-set.csv \
 *       --compare eval/run-groq.csv=Groq eval/run-embed.csv=Embeddings
 *
 * Labels CSV  : review_id, issue_id, language_bucket  (the file you labelled)
 * Predictions : review_id, issue_id                   (blank issue_id = not attached)
 *
 * The validator runs first and refuses to score a file with problems. That is
 * deliberate: two hours of labelling deserve better than a silently skewed
 * score caused by a stray blank cell.
 */

import { readFileSync } from "node:fs";

import { parseCsvRecords } from "../../src/lib/eval/csv.ts";
import { isLanguageBucket } from "../../src/lib/eval/language-bucket.ts";
import {
  compareEngines,
  formatScoreReport,
  scoreClustering,
} from "../../src/lib/eval/cluster-metrics.ts";

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

function has(flag) {
  return process.argv.includes(`--${flag}`);
}

/** Every way a hand-edited CSV can be wrong, named in plain English. */
function validateLabels(records) {
  const problems = [];
  const seen = new Set();
  let labelled = 0;

  records.forEach((row, i) => {
    const line = i + 2; // header is line 1
    const id = (row.review_id ?? "").trim();
    const issueId = (row.issue_id ?? "").trim();
    const bucket = (row.language_bucket ?? "").trim();

    if (!id) {
      problems.push(`line ${line}: no review_id`);
      return;
    }
    if (seen.has(id)) problems.push(`line ${line}: review_id ${id} appears twice`);
    seen.add(id);

    if (!issueId) return; // unlabelled rows are allowed; they are simply skipped
    labelled++;

    if (!bucket) problems.push(`line ${line}: issue_id set but language_bucket empty`);
    else if (!isLanguageBucket(bucket)) {
      problems.push(`line ${line}: language_bucket "${bucket}" is not english / native-script / hinglish`);
    }
  });

  return { problems, labelled, total: records.length };
}

function main() {
  const labelsPath = arg("labels", "eval/golden-set.csv");
  const records = parseCsvRecords(readFileSync(labelsPath, "utf8"));

  const { problems, labelled, total } = validateLabels(records);
  console.log(`\n${labelsPath}: ${total} rows, ${labelled} labelled.`);

  if (problems.length) {
    console.error(`\n${problems.length} problem(s) — fix these before scoring:`);
    for (const problem of problems.slice(0, 40)) console.error(`  ${problem}`);
    if (problems.length > 40) console.error(`  … and ${problems.length - 40} more`);
    process.exit(1);
  }
  console.log("No problems found.");

  const gold = records
    .filter((row) => (row.issue_id ?? "").trim())
    .map((row) => ({
      id: row.review_id.trim(),
      issueId: row.issue_id.trim(),
      bucket: row.language_bucket.trim(),
    }));

  const byBucket = gold.reduce((acc, g) => ({ ...acc, [g.bucket]: (acc[g.bucket] ?? 0) + 1 }), {});
  console.log(
    "Labelled by language: " + Object.entries(byBucket).map(([k, v]) => `${k} ${v}`).join(" · "),
  );
  console.log(`Distinct issues: ${new Set(gold.map((g) => g.issueId)).size}`);

  if (has("check")) {
    console.log("\n--check given: labels validated, nothing scored.");
    return;
  }

  if (has("compare")) {
    runComparison(gold);
    return;
  }

  const predictionsPath = arg("predictions", null);
  if (!predictionsPath) {
    console.error(
      "\nNothing to score. Pass --predictions <csv>, --compare a.csv=A b.csv=B, or --check.",
    );
    process.exit(1);
  }

  const predicted = parseCsvRecords(readFileSync(predictionsPath, "utf8")).map((row) => ({
    id: (row.review_id ?? "").trim(),
    issueId: (row.issue_id ?? "").trim() || null,
  }));

  const report = scoreClustering(gold, predicted);
  console.log(formatScoreReport(report, arg("name", predictionsPath)));
  console.log(
    "\nRecord these in docs/adr/011-issue-identity-and-clustering.md §10 — and record\n" +
      "the eligibility footer with them. A slice printed N/A or low-n is untested, not passed.\n",
  );
}

/**
 * Read `--compare a.csv=Name a.csv=Name …` and rank the engines.
 *
 * Ranking lives here rather than in the single-engine path on purpose: a
 * recommendation is a comparison, and `compareEngines()` is the only code path
 * that refuses to reach for the unsliced weighted-error number to make one.
 */
function runComparison(gold) {
  const start = process.argv.indexOf("--compare");
  const specs = [];
  for (let i = start + 1; i < process.argv.length; i++) {
    const value = process.argv[i];
    if (value.startsWith("--")) break;
    specs.push(value);
  }
  if (specs.length < 2) {
    console.error("\n--compare needs at least two files: path.csv=Name path.csv=Name");
    process.exit(1);
  }

  const entries = specs.map((spec) => {
    const [path, ...rest] = spec.split("=");
    const name = rest.join("=") || path;
    const predicted = parseCsvRecords(readFileSync(path, "utf8")).map((row) => ({
      id: (row.review_id ?? "").trim(),
      issueId: (row.issue_id ?? "").trim() || null,
    }));
    const report = scoreClustering(gold, predicted);
    console.log(formatScoreReport(report, name));
    return { name, report };
  });

  const verdict = compareEngines(entries);
  console.log("\n═══ Comparison ═══\n");
  for (const slice of verdict.perSlice) {
    console.log(`  ${slice.slice}`);
    for (const r of slice.ranking) {
      console.log(`    ${r.name.padEnd(24)} weighted errors ${String(r.weightedErrors).padStart(6)}`);
    }
  }
  if (!verdict.perSlice.length) console.log("  No slice had enough evidence in every engine.");
  for (const blocked of verdict.blockedBy) {
    console.log(`  cannot decide on ${blocked.slice} — ${blocked.status}: ${blocked.reason}`);
  }
  if (verdict.untestedBuckets.length) {
    console.log(`\n  ⚠ UNTESTED buckets: ${verdict.untestedBuckets.join(", ")} — untested is NOT passed.`);
  }
  if (verdict.bucketsMissing.length) {
    console.log(
      `\n  Buckets with an eligible slice: ${verdict.bucketsCovered.join(", ") || "none"}`,
    );
    console.log(`  Buckets with NONE:              ${verdict.bucketsMissing.join(", ")}`);
  }
  console.log(`\n  Leads eligible slices: ${verdict.leader ?? "no single engine"}`);
  console.log(`  Winner: ${verdict.winner ?? "NONE — no recommendation from this run"}`);
  console.log(`  ${verdict.reason}`);
  console.log(
    "\n  The unsliced weightedErrors figure printed above for each engine was NOT\n" +
      "  consulted here. It cannot be: it is dominated by whichever language the\n" +
      "  corpus happens to be made of. See ADR 011 §9 and D025.\n",
  );
}

main();
