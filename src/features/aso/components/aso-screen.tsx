"use client";

import { useState, useRef } from "react";
import { Loader2, Sparkles, X, Plus, TrendingUp, Minus, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAsoSuggestions } from "@/hooks/use-aso-suggestions";
import { useAsoKeywords, useAddKeyword, useDeleteKeyword, useUpdateKeyword } from "@/hooks/use-aso-keywords";
import { useMinedKeywords } from "@/hooks/use-mined-keywords";
import { useApps } from "@/hooks/use-apps";
import { useWorkspaceStore } from "@/store/use-workspace-store";
import { resolveSelectedApp } from "@/lib/selected-app";
import type { AsoKeyword } from "@/types/review";
import type { MinedPhrase } from "@/app/api/aso/mine/route";

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
  const { mutate: add, isPending, error: addError } = useAddKeyword();
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
        {addError && (
          <div role="alert" className="mt-1 text-[11px] text-[var(--rb-red-500)]">
            {addError.message}
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Mined phrase chip ─────────────────────────────────────────────────────────

function SentimentDot({ s }: { s: MinedPhrase["sentiment"] }) {
  return (
    <span
      title={s}
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full flex-shrink-0",
        s === "positive" && "bg-[#1F8A5B]",
        s === "negative" && "bg-[#DC2626]",
        s === "mixed"    && "bg-[#F59E0B]",
      )}
    />
  );
}

