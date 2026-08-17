"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { IncidentAlert, IncidentStatus } from "@/types/review";

// ── List ──────────────────────────────────────────────────────────────────────

/**
 * @param appId Scope to one app (sidebar selector, via `resolveSelectedApp`).
 *              Workspace-level incidents — those with no app — are always
 *              included. Undefined = every live app.
 */
export function useIncidents(appId?: string) {
  return useQuery<IncidentAlert[]>({
    // appId in the key: without it, switching apps served the previous app's
    // incidents from cache.
    queryKey: ["incidents", appId ?? "all"],
    queryFn: async () => {
      const res = await fetch(`/api/incidents${appId ? `?appId=${encodeURIComponent(appId)}` : ""}`);
      if (!res.ok) throw new Error("Failed to fetch incidents");
      const json = (await res.json()) as { incidents?: ApiIncident[] };
      return (json.incidents ?? []).map(mapRow);
    },
    staleTime: 30_000,
  });
}

// ── Create ────────────────────────────────────────────────────────────────────

export interface CreateIncidentInput {
  title:        string;
  description?: string;
  severity:     "critical" | "high" | "medium";
  appName?:     string;
  /** Which app this incident is about; omitted = workspace-level. */
  appId?:       string;
}

export function useCreateIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateIncidentInput) => {
      const res = await fetch("/api/incidents", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create incident");
      return (await res.json()) as { incident: ApiIncident };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });
}

// ── Status patch ──────────────────────────────────────────────────────────────

export function usePatchIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: IncidentStatus }) => {
      const res = await fetch(`/api/incidents/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update incident");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["incidents"] }),
  });
}

// ── Row mapper ────────────────────────────────────────────────────────────────

interface ApiIncident {
  id:          string;
  title:       string;
  description: string | null;
  severity:    "critical" | "high" | "medium";
  owner:       string | null;
  status:      IncidentStatus;
  detected_at: string;
  resolved_at: string | null;
}

function mapRow(r: ApiIncident): IncidentAlert {
  return {
    id:          r.id,
    title:       r.title,
    description: r.description ?? "",
    severity:    r.severity,
    owner:       r.owner ?? "Unassigned",
    detectedAt:  formatDetectedAt(r.detected_at),
    status:      r.status,
  };
}

function formatDetectedAt(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 2)   return "Just now";
  if (mins < 60)  return `Detected ${mins} min ago`;
  if (hours < 24) return `Detected ${hours}h ago`;
  return `Detected ${days}d ago`;
}
