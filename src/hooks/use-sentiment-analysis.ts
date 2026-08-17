"use client";

/**
 * use-sentiment-analysis.ts
 *
 * React Query mutation hook for batch sentiment analysis.
 * Calls POST /api/sentiment/analyze and returns enriched results.
 */

import { useMutation } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api-error-message";
import type { AppReview } from "@/types/review";
import type { AnalysisResult } from "@/app/api/sentiment/analyze/route";

async function analyzeSentiment(reviews: AppReview[]): Promise<AnalysisResult[]> {
  const res = await fetch("/api/sentiment/analyze", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ reviews }),
  });
  if (!res.ok) {
    // The route returns the canonical { error: { code, message } } envelope.
    // Reading it as a flat string made `data.error` an OBJECT, so the `??`
    // fallback never fired and the thrown message was "[object Object]" —
    // hiding real, actionable reasons like a Gemini quota rejection.
    const body = await res.json().catch(() => null);
    throw new Error(apiErrorMessage(body, "Sentiment analysis failed"));
  }
  const data = (await res.json()) as { results: AnalysisResult[] };
  return data.results;
}

export function useSentimentAnalysis() {
  return useMutation({
    mutationFn: analyzeSentiment,
  });
}
