"use client";

import { useQuery } from "@tanstack/react-query";

export interface AiSummaryData {
  summary: string;
  reviewCount: number;
  generatedAt: string;
  cached: boolean;
}

async function fetchAiSummary(): Promise<AiSummaryData> {
  const res = await fetch("/api/dashboard/ai-summary");
  if (!res.ok) throw new Error("Failed to load AI summary");
  return res.json() as Promise<AiSummaryData>;
}

export function useAiSummary() {
  return useQuery<AiSummaryData, Error>({
    queryKey: ["ai-summary"],
    queryFn: fetchAiSummary,
    staleTime: 60 * 60 * 1000, // 1 hour — matches server cache TTL
    retry: 1,
  });
}
