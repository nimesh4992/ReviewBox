#!/usr/bin/env node --experimental-strip-types
/**
 * Bake-off scorer — turns a labelled golden set plus one engine's output into
 * the numbers ADR 011 §10 is waiting for.
 *
 *   npm run eval:score -- --labels eval/golden-set.csv --predictions eval/run-groq.csv --name "Groq / LLM"
 *   npm run eval:score -- --labels eval/golden-set.csv --check      # validate labels only
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
import { formatScoreReport, scoreClustering } from "../../src/lib/eval/cluster-metrics.ts";

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

  const predictionsPath = arg("predictions", null);
  if (!predictionsPath) {
    console.error("\nNothing to score. Pass --predictions <csv>, or --check to validate only.");
    process.exit(1);
  }

  const predicted = parseCsvRecords(readFileSync(predictionsPath, "utf8")).map((row) => ({
    id: (row.review_id ?? "").trim(),
    issueId: (row.issue_id ?? "").trim() || null,
  }));

  const report = scoreClustering(gold, predicted);
  console.log(formatScoreReport(report, arg("name", predictionsPath)));
  console.log("Record these in docs/adr/011-issue-identity-and-clustering.md §10.\n");
}

main();
