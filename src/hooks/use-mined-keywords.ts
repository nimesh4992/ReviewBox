"use client";

import { useQuery } from "@tanstack/react-query";
import type { MineKeywordsResult } from "@/app/api/aso/mine/route";

export function useMinedKeywords(appId?: string) {
  const params = new URLSearchParams({ limit: "40" });
  if (appId) params.set("appId", appId);

  return useQuery<MineKeywordsResult>({
    queryKey: ["aso-mine", appId ?? "all"],
    queryFn: async () => {
      const res = await fetch(`/api/aso/mine?${params}`);
      if (!res.ok) throw new Error("Failed to fetch mined keywords");
      return res.json() as Promise<MineKeywordsResult>;
    },
    staleTime: 5 * 60 * 1000, // 5 min — mining is expensive, don't hammer
  });
}
