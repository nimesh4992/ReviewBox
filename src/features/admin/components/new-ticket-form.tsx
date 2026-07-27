"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { TICKET_PRIORITIES } from "@/lib/support-tickets";

const INPUT_CLASSES =
  "h-9 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none";
const LABEL_CLASSES = "block text-xs font-medium text-gray-600";

/** Founder logs a ticket that arrived by email so all support lives in one queue. */
export function NewTicketForm() {
  const router = useRouter();
  const [requesterEmail, setRequesterEmail] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState("normal");
  const [source, setSource] = useState("email");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterEmail, requesterName, subject, body, priority, source }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { ticketId?: string; error?: { message?: string } }
        | null;
      if (!res.ok || !payload?.ticketId) {
        setError(payload?.error?.message ?? "Couldn't create the ticket — try again.");
        return;
      }
      router.push(`/admin/tickets/${payload.ticketId}`);
    } catch {
      setError("Couldn't create the ticket — check your connection.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="max-w-xl space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL_CLASSES}>
          Requester email *
          <input
            type="email"
            required
            value={requesterEmail}
            onChange={(e) => setRequesterEmail(e.target.value)}
            placeholder="customer@example.com"
            className={`mt-1.5 ${INPUT_CLASSES}`}
          />
        </label>
        <label className={LABEL_CLASSES}>
          Requester name
          <input
            type="text"
            value={requesterName}
            onChange={(e) => setRequesterName(e.target.value)}
            placeholder="Jane Doe"
            className={`mt-1.5 ${INPUT_CLASSES}`}
          />
        </label>
      </div>

      <label className={LABEL_CLASSES}>
        Subject *
        <input
          type="text"
          required
          maxLength={200}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Sync stopped working"
          className={`mt-1.5 ${INPUT_CLASSES}`}
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={LABEL_CLASSES}>
          Priority
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={`mt-1.5 ${INPUT_CLASSES} capitalize`}
          >
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL_CLASSES}>
          Arrived via
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className={`mt-1.5 ${INPUT_CLASSES}`}
          >
            <option value="email">Email</option>
            <option value="manual">Other / manual</option>
          </select>
        </label>
      </div>

      <label className={LABEL_CLASSES}>
        Message *
        <textarea
          required
          rows={5}
          maxLength={5000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Paste the customer's message…"
          className="mt-1.5 w-full resize-y rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none"
        />
      </label>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="h-9 rounded-lg bg-gray-900 px-5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
      >
        {saving ? "Creating…" : "Create ticket"}
      </button>
    </form>
  );
}
