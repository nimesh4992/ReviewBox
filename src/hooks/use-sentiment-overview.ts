"use client";

import { useQuery } from "@tanstack/react-query";
import type { SentimentOverview } from "@/app/api/sentiment/overview/route";

export function useSentimentOverview(
  appId?: string | null,
  range: "7d" | "30d" | "90d" = "30d",
) {
  return useQuery<SentimentOverview>({
    queryKey: ["sentiment-overview", appId ?? "all", range],
    queryFn: async () => {
      const params = new URLSearchParams({ range });
      if (appId) params.set("appId", appId);
      const res = await fetch(`/api/sentiment/overview?${params}`);
      if (!res.ok) throw new Error("Failed to fetch sentiment overview");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}
