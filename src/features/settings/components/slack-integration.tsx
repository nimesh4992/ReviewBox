"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, ExternalLink, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function SlackIntegration() {
  const [webhookUrl, setWebhookUrl]   = useState("");
  const [saved,      setSaved]        = useState<string | null>(null); // saved URL from DB
  const [loading,    setLoading]      = useState(true);
  const [saving,     setSaving]       = useState(false);
  const [testing,    setTesting]      = useState(false);
  const [testResult, setTestResult]   = useState<"success" | "error" | null>(null);
  const [error,      setError]        = useState<string | null>(null);

  // Load saved URL on mount
  useEffect(() => {
    fetch("/api/settings/workspace")
      .then((r) => r.json())
      .then((d: { slackWebhookUrl?: string | null }) => {
        const url = d.slackWebhookUrl ?? null;
        setSaved(url);
        setWebhookUrl(url ?? "");
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    const trimmed = webhookUrl.trim();
    if (trimmed && !trimmed.startsWith("https://hooks.slack.com/")) {
      setError("Must be a Slack Incoming Webhook URL (https://hooks.slack.com/...)");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/workspace", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ slackWebhookUrl: trimmed || null }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(trimmed || null);
    } catch {
      setError("Failed to save. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    const url = webhookUrl.trim();
    if (!url) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/settings/slack/test", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ webhookUrl: url }),
      });
      setTestResult(res.ok ? "success" : "error");
    } catch {
      setTestResult("error");
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  }

  async function handleDisconnect() {
    setSaving(true);
    try {
      await fetch("/api/settings/workspace", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ slackWebhookUrl: null }),
      });
      setSaved(null);
      setWebhookUrl("");
    } finally {
      setSaving(false);
    }
  }

  const isConnected = !!saved;
  const isDirty     = webhookUrl.trim() !== (saved ?? "");

  return (
    <div className="rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--rb-border-1)] px-5 py-4">
        {/* Slack logo mark */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-label="Slack">
          <path d="M6.2 14.7a2.1 2.1 0 1 1-2.1-2.1h2.1v2.1Zm1.05 0a2.1 2.1 0 0 1 4.2 0v5.25a2.1 2.1 0 1 1-4.2 0V14.7Z" fill="#E01E5A"/>
          <path d="M9.3 6.2a2.1 2.1 0 1 1 2.1-2.1v2.1H9.3Zm0 1.05a2.1 2.1 0 0 1 0 4.2H4.05a2.1 2.1 0 1 1 0-4.2H9.3Z" fill="#36C5F0"/>
          <path d="M17.8 9.3a2.1 2.1 0 1 1 2.1 2.1H17.8V9.3Zm-1.05 0a2.1 2.1 0 0 1-4.2 0V4.05a2.1 2.1 0 1 1 4.2 0V9.3Z" fill="#2EB67D"/>
          <path d="M14.7 17.8a2.1 2.1 0 1 1-2.1 2.1V17.8h2.1Zm0-1.05a2.1 2.1 0 0 1 0-4.2h5.25a2.1 2.1 0 1 1 0 4.2H14.7Z" fill="#ECB22E"/>
        </svg>
        <div className="flex-1">
          <div className="text-[14px] font-semibold text-fg-1">Slack</div>
          <div className="text-[12px] text-fg-3">
            Get alerts for rating spikes, incidents, and urgent reviews
          </div>
        </div>
        {isConnected && (
          <span className="flex items-center gap-1.5 rounded-full bg-[#1F8A5B]/10 px-2.5 py-1 text-[11px] font-semibold text-[#1F8A5B]">
            <CheckCircle2 size={11} />
            Connected
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-[13px] text-fg-3">
            <Loader2 size={13} className="animate-spin" />
            Loading…
          </div>
        ) : (
          <>
            {/* Setup guide */}
            {!isConnected && (
              <div className="rounded-[10px] bg-[var(--rb-bg-sunken)] px-4 py-3 text-[12px] text-fg-2 space-y-1">
                <p className="font-semibold text-fg-1">How to connect</p>
                <ol className="list-decimal list-inside space-y-1 text-fg-2">
                  <li>Go to your Slack workspace → <strong>Apps</strong> → search <strong>Incoming Webhooks</strong></li>
                  <li>Click <strong>Add to Slack</strong> → choose a channel → <strong>Allow</strong></li>
                  <li>Copy the <strong>Webhook URL</strong> and paste it below</li>
                </ol>
                <a
                  href="https://api.slack.com/messaging/webhooks"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#0A84FF] hover:underline mt-1"
                >
                  Slack docs <ExternalLink size={10} />
                </a>
              </div>
            )}

            {/* Webhook URL input */}
            <div className="space-y-1.5">
              <label className="text-[12px] font-medium text-fg-2">
                Webhook URL
              </label>
              <input
                type="url"
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                value={webhookUrl}
                onChange={(e) => { setWebhookUrl(e.target.value); setError(null); }}
                className={cn(
                  "w-full rounded-[8px] border bg-[var(--rb-bg-sunken)] px-3 py-2 text-[13px] text-fg-1 placeholder:text-fg-3 outline-none transition-colors",
                  error
                    ? "border-[#DC2626] focus:border-[#DC2626]"
                    : "border-[var(--rb-border-2)] focus:border-[#0A84FF]",
                )}
              />
              {error && <p className="text-[11px] text-[#DC2626]">{error}</p>}
            </div>

            {/* Which events */}
            <div className="space-y-1.5">
              <p className="text-[12px] font-medium text-fg-2">Sends alerts for</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: "⚠️", label: "Rating spikes" },
                  { icon: "🚨", label: "New incidents" },
                  { icon: "🔴", label: "Urgent reviews" },
                ].map((e) => (
                  <span
                    key={e.label}
                    className="flex items-center gap-1.5 rounded-full border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-2.5 py-1 text-[11px] font-medium text-fg-2"
                  >
                    {e.icon} {e.label}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving || !isDirty}
                className="h-[30px] rounded-[7px] bg-[#0A84FF] px-4 text-[12px] font-semibold text-white hover:bg-[#006EE0] disabled:opacity-40 transition-colors"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : isConnected && !isDirty ? "Saved" : "Save"}
              </button>

              {webhookUrl.trim() && (
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="h-[30px] rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-4 text-[12px] font-semibold text-fg-1 hover:bg-[var(--rb-bg-hover)] disabled:opacity-40 transition-colors"
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : "Send test"}
                </button>
              )}

              {testResult === "success" && (
                <span className="flex items-center gap-1 text-[12px] font-semibold text-[#1F8A5B]">
                  <CheckCircle2 size={13} /> Message sent!
                </span>
              )}
              {testResult === "error" && (
                <span className="text-[12px] font-semibold text-[#DC2626]">
                  Failed — check your URL
                </span>
              )}

              {isConnected && (
                <button
                  onClick={handleDisconnect}
                  disabled={saving}
                  className="ml-auto flex items-center gap-1.5 text-[12px] text-fg-3 hover:text-[#DC2626] transition-colors"
                >
                  <Trash2 size={12} />
                  Disconnect
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
