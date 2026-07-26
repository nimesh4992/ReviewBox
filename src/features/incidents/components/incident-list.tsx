import Link from "next/link";
import { ArrowRight, CheckCircle2, Clock, Loader2, ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { IncidentAlert, IncidentStatus } from "@/types/review";

const SEVERITY_CONFIG: Record<
  IncidentAlert["severity"],
  { bar: string; icon: typeof ShieldAlert; label: string }
> = {
  critical: { bar: "bg-red-400", icon: ShieldAlert, label: "Critical" },
  high: { bar: "bg-amber-400", icon: TriangleAlert, label: "High" },
  medium: { bar: "bg-gray-300", icon: TriangleAlert, label: "Medium" },
};

const STATUS_CONFIG: Record<IncidentStatus, { label: string; className: string; Icon: typeof Loader2 }> = {
  active: { label: "Active", className: "text-red-600", Icon: ShieldAlert },
  investigating: { label: "Investigating", className: "text-amber-600", Icon: Loader2 },
  resolved: { label: "Resolved", className: "text-gray-400", Icon: CheckCircle2 },
};

export function IncidentList({ incidents }: { incidents: IncidentAlert[] }) {
  const criticalCount = incidents.filter((i) => i.severity === "critical").length;
  const highCount = incidents.filter((i) => i.severity === "high").length;
  const activeCount = incidents.filter((i) => i.status !== "resolved").length;

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--rb-border-1)] bg-surface">
      {/* Summary strip. The title and description that used to sit here just
          repeated the PageHeader directly above it, and "View all" pointed at
          the page it was already on — both removed. The counts are the only
          part that earned the space. */}
      <div className="flex items-center gap-5 border-b border-[var(--rb-border-1)] px-4 py-3 text-rb-sm text-fg-3">
        <span>
          <span className="font-semibold text-[var(--rb-red-600)]">{criticalCount}</span> critical
        </span>
        <span>
          <span className="font-semibold text-[var(--rb-amber-600)]">{highCount}</span> high
        </span>
        <span className="ml-auto">
          <span className="font-semibold text-fg-1">{activeCount}</span> open
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {incidents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="size-12 text-emerald-200" strokeWidth={1.5} />
            <h3 className="mt-4 text-sm font-semibold text-gray-900">All clear</h3>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              No active incidents. ReviewBox will automatically detect crash spikes and rating drops once reviews are syncing.
            </p>
          </div>
        ) : incidents.map((incident) => {
          const sev = SEVERITY_CONFIG[incident.severity];
          const status = STATUS_CONFIG[incident.status];
          const SevIcon = sev.icon;
          const StatusIcon = status.Icon;

          return (
            <div
              key={incident.id}
              className={cn("flex gap-0", incident.status === "resolved" && "opacity-50")}
            >
              {/* Severity border */}
              <div className={cn("w-0.5 shrink-0", sev.bar)} />

              <div className="flex flex-1 flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <SevIcon className="size-3.5 shrink-0 text-gray-400" />
                    <h3 className="text-sm font-semibold text-gray-900">{incident.title}</h3>
                    <span className="text-[10px] font-medium text-gray-400">{sev.label}</span>
                  </div>
                  <p className="mt-1 max-w-3xl text-sm leading-5 text-gray-400">
                    {incident.description}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {incident.detectedAt}
                    </span>
                    <span className="text-gray-500">{incident.owner}</span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <span className={cn("flex items-center gap-1 text-xs font-medium", status.className)}>
                    <StatusIcon className="size-3.5" />
                    {status.label}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 border-0 text-xs text-gray-400 hover:text-gray-600"
                    asChild
                  >
                    <Link href={`/incidents/${incident.id}`}>
                      Open
                      <ArrowRight className="size-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
