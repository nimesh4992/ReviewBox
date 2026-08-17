/**
 * Tests for the automation executor.
 *
 * This file had ZERO coverage until the 2026-08-17 audit (finding H-7), which
 * is notable because it is where this codebase's worst documented incident
 * lived: automation rules updated reviews keyed on the review UUID against a
 * column the sync had populated with the store's external_id, so every write
 * matched zero rows while `automation_execution_logs` still recorded
 * "success". Every automation rule in the product was dead, and the run
 * history said they were working.
 *
 * Two things are guarded here:
 *
 *   1. `evaluateRule` — pure, and the place a new condition field silently
 *      fails closed if someone forgets a switch case.
 *   2. `updateReview`'s row-count guard (commit e390bc0) — the specific fix
 *      for the incident above. `count === 0` must throw; `count === null` must
 *      NOT, because PostgREST legitimately omits the count and treating that
 *      as failure would turn working automations into errors — the opposite
 *      mistake to the one the guard exists to catch.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppReview, AutomationRule } from "@/types/review";

// ── Module mocks ──────────────────────────────────────────────────────────────
// Mocked at the module boundary (the same approach reply-cache.test.ts uses for
// Redis) rather than mocking the function under test, so the real executor
// logic actually runs.

const mockUpdate = vi.fn();
const mockInsert = vi.fn().mockResolvedValue({ error: null });

vi.mock("@/lib/supabase-server", () => ({
  getServiceClient: () => ({
    from: (table: string) => {
      if (table === "reviews") {
        return { update: mockUpdate };
      }
      // automation_execution_logs, automation_rules, etc.
      return {
        insert: mockInsert,
        select: () => ({
          eq: () => ({
            eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
          }),
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      };
    },
  }),
}));

vi.mock("@/lib/groq", () => ({
  generateReply: vi.fn().mockResolvedValue("Thanks for the feedback!"),
}));
vi.mock("@/lib/ai-usage", () => ({
  recordAiUsage: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/google-play/publisher-api", () => ({
  submitReply: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/services/app-store/connect-api", () => ({
  buildJWT: vi.fn().mockResolvedValue("jwt"),
  submitReply: vi.fn().mockResolvedValue(undefined),
}));

import { evaluateRule, runAutomationRules } from "./automation-executor";

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeReview(overrides: Partial<AppReview> = {}): AppReview {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    author: "Asha",
    rating: 1,
    text: "App crashes every time I open it after the update",
    appVersion: "4.2.0",
    device: "Pixel 7",
    country: "IN",
    issueTags: ["crash"],
    sentiment: "critical",
    priority: "urgent",
    replyStatus: "needs_reply",
    escalationState: "none",
    createdAt: "2026-08-17T00:00:00.000Z",
    source: "Google Play",
    hasAiSuggestion: false,
    ...overrides,
  } as AppReview;
}

function makeRule(overrides: Partial<AutomationRule> = {}): AutomationRule {
  return {
    id: "rule_1",
    name: "Escalate crashes",
    enabled: true,
    conditions: [{ field: "rating", operator: "less_than", value: 3 }],
    action: "escalate",
    appsScope: "all",
    priority: 1,
    timesRun: 0,
    lastRunAt: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  } as AutomationRule;
}

describe("evaluateRule", () => {
  it("does not fire a disabled rule", () => {
    expect(evaluateRule(makeRule({ enabled: false }), makeReview())).toBe(false);
  });

  it("does not fire a rule with no conditions", () => {
    // A rule matching everything by accident would auto-reply to every review
    // in the workspace, so an empty condition list must never match.
    expect(evaluateRule(makeRule({ conditions: [] }), makeReview())).toBe(false);
  });

  it("requires EVERY condition to match, not any", () => {
    const rule = makeRule({
      conditions: [
        { field: "rating", operator: "less_than", value: 3 },
        { field: "tag", operator: "equals", value: "billing" },
      ],
    });
    // rating matches (1 < 3), tag does not (review is tagged "crash")
    expect(evaluateRule(rule, makeReview())).toBe(false);
  });

  describe("rating", () => {
    const forOp = (operator: string, value: unknown) =>
      makeRule({ conditions: [{ field: "rating", operator, value }] as AutomationRule["conditions"] });

    it("compares equals / less_than / greater_than", () => {
      expect(evaluateRule(forOp("equals", 1), makeReview({ rating: 1 }))).toBe(true);
      expect(evaluateRule(forOp("equals", 1), makeReview({ rating: 2 }))).toBe(false);
      expect(evaluateRule(forOp("less_than", 3), makeReview({ rating: 2 }))).toBe(true);
      expect(evaluateRule(forOp("less_than", 3), makeReview({ rating: 3 }))).toBe(false);
      expect(evaluateRule(forOp("greater_than", 3), makeReview({ rating: 4 }))).toBe(true);
      expect(evaluateRule(forOp("greater_than", 3), makeReview({ rating: 3 }))).toBe(false);
    });

    it("handles `in` with the string values the rule builder emits", () => {
      // The UI serialises numbers as strings; comparing "1" === 1 would fail.
      expect(evaluateRule(forOp("in", ["1", "2"]), makeReview({ rating: 2 }))).toBe(true);
      expect(evaluateRule(forOp("in", ["1", "2"]), makeReview({ rating: 4 }))).toBe(false);
    });
  });

  describe("platform", () => {
    // The exact wrong-layer bug class this repo has shipped twice: the DB and
    // the rule builder speak `google_play`, while AppReview.source is the
    // DISPLAY string "Google Play". Comparing them directly always yields
    // false, which is how the sentiment platform split shipped as two
    // permanently-zero counters (audit finding L6).
    const rule = (value: string) =>
      makeRule({ conditions: [{ field: "platform", operator: "equals", value }] as AutomationRule["conditions"] });

    it("matches the DB enum against the display string", () => {
      expect(evaluateRule(rule("google_play"), makeReview({ source: "Google Play" }))).toBe(true);
      expect(evaluateRule(rule("app_store"), makeReview({ source: "App Store" }))).toBe(true);
    });

    it("does not cross-match the two stores", () => {
      expect(evaluateRule(rule("google_play"), makeReview({ source: "App Store" }))).toBe(false);
      expect(evaluateRule(rule("app_store"), makeReview({ source: "Google Play" }))).toBe(false);
    });
  });

  describe("country", () => {
    // India-first ICP: the storefront is `in`, and case has bitten this
    // codebase before. "IN" from the store must match "in" from the UI.
    const rule = (value: string) =>
      makeRule({ conditions: [{ field: "country", operator: "equals", value }] as AutomationRule["conditions"] });

    it("matches case-insensitively in both directions", () => {
      expect(evaluateRule(rule("in"), makeReview({ country: "IN" }))).toBe(true);
      expect(evaluateRule(rule("IN"), makeReview({ country: "in" }))).toBe(true);
    });

    it("does not match a different storefront", () => {
      expect(evaluateRule(rule("us"), makeReview({ country: "IN" }))).toBe(false);
    });

    it("treats a missing country as no match rather than matching everything", () => {
      expect(evaluateRule(rule("in"), makeReview({ country: null as unknown as string }))).toBe(false);
    });
  });

  describe("tag / keyword / sentiment / version", () => {
    it("matches a tag the review carries", () => {
      const rule = makeRule({ conditions: [{ field: "tag", operator: "equals", value: "crash" }] as AutomationRule["conditions"] });
      expect(evaluateRule(rule, makeReview({ issueTags: ["crash", "performance"] }))).toBe(true);
      expect(evaluateRule(rule, makeReview({ issueTags: ["billing"] }))).toBe(false);
    });

    it("matches a keyword case-insensitively inside the review body", () => {
      const rule = makeRule({ conditions: [{ field: "keyword", operator: "contains", value: "CRASHES" }] as AutomationRule["conditions"] });
      expect(evaluateRule(rule, makeReview())).toBe(true);
      expect(evaluateRule(rule, makeReview({ text: "works great" }))).toBe(false);
    });

    it("survives a review with no body", () => {
      const rule = makeRule({ conditions: [{ field: "keyword", operator: "contains", value: "crash" }] as AutomationRule["conditions"] });
      // Rating-only reviews with no text are common on both stores.
      expect(() => evaluateRule(rule, makeReview({ text: null as unknown as string }))).not.toThrow();
      expect(evaluateRule(rule, makeReview({ text: null as unknown as string }))).toBe(false);
    });

    it("matches sentiment by equals and in", () => {
      const eq = makeRule({ conditions: [{ field: "sentiment", operator: "equals", value: "critical" }] as AutomationRule["conditions"] });
      const inOp = makeRule({ conditions: [{ field: "sentiment", operator: "in", value: ["critical", "negative"] }] as AutomationRule["conditions"] });
      expect(evaluateRule(eq, makeReview({ sentiment: "critical" }))).toBe(true);
      expect(evaluateRule(eq, makeReview({ sentiment: "positive" }))).toBe(false);
      expect(evaluateRule(inOp, makeReview({ sentiment: "negative" }))).toBe(true);
      expect(evaluateRule(inOp, makeReview({ sentiment: "positive" }))).toBe(false);
    });

    it("matches version exactly and by substring", () => {
      const eq = makeRule({ conditions: [{ field: "version", operator: "equals", value: "4.2.0" }] as AutomationRule["conditions"] });
      const contains = makeRule({ conditions: [{ field: "version", operator: "contains", value: "4.2" }] as AutomationRule["conditions"] });
      expect(evaluateRule(eq, makeReview({ appVersion: "4.2.0" }))).toBe(true);
      expect(evaluateRule(eq, makeReview({ appVersion: "4.2.1" }))).toBe(false);
      expect(evaluateRule(contains, makeReview({ appVersion: "4.2.1" }))).toBe(true);
    });
  });

  it("fails closed on an unknown condition field", () => {
    // A field the executor doesn't handle must not match everything. It
    // currently returns false silently — see audit finding M-12, which
    // recommends a compile-time exhaustiveness guard so a forgotten case is a
    // build failure rather than a rule that never fires.
    const rule = makeRule({
      conditions: [{ field: "device", operator: "equals", value: "Pixel 7" }] as unknown as AutomationRule["conditions"],
    });
    expect(evaluateRule(rule, makeReview())).toBe(false);
  });
});

// ── The row-count guard (regression test for commit e390bc0) ──────────────────

describe("updateReview row-count guard", () => {
  /**
   * One enabled rule whose action writes to `reviews` unconditionally.
   * `escalate` is used rather than `apply_tag` so the test depends only on the
   * update result, not on the review's existing tag state.
   */
  function rulesResponse() {
    return [
      {
        id: "rule_1",
        name: "Escalate crashes",
        enabled: true,
        conditions: [{ field: "rating", operator: "less_than", value: 3 }],
        action: "escalate",
        action_label: null,
        action_config: null,
        apps_scope: "all",
        priority: 1,
        times_run: 0,
        last_run_at: null,
        created_at: "2026-08-01T00:00:00.000Z",
      },
    ];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  /**
   * Run the executor with a stubbed rules query, and a reviews `.update()`
   * that resolves to the given {error, count}.
   */
  async function runWith(updateResult: { error: unknown; count: number | null }) {
    const supabaseServer = await import("@/lib/supabase-server");
    vi.spyOn(supabaseServer, "getServiceClient").mockReturnValue({
      from: (table: string) => {
        if (table === "reviews") {
          return { update: () => ({ eq: () => Promise.resolve(updateResult) }) };
        }
        if (table === "automation_rules") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({ order: () => Promise.resolve({ data: rulesResponse(), error: null }) }),
              }),
            }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          };
        }
        return { insert: mockInsert };
      },
    } as unknown as ReturnType<typeof supabaseServer.getServiceClient>);

    await runAutomationRules("ws_1", [makeReview()], "app_1");

    return mockInsert.mock.calls.map((c) => c[0] as { status: string; error_message: string | null });
  }

  it("logs an ERROR when the update matched zero rows", async () => {
    // The incident: the write matched nothing (wrong id column) and the run
    // log still said "success", so every rule looked healthy while doing
    // nothing at all.
    const logs = await runWith({ error: null, count: 0 });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBe("error");
    expect(logs[0].error_message).toMatch(/not found|nothing updated/i);
  });

  it("logs SUCCESS when PostgREST reports no count at all", async () => {
    // `count === null` means PostgREST didn't return one — NOT evidence the
    // write missed. Treating it as failure would turn every working
    // automation into an error, which is the opposite mistake.
    const logs = await runWith({ error: null, count: null });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBe("success");
  });

  it("logs SUCCESS on a normal single-row update", async () => {
    const logs = await runWith({ error: null, count: 1 });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBe("success");
  });

  it("logs an ERROR when the database itself rejects the write", async () => {
    const logs = await runWith({ error: { message: "permission denied" }, count: null });
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].status).toBe("error");
    expect(logs[0].error_message).toMatch(/permission denied/i);
  });
});
