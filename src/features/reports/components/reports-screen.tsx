"use client";

import { useState } from "react";
import { AlarmClock, BarChart3, Bug, Download, Loader2, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/store/use-workspace-store";

interface Report {
  id:          string;
  title:       string;
  description: string;
  icon:        LucideIcon;
  schedule:    string;
  format:      string;
  configured:  boolean;
  /** Can be triggered now via /api/reports/send-now; false = coming soon */
  sendable:    boolean;
}

const REPORTS: Report[] = [
  {
    id:          "weekly-digest",
    title:       "Weekly digest",
    description: "Rating trends, top issues, reply performance. Sent to workspace owner every Monday at 9 AM.",
    icon:        BarChart3,
    schedule:    "Weekly · Mon 9 AM",
    format:      "Email + Slack",
    configured:  true,
    sendable:    true,
  },
  {
    id:          "unreplied-alert",
    title:       "Unreplied review alert",
    description: "Notifies when reviews have waited 48+ hours without a reply. Runs daily at 10 AM.",
    icon:        AlarmClock,
    schedule:    "Daily · 10 AM",
    format:      "Email + Slack",
    configured:  true,
    sendable:    true,
  },
  {
    id:          "bug-triage",
    title:       "Bug triage export",
    description: "All crash-tagged reviews grouped by version, device, and frequency. CSV for engineering handoff.",
    icon:        Bug,
    schedule:    "On demand",
    format:      "CSV",
    configured:  false,
    sendable:    false,
  },
  {
    id:          "exec-dashboard",
    title:       "Exec dashboard",
    description: "One-page KPI summary with top action items. Shareable PDF for stakeholders.",
    icon:        TrendingUp,
    schedule:    "Monthly · 1st",
    format:      "PDF",
    configured:  false,
    sendable:    false,
  },
];

function ReportCard({ report }: { report: Report }) {
  const [running,    setRunning]    = useState(false);
  const [runResult,  setRunResult]  = useState<"ok" | "err" | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  async function handleRun() {
    if (!report.sendable) return;
    setRunning(true);
    setRunResult(null);
    setRunMessage(null);
    try {
      const res = await fetch("/api/reports/send-now", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ report: report.id }),
      });
      const data = (await res.json().catch(() => null)) as
        | { sent?: boolean; message?: string; error?: { message?: string } }
        | null;
      if (res.ok && data?.sent) {
        setRunResult("ok");
        setRunMessage("Sent — check your inbox");
      } else if (res.ok && data?.message) {
        // No data to send is a fine outcome, not an error
        setRunResult("ok");
        setRunMessage(data.message);
      } else {
        setRunResult("err");
        setRunMessage(data?.error?.message ?? "Failed — try again");
      }
    } catch {
      setRunResult("err");
      setRunMessage("Failed — try again");
    } finally {
      setRunning(false);
      setTimeout(() => { setRunResult(null); setRunMessage(null); }, 6000);
    }
  }

  const canRun = report.sendable;

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-[var(--rb-border-1)] bg-surface p-5 shadow-[var(--rb-shadow-xs)]">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#0A84FF]/10">
          <report.icon size={17} strokeWidth={1.5} className="text-[#0A84FF]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-fg-1">{report.title}</div>
          <div className="mt-1 text-[12px] leading-relaxed text-fg-3">{report.description}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-[10px] border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-4 py-3">
        {[
          { label: "Schedule", value: report.schedule },
          { label: "Format",   value: report.format   },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="text-[10px] font-semibold uppercase tracking-[0.05em] text-fg-3">{label}</div>
            <div className="mt-0.5 text-[12px] font-medium text-fg-2">{value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {canRun ? (
          <button
            className={cn(
              "flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-[12px] font-semibold transition-colors",
              running
                ? "bg-[#0A84FF]/20 text-[#0A84FF] cursor-wait"
                : "bg-[#0A84FF] text-white hover:bg-[#006EE0]",
            )}
            onClick={handleRun}
            disabled={running}
          >
            {running ? (
              <><Loader2 size={11} className="animate-spin" />Running…</>
            ) : (
              "Send now"
            )}
          </button>
        ) : (
          <span className="h-7 flex items-center px-3 text-[12px] font-medium text-fg-3 rounded-[7px] border border-[var(--rb-border-2)]">
            Coming soon
          </span>
        )}

        {runMessage && (
          <span
            className={cn(
              "min-w-0 truncate text-[12px] font-semibold",
              runResult === "ok" ? "text-[var(--rb-green-500)]" : "text-[var(--rb-red-500)]",
            )}
            title={runMessage}
          >
            {runMessage}
          </span>
        )}

        {report.configured && (
          <span className="ml-auto flex items-center gap-1 text-[11px] text-[#1F8A5B]">
            <span className="size-1.5 rounded-full bg-[#1F8A5B]" />
            Active
          </span>
        )}
      </div>
    </div>
  );
}

const EXPORT_RANGES = [
  { label: "Last 7 days",  value: "7"   },
  { label: "Last 30 days", value: "30"  },
  { label: "Last 90 days", value: "90"  },
  { label: "All time",     value: "all" },
];

function CsvExportCard() {
  const [days,        setDays]        = useState<string>("30");
  const [downloading, setDownloading] = useState(false);

  async function handleExport() {
    setDownloading(true);
    try {
      const url = `/api/reports/export?days=${days}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");

      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = href;
      a.download = `reviews-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(href);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="rounded-[14px] border border-[var(--rb-border-1)] bg-surface p-5 shadow-[var(--rb-shadow-xs)]">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#0A84FF]/10">
          <Download size={17} strokeWidth={1.5} className="text-[#0A84FF]" />
        </div>
        <div>
          <div className="text-[14px] font-semibold text-fg-1">Export reviews</div>
          <div className="text-[12px] text-fg-3">Download filtered reviews as CSV for spreadsheets or engineering handoff</div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex rounded-[8px] border border-[var(--rb-border-2)] overflow-hidden">
          {EXPORT_RANGES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setDays(opt.value)}
              className={cn(
                "h-7 px-3 text-[12px] font-medium transition-colors border-r border-[var(--rb-border-2)] last:border-r-0",
                days === opt.value
                  ? "bg-[#0A84FF] text-white"
                  : "bg-surface text-fg-2 hover:bg-[var(--rb-bg-hover)]",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleExport}
          disabled={downloading}
          className="flex h-7 items-center gap-1.5 rounded-[7px] bg-[#0A84FF] px-3.5 text-[12px] font-semibold text-white hover:bg-[#006EE0] disabled:opacity-50 transition-colors"
        >
          {downloading ? (
            <><Loader2 size={12} className="animate-spin" /> Downloading…</>
          ) : (
            <><Download size={12} /> Download CSV</>
          )}
        </button>

        <span className="text-[11px] text-fg-3 ml-auto">
          Up to 5,000 rows · UTF-8
        </span>
      </div>
    </div>
  );
}

export function ReportsScreen() {
  const selectedApp = useWorkspaceStore((s) => s.selectedApp);
  return (
    <div className="flex w-full flex-col gap-6 overflow-auto p-8 max-w-[1240px] mx-auto">

      {/* Header.
          The "+ New report" button used to live here but did nothing —
          custom report authoring is queued behind the four built-in
          reports (weekly digest, unreplied alert, monthly summary,
          crash spike). Re-add once that backlog item ships. */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[12px] font-medium text-fg-3">{selectedApp || "All apps"}</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.022em] text-fg-1">
            Reports
          </h1>
        </div>
      </header>

      {/* Report cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>

      {/* CSV Export */}
      <CsvExportCard />
    </div>
  );
}
