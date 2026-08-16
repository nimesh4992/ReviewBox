"use client";

import { useQuery } from "@tanstack/react-query";

export interface AiSummaryData {
  summary: string;
  reviewCount: number;
  generatedAt: string;
  cached: boolean;
}

async function fetchAiSummary(appId?: string): Promise<AiSummaryData> {
  const qs = appId ? `?appId=${encodeURIComponent(appId)}` : "";
  const res = await fetch(`/api/dashboard/ai-summary${qs}`);
  if (!res.ok) throw new Error("Failed to load AI summary");
  return res.json() as Promise<AiSummaryData>;
}

/**
 * @param appId Scope the summary to one app (sidebar selector, via
 *              `resolveSelectedApp`). Undefined = all apps in the workspace.
 */
export function useAiSummary(appId?: string) {
  return useQuery<AiSummaryData, Error>({
    queryKey: ["ai-summary", appId ?? "all"],
    queryFn: () => fetchAiSummary(appId),
    staleTime: 60 * 60 * 1000, // 1 hour — matches server cache TTL
    retry: 1,
  });
}
