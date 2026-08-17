"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { DashboardMetrics } from "@/app/api/dashboard/metrics/route";

// Real zeros — never show fabricated numbers. An empty workspace shows real
// zeros so the dashboard accurately reflects the user's actual data.
const EMPTY_METRICS: DashboardMetrics = {
  unrepliedCount: 0,
  urgentCount: 0,
  lowRatingCount: 0,
  avgRating: null,
  aiDraftsThisWeek: 0,
  reviewsToday: 0,
  reviewsThisWeek: 0,
  totalReviews: 0,
  reviewsWeekDelta: null,
  avgRatingDelta: null,
  ratingTrend: [],
  lifetimeRating: null,
  lifetimeReviewCount: null,
  lifetimeRatingAppCount: 0,
};

async function fetchDashboardMetrics(appId?: string): Promise<DashboardMetrics> {
  const qs = appId ? `?appId=${encodeURIComponent(appId)}` : "";
  const res = await fetch(`/api/dashboard/metrics${qs}`);
  if (!res.ok) throw new Error(`Dashboard metrics fetch failed: ${res.status}`);
  return res.json() as Promise<DashboardMetrics>;
}

/**
 * @param appId Scope every metric to one app (from the sidebar selector, via
 *              `resolveSelectedApp`). Undefined = all apps in the workspace.
 */
export function useDashboardMetrics(appId?: string, options?: { enabled?: boolean }) {
  const { data, isLoading, isError, refetch, isPlaceholderData } = useQuery<DashboardMetrics>({
    // appId is part of the key so switching apps refetches instead of serving
    // the previous app's numbers from cache.
    queryKey: ["dashboard-metrics", appId ?? "all"],
    queryFn: () => fetchDashboardMetrics(appId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    // Show previous data while a background refetch runs so the dashboard
    // never blanks out on return visits.
    placeholderData: keepPreviousData,
    // Gated until the app selection resolves — see useAiSummary.
    enabled: options?.enabled ?? true,
  });

  return {
    data: data ?? EMPTY_METRICS,
    isLoading,
    isError,
    refetch,
    // TRUE while the numbers on screen belong to the PREVIOUS app: with
    // `keepPreviousData`, switching apps keeps the old figures visible until
    // the new ones land, which on this screen would mean app A's rating
    // sitting under app B's name — the very confusion this scoping work
    // exists to remove. Callers must render a loading state on this.
    isStaleForApp: isPlaceholderData,
  };
}
