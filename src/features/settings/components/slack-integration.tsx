"use client";

import { useCallback, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, CircleAlert, Loader2, ExternalLink, Siren, Trash2, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LoadErrorState } from "@/components/load-error-state";

// When NEXT_PUBLIC_SLACK_CLIENT_ID is not set, the existing paste-URL
// fallback is rendered — no change for workspaces that already have a
// webhook URL saved manually.
const OAUTH_ENABLED = Boolean(process.env.NEXT_PUBLIC_SLACK_CLIENT_ID);

interface SlackStatus {
  connected:   boolean;
  channelName: string | null;
  teamName:    string | null;
}

export function SlackIntegration() {
  const searchParams = useSearchParams();

  // ── OAuth mode state ─────────────────────────────────────────────────────────
  const [status,       setStatus]       = useState<SlackStatus | null>(null);
  const [statusLoading,setStatusLoading]= useState(OAUTH_ENABLED);
  const [disconnecting,setDisconnecting]= useState(false);
  const [toast,        setToast]        = useState<{ type: "success"|"error"; msg: string } | null>(null);
  /** The status/settings READ failed — distinct from "you have not connected Slack". */
  const [loadFailed,   setLoadFailed]   = useState(false);

  // ── Paste-URL mode state ─────────────────────────────────────────────────────
  const [webhookUrl,  setWebhookUrl]  = useState("");
  const [saved,       setSaved]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(!OAUTH_ENABLED);
  const [saving,      setSaving]      = useState(false);
  const [testing,     setTesting]     = useState(false);
  const [testResult,  setTestResult]  = useState<"success"|"error"|null>(null);
  const [error,       setError]       = useState<string | null>(null);

  function showToast(type: "success"|"error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  }

  /**
   * "We could not ask" is not "you are not connected".
   *
   * Both branches parsed the response without checking `res.ok`, and both
   * routes answer a failure with a JSON error envelope — so `res.json()`
   * resolved, `connected`/`slackWebhookConfigured` came back undefined, and the
   * card rendered its *disconnected* state. On the OAuth branch the old
   * `.catch()` asserted `connected: false` outright, which is the same claim
   * made deliberately.
   *
   * The cost is not cosmetic. A customer shown "not connected" reconnects: they
   * re-run OAuth, or paste a fresh webhook URL over a working one. Either is
   * work caused by a transient 500, and the second silently replaces a live
   * integration.
   */
  const loadConnection = useCallback(async () => {
    setLoadFailed(false);
    if (OAUTH_ENABLED) {
      setStatusLoading(true);
      try {
        const res = await fetch("/api/settings/slack/status");
        if (!res.ok) throw new Error(`slack status failed: ${res.status}`);
        setStatus((await res.json()) as SlackStatus);
      } catch {
        setStatus(null);
        setLoadFailed(true);
      } finally {
        setStatusLoading(false);
      }
      return;
    }

    // Paste-URL mode: load saved webhook from workspace settings
    setLoading(true);
    try {
      const res = await fetch("/api/settings/workspace");
      if (!res.ok) throw new Error(`workspace settings failed: ${res.status}`);
      const d = (await res.json()) as {
        slackWebhookConfigured?: boolean;
        slackWebhookHint?: string | null;
      };
      // The saved URL is deliberately not returned by the API — it is a
      // bearer secret. We show that one is configured and a tail hint;
      // changing it requires pasting a new URL in full.
      setSaved(d.slackWebhookConfigured ? (d.slackWebhookHint ?? "configured") : null);
      setWebhookUrl("");
    } catch {
      setSaved(null);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadConnection(); }, [loadConnection]);

  // Handle ?slack=connected and ?slack=error query params on first render
  useEffect(() => {
    const slackParam = searchParams.get("slack");
    const reason     = searchParams.get("reason");
    if (slackParam === "connected") {
      showToast("success", "Slack connected successfully.");
      if (OAUTH_ENABLED) void loadConnection();
    } else if (slackParam === "error") {
      const msg =
        reason === "csrf"         ? "Connection failed: security check failed. Please try again." :
        reason === "rate_limited" ? "Too many attempts. Please wait and try again." :
        reason === "slack_error"  ? "Slack rejected the connection. Please try again." :
        "Could not connect to Slack. Please try again.";
      showToast("error", msg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/settings/slack", { method: "DELETE" });
      if (res.ok) {
        setStatus({ connected: false, channelName: null, teamName: null });
        showToast("success", "Slack disconnected.");
      } else {
        showToast("error", "Failed to disconnect. Please try again.");
      }
    } catch {
      showToast("error", "Failed to disconnect. Please try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  // ── Paste-URL handlers ───────────────────────────────────────────────────────
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

  async function handleDisconnectPasteUrl() {
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

  const isConnectedViaUrl = !!saved;
  // `saved` is a masked hint now, not the URL, so it cannot be compared against
  // the input. There is something to save exactly when the field has content —
  // which is also the correct rule for rotating a secret you can no longer read
  // back.
  const isDirty           = webhookUrl.trim().length > 0;

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
        {/* Connected badge */}
        {(OAUTH_ENABLED ? status?.connected : isConnectedViaUrl) && (
          <span className="flex items-center gap-1.5 rounded-full bg-[#1F8A5B]/10 px-2.5 py-1 text-[11px] font-semibold text-[#1F8A5B]">
            <CheckCircle2 size={11} />
            Connected
          </span>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={cn(
          "mx-5 mt-4 rounded-[8px] px-4 py-2.5 text-[12px] font-medium",
          toast.type === "success"
            ? "bg-[#1F8A5B]/10 text-[#1F8A5B]"
            : "bg-[#DC2626]/10 text-[#DC2626]",
        )}>
          {toast.msg}
        </div>
      )}

      {/* Body */}
      <div className="px-5 py-4 space-y-4">

        {/* The read failed. Showing neither the "connect" flow nor a
            "connected" badge is the point — we do not know which is true, and
            guessing wrong costs the customer a working integration. */}
        {loadFailed ? (
          <LoadErrorState
            subject="your Slack connection"
            onRetry={() => void loadConnection()}
            retrying={OAUTH_ENABLED ? statusLoading : loading}
            compact
          />
        ) : OAUTH_ENABLED ? (
          statusLoading ? (
            <div className="flex items-center gap-2 text-[13px] text-fg-3">
              <Loader2 size={13} className="animate-spin" />
              Loading…
            </div>
          ) : status?.connected ? (
            /* Connected state */
            <div className="space-y-3">
              <div className="rounded-[10px] bg-[var(--rb-bg-sunken)] px-4 py-3">
                <p className="text-[13px] font-medium text-fg-1">
                  Connected to{" "}
                  <span className="font-mono text-[#0A84FF]">#{status.channelName}</span>
                </p>
                {status.teamName && (
                  <p className="mt-0.5 text-[12px] text-fg-3">{status.teamName}</p>
                )}
              </div>
              <AlertTypePills />
              <div className="flex items-center pt-1">
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="ml-auto flex items-center gap-1.5 text-[12px] text-fg-3 hover:text-[#DC2626] transition-colors disabled:opacity-40"
                >
                  {disconnecting
                    ? <Loader2 size={12} className="animate-spin" />
                    : <Trash2 size={12} />}
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            /* Not connected — OAuth button */
            <div className="space-y-3">
              <div className="rounded-[10px] bg-[var(--rb-bg-sunken)] px-4 py-3 text-[12px] text-fg-2 space-y-1">
                <p className="font-semibold text-fg-1">Connect in two clicks</p>
                <ol className="list-decimal list-inside space-y-1 text-fg-2">
                  <li>Click <strong>Add to Slack</strong> below</li>
                  <li>Pick a channel in your Slack workspace and click <strong>Allow</strong></li>
                  <li>You&rsquo;re redirected back here — done</li>
                </ol>
              </div>
              <AlertTypePills />
              <a
                href="/api/auth/slack/authorize"
                className="inline-flex items-center gap-2 h-[34px] rounded-[8px] bg-[#4A154B] px-4 text-[13px] font-semibold text-white hover:bg-[#3b1040] transition-colors"
              >
                {/* Slack logo (white tinted) */}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6.2 14.7a2.1 2.1 0 1 1-2.1-2.1h2.1v2.1Zm1.05 0a2.1 2.1 0 0 1 4.2 0v5.25a2.1 2.1 0 1 1-4.2 0V14.7Z" fill="white" fillOpacity=".9"/>
                  <path d="M9.3 6.2a2.1 2.1 0 1 1 2.1-2.1v2.1H9.3Zm0 1.05a2.1 2.1 0 0 1 0 4.2H4.05a2.1 2.1 0 1 1 0-4.2H9.3Z" fill="white" fillOpacity=".9"/>
                  <path d="M17.8 9.3a2.1 2.1 0 1 1 2.1 2.1H17.8V9.3Zm-1.05 0a2.1 2.1 0 0 1-4.2 0V4.05a2.1 2.1 0 1 1 4.2 0V9.3Z" fill="white" fillOpacity=".9"/>
                  <path d="M14.7 17.8a2.1 2.1 0 1 1-2.1 2.1V17.8h2.1Zm0-1.05a2.1 2.1 0 0 1 0-4.2h5.25a2.1 2.1 0 1 1 0 4.2H14.7Z" fill="white" fillOpacity=".9"/>
                </svg>
                Add to Slack
                <ExternalLink size={11} className="opacity-70" />
              </a>
            </div>
          )
        ) : (
          /* ── Paste-URL fallback (NEXT_PUBLIC_SLACK_CLIENT_ID not set) ─── */
          loading ? (
            <div className="flex items-center gap-2 text-[13px] text-fg-3">
              <Loader2 size={13} className="animate-spin" />
              Loading…
            </div>
          ) : (
            <>
              {!isConnectedViaUrl && (
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

              <div className="space-y-1.5">
                <label className="text-[12px] font-medium text-fg-2">Webhook URL</label>
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

              <AlertTypePills />

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="h-[30px] rounded-[7px] bg-[#0A84FF] px-4 text-[12px] font-semibold text-white hover:bg-[#006EE0] disabled:bg-[var(--rb-bg-sunken)] disabled:text-fg-3 disabled:border disabled:border-[var(--rb-border-2)] transition-colors"
                >
                  {saving ? <Loader2 size={12} className="animate-spin" /> : isConnectedViaUrl && !isDirty ? "Saved" : "Save"}
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

                {isConnectedViaUrl && (
                  <button
                    onClick={handleDisconnectPasteUrl}
                    disabled={saving}
                    className="ml-auto flex items-center gap-1.5 text-[12px] text-fg-3 hover:text-[#DC2626] transition-colors"
                  >
                    <Trash2 size={12} />
                    Disconnect
                  </button>
                )}
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}

function AlertTypePills() {
  return (
    <div className="space-y-1.5">
      <p className="text-[12px] font-medium text-fg-2">Sends alerts for</p>
      <div className="flex flex-wrap gap-2">
        {[
          { icon: TrendingDown, label: "Rating spikes" },
          { icon: Siren,        label: "New incidents" },
          { icon: CircleAlert,  label: "Urgent reviews" },
        ].map((e) => (
          <span
            key={e.label}
            className="flex items-center gap-1.5 rounded-full border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-2.5 py-1 text-[11px] font-medium text-fg-2"
          >
            <e.icon size={11} strokeWidth={1.5} className="text-fg-3" /> {e.label}
          </span>
        ))}
      </div>
    </div>
  );
}
