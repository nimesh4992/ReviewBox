import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { sparklinePoints } from "@/lib/sparkline";
import { cn } from "@/lib/utils";
import { OperationalMetric } from "@/types/review";

const valueClasses: Record<OperationalMetric["state"], string> = {
  critical: "text-red-600",
  warning: "text-amber-600",
  healthy: "text-gray-900",
  neutral: "text-gray-900",
};

const deltaClasses: Record<OperationalMetric["state"], string> = {
  critical: "text-red-500",
  warning: "text-amber-500",
  healthy: "text-gray-400",
  neutral: "text-gray-400",
};

function TrendIcon({ trend }: { trend: OperationalMetric["trend"] }) {
  if (trend === "up") return <TrendingUp className="size-3.5" />;
  if (trend === "down") return <TrendingDown className="size-3.5" />;
  return <Minus className="size-3.5" />;
}

const W = 80;
const H = 28;

export function OperationalMetrics({ metrics }: { metrics: OperationalMetric[] }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow duration-150 hover:shadow-md"
        >
          <div className="mb-1 text-xs font-medium text-gray-400">{metric.label}</div>

          <div className="flex items-end justify-between gap-2">
            <div>
              <div className={cn("text-2xl font-bold tracking-tight", valueClasses[metric.state])}>
                {metric.value}
              </div>
              <div className={cn("mt-1 flex items-center gap-1 text-xs", deltaClasses[metric.state])}>
                <TrendIcon trend={metric.trend} />
                <span className="truncate">{metric.delta}</span>
              </div>
            </div>

            {metric.sparkline && metric.sparkline.length >= 2 && (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="shrink-0 opacity-60"
                style={{ width: W, height: H }}
                preserveAspectRatio="none"
              >
                <polyline
                  points={sparklinePoints(metric.sparkline, W, H, 2)}
                  fill="none"
                  stroke={metric.sparklineColor}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
