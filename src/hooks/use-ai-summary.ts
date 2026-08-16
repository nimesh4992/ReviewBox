"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface AiSummaryData {
  summary: string;
  reviewCount: number;
  generatedAt: string;
  cached: boolean;
}

async function fetchAiSummary(appId?: string, refresh = false): Promise<AiSummaryData> {
  const params = new URLSearchParams();
  if (appId) params.set("appId", appId);
  if (refresh) params.set("refresh", "1");
  const qs = params.toString();
  const res = await fetch(`/api/dashboard/ai-summary${qs ? `?${qs}` : ""}`);
  if (!res.ok) throw new Error("Failed to load AI summary");
  return res.json() as Promise<AiSummaryData>;
}

/**
 * @param appId Scope the summary to one app (sidebar selector, via
 *              `resolveSelectedApp`). Undefined = all apps in the workspace.
 */
export function useAiSummary(appId?: string) {
  const qc = useQueryClient();
  const key = ["ai-summary", appId ?? "all"];

  const query = useQuery<AiSummaryData, Error>({
    queryKey: key,
    queryFn: () => fetchAiSummary(appId),
    staleTime: 60 * 60 * 1000, // 1 hour — matches server cache TTL
    retry: 1,
  });

  /**
   * Regenerate, bypassing BOTH caches. `refetch()` alone re-requested the
   * route, which answered from its own 1-hour Redis entry — so the button
   * spun and nothing changed.
   */
  const refresh = async () => {
    const fresh = await fetchAiSummary(appId, true);
    qc.setQueryData(key, fresh);
    return fresh;
  };

  return { ...query, refresh };
}
