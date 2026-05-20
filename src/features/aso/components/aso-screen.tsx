"use client";

import { useState, useRef } from "react";
import { Loader2, Sparkles, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAsoSuggestions } from "@/hooks/use-aso-suggestions";
import { useAsoKeywords, useAddKeyword, useDeleteKeyword } from "@/hooks/use-aso-keywords";
import { useWorkspaceStore } from "@/store/use-workspace-store";
import type { AsoKeyword } from "@/types/review";

// ── Primitives ─────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  delta,
  positive = true,
  sub,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  sub?: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--rb-border-1)] bg-surface p-[18px] shadow-[var(--rb-shadow-xs)]">
      <div className="text-[12px] font-medium text-fg-3">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2.5">
        <span className="text-[28px] font-semibold leading-tight tracking-[-0.025em] tabular-nums text-fg-1">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "text-[12px] font-medium tabular-nums",
              positive ? "text-[#1F8A5B]" : "text-[#DC2626]",
            )}
          >
            {delta}
          </span>
        )}
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-fg-3">{sub}</div>}
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="rounded-[12px] border border-[var(--rb-border-1)] bg-surface p-[18px] shadow-[var(--rb-shadow-xs)] animate-pulse">
      <div className="h-3 w-24 rounded bg-[var(--rb-bg-sunken)] mb-3" />
      <div className="h-7 w-14 rounded bg-[var(--rb-bg-sunken)]" />
    </div>
  );
}

function RankDelta({ kw }: { kw: AsoKeyword }) {
  if (kw.currentRank === null || kw.previousRank === null)
    return <span className="text-[12px] text-fg-3">—</span>;
  const delta = kw.previousRank - kw.currentRank; // positive = improved
  if (delta === 0) return <span className="text-[12px] text-fg-3">—</span>;
  return (
    <span
      className={cn(
        "text-[12px] font-semibold tabular-nums",
        delta > 0 ? "text-[#1F8A5B]" : "text-[#DC2626]",
      )}
    >
      {delta > 0 ? `▲${delta}` : `▼${Math.abs(delta)}`}
    </span>
  );
}

