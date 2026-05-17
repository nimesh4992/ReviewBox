"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Inbox, Loader2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { AppReview, ReviewSentiment } from "@/types/review";
import { humanizeToken, formatReviewDate } from "@/utils/format";

// ── Stars ─────────────────────────────────────────────────────────────────────

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 20 20" fill={n <= rating ? "#F59E0B" : "var(--rb-border-2)"}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

// ── Sentiment ─────────────────────────────────────────────────────────────────

const SENTIMENT_DOT: Record<ReviewSentiment, string> = {
  critical: "bg-[var(--rb-red-500)]",
  negative: "bg-[var(--rb-amber-500)]",
  mixed:    "bg-[var(--rb-fg-4)]",
  positive: "bg-[var(--rb-green-500)]",
};

const SENTIMENT_BADGE: Record<ReviewSentiment, { label: string; className: string }> = {
  critical: { label: "Critical",  className: "bg-[var(--rb-red-100)]   text-[var(--rb-red-600)]"   },
  negative: { label: "Negative",  className: "bg-[var(--rb-red-100)]   text-[var(--rb-red-600)]"   },
  mixed:    { label: "Mixed",     className: "bg-[var(--rb-bg-sunken)]  text-[var(--rb-fg-3)]"      },
  positive: { label: "Positive",  className: "bg-[var(--rb-green-100)] text-[var(--rb-green-600)]" },
};

// ── App icon avatar ───────────────────────────────────────────────────────────

function AppIconAvatar({ source, size = "sm" }: { source: AppReview["source"]; size?: "sm" | "xs" }) {
  const isIos = source === "App Store";
  return (
    <div className={cn(
      "shrink-0 items-center justify-center rounded-[9px] text-[13px] font-bold text-white",
      isIos ? "bg-gradient-to-br from-[#4592FF] to-[#0058B3]" : "bg-gradient-to-br from-[#34C759] to-[#1A8A36]",
      size === "sm" ? "flex size-9" : "flex size-7 rounded-[7px] text-[11px]",
    )}>
      {isIos ? "A" : "G"}
    </div>
  );
}

// ── Short title ───────────────────────────────────────────────────────────────

function shortTitle(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= 6) return text;
  return words.slice(0, 6).join(" ") + "…";
}

// ── ReviewRow ─────────────────────────────────────────────────────────────────

