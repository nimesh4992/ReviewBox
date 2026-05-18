/**
 * POST /api/sentiment/analyze
 *
 * Batch sentiment analysis for a set of reviews.
 * Uses a 2-tier approach:
 *   Tier 1 (rules engine) — resolves ~80% of reviews with zero API calls
 *   Tier 2 (Gemini batch) — only for ambiguous 3★ reviews with no detected tags
 *
 * Request:  { reviews: AppReview[] }   (max 100)
 * Response: { results: AnalysisResult[] }
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { enrichReview } from "@/lib/rules-engine";
import { analyzeSentimentBatch } from "@/lib/gemini";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError, captureAndError } from "@/lib/api-response";
import type { AppReview } from "@/types/review";

export interface AnalysisResult {
  id: string;
  sentiment: AppReview["sentiment"];
  tags: AppReview["issueTags"];
  priority: AppReview["priority"];
  escalationState: AppReview["escalationState"];
  /** Which tier resolved this review */
  source: "rules" | "gemini";
}

/** Chunk an array into groups of `size`. */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.userId) {
      return apiError("UNAUTHORIZED", 401);
    }

    // Gemini quota guard: 20 batch requests / 10 min / user.
    const rl = await rateLimit(req, session.userId, { bucket: "sentiment", limit: 20, window: "10 m" });
    if (!rl.allowed) {
      return apiError("RATE_LIMITED", 429);
    }

    const body = (await req.json()) as { reviews?: AppReview[] };
    const reviews = body.reviews;

    if (!Array.isArray(reviews) || reviews.length === 0) {
      return apiError("INVALID_INPUT", 400, "reviews must be a non-empty array");
    }

    if (reviews.length > 100) {
      return apiError("INVALID_INPUT", 400, "Maximum 100 reviews per request");
    }

    // ── TIER 1: Rules engine on ALL reviews (0 API calls) ───────────────────
    const results: AnalysisResult[] = reviews.map((review) => {
      const enriched = enrichReview(review);
      return {
        id:             review.id,
        sentiment:      enriched.sentiment,
        tags:           enriched.issueTags,
        priority:       enriched.priority,
        escalationState: enriched.escalationState,
        source:         "rules" as const,
      };
    });

    // ── TIER 2: Gemini batch for ambiguous reviews ───────────────────────────
    // Ambiguous = 3★ reviews with no detected issue tags and non-trivial text
    const hasGemini = Boolean(process.env.GEMINI_API_KEY);

    if (hasGemini) {
      const ambiguousReviews = reviews.filter((r, i) => {
        const res = results[i];
        return (
          r.rating === 3 &&
          (r.text ?? "").length > 30 &&
          res.tags.length === 0
        );
      });

      if (ambiguousReviews.length > 0) {
        // Process in ≤50-review batches (Gemini free rate limit)
        const batches = chunk(ambiguousReviews, 50);

        for (const batch of batches) {
          try {
            const geminiResults = await analyzeSentimentBatch(batch);

            // Merge Gemini results back into the main results array
            for (const gr of geminiResults) {
              const idx = results.findIndex((r) => r.id === gr.id);
              if (idx !== -1) {
                results[idx].sentiment = gr.sentiment;
                results[idx].source    = "gemini";
              }
            }
          } catch (err) {
            // Non-fatal: keep rule-based results for this batch
            console.warn(
              "Gemini sentiment batch failed — keeping rules result:",
              err instanceof Error ? err.message : String(err),
            );
          }
        }
      }
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (err) {
    return captureAndError(err, "POST /api/sentiment/analyze");
  }
}
