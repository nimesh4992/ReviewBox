"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CompetitorBenchmarkRow, CompetitorsResponse } from "@/types/review";

/**
 * Competitors — real tracking.
 *
 * Rows are apps the workspace chose to track; rating and review count come
 * from the store (scraped through a 6h cache). Metrics that would need the
 * competitor's review history (reply rate, trend) are shown as "—", never
 * invented. Until migration 016 is applied the API serves clearly-labelled
 * illustrative rows and the add flow stays disabled.
 */

async function fetchCompetitors(): Promise<CompetitorsResponse> {
  const res = await fetch("/api/competitors");
  if (!res.ok) throw new Error("Failed to fetch competitors");
  return res.json() as Promise<CompetitorsResponse>;
}

// ── KPI cards ─────────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  positive = true,
  sub,
}: {
  label: string;
  value: string;
  positive?: boolean;
  sub?: string;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--rb-border-1)] bg-surface p-[18px] shadow-[var(--rb-shadow-xs)]">
      <div className="text-[12px] font-medium text-fg-3">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2.5">
        <span
          className={cn(
            "text-[28px] font-semibold leading-tight tracking-[-0.025em] tabular-nums",
            positive ? "text-fg-1" : "text-[var(--rb-red-500)]",
          )}
        >
          {value}
        </span>
      </div>
      {sub && <div className="mt-1.5 text-[11px] text-fg-3">{sub}</div>}
    </div>
  );
}

function RatingKpi({
  yourApp,
  competitors,
}: {
  yourApp: CompetitorBenchmarkRow;
  competitors: CompetitorBenchmarkRow[];
}) {
  if (!yourApp.rating) return null;

  const rated = [yourApp, ...competitors].filter((c) => c.rating !== null);
  if (rated.length < 2) return null;

  const sorted = [...rated].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  const yourRank = sorted.findIndex((c) => c.you) + 1;
  const top = sorted[0];
  const gap = top.you ? null : Math.round(((top.rating ?? 0) - (yourApp.rating ?? 0)) * 10) / 10;

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <MetricCard label="Your rank" value={`#${yourRank}`} sub={`of ${rated.length} tracked`} />
      <MetricCard
        label={gap ? "Gap to #1" : "You're #1"}
        value={gap ? `${gap}★` : "★"}
        positive={!gap}
        sub={gap ? `vs ${top.name}` : "Highest rating of the tracked set"}
      />
      {yourApp.replyRate !== null && (
        <MetricCard
          label="Your reply rate"
          value={`${yourApp.replyRate}%`}
          sub="last 30 days — competitors' rates aren't public"
        />
      )}
    </section>
  );
}

// ── Sparkline (your app only — competitor history isn't available) ────────────

