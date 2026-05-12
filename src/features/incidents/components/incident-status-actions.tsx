"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { IncidentStatus } from "@/types/review";

interface IncidentStatusActionsProps {
  incidentId: string;
  currentStatus: IncidentStatus;
}

export function IncidentStatusActions({
  incidentId,
  currentStatus,
}: IncidentStatusActionsProps) {
  const [status, setStatus] = useState<IncidentStatus>(currentStatus);
  const [saving, setSaving] = useState(false);

  async function updateStatus(next: IncidentStatus) {
    setSaving(true);
    try {
      await fetch(`/api/incidents/${incidentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      setStatus(next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      <Button
        size="sm"
        variant="outline"
        disabled={saving || status === "investigating"}
        onClick={() => updateStatus("investigating")}
        className="h-8 border-gray-200 text-gray-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 disabled:opacity-40"
      >
        Mark Investigating
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={saving || status === "resolved"}
        onClick={() => updateStatus("resolved")}
        className="h-8 border-gray-200 text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 disabled:opacity-40"
      >
        Mark Resolved
      </Button>
    </div>
  );
}
