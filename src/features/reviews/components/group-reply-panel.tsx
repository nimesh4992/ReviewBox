"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Check, CheckCheck, Loader2, MessageSquareDiff, PenLine, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { AppReview, AIReplyTone } from "@/types/review";
import { apiErrorMessage } from "@/lib/api-error-message";
import { tagLabel } from "@/lib/tag-labels";
import { useTagLabels } from "@/hooks/use-tag-labels";
import { Stars, ReviewerAvatar, ToneSelector } from "./review-primitives";
import { useMarkReplied } from "../hooks/use-review-cache";

/**
 * Bulk "reply to all of these at once" panel.
 *
 * Extracted from review-queue.tsx unchanged. This and the single-review
 * composer are independently-scoped surfaces that two concurrent PRs would
 * plausibly each pick up — the reason they no longer share a file.
 */

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

export function GroupReplyPanel({
  reviews,
  onDone,
  onClose,
}: {
  reviews: AppReview[];
  onDone: () => void;
  onClose: () => void;
}) {
  // Only unreplied reviews are candidates
  // Same names the inbox and the digests use — a tag renamed in Settings
  // must not still read as its raw token here.
  const { labels: tagLabels } = useTagLabels();

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
          const data: unknown = await res.json().catch(() => null);
          // message is rendered directly — it must be a string, never the
          // { code, message } envelope (React #31 crash).
          errs.push({ reviewId: r.id, author: r.author, message: apiErrorMessage(data, "Failed") });
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
      <div className="flex items-center gap-2.5 border-b border-[var(--rb-border-1)] px-5 py-4">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-[var(--rb-bg-accent-soft)]">
          <MessageSquareDiff className="size-3.5 text-[var(--rb-blue-500)]" />
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
              <PenLine className="size-2" />
              {tagLabel(t, tagLabels)}
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
            <ReviewerAvatar author={r.author} source={r.source} size="xs" />
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
      <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-5 py-4">

        {/* AI suggestion */}
        <div className="rounded-[10px] border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--rb-blue-500)]">
              <PenLine className="size-2.5" />
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
              "w-full resize-none rounded-lg border bg-[var(--rb-bg-surface)] p-3 text-[13px] leading-relaxed text-[var(--rb-fg-1)] placeholder:text-[var(--rb-fg-3)] outline-none transition-colors disabled:opacity-60",
              overLimit
                ? "border-[var(--rb-red-400)] focus:border-[var(--rb-red-400)]"
                : "border-[var(--rb-border-2)] focus:border-[var(--rb-blue-400)]",
            )}
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
            <Check className="size-3.5 shrink-0" strokeWidth={3} />All {progress?.total} replies posted
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
                  Publishing…
                </>
              ) : (
                <>
                  <CheckCheck className="size-3" />
                  {/* Same verb as the single composer. This path has always
                      published straight to the store; calling it "Post" while
                      the single-review pane said "Copy reply" is part of why
                      it was unclear what the product actually does. */}
                  Publish {selectedCount} {selectedCount === 1 ? "reply" : "replies"}
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

