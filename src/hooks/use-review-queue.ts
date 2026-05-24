"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { AppReview } from "@/types/review";

export interface ReviewFiltersQuery {
  status?: string;
  sentiment?: string;
  rating?: number;
  platform?: string;
}

interface ReviewPage {
  reviews: AppReview[];
  nextCursor: string | null;
  hasMore: boolean;
}

async function fetchReviews(
  cursor: string | undefined,
  filters: ReviewFiltersQuery,
): Promise<ReviewPage> {
  const params = new URLSearchParams();
  params.set("limit", "20");
  if (cursor) params.set("cursor", cursor);
  if (filters.status) params.set("status", filters.status);
  if (filters.sentiment) params.set("sentiment", filters.sentiment);
  if (filters.rating !== undefined) params.set("rating", String(filters.rating));
  if (filters.platform) params.set("platform", filters.platform);

  const res = await fetch(`/api/reviews?${params.toString()}`);
  if (!res.ok) throw new Error(`Reviews fetch failed: ${res.status}`);
  return res.json() as Promise<ReviewPage>;
}

export function useReviewQueue(filters: ReviewFiltersQuery = {}) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
  } = useInfiniteQuery({
    queryKey: ["reviews", filters] as [string, ReviewFiltersQuery],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchReviews(pageParam, filters),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ReviewPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
  });

  // Flatten pages into a single reviews array; fall back to mock on error
  const reviews: AppReview[] = data?.pages.flatMap((page) => page.reviews) ?? [];

  return {
    reviews,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    isLoading,
  };
}
