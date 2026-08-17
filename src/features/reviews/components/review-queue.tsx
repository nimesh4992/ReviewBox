"use client";

import { useState, useEffect, useCallback, useRef, useDeferredValue } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCheck, Inbox, Loader2, MessageSquareDiff, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { AppReview } from "@/types/review";
import { apiErrorMessage } from "@/lib/api-error-message";
import { ReviewRow } from "./review-row";
import { ReplyComposer } from "./reply-composer-panel";
import { GroupReplyPanel } from "./group-reply-panel";
import { useMarkReplied, useMarkDraft } from "../hooks/use-review-cache";
import { isNarrowingFilter, type InboxFilter } from "@/lib/inbox-filter";
import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";

function EmptyDetail({ className }: { className?: string }) {
  return (
    <div className={cn("flex w-full sm:w-[420px] shrink-0 flex-col items-center justify-center gap-3 border-l border-[var(--rb-border-1)] bg-[var(--rb-bg-surface)] text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl bg-[var(--rb-bg-sunken)]">
        <Inbox className="size-5 text-[var(--rb-fg-4)]" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[13px] font-semibold text-[var(--rb-fg-1)]">Select a review</p>
        <p className="mt-1 text-[12px] text-[var(--rb-fg-3)]">Click any review to read it and draft a reply.</p>
      </div>
    </div>
  );
}

// ── InboxScreen ───────────────────────────────────────────────────────────────

type InboxSort   = "newest" | "lowest";

interface InboxScreenProps {
  reviews: AppReview[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isFetching?: boolean;
  /** True when the reviews fetch failed — distinguishes it from an empty inbox. */
  loadError?: boolean;
  fetchNextPage?: () => void;
  /**
   * App the inbox is scoped to (undefined = all apps). The server-side search
   * below MUST carry it: without it, typing three characters replaced an
   * app-scoped list with workspace-wide results, and every count, filter pill
   * and version chip derived from the leaked set.
   */
  appId?: string;
  /**
   * Controlled by the page, because the chip drives the FETCH — see
   * lib/inbox-filter.ts. Local state here meant the chips filtered whatever
   * page happened to be loaded.
   */
  activeFilter: InboxFilter;
  onFilterChange: (filter: InboxFilter) => void;
}

export function InboxScreen({
  reviews,
  hasNextPage = false,
  isFetchingNextPage = false,
  isFetching = false,
  loadError = false,
  fetchNextPage,
  appId,
  activeFilter,
  onFilterChange,
}: InboxScreenProps) {
  // Seed search from ?search= so the global header search box actually
  // filters the inbox when it navigates here.
  const urlSearch = useSearchParams().get("search") ?? "";
  const [selectedId, setSelectedId]         = useState<string | null>(reviews[0]?.id ?? null);
  const [mobilePane, setMobilePane]         = useState<"list" | "detail">("list");
  const [sort, setSort]                     = useState<InboxSort>("newest");
  const [search, setSearch]                 = useState(urlSearch);
  const [versionFilter, setVersionFilter]   = useState<string>("all");
  const [groupMode, setGroupMode]           = useState(false);
  const [selectMode, setSelectMode]           = useState(false);
  const [manuallySelected, setManuallySelected] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking]         = useState(false);
  const [bulkError, setBulkError]             = useState<string | null>(null);
  const [groupReviewsOverride, setGroupReviewsOverride] = useState<AppReview[] | null>(null);
  const markRepliedBulk                       = useMarkReplied();
  const markDraftQuick                        = useMarkDraft();

  // Quick draft — generate AI reply and save as draft_ready without opening composer
  const handleQuickDraft = useCallback(async (review: AppReview) => {
    const draftRes = await fetch("/api/reply/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reviewId:   review.id,
        reviewBody: review.text,
        rating:     review.rating,
        tags:       review.issueTags,
        tone:       "professional",
      }),
    });
    if (!draftRes.ok) return;
    const { reply } = (await draftRes.json()) as { reply: string };

    const saveRes = await fetch(`/api/reviews/${review.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyText: reply, status: "draft" }),
    });
    if (!saveRes.ok) return;
    markDraftQuick(review.id, reply);
  }, [markDraftQuick]);

  // ── Server-side full-text search (fires when search ≥ 3 chars) ──────────────
  //
  // React Query, not a hand-rolled useEffect + fetch + cancellation flag. The
  // project's own State Rules say server data belongs in React Query, but the
  // reason to convert this one wasn't tidiness — the hand-rolled version had
  // two silent failures baked into its shape:
  //
  //   1. It never checked `res.ok`. A 500 parses into the error envelope, so
  //      `data.reviews` was undefined, `?? []` turned it into an empty array,
  //      and a failed search rendered as "0 reviews" — identical to a search
  //      that genuinely matched nothing.
  //   2. Its `.catch()` set results back to null, which silently reverted to
  //      client-side filtering of the loaded page. A network failure looked
  //      like a working search over a much smaller set.
  //
  // `isError` makes both visible. `appId` is in the key so switching apps
  // re-runs an active search instead of leaving the previous app's results up.
  const deferredSearch = useDeferredValue(search);
  const searchQuery = deferredSearch.trim();
  const searchActive = searchQuery.length >= 3;

  const {
    data: searchData,
    isFetching: isSearching,
    isError: searchFailed,
  } = useQuery<AppReview[]>({
    queryKey: ["review-search", searchQuery, appId ?? null],
    enabled: searchActive,
    staleTime: 30_000,
    // Keep the previous term's results on screen while the next one loads, so
    // typing doesn't flash the whole list back to the unfiltered set.
    placeholderData: (previous) => previous,
    queryFn: async () => {
      const params = new URLSearchParams({ search: searchQuery, limit: "50" });
      if (appId) params.set("appId", appId);

      const res = await fetch(`/api/reviews?${params.toString()}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(apiErrorMessage(body, "Search failed. Try again."));
      }
      const data = (await res.json()) as { reviews?: AppReview[] };
      return data.reviews ?? [];
    },
  });

  // Null unless a search is actually running — `placeholderData` would
  // otherwise keep the last results visible after the box is cleared.
  const serverResults = searchActive ? searchData ?? null : null;

  // When server search is active, replace the reviews set
  const effectiveReviews = serverResults !== null ? serverResults : reviews;

  // Unique versions from loaded reviews (top 4)
  const uniqueVersions = Array.from(
    new Set(effectiveReviews.map((r) => r.appVersion).filter(Boolean)),
  ).slice(0, 4);

  // ── Chip counts come from the SCOPE, not from what happens to be loaded ─────
  //
  // These were `effectiveReviews.filter(...).length` — counted over the first
  // page of 20. So an app with 260 reviews and 117 unreplied showed "All · 20 /
  // Unreplied · 20", and the header said "20 reviews". Every number on the
  // screen described the page rather than the app.
  //
  // The counts are NOT recomputed here from a new query. `/api/dashboard/metrics`
  // already returns them, scoped by appId and validated against the workspace's
  // live apps — and the sidebar badge already reads from it, which is why the
  // badge (117) and this header (20) disagreed. Adding a second implementation
  // would be finding M-2 again: two hand-maintained answers to one question,
  // drifting silently. One source, so they cannot.
  //
  // Free, too: the sidebar mounts this same query on every page, and the key is
  // ["dashboard-metrics", appId ?? "all"] — so this is a cache read.
  const { data: scope } = useDashboardMetrics(appId);
  const scopeTotal     = scope?.totalReviews ?? null;
  const unrepliedCount = scope?.unrepliedCount ?? null;
  const lowRatingCount = scope?.lowRatingCount ?? null;

  /** `· N` when the scope count is known, nothing while it loads. */
  const count = (n: number | null) => (n === null ? "" : ` · ${n}`);

  /**
   * The scope total that matches the ACTIVE chip — what the header compares
   * the loaded rows against.
   *
   * Null for the platform chips: `/api/dashboard/metrics` is scoped by app, not
   * by store, so there is no honest total to show there. The header falls back
   * to a plain count rather than quoting the all-stores figure, which would be
   * a bigger number than the filter can ever reach.
   */
  /**
   * Is the empty list the FILTER's doing rather than an empty workspace?
   *
   * Includes `versionFilter`, not just the chip — the version dropdown narrows
   * the same list and produced the same misleading "connect an app" message.
   */
  const filterIsNarrowing = isNarrowingFilter(activeFilter) || versionFilter !== "all";

  const activeScopeTotal =
    activeFilter === "all"        ? scopeTotal
    : activeFilter === "unreplied"  ? unrepliedCount
    : activeFilter === "low_rating" ? lowRatingCount
    : null;

  const FILTERS: { value: InboxFilter; label: React.ReactNode }[] = [
    { value: "all",        label: `All${count(scopeTotal)}` },
    {
      value: "unreplied",
      label: (
        <>
          <span className="inline-block size-1.5 rounded-full bg-[var(--rb-blue-500)]" />
          {` Unreplied${count(unrepliedCount)}`}
        </>
      ),
    },
    { value: "low_rating", label: `1–2 ★${count(lowRatingCount)}` },
    { value: "app_store",  label: "App Store" },
    { value: "play_store", label: "Play Store" },
  ];

  // No chip filter here any more — `/api/reviews` applied it before these rows
  // were fetched (lib/inbox-filter.ts). Re-filtering client-side would be a
  // no-op at best, and at worst a second, drifting definition of "unreplied".
  //
  // The VERSION dropdown stays client-side: its options are derived from the
  // loaded rows, so it can only ever narrow what is already here.
  const filtered = effectiveReviews
    .filter((r) => versionFilter !== "all" ? r.appVersion === versionFilter : true)
    // Client-side text filter only when server search isn't active (< 3 chars)
    .filter((r) => {
      if (serverResults !== null) return true; // already filtered server-side
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return r.text.toLowerCase().includes(q) || r.author.toLowerCase().includes(q);
    });

  const sorted = sort === "lowest"
    ? [...filtered].sort((a, b) => a.rating - b.rating)
    : filtered;

  const selected     = sorted.find((r) => r.id === selectedId) ?? null;
  const groupCount   = sorted.filter((r) => r.replyStatus === "needs_reply").length;
  const showGroupBtn = groupCount >= 2 && !groupMode;

  function toggleSelect(id: string) {
    setManuallySelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setManuallySelected(new Set());
  }

  async function handleBulkMarkReplied() {
    if (manuallySelected.size === 0) return;
    setBulkWorking(true);
    setBulkError(null);
    const ids = Array.from(manuallySelected);
    try {
      const res = await fetch("/api/reviews/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "mark_replied" }),
      });

      if (!res.ok) {
        // Had no failure branch and no catch at all: a rejected bulk action
        // left the selection intact and the bar unchanged, which looks
        // identical to "nothing happened yet". The user would reasonably
        // click again, and keep clicking.
        const data = (await res.json().catch(() => null)) as
          | { error?: { code?: string } }
          | null;
        setBulkError(
          `Couldn't mark ${ids.length} ${ids.length === 1 ? "review" : "reviews"} replied — ${apiErrorMessage(data, "please try again.")}`,
        );
        return;
      }

      // Update cache for each selected review
      for (const id of ids) {
        markRepliedBulk(id, "");
      }
      exitSelectMode();
    } catch {
      setBulkError("Network error — check your connection and try again.");
    } finally {
      setBulkWorking(false);
    }
  }

  // Auto-advance after single reply
  const handleAdvance = useCallback((currentId: string) => {
    const currentIndex = sorted.findIndex((r) => r.id === currentId);
    const nextUnreplied = sorted.slice(currentIndex + 1).find((r) => r.replyStatus === "needs_reply");
    const nextAny       = sorted[currentIndex + 1] ?? sorted[currentIndex - 1];
    const next          = nextUnreplied ?? nextAny;
    if (next) setSelectedId(next.id);
  }, [sorted]);

  // ── Keyboard flow ────────────────────────────────────────────────────────────
  // j/k (or arrows) move the selection, Enter jumps to the composer, "/" jumps
  // to search. Triage without touching the mouse. Handlers bail out whenever
  // focus is in an input/textarea so typing a reply never moves the selection.
  const sortedRef = useRef(sorted);
  sortedRef.current = sorted;
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;

  useEffect(() => {
    function isTypingTarget(el: EventTarget | null): boolean {
      if (!(el instanceof HTMLElement)) return false;
      return (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable
      );
    }

    function moveSelection(delta: 1 | -1) {
      const list = sortedRef.current;
      if (list.length === 0) return;
      const idx = list.findIndex((r) => r.id === selectedIdRef.current);
      const next = list[idx === -1 ? 0 : Math.min(Math.max(idx + delta, 0), list.length - 1)];
      if (!next || next.id === selectedIdRef.current) return;
      setSelectedId(next.id);
      setMobilePane("list");
      // Keep the keyboard selection visible as it walks past the fold
      requestAnimationFrame(() => {
        document
          .querySelector(`[data-review-id="${CSS.escape(next.id)}"]`)
          ?.scrollIntoView({ block: "nearest" });
      });
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      switch (e.key) {
        case "j":
        case "ArrowDown":
          e.preventDefault();
          moveSelection(1);
          break;
        case "k":
        case "ArrowUp":
          e.preventDefault();
          moveSelection(-1);
          break;
        case "Enter": {
          // Row-level Enter (focused row) already opens; this catches the
          // "selection exists, focus elsewhere" case and drops into the composer.
          const el = document.getElementById("rb-composer-input");
          if (el) {
            e.preventDefault();
            el.focus();
          }
          break;
        }
        case "/": {
          e.preventDefault();
          const search = document.querySelector<HTMLInputElement>("[data-inbox-search]");
          search?.focus();
          break;
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Left — review list ─────────────────────────────────────────────── */}
      <div className={cn("relative min-w-0 flex-1 flex-col overflow-hidden", mobilePane === "detail" ? "hidden sm:flex" : "flex")}>

        {/* Header */}
        <div className="shrink-0 border-b border-[var(--rb-border-1)] px-5 pb-4 pt-5">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--rb-fg-3)]">
                <span>
                  {searchActive && searchFailed && !isSearching ? (
                    // Was indistinguishable from "nothing matched" — see the
                    // note on the search query above.
                    <span className="text-[var(--rb-red-500)]">
                      Search failed — showing the reviews already loaded. Try again.
                    </span>
                  ) : isSearching ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                      Searching…
                    </span>
                  ) : (
                    <>
                      {serverResults !== null ? (
                        <>
                          {sorted.length} search result{sorted.length !== 1 ? "s" : ""}
                        </>
                      ) : activeScopeTotal === null ? (
                        // Platform chips, or metrics still loading: no scope
                        // total to compare against, so don't invent one.
                        <>{sorted.length} review{sorted.length !== 1 ? "s" : ""}</>
                      ) : sorted.length < activeScopeTotal ? (
                        // The number the founder asked for: what you can see,
                        // out of what exists. This said "20 reviews" for an app
                        // with 260 of them.
                        <>Showing {sorted.length} of {activeScopeTotal}</>
                      ) : (
                        <>{activeScopeTotal} review{activeScopeTotal !== 1 ? "s" : ""}</>
                      )}
                    </>
                  )}
                </span>
                {/* Live-refresh indicator — pulses while polling */}
                <span
                  title="Auto-refreshes every 60 seconds"
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-semibold",
                    isFetching && !isFetchingNextPage ? "text-[var(--rb-blue-500)]" : "text-[var(--rb-fg-4)]",
                  )}
                >
                  <span className={cn(
                    "size-1.5 rounded-full",
                    isFetching && !isFetchingNextPage ? "animate-pulse bg-[var(--rb-blue-500)]" : "bg-[var(--rb-fg-4)]",
                  )} />
                  Live
                </span>
                {sorted.length > 0 && (
                  <span className="font-normal text-[var(--rb-fg-4)]">
                    · {(sorted.reduce((sum, r) => sum + r.rating, 0) / sorted.length).toFixed(1)}★ avg in view
                  </span>
                )}
              </div>
              <h1
                className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.022em] text-[var(--rb-fg-1)]"
              >
                Inbox
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {/* Group reply button — appears when 2+ unreplied in current filter */}
              {showGroupBtn && !selectMode && (
                <button
                  onClick={() => { setGroupMode(true); setSelectedId(null); setGroupReviewsOverride(null); }}
                  className="flex h-8 items-center gap-1.5 rounded-[8px] bg-[var(--rb-bg-accent-soft)] px-3 text-[12px] font-semibold text-[var(--rb-blue-500)] transition-colors hover:bg-[var(--rb-blue-100)]"
                >
                  <MessageSquareDiff className="size-3.5" />
                  Reply all · {groupCount}
                </button>
              )}
              {/* Select / cancel select */}
              <button
                onClick={() => { if (selectMode) exitSelectMode(); else { setSelectMode(true); setGroupMode(false); setSelectedId(null); } }}
                className={cn(
                  "h-8 rounded-[8px] px-3 text-[12px] font-semibold transition-colors",
                  selectMode
                    ? "bg-[var(--rb-bg-sunken)] text-[var(--rb-fg-1)]"
                    : "text-[var(--rb-fg-2)] hover:bg-[var(--rb-bg-hover)]",
                )}
              >
                {selectMode ? "Cancel" : "Select"}
              </button>
              {/* Sort */}
              <div className="flex shrink-0 items-center rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-0.5">
                {(["newest", "lowest"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSort(s)}
                    className={cn(
                      "h-6 rounded-md px-3 text-[12px] font-semibold capitalize transition-colors",
                      sort === s
                        ? "bg-[var(--rb-bg-surface)] text-[var(--rb-fg-1)] shadow-[var(--rb-shadow-xs)]"
                        : "text-[var(--rb-fg-3)] hover:text-[var(--rb-fg-2)]",
                    )}
                  >
                    {s === "newest" ? "Newest" : "Lowest rated"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--rb-fg-3)]" strokeWidth={1.5} />
            <input
              data-inbox-search
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") (e.target as HTMLInputElement).blur();
              }}
              placeholder="Search reviews…   ( / )"
              className="h-9 w-full rounded-[8px] border border-[var(--rb-border-2)] bg-[var(--rb-bg-sunken)] pl-8 pr-7 text-[13px] text-[var(--rb-fg-1)] placeholder:text-[var(--rb-fg-3)] outline-none transition-colors focus:border-[var(--rb-border-2)]"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--rb-fg-3)] hover:text-[var(--rb-fg-2)]"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          {/* Filter chips — status and version share one wrapping row, so the
              header spends one band on filtering instead of two. */}
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => onFilterChange(f.value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-3 text-[12px] font-semibold transition-colors",
                  activeFilter === f.value
                    ? "border-[var(--rb-blue-500)] bg-[var(--rb-bg-accent-soft)] text-[var(--rb-blue-500)]"
                    : "border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] text-[var(--rb-fg-2)] hover:bg-[var(--rb-bg-hover)]",
                )}
              >
                {f.label}
              </button>
            ))}
            {uniqueVersions.length > 1 && (
              <label className="ml-auto flex h-7 shrink-0 items-center gap-1.5 text-[11px] font-medium text-[var(--rb-fg-3)]">
                Version
                <select
                  value={versionFilter}
                  onChange={(e) => setVersionFilter(e.target.value)}
                  className={cn(
                    "h-7 cursor-pointer rounded-[7px] border bg-[var(--rb-bg-surface)] pl-2 pr-1.5 text-[12px] font-semibold tabular-nums transition-colors",
                    versionFilter !== "all"
                      ? "border-[var(--rb-blue-500)] bg-[var(--rb-bg-accent-soft)] text-[var(--rb-blue-500)]"
                      : "border-[var(--rb-border-2)] text-[var(--rb-fg-1)] hover:bg-[var(--rb-bg-hover)]",
                  )}
                >
                  <option value="all">All</option>
                  {uniqueVersions.map((v) => (
                    <option key={v} value={v}>v{v}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          {/* The old five-stat KPI strip lived here. Four of its numbers were
              noise on this screen (total/shown sit in the meta line, unreplied
              is the filter chip, replied/reply-rate were zeros) — the one
              unique signal, average rating in view, now rides the meta line. */}
        </div>

        {/* Review rows */}
        <div
          role="listbox"
          aria-label="Reviews"
          aria-multiselectable={selectMode || undefined}
          className="flex-1 overflow-y-auto"
        >
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <Inbox className="size-10 text-[var(--rb-fg-4)]" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold text-[var(--rb-fg-1)]">
                  {loadError
                    ? "We couldn't load your reviews"
                    : search
                      ? "No results"
                      : filterIsNarrowing
                        ? "Nothing matches this filter"
                        : "No reviews"}
                </p>
                <p className="mt-1 text-xs text-[var(--rb-fg-3)]">
                  {loadError
                    ? "Something went wrong on our side — your reviews are still here. Try refreshing in a moment."
                    : search
                      ? `Nothing matched "${search}"`
                      : filterIsNarrowing
                        ? "Your reviews are still here — this filter just doesn't match any of them."
                        : "Connect an app in Settings to start syncing."}
                </p>
              </div>
              {/*
                A filtered-to-zero list used to fall through to "No reviews —
                Connect an app in Settings", offering to onboard a customer who
                already had 130 reviews. The component knew: the header printed
                "0 shown" three lines up. It just never asked.
              */}
              {!search && !loadError && filterIsNarrowing && (
                <button
                  onClick={() => { onFilterChange("all"); setVersionFilter("all"); }}
                  className="rounded-lg border border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--rb-fg-2)] hover:bg-[var(--rb-bg-hover)]"
                >
                  Clear filters
                </button>
              )}
              {!search && !loadError && !filterIsNarrowing && (
                <Link
                  href="/settings"
                  className="rounded-lg border border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--rb-fg-2)] hover:bg-[var(--rb-bg-hover)]"
                >
                  Go to Settings
                </Link>
              )}
            </div>
          ) : (
            <>
              {sorted.map((r) => (
                <ReviewRow
                  key={r.id}
                  review={r}
                  selected={!groupMode && r.id === selectedId}
                  onClick={() => { setGroupMode(false); setSelectedId(r.id); setMobilePane("detail"); }}
                  selectMode={selectMode}
                  isChecked={manuallySelected.has(r.id)}
                  onCheck={toggleSelect}
                  onQuickDraft={handleQuickDraft}
                />
              ))}
              {hasNextPage && (
                <div className="flex justify-center py-4">
                  <button
                    onClick={() => fetchNextPage?.()}
                    disabled={isFetchingNextPage}
                    className="rounded-lg border border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] px-4 py-1.5 text-[12px] font-medium text-[var(--rb-fg-2)] hover:bg-[var(--rb-bg-hover)] disabled:opacity-50"
                  >
                    {isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Bulk action bar — floats above review list when items selected ─ */}
        {selectMode && manuallySelected.size > 0 && (
          <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
            {bulkError && (
              <div
                role="alert"
                className="mb-2 rounded-[10px] border border-[var(--rb-red-500)] bg-[var(--rb-bg-surface)] px-3 py-2 text-[11px] text-[var(--rb-red-500)] shadow-[var(--rb-shadow-sm)]"
              >
                {bulkError}
              </div>
            )}
            <div className="flex items-center gap-2 rounded-[10px] border border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] px-3 py-2 shadow-[var(--rb-shadow-sm)]">
              <span className="text-[12px] font-semibold text-[var(--rb-fg-1)]">
                {manuallySelected.size} selected
              </span>
              <div className="mx-1 h-4 w-px bg-[var(--rb-border-2)]" />
              <button
                onClick={handleBulkMarkReplied}
                disabled={bulkWorking}
                className="flex h-7 items-center gap-1.5 rounded-[7px] bg-[var(--rb-green-500)] px-3 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {bulkWorking ? <Loader2 className="size-3 animate-spin" strokeWidth={1.5} /> : <CheckCheck className="size-3" />}
                Mark replied
              </button>
              <button
                onClick={() => {
                  const selected = sorted.filter((r) => manuallySelected.has(r.id));
                  if (selected.length > 0) {
                    setGroupReviewsOverride(selected);
                    setGroupMode(true);
                    setSelectedId(null);
                    setSelectMode(false);
                    setManuallySelected(new Set());
                  }
                }}
                className="flex h-7 items-center gap-1.5 rounded-[7px] bg-[var(--rb-bg-accent-soft)] px-3 text-[11px] font-semibold text-[var(--rb-blue-500)] transition-colors hover:bg-[var(--rb-blue-100)]"
              >
                <MessageSquareDiff className="size-3" />
                Reply all
              </button>
              <button
                onClick={exitSelectMode}
                className="ml-1 text-[11px] text-[var(--rb-fg-3)] hover:text-[var(--rb-fg-2)]"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right — composer or group panel ───────────────────────────────── */}
      {/* Mobile back button — only visible on small screens when detail pane is active */}
      {mobilePane === "detail" && (
        <button
          onClick={() => setMobilePane("list")}
          className="absolute left-4 top-4 z-10 flex items-center gap-1 text-[12px] text-[var(--rb-fg-3)] hover:text-[var(--rb-fg-1)] sm:hidden"
        >
          ← Back to inbox
        </button>
      )}
      {groupMode ? (
        <GroupReplyPanel
          key={(groupReviewsOverride ?? sorted).map((r) => r.id).join(",")}
          reviews={groupReviewsOverride ?? sorted}
          onDone={() => { setGroupMode(false); setSelectedId(null); setGroupReviewsOverride(null); }}
          onClose={() => { setGroupMode(false); setGroupReviewsOverride(null); }}
        />
      ) : selected ? (
        <ReplyComposer
          key={selected.id}
          review={selected}
          onClose={() => setSelectedId(null)}
          onAdvance={handleAdvance}
          className={mobilePane === "list" ? "hidden sm:flex" : undefined}
        />
      ) : (
        <EmptyDetail className={mobilePane === "list" ? "hidden sm:flex" : undefined} />
      )}
    </div>
  );
}

// Keep backward-compat export name
export { InboxScreen as ReviewQueue };
