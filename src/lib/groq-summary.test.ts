/**
 * The AI review summary told a workspace with 202 reviews that it didn't have
 * enough data.
 *
 * `generateSummary` had three exits and one sentence between them: no reviews,
 * an empty completion, and a thrown request all returned "Not enough recent
 * review data to generate a summary." The panel printed "Based on 50 recent
 * reviews" immediately above it — the screen contradicted itself, and the
 * `catch` logged nothing, so there was no way to tell which had happened.
 *
 * Groq's free tier is 6K/day and rate-limits in bursts, so the failing path is
 * the expected one on a busy afternoon, not an edge case.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("groq-sdk", () => ({
  default: class {
    chat = { completions: { create } };
  },
}));

import { generateSummary, SUMMARY_NO_DATA, SUMMARY_FAILED } from "./groq";

beforeEach(() => {
  create.mockReset();
  process.env.GROQ_API_KEY = "test-key";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("generateSummary", () => {
  it("returns the summary when the model answers", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "  Users report billing failures.  " } }] });
    await expect(generateSummary(["a review"])).resolves.toBe("Users report billing failures.");
  });

  it("says NO DATA only when there is genuinely nothing to summarise", async () => {
    await expect(generateSummary([])).resolves.toBe(SUMMARY_NO_DATA);
    expect(create).not.toHaveBeenCalled();
  });

  it("says FAILED — not 'no data' — when the request throws", async () => {
    create.mockRejectedValue(new Error("429 rate limit exceeded"));
    const result = await generateSummary(["a review", "another"]);
    expect(result).toBe(SUMMARY_FAILED);
    expect(result).not.toBe(SUMMARY_NO_DATA);
  });

  it("says FAILED when the completion comes back empty", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "   " } }] });
    await expect(generateSummary(["a review"])).resolves.toBe(SUMMARY_FAILED);
  });

  it("says FAILED when the response has no choices at all", async () => {
    create.mockResolvedValue({ choices: [] });
    await expect(generateSummary(["a review"])).resolves.toBe(SUMMARY_FAILED);
  });

  it("logs the failure instead of swallowing it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    spy.mockClear();
    create.mockRejectedValue(new Error("429 rate limit exceeded"));
    await generateSummary(["a review"]);
    // The old `catch {}` left nothing to look at — the founder saw a wrong
    // message and the logs held no trace of why.
    expect(spy).toHaveBeenCalled();
    expect(JSON.stringify(spy.mock.calls)).toContain("429");
  });

  it("keeps the two messages distinguishable", async () => {
    // If these ever converge, the bug is back and every test above still passes.
    expect(SUMMARY_NO_DATA).not.toBe(SUMMARY_FAILED);
  });
});