function MiniSparkline({ values, positive = true }: { values: number[]; positive?: boolean }) {
  const w = 64, h = 24;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const xs = (i: number) => (i / (values.length - 1)) * w;
  const ys = (v: number) => h - ((v - min) / range) * h;
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${xs(i)},${ys(v)}`).join(" ");
  return (
    <svg width={w} height={h} style={{ display: "block" }} aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={positive ? "var(--rb-green-500)" : "var(--rb-red-500)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Add competitor dialog ─────────────────────────────────────────────────────

interface SearchResult {
  storeId: string;
  name: string;
  developer: string;
  icon: string | null;
  rating: number | null;
}

function AddCompetitorDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  const [platform, setPlatform] = useState<"app-store" | "google-play">("app-store");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);

  // Debounced store search — same endpoint the onboarding wizard uses.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchFailed(false);
      return;
    }
    // Clearing the timer doesn't stop a request that already went out, so a
    // slow earlier response could land after a newer one and leave results
    // that don't match what's in the box.
    let stale = false;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({ platform, query: q });
        const res = await fetch(`/api/onboarding/search-app?${params.toString()}`);
        const data = (await res.json()) as { results?: SearchResult[]; searchFailed?: boolean };
        if (stale) return;
        setResults(data.results ?? []);
        setSearchFailed(Boolean(data.searchFailed));
      } catch {
        if (stale) return;
        setResults([]);
        setSearchFailed(true);
      } finally {
        if (!stale) setSearching(false);
      }
    }, 350);
    return () => { stale = true; clearTimeout(t); };
  }, [query, platform, open]);

  async function handleAdd(r: SearchResult) {
    setAddingId(r.storeId);
    setAddError(null);
    try {
      const res = await fetch("/api/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: platform === "app-store" ? "app_store" : "google_play",
          storeId: r.storeId,
          name: r.name,
          iconUrl: r.icon,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { code?: string } } | null;
        const code = body?.error?.code;
        setAddError(
          code === "ALREADY_EXISTS"
            ? "Already tracking this app."
            : code === "QUOTA_EXCEEDED"
              ? "You can track up to 5 competitors — remove one first."
              : "Couldn't add this app. Try again.",
        );
        return;
      }
      track({
        name: "competitor_added",
        properties: { platform: platform === "app-store" ? "app_store" : "google_play" },
      });
      onAdded();
      onOpenChange(false);
      setQuery("");
      setResults([]);
    } finally {
      setAddingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a competitor</DialogTitle>
        </DialogHeader>

        {/* Platform toggle */}
        <div className="flex rounded-lg border border-[var(--rb-border-2)] p-0.5">
          {(
            [
              ["app-store", "App Store"],
              ["google-play", "Google Play"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => { setPlatform(value); setResults([]); }}
              className={cn(
                "h-7 flex-1 rounded-md text-[12px] font-semibold transition-colors",
                platform === value
                  ? "bg-[var(--rb-bg-sunken)] text-fg-1 shadow-[var(--rb-shadow-xs)]"
                  : "text-fg-3 hover:text-fg-2",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search box */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-3" strokeWidth={1.5} />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={platform === "app-store" ? "Search the App Store…" : "Search Google Play…"}
            className="h-9 w-full rounded-lg border border-[var(--rb-border-2)] bg-surface pl-8 pr-3 text-[13px] text-fg-1 outline-none placeholder:text-fg-3 focus:border-[var(--rb-blue-400)]"
          />
        </div>

        {/* Results */}
        <div className="max-h-64 overflow-y-auto">
          {searching && (
            <div className="flex items-center gap-2 px-1 py-3 text-[12px] text-fg-3">
              <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} /> Searching…
            </div>
          )}
          {!searching && searchFailed && (
            <p className="px-1 py-3 text-[12px] text-fg-3">
              Store search is unavailable right now — try again in a minute.
            </p>
          )}
          {!searching && !searchFailed && query.trim().length >= 2 && results.length === 0 && (
            <p className="px-1 py-3 text-[12px] text-fg-3">No apps matched.</p>
          )}
          {results.map((r) => (
            <button
              key={r.storeId}
              onClick={() => handleAdd(r)}
              disabled={addingId !== null}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-50"
            >
              {r.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.icon} alt="" className="size-8 shrink-0 rounded-lg object-cover" />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--rb-bg-sunken)] text-[12px] font-bold text-fg-3">
                  {r.name[0]?.toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-fg-1">{r.name}</span>
                <span className="block truncate text-[11px] text-fg-3">{r.developer}</span>
              </span>
              {addingId === r.storeId ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-fg-3" strokeWidth={1.5} />
              ) : (
                <Plus className="size-4 shrink-0 text-[var(--rb-blue-500)]" />
              )}
            </button>
          ))}
        </div>

        {addError && <p className="text-[12px] text-[var(--rb-red-500)]">{addError}</p>}
      </DialogContent>
    </Dialog>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export function CompetitorsScreen() {
  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<CompetitorsResponse>({
    queryKey: ["competitors"],
    queryFn: fetchCompetitors,
    staleTime: 5 * 60_000,
  });

  const yourApp = data?.yourApp ?? null;
  const competitors = data?.competitors ?? [];
  const canAdd = data?.canAdd ?? false;
  const rows: CompetitorBenchmarkRow[] = yourApp ? [yourApp, ...competitors] : competitors;
  const hasIllustrative = competitors.some((c) => c.illustrative);

  async function handleRemove(id: string) {
    setRemovingId(id);
    try {
      const res = await fetch(`/api/competitors/${id}`, { method: "DELETE" });
      if (res.ok) await qc.invalidateQueries({ queryKey: ["competitors"] });
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 overflow-auto p-8">
      {/* Header */}
      <header className="flex items-end justify-between gap-6">
        <div>
          <div className="text-[12px] font-medium text-fg-3">{yourApp?.name ?? "All apps"}</div>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.022em] text-fg-1">
            Competitors
          </h1>
        </div>
        {canAdd && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[var(--rb-blue-500)] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--rb-blue-600)]"
          >
            <Plus className="size-3.5" />
            Add competitor
          </button>
        )}
      </header>

      {/* KPI strip */}
      {yourApp && !isLoading && <RatingKpi yourApp={yourApp} competitors={competitors} />}

      {/* Benchmark table */}
      <div className="overflow-hidden rounded-[14px] border border-[var(--rb-border-1)] bg-surface shadow-[var(--rb-shadow-xs)]">
        <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-4">
          <div>
            <div className="text-[14px] font-semibold tracking-[-0.01em] text-fg-1">
              Competitive benchmark
            </div>
            <div className="mt-0.5 text-[12px] text-fg-3">
              Ratings refresh from the store every few hours
            </div>
          </div>
          {!canAdd && (
            <span
              title="Competitor tracking needs a database update — it ships with the next release"
              className="ml-auto flex h-7 cursor-default items-center rounded-[7px] border border-dashed border-[var(--rb-border-2)] px-3 text-[12px] font-medium text-fg-3"
            >
              Add competitor · coming soon
            </span>
          )}
        </div>

        {/* Illustrative data notice (only while migration 016 is pending) */}
        {hasIllustrative && (
          <div className="border-b border-[var(--rb-border-1)] bg-[var(--rb-amber-100)]/50 px-5 py-2.5 text-[12px] text-[var(--rb-amber-600)]">
            Competitor rows are illustrative placeholders — your real data is in the{" "}
            <strong>You</strong> row. Real competitor tracking is enabled with the next
            database update.
          </div>
        )}

        {isLoading ? (
          <div className="px-5 py-8 text-center text-[13px] text-fg-3">Loading…</div>
        ) : canAdd && competitors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
            <p className="text-[14px] font-semibold text-fg-1">No competitors tracked yet</p>
            <p className="max-w-sm text-[12.5px] leading-relaxed text-fg-3">
              Track up to 5 apps to see their store rating next to yours. Ratings come
              straight from the store listing — we never invent numbers.
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-1 flex h-8 items-center gap-1.5 rounded-lg border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-semibold text-fg-1 transition-colors hover:bg-[var(--rb-bg-hover)]"
            >
              <Plus className="size-3.5" />
              Add your first competitor
            </button>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["App", "Rating", "Total ratings", "Reply rate", "6-week trend", ""].map((h, i) => (
                  <th
                    key={i}
                    className="border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-3"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => {
                const border = i < rows.length - 1 ? "border-b border-[var(--rb-border-1)]" : "";
                return (
                  <tr
                    key={c.id ?? c.name}
                    className={cn(
                      "group transition-colors hover:bg-[var(--rb-bg-hover)]",
                      c.you && "bg-[#0A84FF]/[0.04]",
                      c.illustrative && "opacity-60",
                    )}
                  >
                    <td className={cn("px-5 py-3", border)}>
                      <div className="flex items-center gap-2.5">
                        {c.iconUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.iconUrl} alt="" className="size-7 shrink-0 rounded-lg object-cover" />
                        ) : (
                          <div
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold",
                              c.you ? "bg-[var(--rb-blue-500)] text-white" : "bg-[var(--rb-bg-raised)] text-fg-2",
                            )}
                          >
                            {c.name[0]}
                          </div>
                        )}
                        <span className={cn("text-[13px] font-semibold", c.you ? "text-fg-1" : "text-fg-2")}>
                          {c.name}
                          {c.you && (
                            <span className="ml-1.5 rounded-full bg-[#0A84FF]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#0A84FF]">
                              You
                            </span>
                          )}
                          {c.illustrative && (
                            <span className="ml-1.5 rounded-full bg-[var(--rb-amber-100)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--rb-amber-600)]">
                              sample
                            </span>
                          )}
                          {c.platform && (
                            <span className="ml-1.5 text-[10px] font-medium text-fg-3">
                              {c.platform === "app_store" ? "App Store" : "Google Play"}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className={cn("px-5 py-3 text-[13px] font-semibold tabular-nums text-fg-1", border)}>
                      {c.rating ? `★ ${c.rating.toFixed(1)}` : "—"}
                    </td>
                    <td className={cn("px-5 py-3 text-[13px] tabular-nums text-fg-2", border)}>
                      {c.ratingCount != null ? c.ratingCount.toLocaleString() : "—"}
                    </td>
                    <td className={cn("px-5 py-3", border)}>
                      {c.replyRate !== null ? (
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 w-[80px] overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
                            <div
                              className={cn(
                                "h-full rounded-full",
                                c.replyRate >= 60
                                  ? "bg-[var(--rb-green-500)]"
                                  : c.replyRate >= 40
                                    ? "bg-[var(--rb-amber-500)]"
                                    : "bg-[var(--rb-red-500)]",
                              )}
                              style={{ width: `${c.replyRate}%` }}
                            />
                          </div>
                          <span className="text-[12px] tabular-nums text-fg-3">{c.replyRate}%</span>
                        </div>
                      ) : (
                        <span className="text-[12px] text-fg-3" title="Reply rates aren't public — only your own is measurable">
                          —
                        </span>
                      )}
                    </td>
                    <td className={cn("px-5 py-3", border)}>
                      {c.trend ? (
                        <MiniSparkline
                          values={c.trend}
                          positive={c.trend[c.trend.length - 1] >= c.trend[0]}
                        />
                      ) : (
                        <span className="text-[12px] text-fg-4">—</span>
                      )}
                    </td>
                    <td className={cn("w-10 px-3 py-3 text-right", border)}>
                      {c.id && !c.you && (
                        <button
                          onClick={() => handleRemove(c.id!)}
                          disabled={removingId === c.id}
                          aria-label={`Stop tracking ${c.name}`}
                          className="rounded p-1 text-fg-4 opacity-0 transition-opacity hover:text-fg-1 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50"
                        >
                          {removingId === c.id ? (
                            <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
                          ) : (
                            <X className="size-3.5" strokeWidth={1.5} />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <AddCompetitorDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onAdded={() => void qc.invalidateQueries({ queryKey: ["competitors"] })}
      />
    </div>
  );
}
