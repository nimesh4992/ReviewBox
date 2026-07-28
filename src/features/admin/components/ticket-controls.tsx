"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { TICKET_PRIORITIES, TICKET_STATUSES } from "@/lib/support-tickets";
import type { ReviewPriority, SupportTicketStatus } from "@/types/review";

interface TicketControlsProps {
  ticketId: string;
  status: SupportTicketStatus;
  priority: ReviewPriority;
}

const SELECT_CLASSES =
  "h-8 rounded-lg border border-gray-200 bg-white px-2 text-sm text-gray-700 capitalize focus:border-gray-400 focus:outline-none disabled:opacity-50";

/** Status + priority dropdowns that save on change. */
export function TicketControls({ ticketId, status, priority }: TicketControlsProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(patch: { status?: string; priority?: string }) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(body?.error?.message ?? "Couldn't save — try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("Couldn't save — check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        Status
        <select
          className={SELECT_CLASSES}
          defaultValue={status}
          disabled={saving}
          onChange={(e) => save({ status: e.target.value })}
        >
          {TICKET_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
        Priority
        <select
          className={SELECT_CLASSES}
          defaultValue={priority}
          disabled={saving}
          onChange={(e) => save({ priority: e.target.value })}
        >
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      {saving && <span className="text-xs text-gray-400">Saving…</span>}
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
