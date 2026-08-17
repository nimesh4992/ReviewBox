"use client";

/**
 * The panel a screen shows when its data FAILED to load — as opposed to
 * loading fine and being empty.
 *
 * Why this exists as a shared component rather than four inline branches:
 * the bug it fixes is that a failure and an empty result rendered the same
 * pixels, and the four screens each invented a different empty state to be
 * mistaken for. ASO said "No gaps found — all top phrases are already
 * tracked", Competitors said "coming soon", Reply Kit showed an empty
 * library. Every one of those is a confident factual claim about the
 * customer's data, made on a request that never returned.
 *
 * The distinction the copy has to carry: **nothing is lost, we just can't
 * show it right now.** A customer who reads "no keywords tracked" after a
 * 500 will go and re-add keywords they already have.
 *
 * Deliberately not a full-page treatment. These are panel-level failures on
 * screens where other panels may have loaded fine, so it renders inside the
 * card it replaces.
 */

import { AlertCircle } from "lucide-react";

interface LoadErrorStateProps {
  /**
   * What failed, in the customer's words — "your keywords", "competitor
   * ratings". Rendered as "We couldn't load {subject}", so pass a noun
   * phrase, lowercase, no leading article beyond the natural one.
   */
  subject: string;
  /** Wired to the query's `refetch`. Omit when the caller has nothing to retry with. */
  onRetry?: () => void;
  /** True while the retry is in flight, so the button can't be double-fired. */
  retrying?: boolean;
  /** Tightens the vertical padding for panels that sit in a narrow strip. */
  compact?: boolean;
}

export function LoadErrorState({ subject, onRetry, retrying = false, compact = false }: LoadErrorStateProps) {
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 px-5 text-center ${compact ? "py-8" : "py-14"}`}
    >
      <AlertCircle className="size-8 text-[var(--rb-amber-600)]" strokeWidth={1.5} />
      <div>
        <p className="text-[14px] font-semibold text-fg-1">We couldn&rsquo;t load {subject}</p>
        <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-fg-3">
          Something went wrong on our side. Nothing has been lost — this is a
          display problem, not a data one.
        </p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={retrying}
          className="mt-1 flex h-8 items-center rounded-lg border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-50"
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>
      )}
    </div>
  );
}