function ReviewRow({ review, selected, onClick }: {
  review: AppReview;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex cursor-pointer gap-3 border-b border-[var(--rb-border-1)] px-4 py-3.5 transition-colors",
        selected
          ? "bg-[var(--rb-bg-selected)]"
          : "hover:bg-[var(--rb-bg-hover)]",
      )}
    >
      <AppIconAvatar source={review.source} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--rb-fg-1)]">
            {shortTitle(review.text)}
          </span>
          <Stars rating={review.rating} />
          {review.replyStatus === "needs_reply" && (
            <span className="size-[7px] shrink-0 rounded-full bg-[var(--rb-blue-500)]" />
          )}
        </div>
        <div className="mt-1 line-clamp-1 text-[12px] leading-snug text-[var(--rb-fg-2)]">
          {review.text}
        </div>
        <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[11px] text-[var(--rb-fg-3)]">
          <span className="flex items-center gap-1">
            <span className={cn("size-1.5 shrink-0 rounded-full", SENTIMENT_DOT[review.sentiment])} />
            <span className="capitalize">{review.sentiment}</span>
          </span>
          <span>·</span>
          <span className="truncate">{review.author}</span>
          <span>·</span>
          <span className="shrink-0">{review.source === "App Store" ? "iOS" : "Android"}</span>
          <span>·</span>
          <span className="shrink-0 font-mono">v{review.appVersion}</span>
          <span className="ml-auto shrink-0 tabular-nums">{formatReviewDate(review.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

// ── ReplyComposer ─────────────────────────────────────────────────────────────

function ReplyComposer({ review, onClose }: { review: AppReview; onClose: () => void }) {
  const [text, setText]                     = useState("");
  const [isGenerating, setIsGenerating]     = useState(false);
  const [aiSuggestion, setAiSuggestion]     = useState<string | null>(null);
  const [generateError, setGenerateError]   = useState<string | null>(null);
  const [isSending, setIsSending]           = useState(false);
  const [sendFeedback, setSendFeedback]     = useState<"success" | "error" | null>(null);
  const [sendError, setSendError]           = useState<string | null>(null);
  const [replyDone, setReplyDone]           = useState(false);

  const badge = SENTIMENT_BADGE[review.sentiment];

  async function handleGenerate() {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/reply/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: review.id,
          reviewBody: review.text,
          rating: review.rating,
          tags: review.issueTags,
          tone: "professional",
        }),
      });
      if (res.status === 429) { setGenerateError("Daily AI limit reached."); return; }
      if (res.status === 503) { setGenerateError("AI unavailable — try again shortly."); return; }
      if (!res.ok)            { setGenerateError("Something went wrong."); return; }
      const data = (await res.json()) as { reply: string };
      setAiSuggestion(data.reply);
    } catch {
      setGenerateError("Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  }

  // Auto-generate when composer mounts for a new review
  useEffect(() => {
    handleGenerate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSend() {
    if (!text.trim()) return;
    setIsSending(true);
    setSendFeedback(null);
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText: text, status: "sent" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        const msg =
          data.error === "APP_STORE_NOT_CONNECTED"   ? "Connect App Store credentials in Settings first." :
          data.error === "STORE_RATE_LIMITED"        ? "Store rate limit — try again in a few minutes."   :
          data.error === "REVIEW_NOT_FOUND_ON_STORE" ? "Review no longer available on the store."         :
          data.error === "STORE_SUBMIT_FAILED"       ? "Store rejected the reply — check console."         :
          "Something went wrong.";
        setSendFeedback("error");
        setSendError(msg);
        setTimeout(() => { setSendFeedback(null); setSendError(null); }, 4000);
        return;
      }
      setReplyDone(true);
    } catch {
      setSendFeedback("error");
      setTimeout(() => setSendFeedback(null), 2500);
    } finally {
      setIsSending(false);
    }
  }

  async function handleSaveDraft() {
    if (!text.trim()) return;
    await fetch(`/api/reviews/${review.id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ replyText: text, status: "draft" }),
    });
  }

  return (
    <div className="flex w-[420px] shrink-0 flex-col border-l border-[var(--rb-border-1)] bg-[var(--rb-bg-surface)]">

      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--rb-border-1)] px-[18px] py-[14px]">
        <AppIconAvatar source={review.source} size="xs" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[var(--rb-fg-1)]">{review.author}</div>
          <div className="text-[11px] text-[var(--rb-fg-3)]">{review.source} · v{review.appVersion}</div>
        </div>
        <button
          onClick={onClose}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--rb-fg-3)] transition-colors hover:bg-[var(--rb-bg-hover)] hover:text-[var(--rb-fg-2)]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Review detail */}
      <div className="border-b border-[var(--rb-border-1)] px-[18px] py-[14px]">
        <div className="flex items-center gap-2">
          <Stars rating={review.rating} size={14} />
          <span className="text-[12px] text-[var(--rb-fg-3)]">{formatReviewDate(review.createdAt)}</span>
        </div>
        <p className="mt-2 text-[14px] font-semibold leading-snug text-[var(--rb-fg-1)]">
          {shortTitle(review.text)}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--rb-fg-2)]">{review.text}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            badge.className,
          )}>
            <span className={cn("size-1.5 rounded-full", SENTIMENT_DOT[review.sentiment])} />
            {badge.label}
          </span>
          {review.issueTags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-[rgba(142,91,255,0.10)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--rb-purple-500)]"
            >
              <Sparkles className="size-2.5" strokeWidth={2} />
              {humanizeToken(tag)}
            </span>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-[18px] py-[14px]">

        {/* AI suggestion */}
        <div className="rounded-[10px] border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--rb-purple-500)]">
            <Sparkles className="size-2.5" strokeWidth={2} />
            AI suggestion
          </div>
          {isGenerating ? (
            <div className="mt-2 flex items-center gap-2 text-[12px] text-[var(--rb-fg-3)]">
              <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
              Generating…
            </div>
          ) : aiSuggestion ? (
            <>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--rb-fg-2)]">{aiSuggestion}</p>
              <div className="mt-2 flex gap-1.5">
                <button
                  onClick={() => setText(aiSuggestion)}
                  className="h-[26px] rounded-md bg-[var(--rb-bg-surface)] px-2.5 text-[11px] font-semibold text-[var(--rb-fg-1)] shadow-[var(--rb-shadow-xs)] transition-colors hover:bg-[var(--rb-bg-hover)]"
                >
                  Use this
                </button>
                <button
                  onClick={handleGenerate}
                  className="h-[26px] rounded-md px-2.5 text-[11px] font-semibold text-[var(--rb-fg-3)] transition-colors hover:text-[var(--rb-fg-2)]"
                >
                  Regenerate
                </button>
              </div>
            </>
          ) : (
            <div className="mt-1.5">
              {generateError && (
                <p className="mb-1.5 text-[12px] text-[var(--rb-red-500)]">{generateError}</p>
              )}
              <button
                onClick={handleGenerate}
                className="inline-flex h-[26px] items-center gap-1.5 rounded-md bg-[var(--rb-bg-surface)] px-2.5 text-[11px] font-semibold text-[var(--rb-fg-1)] shadow-[var(--rb-shadow-xs)] transition-colors hover:bg-[var(--rb-bg-hover)]"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Reply textarea */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a reply…"
          rows={5}
          className="w-full resize-none rounded-lg border border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] p-2.5 text-[13px] leading-relaxed text-[var(--rb-fg-1)] placeholder:text-[var(--rb-fg-3)] outline-none transition-colors focus:border-[var(--rb-blue-400)]"
          style={{ fontFamily: "var(--rb-font-text)" }}
        />

        {/* Actions */}
        {replyDone ? (
          <p className="text-[12px] font-semibold text-[var(--rb-green-500)]">✓ Reply sent</p>
        ) : (
          <div className="flex items-center gap-2">
            {sendFeedback === "error" && sendError && (
              <p className="text-[11px] text-[var(--rb-red-500)]">{sendError}</p>
            )}
            <button
              onClick={handleSend}
              disabled={isSending || !text.trim()}
              className={cn(
                "h-[30px] rounded-[7px] px-3 text-[12px] font-semibold text-white transition-colors disabled:opacity-50",
                sendFeedback === "error"
                  ? "bg-[var(--rb-red-500)] hover:bg-[var(--rb-red-600)]"
                  : "bg-[var(--rb-blue-500)] hover:bg-[var(--rb-blue-600)]",
              )}
            >
              {isSending ? "Posting…" : sendFeedback === "error" ? "Retry" : "Post reply"}
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={!text.trim()}
              className="h-[30px] rounded-[7px] border border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] px-3 text-[12px] font-semibold text-[var(--rb-fg-1)] transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-40"
            >
              Save draft
            </button>
            <span className="ml-auto shrink-0 text-[11px] text-[var(--rb-fg-3)]">
              {review.source === "App Store" ? "Posts to App Store" : "Posts to Google Play"} · ~5 min
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyDetail() {
  return (
    <div className="flex w-[420px] shrink-0 flex-col items-center justify-center gap-3 border-l border-[var(--rb-border-1)] bg-[var(--rb-bg-surface)] text-center">
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

type InboxFilter = "all" | "unreplied" | "low_rating" | "app_store" | "play_store";
type InboxSort   = "newest" | "lowest";

interface InboxScreenProps {
  reviews: AppReview[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

export function InboxScreen({
  reviews,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
}: InboxScreenProps) {
  const [selectedId, setSelectedId]     = useState<string | null>(reviews[0]?.id ?? null);
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [sort, setSort]                 = useState<InboxSort>("newest");

  const unrepliedCount = reviews.filter((r) => r.replyStatus === "needs_reply").length;
  const lowRatingCount = reviews.filter((r) => r.rating <= 2).length;

  const FILTERS: { value: InboxFilter; label: React.ReactNode }[] = [
    { value: "all",        label: `All · ${reviews.length}` },
    {
      value: "unreplied",
      label: (
        <>
          <span className="inline-block size-1.5 rounded-full bg-[var(--rb-blue-500)]" />
          {` Unreplied · ${unrepliedCount}`}
        </>
      ),
    },
    { value: "low_rating", label: `1–2 ★ · ${lowRatingCount}` },
    { value: "app_store",  label: "App Store · iOS" },
    { value: "play_store", label: "Play Store · Android" },
  ];

  const filtered = reviews.filter((r) => {
    if (activeFilter === "unreplied")  return r.replyStatus === "needs_reply";
    if (activeFilter === "low_rating") return r.rating <= 2;
    if (activeFilter === "app_store")  return r.source === "App Store";
    if (activeFilter === "play_store") return r.source === "Google Play";
    return true;
  });

  const sorted = sort === "lowest"
    ? [...filtered].sort((a, b) => a.rating - b.rating)
    : filtered;

  const selected = sorted.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">

      {/* ── Left — review list ─────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Header */}
        <div className="shrink-0 border-b border-[var(--rb-border-1)] px-7 pb-3.5 pt-5">
          <div className="mb-3.5 flex items-end justify-between gap-4">
            <div>
              <div className="text-[12px] font-medium text-[var(--rb-fg-3)]">
                {reviews.length} review{reviews.length !== 1 ? "s" : ""} this week
              </div>
              <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.022em] text-[var(--rb-fg-1)]"
                  style={{ fontFamily: "var(--rb-font-display)" }}>
                Inbox
              </h1>
            </div>
            {/* Sort control */}
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
                  {s === "newest" ? "Newest" : "Lowest ★"}
                </button>
              ))}
            </div>
          </div>

          {/* Filter chips */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setActiveFilter(f.value)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-[7px] border px-3 text-[12px] font-semibold transition-colors",
                  activeFilter === f.value
                    ? "border-[var(--rb-border-3)] bg-[var(--rb-bg-sunken)] text-[var(--rb-fg-1)]"
                    : "border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] text-[var(--rb-fg-2)] hover:bg-[var(--rb-bg-hover)]",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Review rows */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
              <Inbox className="size-10 text-[var(--rb-fg-4)]" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold text-[var(--rb-fg-1)]">No reviews</p>
                <p className="mt-1 text-xs text-[var(--rb-fg-3)]">
                  Connect an app in Settings to start syncing.
                </p>
              </div>
              <Link
                href="/settings"
                className="rounded-lg border border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--rb-fg-2)] hover:bg-[var(--rb-bg-hover)]"
              >
                Go to Settings
              </Link>
            </div>
          ) : (
            <>
              {sorted.map((r) => (
                <ReviewRow
                  key={r.id}
                  review={r}
                  selected={r.id === selectedId}
                  onClick={() => setSelectedId(r.id)}
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
      </div>

      {/* ── Right — detail + composer ──────────────────────────────────────── */}
      {selected
        ? <ReplyComposer key={selected.id} review={selected} onClose={() => setSelectedId(null)} />
        : <EmptyDetail />
      }
    </div>
  );
}

// Keep backward-compat export name used by old /reviews page
export { InboxScreen as ReviewQueue };