function PhraseChip({
  p,
  onTrack,
  tracking,
}: {
  p: MinedPhrase;
  onTrack: () => void;
  tracking: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={cn(
        "group relative rounded-[10px] border p-3 transition-colors",
        p.tracked
          ? "border-[#1F8A5B]/25 bg-[#1F8A5B]/5"
          : "border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] hover:border-[#0A84FF]/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <SentimentDot s={p.sentiment} />
          <span className="truncate text-[13px] font-semibold text-fg-1">{p.phrase}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="rounded-full bg-[var(--rb-bg-raised)] px-2 py-0.5 text-[11px] font-semibold text-fg-2 border border-[var(--rb-border-1)]">
            {p.count}
          </span>
          {p.tracked ? (
            <span className="text-[10px] font-semibold text-[#1F8A5B]">tracked</span>
          ) : (
            <button
              onClick={onTrack}
              disabled={tracking}
              className="text-[11px] font-semibold text-[#0A84FF] hover:underline disabled:opacity-50"
            >
              {tracking ? "…" : "+ Track"}
            </button>
          )}
        </div>
      </div>

      {p.examples.length > 0 && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="mt-1.5 flex items-center gap-1 text-[11px] text-fg-3 hover:text-fg-2"
        >
          {open ? <Minus size={10} /> : <TrendingUp size={10} />}
          {open ? "hide" : `${p.examples.length} example${p.examples.length > 1 ? "s" : ""}`}
        </button>
      )}

      {open && p.examples.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {p.examples.map((ex, i) => (
            <p key={i} className="rounded-[6px] border border-[var(--rb-border-1)] bg-surface px-2.5 py-1.5 text-[12px] italic text-fg-2 leading-relaxed">
              &ldquo;{ex}&rdquo;
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Opportunities panel ───────────────────────────────────────────────────────

function OpportunitiesPanel({ appId }: { appId?: string }) {
  const { data, isLoading } = useMinedKeywords(appId);
  const { mutate: addKw, isPending: addPending } = useAddKeyword();
  const [tracking, setTracking] = useState<Set<string>>(new Set());

  const track = (phrase: string) => {
    setTracking((s) => new Set([...s, phrase]));
    addKw({ keyword: phrase, appId });
  };

  const phrases = data?.phrases ?? [];
  const gaps     = phrases.filter((p) => !p.tracked && p.score >= 3);
  const tracked  = phrases.filter((p) => p.tracked);

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      {data && !isLoading && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-[12px] border border-[var(--rb-border-1)] bg-surface p-4 shadow-[var(--rb-shadow-xs)]">
            <div className="text-[11px] font-medium text-fg-3">Reviews analysed</div>
            <div className="mt-1 text-[24px] font-semibold tabular-nums text-fg-1">{data.reviewsAnalyzed}</div>
          </div>
          <div className="rounded-[12px] border border-[#0A84FF]/20 bg-[#0A84FF]/5 p-4 shadow-[var(--rb-shadow-xs)]">
            <div className="text-[11px] font-medium text-[#0A84FF]">Keyword gaps</div>
            <div className="mt-1 text-[24px] font-semibold tabular-nums text-fg-1">{data.gapCount}</div>
            <div className="mt-0.5 text-[10px] text-fg-3">high-score, not tracked</div>
          </div>
          <div className="rounded-[12px] border border-[#1F8A5B]/20 bg-[#1F8A5B]/5 p-4 shadow-[var(--rb-shadow-xs)]">
            <div className="text-[11px] font-medium text-[#1F8A5B]">Already tracked</div>
            <div className="mt-1 text-[24px] font-semibold tabular-nums text-fg-1">{data.trackedCount}</div>
            <div className="mt-0.5 text-[10px] text-fg-3">of top phrases</div>
          </div>
        </div>
      )}

      {/* Gaps section */}
      <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
        <div className="flex items-center gap-2 border-b border-[var(--rb-border-1)] px-5 py-4">
          <TrendingUp className="size-4 text-[#0A84FF]" strokeWidth={1.5} />
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">
              Keyword gaps
            </div>
            <div className="mt-0.5 text-[12px] text-fg-3">
              Phrases users write — not yet in your tracked list
            </div>
          </div>
        </div>

        <div className="p-5">
          {isLoading && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="h-[60px] animate-pulse rounded-[10px] bg-[var(--rb-bg-sunken)]" />
              ))}
            </div>
          )}

          {!isLoading && gaps.length === 0 && (
            <div className="py-12 text-center text-[13px] text-fg-3">
              {data?.reviewsAnalyzed === 0
                ? "No reviews synced yet. Run a sync to mine keywords."
                : "No gaps found — all top phrases are already tracked."}
            </div>
          )}

          {!isLoading && gaps.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {gaps.map((p) => (
                <PhraseChip
                  key={p.phrase}
                  p={p}
                  onTrack={() => track(p.phrase)}
                  tracking={tracking.has(p.phrase) && addPending}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Already-tracked phrases */}
      {!isLoading && tracked.length > 0 && (
        <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
          <div className="flex items-center gap-2 border-b border-[var(--rb-border-1)] px-5 py-4">
            <div>
              <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">
                Confirmed in reviews
              </div>
              <div className="mt-0.5 text-[12px] text-fg-3">
                Tracked keywords that also appear in user-written text
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-5 sm:grid-cols-3">
            {tracked.map((p) => (
              <PhraseChip
                key={p.phrase}
                p={p}
                onTrack={() => track(p.phrase)}
                tracking={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inline rank cell ──────────────────────────────────────────────────────────

function RankCell({
  kw,
  bulkMode,
  bulkValue,
  onBulkChange,
}: {
  kw: AsoKeyword;
  bulkMode: boolean;
  bulkValue: string;
  onBulkChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const { mutate: update, isPending } = useUpdateKeyword();

  const save = () => {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n > 0) {
      update({ id: kw.id, current_rank: n });
    }
    setEditing(false);
  };

  if (bulkMode) {
    return (
      <input
        type="number"
        min={1}
        placeholder="—"
        value={bulkValue}
        onChange={(e) => onBulkChange(e.target.value)}
        className="w-[64px] rounded-[6px] border border-[var(--rb-border-2)] bg-[var(--rb-bg-sunken)] px-2 py-1 text-[12px] tabular-nums text-fg-1 outline-none focus:border-[#0A84FF]"
      />
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          type="number"
          min={1}
          placeholder="rank"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={save}
          className="w-[56px] rounded-[6px] border border-[#0A84FF] bg-[var(--rb-bg-sunken)] px-2 py-0.5 text-[12px] tabular-nums text-fg-1 outline-none"
        />
        <button onClick={save} className="text-[#0A84FF]">
          <Check size={11} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(kw.currentRank != null ? String(kw.currentRank) : ""); setEditing(true); }}
      disabled={isPending}
      className="group flex items-center gap-1.5 tabular-nums text-[13px] font-bold text-fg-1"
    >
      {isPending ? <Loader2 size={12} className="animate-spin text-fg-3" /> : (
        kw.currentRank != null ? `#${kw.currentRank}` : <span className="text-fg-3 font-normal text-[12px]">—</span>
      )}
      <Pencil size={10} className="opacity-0 group-hover:opacity-40 text-fg-3 transition-opacity" />
    </button>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function ASOScreen() {
  const [tab, setTab] = useState<"keywords" | "opportunities" | "ratings">("keywords");
  const [showAddRow, setShowAddRow] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkDrafts, setBulkDrafts] = useState<Record<string, string>>({});
  const selectedApp = useWorkspaceStore((s) => s.selectedApp);
  const { apps } = useApps();
  const { mutate: getSuggestions, isPending: suggestLoading, data: asoData } =
    useAsoSuggestions();

  // Resolved through one tested helper — see src/lib/selected-app.ts for why
  // this is not open-coded per screen.
  const { appId, appName } = resolveSelectedApp(apps, selectedApp);

  const { data: kwData, isLoading } = useAsoKeywords(appId);
  const { mutate: deleteKw } = useDeleteKeyword();
  const { mutate: updateKw, isPending: bulkSaving } = useUpdateKeyword();
  const { mutate: addFromSuggestion } = useAddKeyword();

  const saveBulkRanks = () => {
    const entries = Object.entries(bulkDrafts).filter(([, v]) => v.trim() !== "");
    for (const [id, val] of entries) {
      const n = parseInt(val, 10);
      if (!isNaN(n) && n > 0) updateKw({ id, current_rank: n });
    }
    setBulkMode(false);
    setBulkDrafts({});
  };

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
          {(["keywords", "opportunities", "ratings"] as const).map((o) => (
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

      {/* Opportunities tab */}
      {tab === "opportunities" && <OpportunitiesPanel appId={appId} />}

      {/* Keywords table */}
      {tab === "keywords" && <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
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
            {bulkMode ? (
              <>
                <button
                  onClick={() => { setBulkMode(false); setBulkDrafts({}); }}
                  className="flex h-7 items-center gap-1.5 rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-semibold text-fg-2 hover:bg-[var(--rb-bg-hover)]"
                >
                  Cancel
                </button>
                <button
                  onClick={saveBulkRanks}
                  disabled={bulkSaving}
                  className="flex h-7 items-center gap-1.5 rounded-[7px] bg-[#0A84FF] px-3 text-[12px] font-semibold text-white hover:bg-[#006EE0] disabled:opacity-50"
                >
                  {bulkSaving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  Save ranks
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { if (appId) getSuggestions(appId); }}
                  disabled={suggestLoading || !appId}
                  className="flex h-7 items-center gap-1.5 rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-50"
                >
                  {suggestLoading ? <Loader2 className="size-3 animate-spin" /> : <Sparkles className="size-3 text-[#0A84FF]" />}
                  {suggestLoading ? "Generating…" : "AI Suggestions"}
                </button>
                <button
                  onClick={() => setBulkMode(true)}
                  className="flex h-7 items-center gap-1.5 rounded-[7px] border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)]"
                >
                  <Pencil size={11} />
                  Update ranks
                </button>
                <button
                  onClick={() => setShowAddRow(true)}
                  className="flex h-7 items-center gap-1.5 rounded-[7px] bg-[#0A84FF] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[#006EE0]"
                >
                  <Plus size={12} />
                  Add keyword
                </button>
              </>
            )}
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
                  <td className={cn("px-5 py-3", i < keywords.length - 1 && "border-b border-[var(--rb-border-1)]")}>
                    <RankCell
                      kw={k}
                      bulkMode={bulkMode}
                      bulkValue={bulkDrafts[k.id] ?? ""}
                      onBulkChange={(v) => setBulkDrafts((d) => ({ ...d, [k.id]: v }))}
                    />
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
      </div>}

      {/* AI Keyword Suggestions */}
      {tab === "keywords" && asoData && (
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
