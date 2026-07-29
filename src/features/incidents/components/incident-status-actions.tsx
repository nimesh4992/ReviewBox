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
        className="h-8 border-[var(--rb-border-1)] text-fg-2 hover:bg-[var(--rb-amber-500)]/10 hover:border-[var(--rb-amber-500)]/40 hover:text-[var(--rb-amber-500)] disabled:opacity-40"
      >
        Mark Investigating
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={saving || status === "resolved"}
        onClick={() => updateStatus("resolved")}
        className="h-8 border-[var(--rb-border-1)] text-fg-2 hover:bg-[var(--rb-green-500)]/10 hover:border-[var(--rb-green-500)]/40 hover:text-[var(--rb-green-500)] disabled:opacity-40"
      >
        Mark Resolved
      </Button>
    </div>
  );
}
