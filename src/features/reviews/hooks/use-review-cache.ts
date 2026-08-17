"use client";

import { useQueryClient } from "@tanstack/react-query";

import { AppReview } from "@/types/review";

/**
 * Cache-mutation helpers for the review inbox.
 *
 * Extracted from review-queue.tsx unchanged. They are shared by the composer,
 * the group-reply panel and the inbox shell, so they have to live outside all
 * three rather than inside whichever one happened to define them first.
 */

// Helper — stamp a review as replied in the infinite query cache
export function useMarkReplied() {
  const qc = useQueryClient();
  return (reviewId: string, replyText: string) => {
    qc.setQueriesData<{
      pages: Array<{ reviews: AppReview[]; nextCursor: string | null; hasMore: boolean }>;
      pageParams: unknown[];
    }>(
      { queryKey: ["reviews"] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            reviews: page.reviews.map((r) =>
              r.id === reviewId
                ? { ...r, replyStatus: "replied" as const, replyText }
                : r,
            ),
          })),
        };
      },
    );
    // Publishing a reply changes unrepliedCount / urgentCount, which the
    // dashboard KPIs and the sidebar's Inbox badge read from a 5-minute
    // cache. Without this the badge kept its old number for minutes after
    // the user cleared the review it was counting.
    void qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  };
}

// Helper — stamp a review as draft_ready in the infinite query cache
export function useMarkDraft() {
  const qc = useQueryClient();
  return (reviewId: string, replyText: string) => {
    qc.setQueriesData<{
      pages: Array<{ reviews: AppReview[]; nextCursor: string | null; hasMore: boolean }>;
      pageParams: unknown[];
    }>(
      { queryKey: ["reviews"] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            reviews: page.reviews.map((r) =>
              r.id === reviewId
                ? { ...r, replyStatus: "draft_ready" as const, replyText }
                : r,
            ),
          })),
        };
      },
    );
  };
}

// ── Store char limits ─────────────────────────────────────────────────────────

