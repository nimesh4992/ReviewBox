"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Contact-support card: files a ticket via POST /api/support/tickets.
 * The team works tickets at /admin/tickets and replies by email.
 */
export function SupportSection() {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        setError(payload?.error?.message ?? "Couldn't send — email hello@tryreviewbox.com instead.");
        return;
      }
      setSent(true);
      setSubject("");
      setBody("");
    } catch {
      setError("Couldn't send — email hello@tryreviewbox.com instead.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Contact support</h2>
      <p className="mt-0.5 text-xs text-gray-400">
        We reply by email, usually within one business day.
      </p>

      {sent ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-800">Got it — we&apos;re on it.</p>
          <p className="mt-0.5 text-xs text-emerald-700">
            We&apos;ll reply to your account email.{" "}
            <button
              type="button"
              onClick={() => setSent(false)}
              className="underline hover:no-underline"
            >
              Send another
            </button>
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-3.5">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Subject</span>
            <Input
              type="text"
              required
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What do you need help with?"
              className="mt-1.5 h-8 border-gray-200 bg-gray-50 text-sm text-gray-700 focus:bg-white"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Message</span>
            <textarea
              required
              rows={4}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="The more detail, the faster we can help."
              className="mt-1.5 w-full resize-y rounded-md border border-gray-200 bg-gray-50 p-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:bg-white focus:outline-none"
            />
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button type="submit" disabled={sending || !subject.trim() || !body.trim()} className="h-8 w-full">
            {sending ? "Sending…" : "Send to support"}
          </Button>
        </form>
      )}
    </div>
  );
}
