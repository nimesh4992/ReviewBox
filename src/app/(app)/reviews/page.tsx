"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ReviewFilterPanel, ReviewFilters } from "@/features/reviews/components/review-filter-panel";
import { ReviewQueue } from "@/features/reviews/components/review-queue";
import { ReviewStatsStrip } from "@/features/reviews/components/review-stats-strip";
import { useReviewQueue } from "@/hooks/use-review-queue";

const DEFAULT_FILTERS: ReviewFilters = {
  period: "30d",
  stars: [],
  replyStatus: [],
  platforms: [],
  sentiment: [],
  countries: [],
  tags: [],
  versions: [],
};

export default function ReviewsPage() {
  const [filters, setFilters] = useState<ReviewFilters>(DEFAULT_FILTERS);
  const [panelOpen, setPanelOpen] = useState(true);

  // Map panel filters to API query params (single values only for now)
  const queueFilters = {
    status: filters.replyStatus[0],
    sentiment: filters.sentiment[0],
    rating: filters.stars[0],
    platform: filters.platforms[0],
  };

  const {
    reviews,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useReviewQueue(queueFilters);

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Inbox"
        title="Reviews feed"
        description="Triage, reply, and track all reviews across connected apps."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            onClick={() => setPanelOpen(!panelOpen)}
          >
            <SlidersHorizontal className="size-3.5" />
            Filters
          </Button>
        }
      />

      <div className="p-4 md:p-6 space-y-4">
        {/* Stats strip — use all loaded reviews */}
        <ReviewStatsStrip reviews={reviews} />

        {/* Main content + filter panel */}
        <div className="flex min-w-0 gap-4 items-start">
          <div className="min-w-0 flex-1">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-32 animate-pulse rounded-2xl border border-gray-200 bg-gray-50"
                  />
                ))}
              </div>
            ) : (
              <ReviewQueue
                reviews={reviews}
                title="Reviews feed"
                description={`${reviews.length} review${reviews.length !== 1 ? "s" : ""} matching current filters`}
                hasNextPage={hasNextPage}
                isFetchingNextPage={isFetchingNextPage}
                fetchNextPage={fetchNextPage}
              />
            )}
          </div>

          {panelOpen && (
            <div className="shrink-0">
              <ReviewFilterPanel filters={filters} onChange={setFilters} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
