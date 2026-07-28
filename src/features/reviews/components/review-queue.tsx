"use client";

import { useState, useEffect, useCallback, useRef, useDeferredValue } from "react";
import Link from "next/link";
import {
  CheckCheck,
  Inbox,
  Loader2,
  MessageSquareDiff,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useApps } from "@/hooks/use-apps";
import { AppReview, ReviewSentiment, AIReplyTone } from "@/types/review";
import { humanizeToken, formatReviewDate } from "@/utils/format";

// Helper — stamp a review as replied in the infinite query cache
function useMarkReplied() {
  const qc = useQueryClient();
  return (reviewId: string, replyText: string) => {
    qc.setQueriesData<{
      pages: Array<{ reviews: AppReview[]; nextCursor: string | null; hasMore: boolean }>;
      pageParams: unknown[];
    }>(
      { queryKey: ["reviews"] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            reviews: page.reviews.map((r) =>
              r.id === reviewId
                ? { ...r, replyStatus: "replied" as const, replyText }
                : r,
            ),
          })),
        };
      },
    );
  };
}

// Helper — stamp a review as draft_ready in the infinite query cache
function useMarkDraft() {
  const qc = useQueryClient();
  return (reviewId: string, replyText: string) => {
    qc.setQueriesData<{
      pages: Array<{ reviews: AppReview[]; nextCursor: string | null; hasMore: boolean }>;
      pageParams: unknown[];
    }>(
      { queryKey: ["reviews"] },
      (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            reviews: page.reviews.map((r) =>
              r.id === reviewId
                ? { ...r, replyStatus: "draft_ready" as const, replyText }
                : r,
            ),
          })),
        };
      },
    );
  };
}

// ── Store char limits ─────────────────────────────────────────────────────────

const CHAR_LIMIT: Record<AppReview["source"], number> = {
  "Google Play": 350,
  "App Store":   5950,
};

// ── Stars ─────────────────────────────────────────────────────────────────────

function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} width={size} height={size} viewBox="0 0 20 20"
          fill={n <= rating ? "#F59E0B" : "var(--rb-border-2)"}>
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

