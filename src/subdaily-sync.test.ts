/**
 * P1-1 — Sub-daily Review Synchronization.
 *
 * The objective is a FRESHNESS guarantee: a review posted to the store shows up
 * in ReviewBox within `FRESHNESS_OBJECTIVE_HOURS`. Two things decide whether we
 * meet it, and they are in different files:
 *
 *   1. how often the coordinator cron fires  → `vercel.json`
 *   2. how stale a workspace must be to qualify → `lib/sync-candidate.ts`
 *
 * They compound (worst-case interval = cron interval + threshold), so this file
 * asserts the pair against each other. `lib/sync-candidate.test.ts` proves the
 * resulting interval by simulating a week of cron ticks; here we only pin the
 * config the simulation assumes.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { needsStorefrontReprobe } from "@/lib/app-metadata";
import {
  FRESHNESS_OBJECTIVE_HOURS,
  SUB_DAILY_CADENCE_HOURS,
  SYNC_CRON_INTERVAL_HOURS,
} from "@/lib/sync-candidate";
import { planSyncWrites, isGpPermissionError, type FetchedReviewRow } from "@/lib/sync-writes";

const ROOT = process.cwd();

interface VercelConfig {
  crons: Array<{ path: string; schedule: string }>;
}

function syncCronSchedule(): string {
  const config = JSON.parse(readFileSync(join(ROOT, "vercel.json"), "utf8")) as VercelConfig;
  const cron = config.crons.find((c) => c.path === "/api/sync/reviews");
  if (!cron) throw new Error("no /api/sync/reviews cron in vercel.json");
  return cron.schedule;
}

/**
 * Hours between two firings of a 5-field cron expression.
 *
 * Only the shapes this project uses are supported: a fixed hour ("0 8 * * *" —
 * once a day) and a step hour field ("every N hours"). Anything else throws
 * rather than guessing, because a wrong interval here would silently validate a
 * schedule that misses the freshness objective.
 */
function cronIntervalHours(schedule: string): number {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) throw new Error(`unsupported cron expression: ${schedule}`);

  const [minute, hour] = fields;
  if (minute.includes("*") || minute.includes(",") || minute.includes("/")) {
    throw new Error(`sub-hourly cron not supported by this parser: ${schedule}`);
  }

  if (/^\d+$/.test(hour)) return 24; // one fixed hour per day
  if (hour === "*") return 1;

  const step = /^\*\/(\d+)$/.exec(hour);
  if (step) return Number(step[1]);

  throw new Error(`unsupported cron hour field "${hour}" in: ${schedule}`);
}

describe("P1-1 cadence configuration", () => {
  it("declares a sub-daily sync cron in vercel.json", () => {
    // NOTE: a sub-daily cron REQUIRES Vercel Pro. Hobby rejects any expression
    // that fires more than once per day at deploy time, so this assertion also
    // encodes a billing prerequisite — see the review notes for P1-1.
    expect(cronIntervalHours(syncCronSchedule())).toBeLessThan(24);
  });

  it("keeps the cron schedule and SYNC_CRON_INTERVAL_HOURS in lockstep", () => {
    // The threshold is derived from this constant. If someone edits the cron in
    // vercel.json without editing the constant, the derived threshold no longer
    // matches reality and the freshness guarantee quietly weakens.
    expect(cronIntervalHours(syncCronSchedule())).toBe(SYNC_CRON_INTERVAL_HOURS);
  });

  it("pairs cron interval and staleness threshold within the freshness objective", () => {
    // Worst-case interval between two syncs of one workspace = C + h, reached
    // when an off-cycle sync lands just inside the threshold before a tick.
    expect(SYNC_CRON_INTERVAL_HOURS + SUB_DAILY_CADENCE_HOURS).toBeLessThanOrEqual(
      FRESHNESS_OBJECTIVE_HOURS,
    );
  });

  it("still promises freshness better than the daily cron it replaced", () => {
    expect(FRESHNESS_OBJECTIVE_HOURS).toBeLessThan(24);
    expect(SYNC_CRON_INTERVAL_HOURS).toBeLessThan(24);
  });
});

