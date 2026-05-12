import Link from "next/link";
import { ArrowRight, GitBranch, TrendingDown, TrendingUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ReleaseHealth } from "@/types/review";

const STATUS_CONFIG: Record<
  ReleaseHealth["status"],
  { label: string; dot: string; text: string }
> = {
  degraded: { label: "Degraded", dot: "bg-red-400", text: "text-red-600" },
  monitoring: { label: "Monitoring", dot: "bg-amber-400", text: "text-amber-600" },
  healthy: { label: "Healthy", dot: "bg-emerald-400", text: "text-gray-500" },
};

function RatingDelta({ delta, num }: { delta: string; num: number }) {
  const isPositive = num > 0;
  const isNegative = num < 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-sm font-medium",
        isPositive && "text-emerald-600",
        isNegative && "text-red-500",
        !isPositive && !isNegative && "text-gray-400",
      )}
    >
      {isPositive ? (
        <TrendingUp className="size-3.5" />
      ) : isNegative ? (
        <TrendingDown className="size-3.5" />
      ) : null}
      {delta}
    </span>
  );
}

function RolloutBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-20 overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-gray-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-500">{pct}%</span>
    </div>
  );
}

export function ReleaseHealthTable({ releases }: { releases: ReleaseHealth[] }) {
  const degradedCount = releases.filter((r) => r.status === "degraded").length;
  const monitoringCount = releases.filter((r) => r.status === "monitoring").length;

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Release health</h2>
            <p className="mt-0.5 text-xs text-gray-400">Rating and complaint impact per staged rollout</p>
          </div>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-400 hover:text-gray-600">
            View all
            <ArrowRight className="size-3" />
          </Button>
        </div>

        {/* Stats strip */}
        <div className="mt-3 flex items-center gap-5 text-xs text-gray-400">
          {degradedCount > 0 && (
            <span>
              <span className="font-semibold text-red-600">{degradedCount}</span> degraded
            </span>
          )}
          {monitoringCount > 0 && (
            <span>
              <span className="font-semibold text-amber-600">{monitoringCount}</span> monitoring
            </span>
          )}
          <span className="ml-auto text-gray-300">{releases.length} versions</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid border-b border-gray-100 bg-gray-50/40 px-4 py-2 text-[11px] font-medium uppercase tracking-wide text-gray-400 md:grid-cols-[1fr_130px_110px_120px_150px_110px_80px]">
        <span>Version</span>
        <span className="hidden md:block">Status</span>
        <span className="hidden md:block">Rating Δ</span>
        <span className="hidden md:block">Complaints</span>
        <span className="hidden md:block">Rollout</span>
        <span className="hidden md:block">Started</span>
        <span className="hidden md:block" />
      </div>

      <div className="divide-y divide-gray-100">
        {releases.map((release) => {
          const config = STATUS_CONFIG[release.status];

          return (
            <div
              key={release.version}
              className="grid gap-3 px-4 py-3 hover:bg-gray-50/40 md:grid-cols-[1fr_130px_110px_120px_150px_110px_80px] md:items-center"
            >
              <div className="flex min-w-0 items-center gap-2">
                <GitBranch className="size-3.5 shrink-0 text-gray-300" />
                <span className="font-mono text-sm font-medium text-gray-900">{release.version}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("size-1.5 rounded-full", config.dot)} />
                <span className={cn("text-xs font-medium", config.text)}>{config.label}</span>
              </div>
              <RatingDelta delta={release.ratingDelta} num={release.ratingDeltaNum} />
              <div
                className={cn(
                  "text-sm font-medium",
                  release.complaintDelta.startsWith("+") ? "text-red-500" : "text-emerald-600",
                )}
              >
                {release.complaintDelta}
              </div>
              <RolloutBar pct={release.rolloutNum} />
              <div className="text-xs text-gray-400">{release.startedAt}</div>
              <div className="hidden md:flex">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-gray-400 hover:text-gray-600"
                  asChild
                >
                  <Link href={`/releases/${encodeURIComponent(release.version)}`}>
                    Details
                    <ArrowRight className="size-3" />
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
