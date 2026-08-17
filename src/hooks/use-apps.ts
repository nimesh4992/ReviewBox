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
  /** Storefront the rating/review count are read from. Null until sync resolves one. */
  store_country: string | null;
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
  // Throw rather than returning []. A swallowed error here is indistinguishable
  // from a genuinely empty workspace, and the dashboard reacts to "zero apps"
  // by replacing itself with the first-run "connect your first app" screen —
  // so one transient 500 told a fully set-up customer their workspace was gone.
  if (!res.ok) {
    throw new Error(`Failed to load apps (${res.status})`);
  }
  const data = (await res.json()) as { apps: WorkspaceApp[] };
  return data.apps ?? [];
}

export function useApps() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["apps"],
    queryFn: fetchApps,
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  // Guard: if the cache was populated with a non-array (e.g. an `{ apps: [] }`
  // object from a stale CredentialsBanner queryFn), fall back to empty array
  // rather than propagating a non-array to callers who do `.some()` / `.map()`.
  const apps = Array.isArray(data) ? data : [];
  return { apps, isLoading, isError, refetch };
}

/**
 * Invalidate everything that is derived from the app list.
 *
 * Adding or removing an app changes far more than the picker: the dashboard
 * KPIs, the AI summary, the review queue, sentiment, ASO and the competitor
 * benchmark are all computed per app. Only `["apps"]` was invalidated, so
 * after deleting an app — which deletes its reviews server-side — the
 * dashboard kept showing that app's numbers until its own staleTime expired
 * (up to an hour for the AI summary).
 *
 * Keys are invalidated by prefix, so every per-app variant is covered.
 */
export function useInvalidateApps() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      ["apps"],
      ["dashboard-metrics"],
      ["ai-summary"],
      ["reviews"],
      ["incidents"],
      ["sentiment-overview"],
      ["aso-keywords"],
      ["aso-mine"],
      ["competitors"],
    ]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
}
