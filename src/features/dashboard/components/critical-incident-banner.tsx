import { ArrowRight, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IncidentAlert } from "@/types/review";

export function CriticalIncidentBanner({ alerts }: { alerts: IncidentAlert[] }) {
  const primaryAlert = alerts[0];
  if (!primaryAlert) return null;

  return (
    <section className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-red-500" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-red-700">{primaryAlert.title}</span>
              <span className="text-[11px] text-red-400">{primaryAlert.detectedAt}</span>
            </div>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-red-600/80">
              {primaryAlert.description}
            </p>
            {alerts.length > 1 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {alerts.map((alert) => (
                  <span
                    key={alert.id}
                    className="rounded-full border border-red-200 bg-white/60 px-2 py-0.5 text-[10px] font-medium text-red-600"
                  >
                    {alert.owner}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 shrink-0 border-red-200 bg-white/60 text-xs text-red-700 hover:bg-white"
        >
          Open incident
          <ArrowRight className="size-3.5" />
        </Button>
      </div>
    </section>
  );
}
