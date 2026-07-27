"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Append an admin reply or internal note to a ticket thread.
 * Replies are stored only — nothing is emailed (D009 #6); the founder sends
 * the actual email from hello@tryreviewbox.com.
 */
export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, isInternal }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "Couldn't save — try again.");
        return;
      }
      setBody("");
      setIsInternal(false);
      router.refresh();
    } catch {
      setError("Couldn't save — check your connection.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        maxLength={5000}
        placeholder={isInternal ? "Internal note (customer never sees this)…" : "Write a reply…"}
        className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-xs text-gray-500">
          <input
            type="checkbox"
            checked={isInternal}
            onChange={(e) => setIsInternal(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          Internal note
        </label>
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="h-8 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
        >
          {sending ? "Saving…" : isInternal ? "Add note" : "Add reply"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      <p className="mt-2 text-[11px] text-gray-400">
        Saved to the thread only — nothing is emailed automatically. Send the actual reply from
        hello@tryreviewbox.com.
      </p>
    </form>
  );
}
