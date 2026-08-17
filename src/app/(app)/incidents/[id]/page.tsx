import Link from "next/link";
import { ArrowLeft, Clock, User } from "lucide-react";
import { auth } from "@clerk/nextjs/server";

import { PageHeader } from "@/components/layout/page-header";
import { IncidentStatusActions } from "@/features/incidents/components/incident-status-actions";
import { getWorkspaceId } from "@/lib/supabase-server";
import { getIncidentDetail, type DbIncident } from "@/services/incident-service";
import { cn } from "@/lib/utils";
import type { IncidentAlert } from "@/types/review";

export const dynamic = "force-dynamic";

// ── DB row → view model ───────────────────────────────────────────────────────
// The row shape and the query both live in services/incident-service.ts so this
// page and GET /api/incidents/[id] cannot drift apart.

function mapIncident(row: DbIncident): IncidentAlert & { resolvedAt?: string } {
  return {
    id:          row.id,
    title:       row.title,
    description: row.description ?? "",
    severity:    row.severity,
    status:      row.status,
    owner:       row.owner ?? "Unassigned",
    detectedAt:  new Date(row.detected_at).toLocaleString("en-US", {
                   month: "short", day: "numeric",
                   hour: "numeric", minute: "2-digit",
                 }),
    resolvedAt:  row.resolved_at
                   ? new Date(row.resolved_at).toLocaleString("en-US", {
                       month: "short", day: "numeric",
                       hour: "numeric", minute: "2-digit",
                     })
                   : undefined,
  };
}

// ── Severity + status styling ─────────────────────────────────────────────────

const SEVERITY_STYLES: Record<
  IncidentAlert["severity"],
  { bar: string; badge: string; label: string }
> = {
  critical: {
    bar:   "bg-[var(--rb-red-400)]",
    badge: "bg-[var(--rb-red-500)]/10 text-[var(--rb-red-500)] border border-[var(--rb-red-500)]/25",
    label: "Critical",
  },
  high: {
    bar:   "bg-[var(--rb-amber-500)]",
    badge: "bg-[var(--rb-amber-500)]/10 text-[var(--rb-amber-500)] border border-[var(--rb-amber-500)]/25",
    label: "High",
  },
  medium: {
    bar:   "bg-[var(--rb-border-3)]",
    badge: "bg-[var(--rb-bg-sunken)] text-fg-2 border border-[var(--rb-border-1)]",
    label: "Medium",
  },
};

const STATUS_STYLES: Record<
  IncidentAlert["status"],
  { badge: string; label: string }
> = {
  active:       { badge: "bg-[var(--rb-red-500)]/10 text-[var(--rb-red-500)] border border-[var(--rb-red-500)]/25",           label: "Active" },
  investigating:{ badge: "bg-[var(--rb-amber-500)]/10 text-[var(--rb-amber-500)] border border-[var(--rb-amber-500)]/25",     label: "Investigating" },
  resolved:     { badge: "bg-[var(--rb-green-500)]/10 text-[var(--rb-green-500)] border border-[var(--rb-green-500)]/25", label: "Resolved" },
};

// ── Page ──────────────────────────────────────────────────────────────────────

interface IncidentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function IncidentDetailPage({
  params,
}: IncidentDetailPageProps) {
  const { id } = await params;

  // ── Auth + workspace ──────────────────────────────────────────────────────
  const session = await auth();
  const userId  = session?.userId;

  let incident: (IncidentAlert & { resolvedAt?: string }) | null = null;

  if (userId) {
    const workspaceId = await getWorkspaceId(userId);
    if (workspaceId) {
      const row = await getIncidentDetail(workspaceId, id);
      if (row) incident = mapIncident(row);
    }
  }

  // ── Not found ─────────────────────────────────────────────────────────────
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
            className="inline-flex items-center gap-1.5 text-sm text-[#0A84FF] hover:underline"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
            Back to incidents
          </Link>
        </div>
      </div>
    );
  }

  const sev    = SEVERITY_STYLES[incident.severity];
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
          className="inline-flex items-center gap-1.5 text-sm text-fg-3 hover:text-fg-1 transition-colors"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          Back to incidents
        </Link>

        {/* Main card */}
        <div className="overflow-hidden rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-sm">
          <div className={cn("h-1 w-full", sev.bar)} />
          <div className="p-5 space-y-4">
            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", sev.badge)}>
                {sev.label}
              </span>
              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", status.badge)}>
                {status.label}
              </span>
            </div>

            {/* Description */}
            <p className="text-sm leading-6 text-fg-2">{incident.description}</p>

            {/* Meta */}
            <div className="flex flex-wrap items-center gap-5 text-xs text-fg-3">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" strokeWidth={1.5} />
                Detected {incident.detectedAt}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="size-3.5" strokeWidth={1.5} />
                {incident.owner}
              </span>
              {incident.resolvedAt && (
                <span className="flex items-center gap-1.5 text-[var(--rb-green-500)]">
                  <Clock className="size-3.5" strokeWidth={1.5} />
                  Resolved {incident.resolvedAt}
                </span>
              )}
            </div>

            {/* Status actions — client component */}
            {incident.status !== "resolved" && (
              <IncidentStatusActions
                incidentId={incident.id}
                currentStatus={incident.status}
              />
            )}
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-sm p-5">
          <h2 className="text-sm font-semibold text-fg-1 mb-4">Timeline</h2>
          <ol className="relative border-l border-[var(--rb-border-1)] ml-2 space-y-4">
            <li className="ml-4">
              <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-[var(--rb-bg-surface)] bg-[var(--rb-border-3)]" />
              <p className="text-xs font-semibold text-fg-2">Incident detected</p>
              <p className="text-xs text-fg-3 mt-0.5">{incident.detectedAt}</p>
            </li>
            {incident.status === "investigating" && (
              <li className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-[var(--rb-amber-500)]" />
                <p className="text-xs font-semibold text-[var(--rb-amber-500)]">Investigation started</p>
                <p className="text-xs text-fg-3 mt-0.5">{incident.owner}</p>
              </li>
            )}
            {incident.resolvedAt && (
              <li className="ml-4">
                <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-white bg-[var(--rb-green-500)]" />
                <p className="text-xs font-semibold text-[var(--rb-green-500)]">Resolved</p>
                <p className="text-xs text-fg-3 mt-0.5">{incident.resolvedAt}</p>
              </li>
            )}
          </ol>
        </div>
      </div>
    </div>
  );
}
