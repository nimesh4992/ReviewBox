import { getServiceClient } from "@/lib/supabase-server";
import { mockReviews } from "@/features/reviews/data/mock-reviews";
import { AppReview } from "@/types/review";

export interface ReviewFilters {
  status?: string;
  sentiment?: string;
  rating?: number;
  platform?: string;
  limit?: number;
  cursor?: string;
}

export interface ReviewPage {
  reviews: AppReview[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function listReviewQueue(
  workspaceId: string | null,
  filters: ReviewFilters = {},
): Promise<ReviewPage> {
  if (!workspaceId) {
    return { reviews: mockReviews, nextCursor: null, hasMore: false };
  }

  const sb = getServiceClient();
  const limit = Math.min(filters.limit ?? 20, 50);

  let query = sb
    .from("reviews")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit + 1);

  if (filters.cursor)    query = query.lt("created_at", filters.cursor);
  if (filters.status)    query = query.eq("reply_status", filters.status);
  if (filters.sentiment) query = query.eq("sentiment", filters.sentiment);
  if (filters.rating !== undefined) query = query.eq("rating", filters.rating);
  if (filters.platform)  query = query.eq("source", filters.platform);

  const { data, error } = await query;

  if (error) {
    console.error("[review-service] listReviewQueue:", error);
    return { reviews: mockReviews, nextCursor: null, hasMore: false };
  }

  const rows = (data ?? []) as AppReview[];
  const hasMore = rows.length > limit;
  const reviews = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? (reviews[reviews.length - 1]?.createdAt ?? null) : null;

  return { reviews, nextCursor, hasMore };
}
