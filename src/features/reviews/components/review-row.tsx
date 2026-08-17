"use client";

import { useState } from "react";

import { Loader2, PenLine } from "lucide-react";

import { cn } from "@/lib/utils";
import { AppReview } from "@/types/review";
import { formatReviewDate } from "@/utils/format";
import { Stars, ReviewerAvatar, shortTitle, SENTIMENT_DOT } from "./review-primitives";

/** One row in the inbox list. Extracted from review-queue.tsx unchanged. */

// ── ReviewRow ─────────────────────────────────────────────────────────────────

export function ReviewRow({ review, selected, onClick, selectMode, isChecked, onCheck, onQuickDraft }: {
  review: AppReview;
  selected: boolean;
  onClick: () => void;
  selectMode?: boolean;
  isChecked?: boolean;
  onCheck?: (id: string) => void;
  onQuickDraft?: (review: AppReview) => void;
}) {
  const [isDrafting, setIsDrafting] = useState(false);

  // The row is interactive, so it carries real interactive semantics: option
  // role (the list is a listbox), keyboard activation, and a focus ring. A
  // bare onClick div was invisible to keyboard and screen-reader users on the
  // single most-used surface in the product.
  return (
    <div
      role="option"
      aria-selected={selectMode ? isChecked : selected}
      tabIndex={0}
      data-review-id={review.id}
      onClick={selectMode ? () => onCheck?.(review.id) : onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (selectMode) onCheck?.(review.id);
          else onClick();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer gap-3 border-b border-[var(--rb-border-1)] px-5 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rb-blue-400)]",
        selected && !selectMode ? "bg-[var(--rb-bg-selected)]" : "hover:bg-[var(--rb-bg-hover)]",
        isChecked && "bg-[var(--rb-blue-50)]",
      )}
    >
      {selectMode ? (
        <div className="flex shrink-0 items-center">
          <input
            type="checkbox"
            checked={isChecked ?? false}
            onChange={() => onCheck?.(review.id)}
            onClick={(e) => e.stopPropagation()}
            className="size-3.5 accent-[var(--rb-blue-500)]"
          />
        </div>
      ) : (
        <ReviewerAvatar author={review.author} source={review.source} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--rb-fg-1)]">
            {shortTitle(review.text)}
          </span>
          <Stars rating={review.rating} />
          {review.replyStatus === "needs_reply" && (
            <span className="size-[7px] shrink-0 rounded-full bg-[var(--rb-blue-500)]" />
          )}
        </div>
        <div className="mt-1 line-clamp-1 text-[12px] leading-snug text-[var(--rb-fg-2)]">
          {review.text}
        </div>
        <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[11px] text-[var(--rb-fg-3)]">
          <span className="flex items-center gap-1">
            <span className={cn("size-1.5 shrink-0 rounded-full", SENTIMENT_DOT[review.sentiment])} />
            <span className="capitalize">{review.sentiment}</span>
          </span>
          <span>·</span>
          <span className="truncate">{review.author}</span>
          <span>·</span>
          <span className="shrink-0">{review.source === "App Store" ? "iOS" : "Android"}</span>
          <span>·</span>
          <span className="shrink-0 font-mono">v{review.appVersion}</span>
          <span className="ml-auto shrink-0 tabular-nums">{formatReviewDate(review.createdAt)}</span>
        </div>
      </div>

      {/* Hover quick actions — visible on group-hover, hidden in select mode */}
      {!selectMode && review.replyStatus === "needs_reply" && onQuickDraft && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              setIsDrafting(true);
              try { await onQuickDraft(review); } finally { setIsDrafting(false); }
            }}
            disabled={isDrafting}
            title="AI draft — generates reply and saves for review"
            className="flex items-center gap-1 rounded-md border border-[var(--rb-border-2)] bg-surface px-2.5 py-1 text-[11px] font-semibold text-[var(--rb-blue-500)] shadow-[var(--rb-shadow-xs)] transition-colors hover:bg-[var(--rb-blue-50)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-blue-400)]"
          >
            {isDrafting ? (
              <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
            ) : (
              <PenLine className="size-3" />
            )}
            {isDrafting ? "Drafting…" : "Draft"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tone selector ─────────────────────────────────────────────────────────────

