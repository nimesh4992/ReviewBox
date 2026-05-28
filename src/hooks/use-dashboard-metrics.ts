"use client";

import { useQuery } from "@tanstack/react-query";

import type { DashboardMetrics } from "@/app/api/dashboard/metrics/route";

// Real zeros — never show fabricated numbers. An empty workspace shows real
// zeros so the dashboard accurately reflects the user's actual data.
const EMPTY_METRICS: DashboardMetrics = {
  unrepliedCount: 0,
  urgentCount: 0,
  avgRating: null,
  aiDraftsThisWeek: 0,
  reviewsToday: 0,
  totalReviews: 0,
  reviewsWeekDelta: null,
  avgRatingDelta: null,
  ratingTrend: [],
  lifetimeRating: null,
  lifetimeReviewCount: null,
};

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetch("/api/dashboard/metrics");
  if (!res.ok) throw new Error(`Dashboard metrics fetch failed: ${res.status}`);
  return res.json() as Promise<DashboardMetrics>;
}

export function useDashboardMetrics() {
  const { data, isLoading, isError, refetch } = useQuery<DashboardMetrics>({
    queryKey: ["dashboard-metrics"],
    queryFn: fetchDashboardMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  return {
    data: data ?? EMPTY_METRICS,
    isLoading,
    isError,
    refetch,
  };
}
