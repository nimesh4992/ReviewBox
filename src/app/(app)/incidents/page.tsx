"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert, ShieldCheck, X } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { IncidentList } from "@/features/incidents/components/incident-list";
import { useIncidents, useCreateIncident } from "@/hooks/use-incidents";
import { useApps } from "@/hooks/use-apps";
import { resolveSelectedApp } from "@/lib/selected-app";
import { useWorkspaceStore } from "@/store/use-workspace-store";
import { cn } from "@/lib/utils";

const SEVERITY_OPTIONS = [
  { value: "critical", label: "Critical",  desc: "Active user impact, store rating falling" },
  { value: "high",     label: "High",       desc: "Significant complaints, at-risk cohort"   },
  { value: "medium",   label: "Medium",     desc: "Notable pattern, monitor closely"         },
] as const;

// ── Declare incident dialog ───────────────────────────────────────────────────

function DeclareDialog({
  onClose,
  appId,
  appName,
}: {
  onClose: () => void;
  appId?: string;
  appName: string;
}) {
  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [severity,    setSeverity]    = useState<"critical" | "high" | "medium">("high");
  const [error,       setError]       = useState<string | null>(null);

  const create = useCreateIncident();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    setError(null);
    try {
      // Attribute the incident to the app the user is looking at. Until now
      // `incidents.app_id` was never written, so nothing could be scoped.
      await create.mutateAsync({
        title: title.trim(),
        description: description.trim(),
        severity,
        appId,
        appName: appId ? appName : undefined,
      });
      onClose();
    } catch {
      setError("Failed to create incident. Try again.");
    }
  }

  // This dialog is hand-rolled rather than built on the Radix primitive the
  // other modals use, so nothing gave it Escape-to-close, a focus trap, or a
  // scroll lock. A keyboard user who opened it had no way out but to tab to
  // the close button, and focus leaked to the page behind it.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Declare incident"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop — presentational; Escape and the close button are the
          keyboard-accessible dismissals. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative z-10 w-full max-w-[480px] rounded-[18px] border border-[var(--rb-border-1)] bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--rb-border-1)] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 items-center justify-center rounded-lg bg-[var(--rb-red-500)]/10 text-[var(--rb-red-500)]">
              <ShieldAlert size={14} />
            </div>
            <span className="text-[15px] font-semibold text-fg-1">Declare incident</span>
          </div>
          <button
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-lg text-fg-3 hover:bg-[var(--rb-bg-hover)] transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Severity */}
          <div className="space-y-2">
            <label className="text-[12px] font-semibold text-fg-2">Severity</label>
            <div className="grid grid-cols-3 gap-2">
              {SEVERITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSeverity(opt.value)}
                  className={cn(
                    "rounded-[10px] border px-3 py-2.5 text-left transition-all",
                    severity === opt.value
                      ? opt.value === "critical"
                        ? "border-[var(--rb-red-500)] bg-[var(--rb-red-500)]/10"
                        : opt.value === "high"
                        ? "border-[var(--rb-amber-500)] bg-[var(--rb-amber-500)]/10"
                        : "border-[var(--rb-border-3)] bg-[var(--rb-bg-sunken)]"
                      : "border-[var(--rb-border-2)] bg-surface hover:bg-[var(--rb-bg-hover)]",
                  )}
                >
                  <div className={cn(
                    "text-[12px] font-semibold",
                    severity === opt.value
                      ? opt.value === "critical" ? "text-[var(--rb-red-500)]"
                      : opt.value === "high"     ? "text-[var(--rb-amber-500)]"
                      : "text-fg-2"
                      : "text-fg-2",
                  )}>
                    {opt.label}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-tight text-fg-3">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-fg-2">
              Title <span className="text-[var(--rb-red-500)]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(null); }}
              placeholder="e.g. v5.42.0 crash spike on Android 14"
              maxLength={120}
              className={cn(
                "w-full rounded-[8px] border bg-[var(--rb-bg-sunken)] px-3 py-2 text-[13px] text-fg-1 placeholder:text-fg-3 outline-none transition-colors",
                error && !title.trim()
                  ? "border-[var(--rb-red-400)] focus:border-[var(--rb-red-400)]"
                  : "border-[var(--rb-border-2)] focus:border-[#0A84FF]",
              )}
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-[12px] font-semibold text-fg-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's happening? Which users/versions affected?"
              rows={3}
              maxLength={500}
              className="w-full resize-none rounded-[8px] border border-[var(--rb-border-2)] bg-[var(--rb-bg-sunken)] px-3 py-2 text-[13px] text-fg-1 placeholder:text-fg-3 outline-none focus:border-[#0A84FF] transition-colors"
            />
          </div>

          {error && (
            <p className="text-[12px] font-medium text-[var(--rb-red-500)]">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-8 rounded-[7px] border border-[var(--rb-border-2)] px-4 text-[13px] font-medium text-fg-2 hover:bg-[var(--rb-bg-hover)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="flex h-8 items-center gap-1.5 rounded-[7px] bg-[#DC2626] px-4 text-[13px] font-semibold text-white hover:bg-[#B91C1C] disabled:opacity-50 transition-colors"
            >
              {create.isPending ? (
                <><Loader2 size={13} className="animate-spin" /> Declaring…</>
              ) : (
                "Declare incident"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function IncidentsPage() {
  const [showDialog, setShowDialog] = useState(false);
  const selectedApp = useWorkspaceStore((s) => s.selectedApp);
  const { apps } = useApps();
  const { appId: selectedAppId, appName: selectedAppName } = resolveSelectedApp(apps, selectedApp);
  const { data: incidents, isLoading, error } = useIncidents(selectedAppId);

  return (
    <>
      {showDialog && (
        <DeclareDialog
          onClose={() => setShowDialog(false)}
          appId={selectedAppId}
          appName={selectedAppName}
        />
      )}

      <div className="min-w-0">
        <PageHeader
          eyebrow="Operations"
          title="Incidents"
          description="Review-driven issues that need product, support, or engineering ownership."
          actions={
            <Button size="sm" className="h-8" onClick={() => setShowDialog(true)}>
              <ShieldAlert className="size-3.5" />
              Declare incident
            </Button>
          }
        />

        <div className="p-4 md:p-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-fg-3">
              <Loader2 size={20} className="animate-spin" />
            </div>
          ) : error ? (
            <div className="rounded-xl border border-[var(--rb-red-500)]/20 bg-[var(--rb-red-500)]/10 p-6 text-center text-[13px] text-[var(--rb-red-500)]">
              Failed to load incidents. Check your connection and refresh.
            </div>
          ) : (
            <IncidentList incidents={incidents ?? []} />
          )}
        </div>
      </div>
    </>
  );
}
