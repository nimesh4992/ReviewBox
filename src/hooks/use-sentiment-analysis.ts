"use client";

/**
 * use-sentiment-analysis.ts
 *
 * React Query mutation hook for batch sentiment analysis.
 * Calls POST /api/sentiment/analyze and returns enriched results.
 */

import { useMutation } from "@tanstack/react-query";
import type { AppReview } from "@/types/review";
import type { AnalysisResult } from "@/app/api/sentiment/analyze/route";

async function analyzeSentiment(reviews: AppReview[]): Promise<AnalysisResult[]> {
  const res = await fetch("/api/sentiment/analyze", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ reviews }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? "Sentiment analysis failed");
  }
  const data = (await res.json()) as { results: AnalysisResult[] };
  return data.results;
}

export function useSentimentAnalysis() {
  return useMutation({
    mutationFn: analyzeSentiment,
  });
}
