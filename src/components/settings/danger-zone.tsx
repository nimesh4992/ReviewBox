"use client";

import { useState } from "react";
import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";

export function DangerZone() {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch("/api/gdpr/export", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? "Couldn't generate export.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reviewbox-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate export.");
    } finally {
      setExporting(false);
    }
  }

  async function handleCancel() {
    if (confirmText.trim().toLowerCase() !== "delete") return;
    setCanceling(true);
    setError(null);
    try {
      const res = await fetch("/api/account/cancel", { method: "POST" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(data.error?.message ?? "Couldn't cancel account.");
      }
      // Force fresh session so middleware sees accountDeletedAt
      window.location.href = "/account-deleted";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel account.");
      setCanceling(false);
    }
  }

  return (
    <section className="rounded-[14px] border border-red-200/60 bg-white shadow-[var(--rb-shadow-xs)]">
      <div className="border-b border-red-100 bg-red-50/40 px-5 py-3.5">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-red-600" strokeWidth={1.5} />
          <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-[#1D1D1F]">
            Danger zone
          </h2>
        </div>
        <p className="mt-0.5 text-[12px] text-[var(--rb-fg-3)]">
          Export your data or permanently delete your workspace.
        </p>
      </div>

      {error && (
        <div className="mx-5 mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* Export */}
      <div className="flex items-center justify-between gap-4 border-b border-[var(--rb-border-1)] px-5 py-4">
        <div>
          <div className="text-[13px] font-semibold text-[#1D1D1F]">Export your data</div>
          <div className="mt-0.5 text-[12px] text-[var(--rb-fg-3)]">
            Download all reviews, replies, automations, templates, and audit logs as JSON.
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-black/[0.08] bg-white px-3 text-[12px] font-semibold text-[#48484D] transition-colors hover:bg-[#F5F5F7] disabled:opacity-50"
        >
          {exporting ? (
            <>
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
              Preparing…
            </>
          ) : (
            <>
              <Download className="size-3.5" strokeWidth={1.5} />
              Download
            </>
          )}
        </button>
      </div>

      {/* Cancel account */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[13px] font-semibold text-[#1D1D1F]">Delete account</div>
            <div className="mt-0.5 text-[12px] text-[var(--rb-fg-3)]">
              Your workspace will be scheduled for deletion. You have 30 days to restore.
              After that, all data is permanently erased.
            </div>
          </div>
          {!confirming && (
            <button
              onClick={() => setConfirming(true)}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-red-200 bg-white px-3 text-[12px] font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              <Trash2 className="size-3.5" strokeWidth={1.5} />
              Delete…
            </button>
          )}
        </div>

        {confirming && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50/60 p-4">
            <p className="text-[13px] font-semibold text-red-900">
              Type <span className="font-mono">DELETE</span> to confirm.
            </p>
            <p className="mt-1 text-[12px] text-red-800">
              All apps, reviews, replies, automations, templates, knowledge base entries,
              and team members will be removed after 30 days.
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-3 h-9 w-full rounded-md border border-red-200 bg-white px-3 font-mono text-[13px] text-[#1D1D1F] outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100"
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleCancel}
                disabled={confirmText.trim().toLowerCase() !== "delete" || canceling}
                className="flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-3.5 text-[12px] font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-40"
              >
                {canceling ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
                    Canceling…
                  </>
                ) : (
                  "Permanently delete in 30 days"
                )}
              </button>
              <button
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                }}
                disabled={canceling}
                className="h-9 rounded-md border border-black/[0.08] bg-white px-3.5 text-[12px] font-medium text-[#48484D] transition-colors hover:bg-[#F5F5F7]"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
