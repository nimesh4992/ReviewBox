import { Bot, Sparkles, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InsightSignal } from "@/types/review";

const signalConfig: Record<InsightSignal["state"], { dot: string; value: string }> = {
  critical: { dot: "bg-red-500", value: "text-red-600" },
  warning: { dot: "bg-amber-400", value: "text-amber-600" },
  neutral: { dot: "bg-gray-300", value: "text-gray-600" },
  healthy: { dot: "bg-gray-300", value: "text-gray-600" },
};

export function AiInsightsPanel({ signals }: { signals: InsightSignal[] }) {
  return (
    <aside className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Bot className="size-4 text-gray-400" />
            <div>
              <h2 className="text-sm font-semibold text-gray-900">AI insights</h2>
              <p className="text-[11px] text-gray-400">Live triage signals</p>
            </div>
          </div>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            beta
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {signals.map((signal) => {
          const config = signalConfig[signal.state];
          return (
            <div key={signal.label} className="px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={cn("mt-0.5 size-1.5 shrink-0 rounded-full", config.dot)} />
                  <span className="text-[11px] font-medium text-gray-500">{signal.label}</span>
                </div>
                <span className={cn("shrink-0 text-xs font-semibold", config.value)}>
                  {signal.value}
                </span>
              </div>
              <p className="mt-1 pl-3 text-xs leading-5 text-gray-500">{signal.detail}</p>
            </div>
          );
        })}
      </div>

      <div className="border-t border-gray-100 p-3">
        <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 p-3">
          <div className="flex items-center gap-2 text-xs font-medium text-gray-600">
            <TrendingDown className="size-3.5 text-red-500" />
            Rating drop driver
          </div>
          <p className="mt-1.5 text-xs leading-5 text-gray-400">
            Crash + billing language explains most of today&apos;s negative movement.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-full border-gray-200 text-gray-600 hover:bg-gray-50"
        >
          <Sparkles className="size-3.5" />
          Prepare triage brief
        </Button>
      </div>
    </aside>
  );
}