function AppIconAvatar({ source, size = "sm" }: {
  source: AppReview["source"];
  size?: "sm" | "xs";
}) {
  const isIos = source === "App Store";
  return (
    <div className={cn(
      "shrink-0 items-center justify-center rounded-[9px] text-[13px] font-bold text-white",
      isIos
        ? "bg-gradient-to-br from-[#4592FF] to-[#0058B3]"
        : "bg-gradient-to-br from-[#34C759] to-[#1A8A36]",
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

function ReviewRow({ review, selected, onClick, selectMode, isChecked, onCheck, onQuickDraft }: {
  review: AppReview;
  selected: boolean;
  onClick: () => void;
  selectMode?: boolean;
  isChecked?: boolean;
  onCheck?: (id: string) => void;
  onQuickDraft?: (review: AppReview) => void;
}) {
  const [isDrafting, setIsDrafting] = useState(false);

  // The row is interactive, so it carries real interactive semantics: option
  // role (the list is a listbox), keyboard activation, and a focus ring. A
  // bare onClick div was invisible to keyboard and screen-reader users on the
  // single most-used surface in the product.
  return (
    <div
      role="option"
      aria-selected={selectMode ? isChecked : selected}
      tabIndex={0}
      data-review-id={review.id}
      onClick={selectMode ? () => onCheck?.(review.id) : onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (selectMode) onCheck?.(review.id);
          else onClick();
        }
      }}
      className={cn(
        "group relative flex cursor-pointer gap-3 border-b border-[var(--rb-border-1)] px-4 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--rb-blue-400)]",
        selected && !selectMode ? "bg-[var(--rb-bg-selected)]" : "hover:bg-[var(--rb-bg-hover)]",
        isChecked && "bg-[var(--rb-blue-50)]",
      )}
    >
      {selectMode ? (
        <div className="flex shrink-0 items-center">
          <input
            type="checkbox"
            checked={isChecked ?? false}
            onChange={() => onCheck?.(review.id)}
            onClick={(e) => e.stopPropagation()}
            className="size-3.5 accent-[var(--rb-blue-500)]"
          />
        </div>
      ) : (
        <AppIconAvatar source={review.source} />
      )}
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
        <div className="mt-0.5 line-clamp-1 text-[12px] leading-snug text-[var(--rb-fg-2)]">
          {review.text}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-[11px] text-[var(--rb-fg-3)]">
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

      {/* Hover quick actions — visible on group-hover, hidden in select mode */}
      {!selectMode && review.replyStatus === "needs_reply" && onQuickDraft && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-1">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              setIsDrafting(true);
              try { await onQuickDraft(review); } finally { setIsDrafting(false); }
            }}
            disabled={isDrafting}
            title="AI draft — generates reply and saves for review"
            className="flex items-center gap-1 rounded-md border border-[var(--rb-border-2)] bg-surface px-2.5 py-1 text-[11px] font-semibold text-[var(--rb-blue-500)] shadow-[var(--rb-shadow-xs)] transition-colors hover:bg-[var(--rb-blue-50)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--rb-blue-400)]"
          >
            {isDrafting ? (
              <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
            ) : (
              <Sparkles className="size-3" strokeWidth={2} />
            )}
            {isDrafting ? "Drafting…" : "Draft"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Tone selector ─────────────────────────────────────────────────────────────

const TONES: { value: AIReplyTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "empathetic",   label: "Empathetic"   },
  { value: "casual",       label: "Casual"        },
  { value: "direct",       label: "Direct"        },
];

function ToneSelector({ tone, onChange }: {
  tone: AIReplyTone;
  onChange: (t: AIReplyTone) => void;
}) {
  // Compact enough that all four tones sit on one line in the detail pane —
  // a wrapped, ragged second line read as broken chrome.
  return (
    <div className="flex items-center gap-0.5">
      {TONES.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "h-7 rounded-md px-2 text-[11px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]",
            tone === t.value
              ? "bg-[var(--rb-blue-100)] text-[var(--rb-blue-600)]"
              : "text-[var(--rb-fg-3)] hover:bg-[var(--rb-bg-hover)] hover:text-[var(--rb-fg-2)]",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── ReplyComposer ─────────────────────────────────────────────────────────────

function ReplyComposer({
  review,
  onClose,
  onAdvance,
  className,
}: {
  review: AppReview;
  onClose: () => void;
  onAdvance: (id: string) => void;
  className?: string;
}) {
  const limit                             = CHAR_LIMIT[review.source];
  const alreadyReplied                    = review.replyStatus === "replied";
  const [text, setText]                   = useState(review.replyText ?? "");
  const [tone, setTone]                   = useState<AIReplyTone>("professional");
  const [isGenerating, setIsGenerating]   = useState(false);
  const [aiSuggestion, setAiSuggestion]   = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isSending, setIsSending]         = useState(false);
  const [sendFeedback, setSendFeedback]   = useState<"success" | "error" | null>(null);
  const [sendError, setSendError]         = useState<string | null>(null);
  const [sendErrorLink, setSendErrorLink] = useState<{ label: string; href: string } | null>(null);
  const [replyDone, setReplyDone]         = useState(alreadyReplied);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSaved, setDraftSaved]       = useState(false);
  // Draft Mode (D018): copy reply → user pastes into store → mark replied
  const [copied, setCopied]               = useState(false);
  const [isMarking, setIsMarking]         = useState(false);
  // Learning loop: track draft source + whether user edited before sending
  const [draftSource, setDraftSource]     = useState<string | null>(null);
  const [originalDraft, setOriginalDraft] = useState<string | null>(null);
  const prevToneRef                       = useRef(tone);

  const overLimit   = text.length > limit;
  const badge       = SENTIMENT_BADGE[review.sentiment];
  const markReplied = useMarkReplied();
  const markDraft   = useMarkDraft();

  // Credential-aware action hierarchy. When the review's app has store
  // credentials, one-click "Post reply" is the hero action — that's the whole
  // promise of the product. Draft Mode's copy-and-paste flow stays the hero
  // only where it's genuinely the best available path (no credentials).
  // Fallback when appId is missing (pre-deploy rows in cache): any credentialed
  // app on the same platform counts.
  const { apps } = useApps();
  const reviewPlatform = review.source === "App Store" ? "app_store" : "google_play";
  const composerApp = review.appId ? apps.find((a) => a.id === review.appId) : undefined;
  const canPostViaApi = composerApp
    ? composerApp.has_credentials
    : apps.some((a) => a.platform === reviewPlatform && a.has_credentials);

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [sourceLang, setSourceLang]         = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  async function handleTranslate() {
    if (translatedText) { setShowTranslation((v) => !v); return; }
    setIsTranslating(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/translate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json() as { translatedText: string; sourceLang: string };
        setTranslatedText(data.translatedText);
        setSourceLang(data.sourceLang);
        setShowTranslation(true);
      }
    } finally {
      setIsTranslating(false);
    }
  }

  const handleGenerate = useCallback(async (selectedTone: AIReplyTone) => {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/reply/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId:   review.id,
          reviewBody: review.text,
          rating:     review.rating,
          tags:       review.issueTags,
          tone:       selectedTone,
        }),
      });
      if (res.status === 429) { setGenerateError("Daily AI limit reached."); return; }
      if (res.status === 503) { setGenerateError("AI unavailable — try again shortly."); return; }
      if (!res.ok)            { setGenerateError("Something went wrong."); return; }
      const data = (await res.json()) as { reply: string; source?: string };
      setAiSuggestion(data.reply);
      // Auto-populate the textarea so user can post immediately — no "Use this" click
      setText(data.reply);
      // Store for learning loop — track source + original text before any edit
      setDraftSource(data.source ?? null);
      setOriginalDraft(data.reply);
      track({
        name: "reply_drafted",
        properties: {
          source:
            data.source === "template" || data.source === "cache" || data.source === "groq"
              ? data.source
              : "unknown",
        },
      });
    } catch {
      setGenerateError("Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  }, [review.id, review.text, review.rating, review.issueTags]);

  // Auto-generate on mount (skip if already replied)
  useEffect(() => {
    if (!alreadyReplied) handleGenerate(tone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regenerate when tone changes
  useEffect(() => {
    if (prevToneRef.current !== tone) {
      prevToneRef.current = tone;
      handleGenerate(tone);
    }
  }, [tone, handleGenerate]);

  async function handleSend() {
    if (!text.trim() || overLimit) return;
    setIsSending(true);
    setSendFeedback(null);
    setSendError(null);
    setSendErrorLink(null);
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyText:   text,
          status:      "sent",
          draftSource: draftSource ?? "manual",
          draftEdited: originalDraft !== null && text.trim() !== originalDraft.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        const isCredentialError =
          data.error === "APP_STORE_NOT_CONNECTED" ||
          data.error === "GOOGLE_PLAY_NOT_CONFIGURED";
        const msg =
          data.error === "APP_STORE_NOT_CONNECTED"   ? "App Store credentials not connected."      :
          data.error === "GOOGLE_PLAY_NOT_CONFIGURED"? "Google Play service account not configured." :
          data.error === "STORE_RATE_LIMITED"        ? "Store rate limit — try again in a few minutes." :
          data.error === "REVIEW_NOT_FOUND_ON_STORE" ? "Review no longer available on the store."   :
          data.error === "STORE_SUBMIT_FAILED"       ? "Store rejected the reply — check credentials." :
          data.error === "REPLY_TOO_LONG"            ? "Reply exceeds the store's character limit."  :
          "Something went wrong.";
        setSendFeedback("error");
        setSendError(msg);
        if (isCredentialError) {
          setSendErrorLink({ label: "Set up in Settings →", href: "/settings" });
          // Credential errors stay visible — user needs to act
        } else {
          setTimeout(() => { setSendFeedback(null); setSendError(null); }, 5000);
        }
        return;
      }
      markReplied(review.id, text.trim());
      setReplyDone(true);
      track({
        name: "reply_sent",
        properties: {
          app_platform: review.source === "App Store" ? "app_store" : "google_play",
          method: "api",
        },
      });
      setTimeout(() => onAdvance(review.id), 1200);
    } catch {
      setSendFeedback("error");
      setSendError("Network error — check your connection.");
      setTimeout(() => { setSendFeedback(null); setSendError(null); }, 5000);
    } finally {
      setIsSending(false);
    }
  }

  // Draft Mode: copy the reply to clipboard so the user can paste it into the
  // store console (Play Console / App Store Connect). No store API call.
  async function handleCopy() {
    if (!text.trim()) return;
    try {
      await navigator.clipboard.writeText(text.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch {
      // Clipboard API can fail on insecure origins / old browsers — select fallback
      setCopied(false);
    }
  }

  // Draft Mode: user posted the reply themselves → record it as replied in our
  // DB WITHOUT calling the store API (status: manual_replied, D018).
  async function handleMarkReplied() {
    if (!text.trim() || isMarking) return;
    setIsMarking(true);
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replyText:   text,
          status:      "manual_replied",
          draftSource: draftSource ?? "manual",
          draftEdited: originalDraft !== null && text.trim() !== originalDraft.trim(),
        }),
      });
      if (res.ok) {
        markReplied(review.id, text.trim());
        setReplyDone(true);
        track({
          name: "reply_sent",
          properties: {
            app_platform: review.source === "App Store" ? "app_store" : "google_play",
            method: "manual",
          },
        });
        setTimeout(() => onAdvance(review.id), 1000);
      }
    } catch {
      // best-effort — leave the composer open so the user can retry
    } finally {
      setIsMarking(false);
    }
  }

  async function handleSaveDraft() {
    if (!text.trim() || isSavingDraft) return;
    setIsSavingDraft(true);
    setDraftSaved(false);
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText: text, status: "draft" }),
      });
      if (res.ok) {
        markDraft(review.id, text.trim());
        setDraftSaved(true);
        setTimeout(() => setDraftSaved(false), 3000);
      }
    } catch {
      // best-effort — silent fail on draft save
    } finally {
      setIsSavingDraft(false);
    }
  }

  return (
    <div className={cn("flex w-full sm:w-[420px] shrink-0 flex-col border-l border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)]", className)}>
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
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
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
              className="inline-flex items-center gap-1 rounded-full bg-[var(--rb-bg-accent-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--rb-blue-500)]"
            >
              <Sparkles className="size-2.5" strokeWidth={2} />
              {humanizeToken(tag)}
            </span>
          ))}
          {/* Translate button */}
          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="ml-auto flex items-center gap-1 rounded-full border border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--rb-fg-2)] transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-50"
          >
            {isTranslating ? (
              <Loader2 className="size-2.5 animate-spin" strokeWidth={2} />
            ) : (
              <span className="text-[10px]">🌐</span>
            )}
            {showTranslation ? "Original" : "Translate"}
          </button>
        </div>

        {/* Translated text */}
        {showTranslation && translatedText && sourceLang !== "en" && (
          <div className="mt-2 rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-3 py-2">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--rb-fg-3)]">
              Translated from {sourceLang?.toUpperCase() ?? "?"}
            </div>
            <p className="text-[13px] leading-relaxed text-[var(--rb-fg-2)]">{translatedText}</p>
          </div>
        )}
        {showTranslation && sourceLang === "en" && (
          <p className="mt-1.5 text-[11px] text-[var(--rb-fg-3)]">Already in English.</p>
        )}
      </div>

      {/* Existing reply banner */}
      {alreadyReplied && review.replyText && (
        <div className="border-b border-[var(--rb-border-1)] bg-[var(--rb-green-50)] px-[18px] py-3">
          <div className="mb-1 text-[11px] font-semibold text-[var(--rb-green-600)]">Your reply</div>
          <p className="text-[12px] leading-relaxed text-[var(--rb-fg-2)]">{review.replyText}</p>
        </div>
      )}

      {/* Composer */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-[18px] py-[14px]">

        {/* AI tone bar — shows while generating or after AI text is ready */}
        {!alreadyReplied && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {isGenerating ? (
                <Loader2 className="size-3 animate-spin text-[var(--rb-blue-500)]" strokeWidth={1.5} />
              ) : (
                <Sparkles className="size-3 text-[var(--rb-blue-500)]" strokeWidth={2} />
              )}
              <span className="text-[11px] font-semibold text-[var(--rb-blue-500)]">
                {isGenerating ? "Generating…" : aiSuggestion ? "AI draft — edit or post" : "AI reply"}
              </span>
            </div>
            <ToneSelector tone={tone} onChange={setTone} />
          </div>
        )}

        {/* Generate error */}
        {generateError && !isGenerating && (
          <div className="flex items-center gap-2">
            <p className="text-[12px] text-[var(--rb-red-500)]">{generateError}</p>
            <button
              onClick={() => handleGenerate(tone)}
              className="text-[11px] font-semibold text-[var(--rb-blue-500)] hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* Textarea + char count */}
        <div>
          <textarea
            id="rb-composer-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={alreadyReplied ? "Edit your reply…" : "Write a reply…"}
            rows={5}
            className={cn(
              "w-full resize-none rounded-lg border bg-[var(--rb-bg-surface)] p-2.5 text-[13px] leading-relaxed text-[var(--rb-fg-1)] placeholder:text-[var(--rb-fg-3)] outline-none transition-colors",
              overLimit
                ? "border-[var(--rb-red-400)] focus:border-[var(--rb-red-400)]"
                : "border-[var(--rb-border-2)] focus:border-[var(--rb-blue-400)]",
            )}
            style={{ fontFamily: "var(--rb-font-text)" }}
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-[var(--rb-fg-3)]">
              {review.source === "Google Play" ? "Google Play · 350 char limit" : "App Store · 5,950 char limit"}
            </span>
            <span className={cn(
              "tabular-nums text-[11px] font-medium",
              overLimit
                ? "text-[var(--rb-red-500)]"
                : text.length > limit * 0.85
                  ? "text-[var(--rb-amber-500)]"
                  : "text-[var(--rb-fg-3)]",
            )}>
              {text.length.toLocaleString()} / {limit.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Actions */}
        {replyDone && !alreadyReplied ? (
          <p className="text-[12px] font-semibold text-[var(--rb-green-500)]">✓ Marked as replied — moving to next…</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {sendFeedback === "error" && sendError && (
              <div className="flex items-center gap-1.5">
                <p className="text-[11px] text-[var(--rb-red-500)]">{sendError}</p>
                {sendErrorLink && (
                  <Link
                    href={sendErrorLink.href}
                    className="shrink-0 text-[11px] font-semibold text-[var(--rb-blue-500)] hover:underline"
                  >
                    {sendErrorLink.label}
                  </Link>
                )}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {canPostViaApi ? (
                <>
                  {/* Connected account: one-click post is the hero action —
                      this is the product's core promise. */}
                  <button
                    onClick={handleSend}
                    disabled={isSending || !text.trim() || overLimit}
                    className="h-10 w-full rounded-[8px] bg-[var(--rb-blue-500)] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--rb-blue-600)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] focus-visible:ring-offset-1"
                  >
                    {isSending
                      ? "Posting…"
                      : `Post reply to ${review.source === "App Store" ? "App Store" : "Google Play"}`}
                  </button>
                  <p className="text-[10px] leading-relaxed text-[var(--rb-fg-3)]">
                    Posts via the connected store account — the review page updates in minutes.
                    {overLimit && <span className="ml-1 text-[var(--rb-red-500)]">Reply is over the {limit}-char store limit.</span>}
                  </p>
                </>
              ) : (
                <>
                  {/* Draft Mode (D018): Copy → user pastes into store → Mark
                      replied. Hero only when no store credentials exist. */}
                  <button
                    onClick={handleCopy}
                    disabled={!text.trim()}
                    className={cn(
                      "h-10 w-full rounded-[8px] text-[13px] font-semibold text-white transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] focus-visible:ring-offset-1",
                      copied ? "bg-[var(--rb-green-500)]" : "bg-[var(--rb-blue-500)] hover:bg-[var(--rb-blue-600)]",
                    )}
                  >
                    {copied ? "✓ Copied — now paste it on the store" : "Copy reply"}
                  </button>

                  {/* Confirm step — record it as replied in our DB (no store API call) */}
                  <button
                    onClick={handleMarkReplied}
                    disabled={!text.trim() || overLimit || isMarking}
                    className="h-9 w-full rounded-[8px] border border-[var(--rb-border-2)] bg-surface text-[12px] font-semibold text-[var(--rb-fg-1)] transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
                  >
                    {isMarking ? "Saving…" : alreadyReplied ? "Update reply" : "Mark as replied"}
                  </button>

                  {/* Where to paste + char warning */}
                  <p className="text-[10px] leading-relaxed text-[var(--rb-fg-3)]">
                    Paste into {review.source === "App Store" ? "App Store Connect" : "Google Play Console"}, then mark it replied here.
                    {overLimit && <span className="ml-1 text-[var(--rb-red-500)]">Reply is over the {limit}-char store limit.</span>}
                  </p>
                </>
              )}

              {/* Secondary row */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={!text.trim() || isSavingDraft}
                  className="text-[11px] font-medium text-[var(--rb-fg-3)] transition-colors hover:text-[var(--rb-fg-2)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0A84FF]"
                >
                  {isSavingDraft ? "Saving…" : draftSaved ? "✓ Saved" : "Save draft"}
                </button>
                {!alreadyReplied && aiSuggestion && (
                  <button
                    onClick={() => handleGenerate(tone)}
                    disabled={isGenerating}
                    className="text-[11px] font-medium text-[var(--rb-fg-3)] transition-colors hover:text-[var(--rb-fg-2)] disabled:opacity-40"
                  >
                    Regenerate
                  </button>
                )}
                {canPostViaApi ? (
                  /* Connected flow: copy stays available as an escape hatch */
                  <button
                    onClick={handleCopy}
                    disabled={!text.trim()}
                    className="ml-auto text-[11px] font-medium text-[var(--rb-fg-3)] transition-colors hover:text-[var(--rb-fg-2)] disabled:opacity-40"
                  >
                    {copied ? "✓ Copied" : "Copy reply"}
                  </button>
                ) : (
                  /* Draft Mode: API posting stays reachable for the curious —
                     its error path links to Settings to connect the account */
                  <button
                    onClick={handleSend}
                    disabled={isSending || !text.trim() || overLimit}
                    className="ml-auto text-[10px] font-medium text-[var(--rb-fg-3)] transition-colors hover:text-[var(--rb-blue-500)] disabled:opacity-40"
                    title="Post directly via the store API (requires a connected store account)"
                  >
                    {isSending ? "Posting…" : "Post via API"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── GroupReplyPanel ───────────────────────────────────────────────────────────
// "Reply all similar" — write once, post to N reviews in one action.

interface SendProgress {
  done: number;
  total: number;
  currentAuthor?: string;
}

interface SendError {
  reviewId: string;
  author: string;
  message: string;
}

function GroupReplyPanel({
  reviews,
  onDone,
  onClose,
}: {
  reviews: AppReview[];
  onDone: () => void;
  onClose: () => void;
}) {
  // Only unreplied reviews are candidates
  const candidates = reviews.filter((r) => r.replyStatus === "needs_reply");
  const [selected, setSelected] = useState<Set<string>>(
    new Set(candidates.map((r) => r.id)),
  );
  const [text, setText]                     = useState("");
  const [tone, setTone]                     = useState<AIReplyTone>("professional");
  const [isGenerating, setIsGenerating]     = useState(false);
  const [generateError, setGenerateError]   = useState<string | null>(null);
  const [isSending, setIsSending]           = useState(false);
  const [progress, setProgress]             = useState<SendProgress | null>(null);
  const [sendErrors, setSendErrors]         = useState<SendError[]>([]);
  const [allDone, setAllDone]               = useState(false);
  const prevToneRef                         = useRef(tone);
  const markReplied                         = useMarkReplied();

  // Use the first candidate as the representative for AI generation
  const rep = candidates[0];

  // If any selected review is Google Play → enforce tighter limit
  const selectedReviews = candidates.filter((r) => selected.has(r.id));
  const hasGooglePlay   = selectedReviews.some((r) => r.source === "Google Play");
  const limit           = hasGooglePlay ? 350 : 5950;
  const overLimit       = text.length > limit;
  const selectedCount   = selected.size;

  const handleGenerate = useCallback(async (t: AIReplyTone) => {
    if (!rep) return;
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/reply/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId:   rep.id,
          reviewBody: rep.text,
          rating:     rep.rating,
          tags:       rep.issueTags,
          tone:       t,
        }),
      });
      if (res.status === 429) { setGenerateError("Daily AI limit reached."); return; }
      if (!res.ok)            { setGenerateError("Generation failed."); return; }
      const data = (await res.json()) as { reply: string };
      setText(data.reply);
    } catch {
      setGenerateError("Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  }, [rep]);

  // Auto-generate on mount
  useEffect(() => {
    handleGenerate(tone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Regenerate when tone changes
  useEffect(() => {
    if (prevToneRef.current !== tone) {
      prevToneRef.current = tone;
      handleGenerate(tone);
    }
  }, [tone, handleGenerate]);

  function toggleReview(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  }

  async function handleSendAll() {
    if (!text.trim() || overLimit || selectedCount === 0) return;
    const toSend = candidates.filter((r) => selected.has(r.id));
    setIsSending(true);
    setProgress({ done: 0, total: toSend.length });
    const errs: SendError[] = [];

    for (let i = 0; i < toSend.length; i++) {
      const r = toSend[i];
      setProgress({ done: i, total: toSend.length, currentAuthor: r.author });
      try {
        const res = await fetch(`/api/reviews/${r.id}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ replyText: text.trim(), status: "sent" }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({})) as { error?: string };
          errs.push({ reviewId: r.id, author: r.author, message: data.error ?? "Failed" });
        } else {
          markReplied(r.id, text.trim());
        }
      } catch {
        errs.push({ reviewId: r.id, author: r.author, message: "Network error" });
      }
    }

    setProgress({ done: toSend.length, total: toSend.length });
    setSendErrors(errs);
    setIsSending(false);
    setAllDone(true);
    if (errs.length === 0) {
      setTimeout(() => onDone(), 2000);
    }
  }

  // Derive top shared tags for the group label
  const tagCounts: Record<string, number> = {};
  for (const r of candidates) {
    for (const t of r.issueTags) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);

  return (
    <div className="flex w-[480px] shrink-0 flex-col border-l border-[var(--rb-border-1)] bg-[var(--rb-bg-surface)]">

      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--rb-border-1)] px-[18px] py-[14px]">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-[var(--rb-bg-accent-soft)]">
          <MessageSquareDiff className="size-3.5 text-[var(--rb-blue-500)]" strokeWidth={2} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-[var(--rb-fg-1)]">Reply all similar</div>
          <div className="text-[11px] text-[var(--rb-fg-3)]">
            {candidates.length} unreplied · one reply posted to all selected
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-[var(--rb-fg-3)] transition-colors hover:bg-[var(--rb-bg-hover)] hover:text-[var(--rb-fg-2)]"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Group context */}
      {topTags.length > 0 && (
        <div className="flex items-center gap-2 border-b border-[var(--rb-border-1)] px-[18px] py-2.5">
          <span className="text-[11px] text-[var(--rb-fg-3)]">Common issues:</span>
          {topTags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--rb-bg-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--rb-blue-500)]"
            >
              <Sparkles className="size-2" strokeWidth={2} />
              {humanizeToken(t)}
            </span>
          ))}
        </div>
      )}

      {/* Review checklist */}
      <div className="max-h-[200px] overflow-y-auto border-b border-[var(--rb-border-1)]">
        {candidates.map((r) => (
          <label
            key={r.id}
            className={cn(
              "flex cursor-pointer items-center gap-3 border-b border-[var(--rb-border-1)] px-4 py-2.5 last:border-0 transition-colors",
              selected.has(r.id) ? "bg-[var(--rb-bg-surface)]" : "bg-[var(--rb-bg-sunken)] opacity-60",
            )}
          >
            <input
              type="checkbox"
              checked={selected.has(r.id)}
              onChange={() => toggleReview(r.id)}
              className="size-3.5 accent-[var(--rb-blue-500)]"
            />
            <AppIconAvatar source={r.source} size="xs" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[12px] font-semibold text-[var(--rb-fg-1)]">{r.author}</span>
                <Stars rating={r.rating} size={10} />
              </div>
              <div className="truncate text-[11px] text-[var(--rb-fg-3)]">{r.text}</div>
            </div>
            {/* Per-review send state */}
            {allDone && !sendErrors.find((e) => e.reviewId === r.id) && selected.has(r.id) && (
              <CheckCheck className="size-3.5 shrink-0 text-[var(--rb-green-500)]" />
            )}
            {sendErrors.find((e) => e.reviewId === r.id) && (
              <X className="size-3.5 shrink-0 text-[var(--rb-red-500)]" />
            )}
          </label>
        ))}
      </div>

      {/* Composer area */}
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-[18px] py-[14px]">

        {/* AI suggestion */}
        <div className="rounded-[10px] border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--rb-blue-500)]">
              <Sparkles className="size-2.5" strokeWidth={2} />
              AI draft · based on top issue
            </div>
            <ToneSelector tone={tone} onChange={setTone} />
          </div>
          {isGenerating ? (
            <div className="flex items-center gap-2 text-[12px] text-[var(--rb-fg-3)]">
              <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
              Generating…
            </div>
          ) : generateError ? (
            <div>
              <p className="mb-1.5 text-[12px] text-[var(--rb-red-500)]">{generateError}</p>
              <button
                onClick={() => handleGenerate(tone)}
                className="h-[24px] rounded-md bg-[var(--rb-bg-surface)] px-2 text-[11px] font-semibold text-[var(--rb-fg-1)] shadow-[var(--rb-shadow-xs)]"
              >
                Retry
              </button>
            </div>
          ) : text ? (
            <div className="flex gap-1.5 mt-1">
              <button
                onClick={() => handleGenerate(tone)}
                className="h-[24px] rounded-md px-2 text-[11px] font-semibold text-[var(--rb-fg-3)] transition-colors hover:text-[var(--rb-fg-2)]"
              >
                Regenerate
              </button>
            </div>
          ) : null}
        </div>

        {/* Textarea + char count */}
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Edit the reply that will be sent to all selected reviews…"
            rows={6}
            disabled={isSending || allDone}
            className={cn(
              "w-full resize-none rounded-lg border bg-[var(--rb-bg-surface)] p-2.5 text-[13px] leading-relaxed text-[var(--rb-fg-1)] placeholder:text-[var(--rb-fg-3)] outline-none transition-colors disabled:opacity-60",
              overLimit
                ? "border-[var(--rb-red-400)] focus:border-[var(--rb-red-400)]"
                : "border-[var(--rb-border-2)] focus:border-[var(--rb-blue-400)]",
            )}
            style={{ fontFamily: "var(--rb-font-text)" }}
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-[var(--rb-fg-3)]">
              {hasGooglePlay ? "Google Play limit applies · 350 chars" : "App Store · 5,950 char limit"}
            </span>
            <span className={cn(
              "tabular-nums text-[11px] font-medium",
              overLimit ? "text-[var(--rb-red-500)]"
                : text.length > limit * 0.85 ? "text-[var(--rb-amber-500)]"
                : "text-[var(--rb-fg-3)]",
            )}>
              {text.length.toLocaleString()} / {limit.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {progress && (
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-[var(--rb-fg-3)]">
                {allDone
                  ? sendErrors.length === 0
                    ? "All replies sent"
                    : `${progress.total - sendErrors.length} sent · ${sendErrors.length} failed`
                  : `Sending to ${progress.currentAuthor ?? "…"}`}
              </span>
              <span className="tabular-nums text-[var(--rb-fg-3)]">
                {progress.done} / {progress.total}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  sendErrors.length > 0 ? "bg-[var(--rb-amber-500)]" : "bg-[var(--rb-green-500)]",
                )}
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Success / errors */}
        {allDone && sendErrors.length === 0 && (
          <p className="text-[12px] font-semibold text-[var(--rb-green-500)]">
            ✓ All {progress?.total} replies posted
          </p>
        )}
        {allDone && sendErrors.length > 0 && (
          <div className="rounded-[8px] border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-2.5">
            <p className="mb-1.5 text-[11px] font-semibold text-[var(--rb-red-500)]">
              {sendErrors.length} failed to send:
            </p>
            {sendErrors.map((e) => (
              <p key={e.reviewId} className="text-[11px] text-[var(--rb-fg-3)]">
                {e.author} — {e.message}
              </p>
            ))}
          </div>
        )}

        {/* Actions */}
        {!allDone && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSendAll}
              disabled={isSending || !text.trim() || overLimit || selectedCount === 0}
              className="flex h-[30px] items-center gap-1.5 rounded-[7px] bg-[var(--rb-blue-500)] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[var(--rb-blue-600)] disabled:opacity-50"
            >
              {isSending ? (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  Posting…
                </>
              ) : (
                <>
                  <CheckCheck className="size-3" />
                  Post {selectedCount} {selectedCount === 1 ? "reply" : "replies"}
                </>
              )}
            </button>
            <span className="text-[11px] text-[var(--rb-fg-3)]">
              same reply · all selected
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

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

type InboxFilter = "all" | "unreplied" | "low_rating" | "app_store" | "play_store";
type InboxSort   = "newest" | "lowest";

interface InboxScreenProps {
  reviews: AppReview[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isFetching?: boolean;
  fetchNextPage?: () => void;
}

export function InboxScreen({
  reviews,
  hasNextPage = false,
  isFetchingNextPage = false,
  isFetching = false,
  fetchNextPage,
}: InboxScreenProps) {
  const [selectedId, setSelectedId]         = useState<string | null>(reviews[0]?.id ?? null);
  const [mobilePane, setMobilePane]         = useState<"list" | "detail">("list");
  const [activeFilter, setActiveFilter]     = useState<InboxFilter>("all");
  const [sort, setSort]                     = useState<InboxSort>("newest");
  const [search, setSearch]                 = useState("");
  const [versionFilter, setVersionFilter]   = useState<string>("all");
  const [groupMode, setGroupMode]           = useState(false);
  const [selectMode, setSelectMode]           = useState(false);
  const [manuallySelected, setManuallySelected] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking]         = useState(false);
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
  const deferredSearch = useDeferredValue(search);
  const [serverResults, setServerResults] = useState<AppReview[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (deferredSearch.trim().length < 3) {
      setServerResults(null);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    const params = new URLSearchParams({ search: deferredSearch.trim(), limit: "50" });
    fetch(`/api/reviews?${params.toString()}`)
      .then((r) => r.json() as Promise<{ reviews: AppReview[] }>)
      .then((data) => {
        if (!cancelled) setServerResults(data.reviews ?? []);
      })
      .catch(() => { if (!cancelled) setServerResults(null); })
      .finally(() => { if (!cancelled) setIsSearching(false); });
    return () => { cancelled = true; };
  }, [deferredSearch]);

  // When server search is active, replace the reviews set
  const effectiveReviews = serverResults !== null ? serverResults : reviews;

  // Unique versions from loaded reviews (top 4)
  const uniqueVersions = Array.from(
    new Set(effectiveReviews.map((r) => r.appVersion).filter(Boolean)),
  ).slice(0, 4);

  const unrepliedCount = effectiveReviews.filter((r) => r.replyStatus === "needs_reply").length;
  const lowRatingCount = effectiveReviews.filter((r) => r.rating <= 2).length;

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
    { value: "app_store",  label: "App Store" },
    { value: "play_store", label: "Play Store" },
  ];

  const filtered = effectiveReviews
    .filter((r) => {
      if (activeFilter === "unreplied")  return r.replyStatus === "needs_reply";
      if (activeFilter === "low_rating") return r.rating <= 2;
      if (activeFilter === "app_store")  return r.source === "App Store";
      if (activeFilter === "play_store") return r.source === "Google Play";
      return true;
    })
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
    try {
      const ids = Array.from(manuallySelected);
      const res = await fetch("/api/reviews/bulk-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "mark_replied" }),
      });
      if (res.ok) {
        // Update cache for each selected review
        for (const id of ids) {
          markRepliedBulk(id, "");
        }
        exitSelectMode();
      }
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
        <div className="shrink-0 border-b border-[var(--rb-border-1)] px-7 pb-3.5 pt-5">
          <div className="mb-3.5 flex items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--rb-fg-3)]">
                <span>
                  {isSearching ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                      Searching…
                    </span>
                  ) : (
                    <>
                      {effectiveReviews.length} review{effectiveReviews.length !== 1 ? "s" : ""}
                      {serverResults !== null && (
                        <span className="ml-1 text-[var(--rb-blue-500)]">· search results</span>
                      )}
                      {sorted.length !== effectiveReviews.length && serverResults === null && (
                        <span className="ml-1 text-[var(--rb-blue-500)]">· {sorted.length} shown</span>
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
                {/* Keyboard affordance — shown where the eye already reads meta */}
                <span className="hidden text-[11px] font-normal text-[var(--rb-fg-4)] lg:inline">
                  · j/k navigate · ↵ reply · / search
                </span>
              </div>
              <h1
                className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.022em] text-[var(--rb-fg-1)]"
                style={{ fontFamily: "var(--rb-font-display)" }}
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
                  <MessageSquareDiff className="size-3.5" strokeWidth={2} />
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
                    {s === "newest" ? "Newest" : "Lowest ★"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-2.5">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[var(--rb-fg-3)]" strokeWidth={1.5} />
            <input
              data-inbox-search
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") (e.target as HTMLInputElement).blur();
              }}
              placeholder="Search reviews…   ( / )"
              className="h-8 w-full rounded-[8px] border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] pl-7 pr-7 text-[12px] text-[var(--rb-fg-1)] placeholder:text-[var(--rb-fg-3)] outline-none transition-colors focus:border-[var(--rb-border-2)]"
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

          {/* Version filter chips */}
          {uniqueVersions.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="flex items-center text-[11px] text-[var(--rb-fg-3)] mr-0.5">v:</span>
              {["all", ...uniqueVersions].map((v) => (
                <button
                  key={v}
                  onClick={() => setVersionFilter(v)}
                  className={cn(
                    "inline-flex h-6 items-center rounded-[6px] border px-2.5 text-[11px] font-semibold font-mono transition-colors",
                    versionFilter === v
                      ? "border-[var(--rb-border-3)] bg-[var(--rb-bg-sunken)] text-[var(--rb-fg-1)]"
                      : "border-[var(--rb-border-1)] bg-[var(--rb-bg-surface)] text-[var(--rb-fg-3)] hover:bg-[var(--rb-bg-hover)]",
                  )}
                >
                  {v === "all" ? "All" : v}
                </button>
              ))}
            </div>
          )}

          {/* KPI metrics strip — derived from currently filtered set */}
          {sorted.length > 0 && (() => {
            const sortedReplied   = sorted.filter((r) => r.replyStatus === "replied").length;
            const sortedUnreplied = sorted.filter((r) => r.replyStatus === "needs_reply").length;
            const avgRating       = sorted.reduce((s, r) => s + r.rating, 0) / sorted.length;
            const replyRate       = sorted.length > 0 ? Math.round((sortedReplied / sorted.length) * 100) : 0;
            const stats = [
              { label: "Shown",        value: String(sorted.length)             },
              { label: "Avg ★",        value: avgRating.toFixed(1)              },
              { label: "Needs reply",  value: String(sortedUnreplied),  alert: sortedUnreplied > 0 },
              { label: "Replied",      value: String(sortedReplied)             },
              { label: "Reply rate",   value: replyRate + "%"                   },
            ];
            return (
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--rb-border-1)] pt-2.5">
                {stats.map((s) => (
                  <div key={s.label} className="flex items-baseline gap-1.5">
                    <span className={cn(
                      "text-[13px] font-semibold tabular-nums leading-none",
                      s.alert ? "text-[var(--rb-blue-500)]" : "text-[var(--rb-fg-1)]",
                    )}>
                      {s.value}
                    </span>
                    <span className="text-[11px] text-[var(--rb-fg-3)]">{s.label}</span>
                  </div>
                ))}
              </div>
            );
          })()}
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
                  {search ? "No results" : "No reviews"}
                </p>
                <p className="mt-1 text-xs text-[var(--rb-fg-3)]">
                  {search ? `Nothing matched "${search}"` : "Connect an app in Settings to start syncing."}
                </p>
              </div>
              {!search && (
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
                {bulkWorking ? <Loader2 className="size-3 animate-spin" strokeWidth={1.5} /> : <CheckCheck className="size-3" strokeWidth={2} />}
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
                <MessageSquareDiff className="size-3" strokeWidth={2} />
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