describe("P1-1 idempotency across repeated sub-daily runs", () => {
  const row = (overrides: Partial<FetchedReviewRow> = {}): FetchedReviewRow => ({
    external_id: "rev-ext-100",
    reply_status: "needs_reply",
    reply_text: null,
    ...overrides,
  });

  it("inserts an unseen review exactly once", () => {
    const plan = planSyncWrites([row()], new Map());
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0].external_id).toBe("rev-ext-100");
  });

  it("does not re-insert it on the next run of the same hour's data", () => {
    // Run 1 inserted it; run 2 (three hours later) fetches the same page.
    const known = new Map([["rev-ext-100", { id: "db-100", reply_status: "needs_reply" }]]);
    const plan = planSyncWrites([row()], known);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.promotions).toHaveLength(0);
  });

  it("never downgrades a saved draft, however many times the sync runs", () => {
    const known = new Map([["rev-ext-200", { id: "db-200", reply_status: "draft_ready" }]]);
    for (let run = 0; run < 8; run++) {
      const plan = planSyncWrites([row({ external_id: "rev-ext-200" })], known);
      expect(plan.inserts).toHaveLength(0);
      expect(plan.promotions).toHaveLength(0);
    }
  });

  it("never downgrades a replied review back to needs_reply", () => {
    // The iTunes RSS feed never reports developer replies, so every App Store
    // row arrives as needs_reply. At 8 runs a day this is the write that would
    // erase a customer's reply state eight times instead of once.
    const known = new Map([["rev-ext-300", { id: "db-300", reply_status: "replied" }]]);
    const plan = planSyncWrites([row({ external_id: "rev-ext-300" })], known);
    expect(plan.inserts).toHaveLength(0);
    expect(plan.promotions).toHaveLength(0);
  });

  it("promotes needs_reply → replied once, then stops", () => {
    const fetched = [row({ external_id: "rev-ext-400", reply_status: "replied", reply_text: "Thanks!" })];

    const first = planSyncWrites(fetched, new Map([["rev-ext-400", { id: "db-400", reply_status: "needs_reply" }]]));
    expect(first.promotions).toEqual([{ id: "db-400", replyText: "Thanks!" }]);

    // Next run sees it already replied — no second write.
    const second = planSyncWrites(fetched, new Map([["rev-ext-400", { id: "db-400", reply_status: "replied" }]]));
    expect(second.promotions).toHaveLength(0);
  });

  it("does not promote on reply status alone when the reply body is missing", () => {
    const fetched = [row({ external_id: "rev-ext-500", reply_status: "replied", reply_text: "   " })];
    const plan = planSyncWrites(fetched, new Map([["rev-ext-500", { id: "db-500", reply_status: "needs_reply" }]]));
    expect(plan.promotions).toHaveLength(0);
  });
});

describe("P1-1 provider failure handling", () => {
  it("classifies permission failures as connection state, transient ones as not", () => {
    expect(isGpPermissionError("403 Forbidden: Caller does not have permission")).toBe(true);
    expect(isGpPermissionError("Credentials are missing for publisher API")).toBe(true);
    // A 5xx or a timeout must not flip a connected app back to "not connected" —
    // at 8 runs a day a flaky hour would otherwise nag the customer repeatedly.
    expect(isGpPermissionError("500 Internal Server Error")).toBe(false);
    expect(isGpPermissionError("ETIMEDOUT")).toBe(false);
  });

  it("re-probes a storefront that returns no listing, and trusts one that does", () => {
    expect(needsStorefrontReprobe("us", null)).toBe(true);
    expect(
      needsStorefrontReprobe("in", {
        storeId: "com.mmrda",
        name: "Mumbai One",
        developer: "MMRDA",
        icon: "https://example.com/icon.png",
        rating: 4.2,
        reviewCount: 500,
        country: "in",
      }),
    ).toBe(false);
  });
});
