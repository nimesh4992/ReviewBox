"use client";

import { RefreshCw } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { OnboardingBanner } from "@/features/dashboard/components/onboarding-banner";
import { OperationalMetrics } from "@/features/dashboard/components/operational-metrics";
import { PlatformHealthSection } from "@/features/dashboard/components/platform-health";
import {
  operationalMetrics as mockOperationalMetrics,
  platformHealth,
} from "@/features/dashboard/data/operations";
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";
import { OperationalMetric } from "@/types/review";

// TODO: wire showOnboarding to real app count once Google Play sync is live
const showOnboarding = true;

export default function DashboardPage() {
  const { data: metrics, isLoading } = useDashboardMetrics();

  // Build real metric cards, keeping sparklines + colors from mock (no historical data yet)
  const operationalMetrics: OperationalMetric[] = isLoading
    ? mockOperationalMetrics
    : [
        {
          label: "Avg. Rating",
          value: metrics.avgRating !== null ? String(metrics.avgRating) : "—",
          delta: "Last 30 days",
          trend: "neutral",
          state: metrics.avgRating !== null && metrics.avgRating < 4.0 ? "warning" : "healthy",
          sparkline: mockOperationalMetrics[0].sparkline,
          sparklineColor: mockOperationalMetrics[0].sparklineColor,
        },
        {
          label: "Unresolved Reviews",
          value: String(metrics.unrepliedCount),
          delta: `${metrics.urgentCount} urgent`,
          trend: metrics.unrepliedCount > 50 ? "up" : "neutral",
          state: metrics.unrepliedCount > 100 ? "warning" : metrics.unrepliedCount > 50 ? "warning" : "healthy",
          sparkline: mockOperationalMetrics[1].sparkline,
          sparklineColor: mockOperationalMetrics[1].sparklineColor,
        },
        {
          label: "Reviews Today",
          value: String(metrics.reviewsToday),
          delta: `${metrics.totalReviews.toLocaleString()} total`,
          trend: "neutral",
          state: "neutral",
          sparkline: mockOperationalMetrics[2].sparkline,
          sparklineColor: mockOperationalMetrics[2].sparklineColor,
        },
        {
          label: "AI Drafts This Week",
          value: String(metrics.aiDraftsThisWeek),
          delta: "Draft replies generated",
          trend: "neutral",
          state: "neutral",
          sparkline: mockOperationalMetrics[3].sparkline,
          sparklineColor: mockOperationalMetrics[3].sparklineColor,
        },
      ];

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="Rating health and review activity across your connected apps."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="size-3.5" />
            Refresh
          </Button>
        }
      />

      <div className="space-y-6 p-4 md:p-6">
        <OnboardingBanner showOnboarding={showOnboarding} />
        <OperationalMetrics metrics={operationalMetrics} />
        <PlatformHealthSection data={platformHealth} />
      </div>
    </div>
  );
}
