"use client";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/** Extracted verbatim from dashboard/page.tsx. */

// ── KpiCard ───────────────────────────────────────────────────────────────────

export function KpiCard({
  icon: Icon,
  label,
  value,
  delta,
  sub,
  kind,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  delta: string;
  sub: string;
  kind: "positive" | "warning" | "neutral";
  loading: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--rb-border-1)] bg-surface px-5 py-4 shadow-[var(--rb-shadow-xs)]">
      {/* Label row with icon */}
      <div className="flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--rb-bg-sunken)]">
          <Icon className="size-3.5 text-fg-3" strokeWidth={1.5} />
        </div>
        <span className="text-[12px] font-medium text-fg-3 truncate leading-none">{label}</span>
      </div>
      {/* Value + delta */}
      <div className="flex items-baseline gap-2">
        {loading ? (
          <Skeleton className="h-8 w-14 rounded-md" />
        ) : (
          <span className="text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-fg-1">
            {value}
          </span>
        )}
        {!loading && (
          <span
            className={cn(
              "text-[11px] font-medium tabular-nums shrink-0",
              kind === "positive" ? "text-[#1F8A5B]" :
              kind === "warning"  ? "text-[#D97706]" :
              "text-fg-3",
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {/* Sub label */}
      <div className="text-[11px] text-fg-3 leading-none">{sub}</div>
    </div>
  );
}
