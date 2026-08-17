"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiErrorMessage } from "@/lib/api-error-message";
import type { AsoKeyword } from "@/types/review";

export interface AsoKeywordsData {
  keywords: AsoKeyword[];
  metrics: {
    total: number;
    avgRank: number | null;
    top10Count: number;
  };
}

async function fetchKeywords(appId?: string): Promise<AsoKeywordsData> {
  const url = appId
    ? `/api/aso/keywords?appId=${encodeURIComponent(appId)}`
    : "/api/aso/keywords";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch ASO keywords");
  return res.json();
}

export function useAsoKeywords(appId?: string) {
  return useQuery<AsoKeywordsData>({
    queryKey: ["aso-keywords", appId ?? "all"],
    queryFn: () => fetchKeywords(appId),
    staleTime: 2 * 60 * 1000,
  });
}

export function useAddKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      keyword: string;
      appId?: string;
      volumeEstimate?: number;
    }) => {
      const res = await fetch("/api/aso/keywords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "Failed to add keyword"));
      }
      return res.json() as Promise<AsoKeyword>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aso-keywords"] }),
  });
}

export function useUpdateKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      current_rank?: number | null;
      volume_estimate?: number | null;
    }) => {
      const { id, ...body } = payload;
      const res = await fetch(`/api/aso/keywords/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update keyword");
      return res.json() as Promise<AsoKeyword>;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aso-keywords"] }),
  });
}

export function useDeleteKeyword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/aso/keywords/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete keyword");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["aso-keywords"] }),
  });
}
