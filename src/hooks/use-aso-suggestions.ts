"use client";

/**
 * use-aso-suggestions.ts
 *
 * React Query mutation hook for ASO keyword suggestions.
 * Calls POST /api/aso/suggest and returns keyword list + cache metadata.
 */

import { useMutation } from "@tanstack/react-query";

export interface AsoSuggestResult {
  keywords: string[];
  lastUpdated: string;
  source: "cache" | "gemini" | "unavailable";
}

async function fetchAsoSuggestions(appId: string): Promise<AsoSuggestResult> {
  const res = await fetch("/api/aso/suggest", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ appId }),
  });
  if (!res.ok) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? "ASO suggestions failed");
  }
  return (await res.json()) as AsoSuggestResult;
}

export function useAsoSuggestions() {
  return useMutation({
    mutationFn: fetchAsoSuggestions,
  });
}
