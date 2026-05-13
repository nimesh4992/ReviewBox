"use client";

import { ReviewQueue } from "@/features/reviews/components/review-queue";
import { useReviewQueue } from "@/hooks/use-review-queue";

export default function ReviewsPage() {
  const { reviews, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useReviewQueue();

  return (
    <div className="flex h-[calc(100vh-52px)] flex-col overflow-hidden">
      {isLoading ? (
        <div className="flex flex-1 flex-col">
          {/* Header skeleton */}
          <div className="shrink-0 border-b border-gray-100 px-7 pb-3.5 pt-5">
            <div className="mb-3.5">
              <div className="h-3 w-32 animate-pulse rounded bg-gray-100" />
              <div className="mt-2 h-6 w-16 animate-pulse rounded bg-gray-100" />
            </div>
            <div className="flex gap-2">
              {[80, 110, 90, 90, 90].map((w, i) => (
                <div key={i} className="h-7 animate-pulse rounded-[7px] bg-gray-100" style={{ width: w }} />
              ))}
            </div>
          </div>
          {/* Row skeletons */}
          <div className="flex-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="flex gap-3 border-b border-gray-50 px-4 py-3.5">
                <div className="size-9 shrink-0 animate-pulse rounded-[9px] bg-gray-100" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-100" />
                  <div className="h-3 w-full animate-pulse rounded bg-gray-100" />
                  <div className="h-2.5 w-1/2 animate-pulse rounded bg-gray-100" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <ReviewQueue
          reviews={reviews}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
        />
      )}
    </div>
  );
}
