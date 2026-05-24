"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface WorkspaceApp {
  id: string;
  name: string;
  platform: "google_play" | "app_store";
  store_id: string;
  last_synced_at: string | null;
  has_credentials: boolean;
  icon_url: string | null;
  developer: string | null;
  lifetime_rating: number | null;
  lifetime_review_count: number | null;
}

async function fetchApps(): Promise<WorkspaceApp[]> {
  const res = await fetch("/api/apps");
  if (!res.ok) return [];
  const data = (await res.json()) as { apps: WorkspaceApp[] };
  return data.apps ?? [];
}

export function useApps() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["apps"],
    queryFn: fetchApps,
    staleTime: 5 * 60 * 1000,
  });

  return { apps: data ?? [], isLoading, refetch };
}

export function useInvalidateApps() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["apps"] });
}
