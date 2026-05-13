"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const REPORTS = [
  {
    id: "weekly-digest",
    title: "Weekly digest",
    description: "Rating trends, top issues, reply performance, and competitor snapshot. Sent every Monday 9 AM.",
    icon: "📊",
    lastRun: "2 days ago",
    schedule: "Weekly · Mon 9 AM",
    format: "Email + PDF",
    configured: true,
  },
  {
    id: "exec-dashboard",
    title: "Exec dashboard",
    description: "One-page summary of KPIs, NPS proxy, and top 3 action items. Shareable link with no login required.",
    icon: "📈",
    lastRun: "5 days ago",
    schedule: "Monthly · 1st",
    format: "Link + PDF",
    configured: true,
  },
  {
    id: "bug-triage",
    title: "Bug triage export",
    description: "All crash-tagged reviews grouped by version, device, and frequency. CSV for engineering handoff.",
    icon: "🐛",
    lastRun: "Never",
    schedule: "On demand",
    format: "CSV",
    configured: false,
  },
  {
    id: "store-reply-audit",
    title: "Reply audit",
    description: "Reviews older than SLA threshold with no reply. Includes suggested reply drafts per review.",
    icon: "💬",
    lastRun: "1 week ago",
    schedule: "Weekly · Fri 5 PM",
    format: "Email",
    configured: true,
  },
];

function ReportCard({
  report,
}: {
  report: (typeof REPORTS)[number];
}) {
  const [running, setRunning] = useState(false);

  function handleRun() {
    setRunning(true);
    setTimeout(() => setRunning(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-[var(--rb-border-1)] bg-surface p-5 shadow-[var(--rb-shadow-xs)]">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--rb-bg-sunken)] text-[18px]">
          {report.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold text-fg-1">{report.title}</div>
          <div className="mt-1 text-[12px] leading-relaxed text-fg-3">{report.description}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-[10px] border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-4 py-3">
        {[
          { label: "Last run", value: report.lastRun },
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
            <>
              <span className="size-3 animate-spin rounded-full border-2 border-[#0A84FF] border-t-transparent" />
              Running…
            </>
          ) : (
            "Run now"
          )}
        </button>
        <button className="h-7 rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)]">
          Configure
        </button>
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

export function ReportsScreen() {
  return (
    <div className="flex w-full flex-col gap-6 overflow-auto p-8 max-w-[1240px] mx-auto">

      {/* Header */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[12px] font-medium text-fg-3">Acme Banking · iOS</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.022em] text-fg-1">
            Reports
          </h1>
        </div>
        <button className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0A84FF] px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#006EE0]">
          + New report
        </button>
      </header>

      {/* Report cards */}
      <div className="grid grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <ReportCard key={r.id} report={r} />
        ))}
      </div>
    </div>
  );
}
