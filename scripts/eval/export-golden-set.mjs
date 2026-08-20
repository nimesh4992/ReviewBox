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

/** Target composition. India-first: Hinglish is the largest slice on purpose. */
const TARGET_MIX = { hinglish: 0.35, "native-script": 0.25, english: 0.4 };

const HEADER = [
  // --- filled by this script ---
  "review_id", "app", "source", "rating", "app_version", "country",
  "store_created_at", "bucket_guess", "text",
  // --- filled by the human labeller (see docs/GOLDEN_SET.md) ---
  "theme", "issue_id", "issue_title", "is_actionable", "severity", "language_bucket",
];

function loadEnvLocal() {
  try {
    const text = readFileSync(".env.local", "utf8");
    for (const line of text.split("\n")) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // No .env.local — fall back to whatever is already in the environment.
  }
}

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

/** Stable 32-bit string hash — the deterministic stand-in for shuffling. */
function hash(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Pick `count` rows, spreading across ratings so the sample is not all 1★.
 * Round-robins the rating groups, each internally ordered by hash.
 */
function pickSpread(rows, count) {
  const byRating = new Map();
  for (const row of rows) {
    const list = byRating.get(row.rating) ?? [];
    list.push(row);
    byRating.set(row.rating, list);
  }
  for (const list of byRating.values()) list.sort((a, b) => hash(a.id) - hash(b.id));

  const ratings = [...byRating.keys()].sort();
  const picked = [];
  let exhausted = false;
  while (picked.length < count && !exhausted) {
    exhausted = true;
    for (const rating of ratings) {
      const list = byRating.get(rating);
      if (list.length === 0) continue;
      picked.push(list.shift());
      exhausted = false;
      if (picked.length === count) break;
    }
  }
  return picked;
}

async function main() {
  loadEnvLocal();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
        "Run this from the project root with .env.local present.",
    );
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

  const selected = [];
  const shortfalls = [];
  for (const [bucket, share] of Object.entries(TARGET_MIX)) {
    const want = Math.round(count * share);
    const picked = pickSpread(buckets[bucket], want);
    if (picked.length < want) shortfalls.push(`${bucket}: wanted ${want}, got ${picked.length}`);
    selected.push(...picked.map((review) => ({ review, bucket })));
  }

  // Top up from whatever is left, largest bucket first, so a short quota still
  // yields `count` rows rather than a small sample nobody notices is small.
  if (selected.length < count) {
    const used = new Set(selected.map((s) => s.review.id));
    const rest = Object.entries(buckets)
      .flatMap(([bucket, rows]) => rows.map((review) => ({ review, bucket })))
      .filter((s) => !used.has(s.review.id))
      .sort((a, b) => hash(a.review.id) - hash(b.review.id));
    selected.push(...rest.slice(0, count - selected.length));
  }

  const rows = [HEADER];
  for (const { review, bucket } of selected) {
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
    for (const line of shortfalls) console.log(`   ${line}`);
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
