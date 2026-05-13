"use client";

import { useState } from "react";
import Link from "next/link";
import { Inbox, Loader2, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  AppReview,
  ReviewSentiment,
} from "@/types/review";
import { humanizeToken } from "@/utils/format";

// ── Stars ─────────────────────────────────────────────────────────────────────

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 20 20" fill={n <= rating ? "#F59E0B" : "#E5E7EB"}>
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

// ── Sentiment dot ─────────────────────────────────────────────────────────────

const SENTIMENT_DOT: Record<ReviewSentiment, string> = {
  critical: "bg-red-500",
  negative: "bg-amber-400",
  mixed:    "bg-gray-300",
  positive: "bg-emerald-400",
};

const SENTIMENT_BADGE: Record<ReviewSentiment, { label: string; className: string }> = {
  critical: { label: "Critical",  className: "bg-red-100 text-red-700" },
  negative: { label: "Negative",  className: "bg-red-100 text-red-700" },
  mixed:    { label: "Mixed",     className: "bg-gray-100 text-gray-600" },
  positive: { label: "Positive",  className: "bg-emerald-100 text-emerald-700" },
};

// ── App icon avatar ───────────────────────────────────────────────────────────

function AppIconAvatar({ source, size = "sm" }: { source: AppReview["source"]; size?: "sm" | "xs" }) {
  const isIos = source === "App Store";
  return (
    <div
      className={cn(
        "shrink-0 items-center justify-center rounded-[9px] text-[13px] font-bold text-white",
        isIos
          ? "bg-gradient-to-br from-blue-400 to-blue-600"
          : "bg-gradient-to-br from-green-400 to-green-600",
        size === "sm" ? "flex size-9" : "flex size-7 rounded-[7px] text-[11px]",
      )}
    >
      {isIos ? "A" : "G"}
    </div>
  );
}

// ── Title derived from review body ────────────────────────────────────────────

function shortTitle(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= 6) return text;
  return words.slice(0, 6).join(" ") + "…";
}

// ── ReviewRow ─────────────────────────────────────────────────────────────────

function ReviewRow({
  review,
  selected,
  onClick,
}: {
  review: AppReview;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "flex cursor-pointer gap-3 border-b border-gray-50 px-4 py-3.5 transition-colors hover:bg-gray-50/80",
        selected && "bg-[#0A84FF]/[0.07]",
      )}
    >
      <AppIconAvatar source={review.source} />
      <div className="min-w-0 flex-1">
        {/* Title row */}
        <div className="flex min-w-0 items-center gap-2">
          <span className="min-w-0 truncate text-[13px] font-semibold text-[#1D1D1F]">
            {shortTitle(review.text)}
          </span>
          <Stars rating={review.rating} />
          {review.replyStatus === "needs_reply" && (
            <span className="size-[7px] shrink-0 rounded-full bg-[#0A84FF]" />
          )}
        </div>
        {/* Body preview */}
        <div className="mt-1 line-clamp-1 text-[12px] leading-snug text-[#86868B]">
          {review.text}
        </div>
        {/* Metadata row */}
        <div className="mt-1.5 flex min-w-0 items-center gap-2 text-[11px] text-[#86868B]">
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
          <span className="ml-auto shrink-0 tabular-nums">{review.createdAt}</span>
        </div>
      </div>
    </div>
  );
}

// ── ReplyComposer ─────────────────────────────────────────────────────────────