function MiniSparkline({ values }: { values: number[] }) {
  if (!values || values.length < 2)
    return <span className="text-[12px] text-fg-3">—</span>;
  const w = 56, h = 20;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  // invert y: lower rank number = better = higher on chart
  const xs = (i: number) => (i / (values.length - 1)) * w;
  const ys = (v: number) => h - ((max - v) / range) * (h - 4) - 2;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");
  const improving = values[values.length - 1] <= values[0]; // lower = better
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      <path
        d={d}
        fill="none"
        stroke={improving ? "#1F8A5B" : "#DC2626"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VolumeBar({ value }: { value: number | null }) {
  if (value === null) return <span className="text-[12px] text-fg-3">—</span>;
  // normalise to 0–100 assuming max volume ~10000
  const pct = Math.min(Math.round((value / 10000) * 100), 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-[60px] overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
        <div className="h-full rounded-full bg-[#0A84FF]" style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular-nums text-[12px] text-fg-3">{value.toLocaleString()}</span>
    </div>
  );
}

// ── Inline add-keyword form ────────────────────────────────────────────────────

function AddKeywordRow({
  appId,
  onDone,
}: {
  appId?: string;
  onDone: () => void;
}) {
  const [kw, setKw] = useState("");
  const [vol, setVol] = useState("");
  const { mutate: add, isPending } = useAddKeyword();
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    add(
      { keyword: trimmed, appId, volumeEstimate: vol ? parseInt(vol, 10) : undefined },
      {
        onSuccess: () => {
          setKw("");
          setVol("");
          onDone();
        },
      },
    );
  };

  return (
    <tr className="bg-[var(--rb-bg-raised)]">
      <td className="px-5 py-2.5 border-b border-[var(--rb-border-1)]">
        <input
          ref={inputRef}
          autoFocus
          placeholder="e.g. review management tool"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onDone();
          }}
          className="w-full bg-transparent text-[13px] text-fg-1 placeholder:text-fg-3 outline-none"
        />
      </td>
      <td className="px-5 py-2.5 border-b border-[var(--rb-border-1)] text-[12px] text-fg-3">
        —
      </td>
      <td className="px-5 py-2.5 border-b border-[var(--rb-border-1)] text-[12px] text-fg-3">
        —
      </td>
      <td className="px-5 py-2.5 border-b border-[var(--rb-border-1)]">
        <input
          placeholder="Volume (opt)"
          value={vol}
          onChange={(e) => setVol(e.target.value)}
          type="number"
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onDone();
          }}
          className="w-[90px] bg-transparent text-[12px] text-fg-1 placeholder:text-fg-3 outline-none"
        />
      </td>
      <td className="px-5 py-2.5 border-b border-[var(--rb-border-1)]">
        <div className="flex items-center gap-2">
          <button
            onClick={submit}
            disabled={isPending || !kw.trim()}
            className="h-6 rounded-[6px] bg-[#0A84FF] px-2.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {isPending ? "Adding…" : "Add"}
          </button>
          <button onClick={onDone} className="text-fg-3 hover:text-fg-1">
            <X size={13} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ASOScreen() {
  const [tab, setTab] = useState<"keywords" | "ratings">("keywords");
  const [showAddRow, setShowAddRow] = useState(false);
  const selectedApp = useWorkspaceStore((s) => s.selectedApp);
  const { mutate: getSuggestions, isPending: suggestLoading, data: asoData } =
    useAsoSuggestions();

  const appId =
    selectedApp && typeof selectedApp === "object" && "id" in selectedApp
      ? (selectedApp as { id: string }).id
      : undefined;
  const appName =
    selectedApp && typeof selectedApp === "object" && "name" in selectedApp
      ? (selectedApp as { name: string }).name
      : typeof selectedApp === "string"
        ? selectedApp
        : "All apps";

  const { data: kwData, isLoading } = useAsoKeywords(appId);
  const { mutate: deleteKw } = useDeleteKeyword();
  const { mutate: addFromSuggestion } = useAddKeyword();

  const keywords = kwData?.keywords ?? [];
  const metrics = kwData?.metrics;

  const rankChange = keywords
    .filter((k) => k.currentRank !== null && k.previousRank !== null)
    .reduce((sum, k) => sum + (k.previousRank! - k.currentRank!), 0);

  return (
    <div className="flex w-full flex-col gap-6 overflow-auto p-8 max-w-[1240px] mx-auto">

      {/* Header */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[12px] font-medium text-fg-3">{appName}</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.022em] text-fg-1">
            ASO
          </h1>
        </div>
        <div className="flex items-center rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-0.5">
          {(["keywords", "ratings"] as const).map((o) => (
            <button
              key={o}
              onClick={() => setTab(o)}
              className={cn(
                "h-[26px] rounded-md px-3 text-[12px] font-semibold capitalize transition-colors",
                tab === o
                  ? "bg-surface text-fg-1 shadow-[var(--rb-shadow-xs)]"
                  : "text-fg-3 hover:text-fg-2",
              )}
            >
              {o}
            </button>
          ))}
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-3 gap-3">
        {isLoading ? (
          <>
            <MetricSkeleton />
            <MetricSkeleton />
            <MetricSkeleton />
          </>
        ) : (
          <>
            <MetricCard
              label="Tracked keywords"
              value={String(metrics?.total ?? 0)}
              sub={appName}
            />
            <MetricCard
              label="Avg rank"
              value={metrics?.avgRank != null ? String(metrics.avgRank) : "—"}
              delta={
                rankChange !== 0
                  ? `${rankChange > 0 ? "▲" : "▼"}${Math.abs(rankChange)}`
                  : undefined
              }
              positive={rankChange > 0}
              sub="last snapshot"
            />
            <MetricCard
              label="Top-10 keywords"
              value={String(metrics?.top10Count ?? 0)}
              sub="current rank ≤ 10"
            />
          </>
        )}
      </section>

      {/* Keywords table */}
      <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
        <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-4">
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">
              Keyword positions
            </div>
            <div className="mt-0.5 text-[12px] text-fg-3">
              {isLoading
                ? "Loading…"
                : `${keywords.length} keyword${keywords.length === 1 ? "" : "s"} tracked`}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => getSuggestions(selectedApp)}
              disabled={suggestLoading}
              className="flex h-7 items-center gap-1.5 rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-50"
            >
              {suggestLoading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3 text-[#0A84FF]" />}
              {suggestLoading ? "Generating…" : "AI Suggestions"}
            </button>
            <button
              onClick={() => setShowAddRow(true)}
              className="flex h-7 items-center gap-1.5 rounded-[7px] bg-[#0A84FF] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#006EE0]"
            >
              <Plus size={12} />
              Add keyword
            </button>
          </div>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Keyword", "Rank", "7-day delta", "Volume", "Trend", ""].map((h) => (
                <th
                  key={h}
                  className="border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showAddRow && (
              <AddKeywordRow appId={appId} onDone={() => setShowAddRow(false)} />
            )}

            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-5 py-3 border-b border-[var(--rb-border-1)]">
                      <div className="h-3 rounded bg-[var(--rb-bg-sunken)]" style={{ width: j === 0 ? 120 : 48 }} />
                    </td>
                  ))}
                  <td className="px-5 py-3 border-b border-[var(--rb-border-1)]" />
                </tr>
              ))}

            {!isLoading && keywords.length === 0 && !showAddRow && (
              <tr>
                <td colSpan={6} className="py-16 text-center text-[13px] text-fg-3">
                  No keywords tracked yet.{" "}
                  <button
                    onClick={() => setShowAddRow(true)}
                    className="font-semibold text-[#0A84FF] hover:underline"
                  >
                    Add your first keyword
                  </button>
                </td>
              </tr>
            )}

            {!isLoading &&
              keywords.map((k, i) => (
                <tr key={k.id} className="transition-colors hover:bg-[var(--rb-bg-hover)]">
                  <td className={cn("px-5 py-3 text-[13px] font-semibold text-fg-1", i < keywords.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    {k.keyword}
                  </td>
                  <td className={cn("px-5 py-3 tabular-nums text-[13px] font-bold text-fg-1", i < keywords.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    {k.currentRank != null ? `#${k.currentRank}` : "—"}
                  </td>
                  <td className={cn("px-5 py-3", i < keywords.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    <RankDelta kw={k} />
                  </td>
                  <td className={cn("px-5 py-3", i < keywords.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    <VolumeBar value={k.volumeEstimate} />
                  </td>
                  <td className={cn("px-5 py-3", i < keywords.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    <MiniSparkline values={k.trendData} />
                  </td>
                  <td className={cn("px-5 py-3", i < keywords.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    <button
                      onClick={() => deleteKw(k.id)}
                      className="opacity-40 hover:opacity-80 transition-opacity"
                      aria-label={`Remove ${k.keyword}`}
                    >
                      <X size={13} className="text-fg-2" />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* AI Keyword Suggestions */}
      {asoData && (
        <div className="overflow-hidden rounded-[14px] border border-[#0A84FF]/20 bg-surface shadow-[var(--rb-shadow-xs)]">
          <div className="flex items-center gap-2 border-b border-[var(--rb-border-1)] px-5 py-4">
            <Sparkles className="size-4 text-[#0A84FF]" strokeWidth={1.5} />
            <div>
              <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">
                AI Keyword Suggestions
              </div>
              <div className="mt-0.5 text-[12px] text-fg-3">
                {asoData.source === "cache"
                  ? `Cached · updated ${new Date(asoData.lastUpdated).toLocaleDateString()}`
                  : asoData.source === "gemini"
                    ? "Gemini 2.0 Flash · just generated"
                    : "Service unavailable — check GEMINI_API_KEY"}
              </div>
            </div>
          </div>
          {asoData.keywords.length > 0 ? (
            <div className="flex flex-wrap gap-2 p-5">
              {asoData.keywords.map((kw) => (
                <div
                  key={kw}
                  className="flex items-center gap-2 rounded-[8px] border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 py-1.5"
                >
                  <span className="text-[13px] font-medium text-fg-1">{kw}</span>
                  <button
                    onClick={() => addFromSuggestion({ keyword: kw, appId })}
                    className="text-[10px] font-semibold text-[#0A84FF] hover:underline"
                  >
                    + Track
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-5 py-6 text-center text-[13px] text-fg-3">
              {asoData.source === "unavailable"
                ? "Add your GEMINI_API_KEY to enable AI suggestions."
                : "No new keyword suggestions at this time."}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
