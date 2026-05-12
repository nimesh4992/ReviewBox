import Link from "next/link";
import { ArrowLeft, Clock, User } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { incidentAlerts } from "@/features/dashboard/data/operations"; // swap for Supabase query
import { IncidentStatusActions } from "@/features/incidents/components/incident-status-actions";
import { cn } from "@/lib/utils";
import type { IncidentAlert } from "@/types/review";

export const dynamic = "force-dynamic";

// ── Severity + status styling ─────────────────────────────────────────────────

const SEVERITY_STYLES: Record<
  IncidentAlert["severity"],
  { bar: string; badge: string; label: string }
> = {
  critical: {
    bar: "bg-red-400",
    badge: "bg-red-50 text-red-700 border border-red-200",
    label: "Critical",
  },
  high: {
    bar: "bg-amber-400",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "High",
  },
  medium: {
    bar: "bg-gray-300",
    badge: "bg-gray-50 text-gray-600 border border-gray-200",
    label: "Medium",
  },
};

const STATUS_STYLES: Record<
  IncidentAlert["status"],
  { badge: string; label: string }
> = {
  active: { badge: "bg-red-50 text-red-700 border border-red-200", label: "Active" },
  investigating: {
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    label: "Investigating",
  },
  resolved: {
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    label: "Resolved",
  },
};

// ── Page ──────────────────────────────────────────────────────────────────────

interface IncidentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function IncidentDetailPage({
  params,
}: IncidentDetailPageProps) {
  const { id } = await params;

  // Look up from mock data (replace with Supabase query once sync is live)
  const incident = incidentAlerts.find((i) => i.id === id);

  if (!incident) {
    return (
      <div className="min-w-0">
        <PageHeader
          eyebrow="Operations"
          title="Incident not found"
          description="This incident does not exist or has been removed."
        />
        <div className="p-6">
          <Link
            href="/incidents"
            className="inline-flex items-center gap-1.5 text-sm text-[#5B5BD6] hover:underline"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
            Back to incidents
          </Link>
        </div>
      </div>
    );
  }

  const sev = SEVERITY_STYLES[incident.severity];
  const status = STATUS_STYLES[incident.status];

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Operations · Incidents"
        title={incident.title}
        description={incident.description}
      />

      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        {/* Back link */}
        <Link
          href="/incidents"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          Back to incidents
        </Link>

        {/* Main card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Severity bar */}
          <div className={cn("h-1 w-full", sev.bar)} />

          <div className="p-5 space-y-4">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  sev.badge,
                )}
              >
                {sev.label}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  status.badge,
                )}
              >
                {status.label}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm leading-6 text-gray-600">
              {incident.description}
            </p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-5 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" strokeWidth={1.5} />
                {incident.detectedAt}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="size-3.5" strokeWidth={1.5} />
                {incident.owner}
              </span>
            </div>

            {/* Status actions (client component) */}
            <IncidentStatusActions
              incidentId={incident.id}
              currentStatus={incident.status}
            />
          </div>
        </div>

        {/* Related reviews */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Related reviews
          </h2>
          <p className="text-sm text-gray-400">
            Reviews linked to this incident will appear here once Google Play
            sync is connected.
          </p>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">
            Timeline
          </h2>
          <ol className="relative border-l border-gray-200 ml-2 space-y-4">
            <li className="ml-4">
              <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-gray-300" />
              <p className="text-xs font-semibold text-gray-700">
                Incident detected
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {incident.detectedAt}
              </p>
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
