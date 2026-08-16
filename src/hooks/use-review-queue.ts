"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

import { AppReview } from "@/types/review";

export interface ReviewFiltersQuery {
  status?: string;
  sentiment?: string;
  rating?: number;
  platform?: string;
  /** Server-side full-text search on review body + author. Pass when ≥3 chars. */
  search?: string;
  /** Limit to one app in the workspace. Omit for all apps. */
  appId?: string;
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
  if (filters.search)   params.set("search", filters.search);
  if (filters.appId)    params.set("appId", filters.appId);

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
    isFetching,
    isError,
  } = useInfiniteQuery({
    queryKey: ["reviews", filters] as [string, ReviewFiltersQuery],
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      fetchReviews(pageParam, filters),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ReviewPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    // Poll every 60s when the browser tab is visible — new reviews appear
    // automatically without a manual refresh. Pauses when tab is hidden to
    // avoid waking the server on idle sessions.
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });

  // Flatten pages into a single reviews array.
  const reviews: AppReview[] = data?.pages.flatMap((page) => page.reviews) ?? [];

  return {
    reviews,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    isFetching,
    isLoading,
    // isError was computed and then dropped from this return, so the inbox
    // could not tell a failed fetch from an empty inbox — and rendered "No
    // reviews · Connect an app in Settings" to customers whose app was
    // already connected, sending them to redo setup they'd finished.
    isError,
  };
}
