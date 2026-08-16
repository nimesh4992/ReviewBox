"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useAiSummary } from "@/hooks/use-ai-summary";

function relativeTime(iso: string): string {
  const diffMins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins === 1) return "1 minute ago";
  if (diffMins < 60) return `${diffMins} minutes ago`;
  const h = Math.floor(diffMins / 60);
  return h === 1 ? "1 hour ago" : `${h} hours ago`;
}

export function AiSummaryPanel({ appId }: { appId?: string }) {
  const { data, isLoading, isFetching, refresh } = useAiSummary(appId);
  const [refreshing, setRefreshing] = useState(false);
  const busy = isFetching || refreshing;

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } catch {
      // The panel keeps showing the last good summary; a failed refresh is
      // not worth an error state of its own.
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--rb-border-1)] bg-surface p-5 flex flex-col gap-3 shadow-[var(--rb-shadow-xs)]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-fg-1 leading-snug">
              AI review summary
            </span>
            <span className="rounded-full bg-[var(--rb-bg-sunken)] px-1.5 py-0.5 text-[10px] font-medium text-fg-3 leading-none">
              Groq
            </span>
          </div>
          {data && (
            <span className="text-[12px] text-fg-3">
              Based on {data.reviewCount} recent review{data.reviewCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex flex-col gap-2 animate-pulse">
          <div className="h-3 rounded bg-[var(--rb-bg-sunken)] w-full" />
          <div className="h-3 rounded bg-[var(--rb-bg-sunken)] w-[88%]" />
          <div className="h-3 rounded bg-[var(--rb-bg-sunken)] w-[72%]" />
        </div>
      ) : (
        <p className="text-[14px] leading-relaxed text-fg-2">
          {data?.summary ?? "No summary available."}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        {data?.generatedAt ? (
          <span className="text-[11px] text-fg-3">
            Updated {relativeTime(data.generatedAt)}
          </span>
        ) : (
          <span />
        )}
        <button
          onClick={() => void handleRefresh()}
          disabled={busy}
          className="flex items-center gap-1 text-[12px] font-medium transition-opacity hover:opacity-70 disabled:opacity-40"
          style={{ color: "#0A84FF" }}
          aria-label="Refresh AI summary"
        >
          <RefreshCw
            size={12}
            strokeWidth={1.5}
            className={busy ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>
    </div>
  );
}
