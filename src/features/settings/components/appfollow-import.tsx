"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, CheckCircle2, AlertCircle, FileText, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useApps, type WorkspaceApp } from "@/hooks/use-apps";

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "idle" | "preview" | "importing" | "done" | "error";

interface ColumnPreview {
  headers: string[];
  detected: Record<string, string | null>;
  bodyFound: boolean;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readCsvHeaders(text: string): string[] {
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  return firstLine
    .split(",")
    .map((h) => h.replace(/^["']|["']$/g, "").trim());
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DropZone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors",
        dragOver
          ? "border-[#0A84FF] bg-blue-50"
          : "border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] hover:border-[#0A84FF]/40 hover:bg-blue-50/30",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <Upload className="size-6 text-[var(--rb-fg-3)]" />
      <div>
        <p className="text-sm font-medium text-[var(--rb-fg-2)]">
          Drop your AppFollow CSV here
        </p>
        <p className="mt-0.5 text-xs text-[var(--rb-fg-4)]">
          or click to browse · max 10 MB
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

function ColumnBadge({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-[var(--rb-fg-4)]">{label}:</span>
      {value ? (
        <span className="rounded bg-[var(--rb-green-500)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[var(--rb-green-500)] border border-[var(--rb-green-500)]/25">
          {value}
        </span>
      ) : (
        <span className="rounded bg-[var(--rb-bg-hover)] px-1.5 py-0.5 text-[10px] text-[var(--rb-fg-4)]">
          not found
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AppFollowImport() {
  const { apps } = useApps();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ColumnPreview | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string>("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Default to first app
  const defaultAppId = apps[0]?.id ?? "";

  function reset() {
    setStep("idle");
    setFile(null);
    setPreview(null);
    setResult(null);
    setErrorMsg(null);
  }

  async function handleFile(f: File) {
    setFile(f);
    setErrorMsg(null);

    const text = await f.text().catch(() => "");
    if (!text) {
      setErrorMsg("Could not read file.");
      return;
    }

    const headers = readCsvHeaders(text);
    if (!headers.length) {
      setErrorMsg("CSV appears empty or malformed.");
      return;
    }

    try {
      const params = new URLSearchParams({ headers: headers.join(",") });
      const res = await fetch(`/api/import/appfollow?${params.toString()}`);
      const data = (await res.json()) as ColumnPreview & { error?: { message?: string } };

      if (!res.ok) {
        setErrorMsg(data.error?.message ?? "Could not analyze file.");
        return;
      }
      if (!data.bodyFound) {
        setErrorMsg(
          `No review text column detected. Columns found: ${headers.slice(0, 8).join(", ")}${headers.length > 8 ? "…" : ""}. AppFollow CSVs usually have a "Review" or "Body" column.`,
        );
        return;
      }

      setPreview(data);
      setSelectedAppId(defaultAppId);
      setStep("preview");
    } catch {
      setErrorMsg("Network error — could not analyze file.");
    }
  }

  async function handleImport() {
    if (!file) return;
    setStep("importing");
    setErrorMsg(null);

    const form = new FormData();
    form.append("file", file);
    if (selectedAppId) form.append("appId", selectedAppId);

    try {
      const res = await fetch("/api/import/appfollow", { method: "POST", body: form });
      const data = (await res.json()) as ImportResult & { error?: { message?: string } };

      if (!res.ok) {
        setErrorMsg(data.error?.message ?? "Import failed.");
        setStep("error");
        return;
      }
      setResult(data);
      setStep("done");
    } catch {
      setErrorMsg("Network error — import did not complete.");
      setStep("error");
    }
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-[var(--rb-border-1)] bg-surface px-4 py-3 shadow-sm">
        <div>
          <h3 className="text-sm font-semibold text-[var(--rb-fg-1)]">Import from AppFollow</h3>
          <p className="mt-0.5 text-xs text-[var(--rb-fg-4)]">
            Migrate existing reviews via CSV export
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setOpen(true)}
        >
          <Upload className="size-3.5" />
          Import CSV
        </Button>
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[var(--rb-border-1)] bg-surface shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--rb-border-1)] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--rb-fg-1)]">Import from AppFollow</h2>
          <p className="mt-0.5 text-xs text-[var(--rb-fg-4)]">
            Upload an AppFollow CSV export to import historical reviews
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-[var(--rb-fg-4)]"
          onClick={() => { setOpen(false); reset(); }}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Step indicator */}
        <div className="flex items-center gap-1 text-[11px]">
          {(["Upload", "Map columns", "Import"] as const).map((label, i) => {
            const active =
              (i === 0 && (step === "idle" || step === "error")) ||
              (i === 1 && step === "preview") ||
              (i === 2 && (step === "importing" || step === "done"));
            const done =
              (i === 0 && step !== "idle") ||
              (i === 1 && (step === "importing" || step === "done"));
            return (
              <span key={label} className="flex items-center gap-1">
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium",
                    done
                      ? "bg-[var(--rb-green-500)]/15 text-[var(--rb-green-500)]"
                      : active
                      ? "bg-[#0A84FF] text-white"
                      : "bg-[var(--rb-bg-hover)] text-[var(--rb-fg-4)]",
                  )}
                >
                  {done ? "✓" : i + 1}. {label}
                </span>
                {i < 2 && <ChevronRight className="size-3 text-[var(--rb-fg-4)]" />}
              </span>
            );
          })}
        </div>

        {/* Step 1: Upload */}
        {(step === "idle" || (step === "error" && !preview)) && (
          <>
            <DropZone onFile={handleFile} disabled={false} />
            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--rb-red-500)]/25 bg-[var(--rb-red-500)]/10 px-3 py-2">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                <p className="text-xs text-[var(--rb-red-500)]">{errorMsg}</p>
              </div>
            )}
            <div className="rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 py-2.5 text-[11px] text-[var(--rb-fg-4)] leading-relaxed">
              <strong className="text-[var(--rb-fg-3)]">How to export from AppFollow:</strong>
              {" "}Reviews → Export → CSV. The importer auto-detects columns — no manual mapping needed.
            </div>
          </>
        )}

        {/* Step 2: Column preview */}
        {step === "preview" && preview && file && (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 py-2.5">
              <FileText className="size-4 shrink-0 text-[var(--rb-fg-3)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-[var(--rb-fg-2)]">{file.name}</p>
                <p className="text-[11px] text-[var(--rb-fg-4)]">
                  {preview.headers.length} columns detected
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] text-[var(--rb-fg-4)]"
                onClick={reset}
              >
                Change
              </Button>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-[var(--rb-fg-2)]">
                Auto-detected column mapping
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {Object.entries(preview.detected).map(([key, val]) => (
                  <ColumnBadge
                    key={key}
                    label={key.replace(/([A-Z])/g, " $1").toLowerCase()}
                    value={val}
                  />
                ))}
              </div>
              {!preview.detected.rating && (
                <p className="mt-2 text-[11px] text-amber-600">
                  Rating column not found — all imported reviews will default to 3★.
                </p>
              )}
            </div>

            {apps.length > 1 && (
              <label className="block">
                <span className="text-xs font-medium text-[var(--rb-fg-2)]">Import into app</span>
                <select
                  value={selectedAppId}
                  onChange={(e) => setSelectedAppId(e.target.value)}
                  className="mt-1 h-8 w-full rounded-md border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 text-sm text-[var(--rb-fg-2)] focus:outline-none focus:ring-2 focus:ring-[#0A84FF]/20"
                >
                  {apps.map((app: WorkspaceApp) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-[var(--rb-red-500)]/25 bg-[var(--rb-red-500)]/10 px-3 py-2">
                <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                <p className="text-xs text-[var(--rb-red-500)]">{errorMsg}</p>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 bg-[#0A84FF] text-white hover:bg-[#0070e0]"
                onClick={handleImport}
              >
                Import reviews
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-[var(--rb-fg-3)]"
                onClick={reset}
              >
                Cancel
              </Button>
            </div>
          </>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="size-8 animate-spin rounded-full border-2 border-[#0A84FF] border-t-transparent" />
            <p className="text-sm text-[var(--rb-fg-2)]">Importing reviews…</p>
            <p className="text-xs text-[var(--rb-fg-4)]">This may take a moment for large files.</p>
          </div>
        )}

        {/* Done */}
        {step === "done" && result && (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle2 className="size-8 text-[var(--rb-green-500)]" />
            <div>
              <p className="text-sm font-semibold text-[var(--rb-fg-1)]">
                {result.imported.toLocaleString()} reviews imported
              </p>
              {result.skipped > 0 && (
                <p className="mt-0.5 text-xs text-[var(--rb-fg-4)]">
                  {result.skipped} rows skipped (blank or malformed)
                </p>
              )}
            </div>
            <p className="text-xs text-[var(--rb-fg-4)]">
              Reviews are now in your inbox. Duplicates were skipped automatically.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => { setOpen(false); reset(); }}
            >
              Done
            </Button>
          </div>
        )}

        {/* Error after preview */}
        {step === "error" && preview && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border border-[var(--rb-red-500)]/25 bg-[var(--rb-red-500)]/10 px-3 py-2">
              <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
              <p className="text-xs text-[var(--rb-red-500)]">{errorMsg ?? "Import failed."}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => { setStep("preview"); setErrorMsg(null); }}
            >
              Try again
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
