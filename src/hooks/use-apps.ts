"use client";

import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

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
  /** Visible-status fields for the dashboard sync banner. Null until migration 013. */
  last_sync_attempted_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  last_sync_review_count: number | null;
  /**
   * Whether the official store API works for this app (customer granted
   * access). null = unknown (never synced, or migration 016 not applied).
   * Drives the "connect your Play Console" banner.
   */
  publisher_api_connected: boolean | null;
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
    placeholderData: keepPreviousData,
  });

  // Guard: if the cache was populated with a non-array (e.g. an `{ apps: [] }`
  // object from a stale CredentialsBanner queryFn), fall back to empty array
  // rather than propagating a non-array to callers who do `.some()` / `.map()`.
  const apps = Array.isArray(data) ? data : [];
  return { apps, isLoading, refetch };
}

export function useInvalidateApps() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["apps"] });
}
