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
    <div className="rounded-xl border border-[var(--rb-border-1)] bg-surface p-6 shadow-[var(--rb-shadow-xs)]">
      <h2 className="text-[15px] font-semibold text-fg-1">Contact support</h2>
      <p className="mt-1 text-[13px] text-fg-3">
        We reply by email, usually within one business day.
      </p>

      {sent ? (
        <div className="mt-4 rounded-lg border border-[var(--rb-green-500)]/25 bg-[var(--rb-green-500)]/10 p-3">
          <p className="text-sm font-medium text-[var(--rb-green-500)]">Got it — we&apos;re on it.</p>
          <p className="mt-0.5 text-xs text-[var(--rb-green-500)]/90">
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
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block">
            <span className="text-[13px] font-medium text-fg-2">Subject</span>
            <Input
              type="text"
              required
              maxLength={200}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="What do you need help with?"
              className="mt-2 h-10 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-[13px] font-medium text-fg-2">Message</span>
            <textarea
              required
              rows={4}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="The more detail, the faster we can help."
              className="mt-2 w-full resize-y rounded-lg border border-[var(--rb-border-2)] bg-[var(--rb-bg-sunken)] p-3 text-sm text-fg-1 placeholder:text-fg-3"
            />
          </label>
          {error && <p className="text-xs text-[var(--rb-red-500)]">{error}</p>}
          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              size="sm"
              disabled={sending || !subject.trim() || !body.trim()}
              className="h-10 px-5 disabled:bg-[var(--rb-bg-sunken)] disabled:text-fg-3 disabled:opacity-100"
            >
              {sending ? "Sending…" : "Send to support"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
