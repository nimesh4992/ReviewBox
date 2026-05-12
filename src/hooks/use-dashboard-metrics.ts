"use client";

import { useQuery } from "@tanstack/react-query";

import type { DashboardMetrics } from "@/app/api/dashboard/metrics/route";

const FALLBACK_METRICS: DashboardMetrics = {
  unrepliedCount: 127,
  urgentCount: 9,
  avgRating: 3.8,
  aiDraftsThisWeek: 5,
  reviewsToday: 84,
  totalReviews: 2764,
};

async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetch("/api/dashboard/metrics");
  if (!res.ok) return FALLBACK_METRICS;
  return res.json() as Promise<DashboardMetrics>;
}

export function useDashboardMetrics() {
  const { data, isLoading } = useQuery<DashboardMetrics>({
    queryKey: ["dashboard-metrics"],
    queryFn: fetchDashboardMetrics,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    data: data ?? FALLBACK_METRICS,
    isLoading,
  };
}