function ReplyComposer({
  review,
  onClose,
}: {
  review: AppReview;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<"success" | "error" | null>(null);
  const [replyDone, setReplyDone] = useState(false);

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
      if (!res.ok) { setGenerateError("Something went wrong."); return; }
      const data = (await res.json()) as { reply: string };
      setAiSuggestion(data.reply);
    } catch {
      setGenerateError("Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  }

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
        setSendFeedback("error");
        setTimeout(() => setSendFeedback(null), 2500);
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
    <div className="flex w-[420px] shrink-0 flex-col border-l border-gray-100 bg-white">
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-gray-100 px-[18px] py-[14px]">
        <AppIconAvatar source={review.source} size="xs" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-[#1D1D1F]">{review.author}</div>
          <div className="text-[11px] text-[#86868B]">{review.source} · v{review.appVersion}</div>
        </div>
        <button
          onClick={onClose}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-[#86868B] transition-colors hover:bg-gray-100 hover:text-[#48484D]"
        >
          <X className="size-[15px]" strokeWidth={1.5} />
        </button>
      </div>

      {/* Review detail */}
      <div className="border-b border-gray-50 px-[18px] py-[14px]">
        <div className="flex items-center gap-2">
          <Stars rating={review.rating} size={14} />
          <span className="text-[12px] text-[#86868B]">{review.createdAt}</span>
        </div>
        <p className="mt-2 text-[14px] font-semibold leading-snug text-[#1D1D1F]">
          {shortTitle(review.text)}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-[#48484D]">{review.text}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            badge.className,
          )}>
            <span className={cn("size-1.5 rounded-full", SENTIMENT_DOT[review.sentiment])} />
            {badge.label}
          </span>
          {review.issueTags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-[#8E5BFF]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#6D3DD9]"
            >
              <Sparkles className="size-2.5" strokeWidth={2} />
              {humanizeToken(tag)}
            </span>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-[18px] py-[14px]">
        {/* AI suggestion box */}
        {review.hasAiSuggestion && (
          <div className="rounded-[10px] border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#6D3DD9]">
              <Sparkles className="size-2.5" strokeWidth={2} />
              AI suggestion
            </div>
            {aiSuggestion ? (
              <>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#48484D]">{aiSuggestion}</p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => setText(aiSuggestion)}
                    className="h-[26px] rounded-md bg-white px-2.5 text-[11px] font-semibold text-[#1D1D1F] shadow-sm transition-colors hover:bg-gray-50"
                  >
                    Use this
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="h-[26px] rounded-md px-2.5 text-[11px] font-semibold text-[#86868B] transition-colors hover:text-[#48484D] disabled:opacity-50"
                  >
                    {isGenerating ? "Generating…" : "Regenerate"}
                  </button>
                </div>
              </>
            ) : (
              <div className="mt-1.5">
                {generateError && (
                  <p className="mb-1.5 text-[12px] text-red-500">{generateError}</p>
                )}
                {!generateError && (
                  <p className="mb-1.5 text-[12px] text-[#86868B]">
                    Click Generate to get an AI-drafted reply.
                  </p>
                )}
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="inline-flex h-[26px] items-center gap-1.5 rounded-md bg-white px-2.5 text-[11px] font-semibold text-[#1D1D1F] shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                      Generating…
                    </>
                  ) : "Generate"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Reply textarea */}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a reply…"
          rows={5}
          className="w-full resize-none rounded-lg border border-gray-200 bg-white p-2.5 text-[13px] leading-relaxed text-[#1D1D1F] placeholder:text-[#86868B] outline-none transition-colors focus:border-[#0A84FF]/40 focus:ring-1 focus:ring-[#0A84FF]/20"
        />

        {/* Actions */}
        {replyDone ? (
          <p className="text-[12px] font-semibold text-emerald-600">✓ Reply sent</p>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={isSending || !text.trim()}
              className={cn(
                "h-[30px] rounded-[7px] px-3 text-[12px] font-semibold text-white transition-colors disabled:opacity-50",
                sendFeedback === "error"
                  ? "bg-red-500 hover:bg-red-600"
                  : "bg-[#0A84FF] hover:bg-[#006EE0]",
              )}
            >
              {isSending ? "Posting…" : sendFeedback === "error" ? "Failed — retry" : "Post reply"}
            </button>
            <button
              onClick={handleSaveDraft}
              disabled={!text.trim()}
              className="h-[30px] rounded-[7px] border border-gray-200 bg-white px-3 text-[12px] font-semibold text-[#1D1D1F] transition-colors hover:bg-gray-50 disabled:opacity-40"
            >
              Save draft
            </button>
            <span className="ml-auto shrink-0 text-[11px] text-[#86868B]">
              {review.source === "App Store" ? "Posts to App Store · ~5 min" : "Posts to Google Play"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ReviewQueue ───────────────────────────────────────────────────────────────

type InboxFilter = "all" | "unreplied" | "low_rating" | "app_store" | "play_store";
type InboxSort   = "newest" | "lowest";

interface ReviewQueueProps {
  reviews: AppReview[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

export function ReviewQueue({
  reviews,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
}: ReviewQueueProps) {
  const [selectedId, setSelectedId] = useState<string | null>(reviews[0]?.id ?? null);
  const [activeFilter, setActiveFilter] = useState<InboxFilter>("all");
  const [sort, setSort] = useState<InboxSort>("newest");

  const unrepliedCount = reviews.filter((r) => r.replyStatus === "needs_reply").length;
  const lowRatingCount = reviews.filter((r) => r.rating <= 2).length;

  const FILTERS: { value: InboxFilter; label: React.ReactNode }[] = [
    { value: "all",        label: `All · ${reviews.length}` },
    {
      value: "unreplied",
      label: (
        <>
          <span className="inline-block size-1.5 rounded-full bg-[#0A84FF]" />
          {` Unreplied · ${unrepliedCount}`}
        </>
      ),
    },
    { value: "low_rating", label: `1–2 ★ · ${lowRatingCount}` },
    { value: "app_store",  label: "App Store" },
    { value: "play_store", label: "Play Store" },
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

      {/* Left — review list */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Inbox header */}
        <div className="shrink-0 border-b border-gray-100 px-7 pb-3.5 pt-5">
          <div className="mb-3.5 flex items-end justify-between gap-4">
            <div>
              <div className="text-[12px] font-medium text-[#86868B]">
                {reviews.length} review{reviews.length !== 1 ? "s" : ""} this week
              </div>
              <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.022em] text-[#1D1D1F]">
                Inbox
              </h1>
            </div>
            {/* Sort control */}
            <div className="flex shrink-0 items-center rounded-lg border border-gray-100 bg-gray-50 p-0.5">
              {(["newest", "lowest"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(
                    "h-6 rounded-md px-3 text-[12px] font-semibold capitalize transition-colors",
                    sort === s
                      ? "bg-white text-[#1D1D1F] shadow-sm"
                      : "text-[#86868B] hover:text-[#48484D]",
                  )}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
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
                    ? "border-gray-300 bg-gray-100 text-[#1D1D1F]"
                    : "border-gray-200 bg-white text-[#48484D] hover:bg-gray-50",
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
              <Inbox className="size-10 text-gray-200" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-semibold text-[#1D1D1F]">No reviews</p>
                <p className="mt-1 text-xs text-[#86868B]">
                  Connect an app in Settings to start syncing.
                </p>
              </div>
              <Link
                href="/settings"
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-[#48484D] hover:bg-gray-50"
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
                    className="rounded-lg border border-gray-200 bg-white px-4 py-1.5 text-[12px] font-medium text-[#48484D] hover:bg-gray-50 disabled:opacity-50"
                  >
                    {isFetchingNextPage ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right — reply composer */}
      {selected && (
        <ReplyComposer
          key={selected.id}
          review={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
