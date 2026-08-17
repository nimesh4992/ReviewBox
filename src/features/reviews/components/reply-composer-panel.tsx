"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Check, Languages, Loader2, PenLine } from "lucide-react";

import { cn } from "@/lib/utils";
import { track } from "@/lib/analytics";
import { useApps } from "@/hooks/use-apps";
import { AppReview, ReviewSentiment, AIReplyTone } from "@/types/review";
import { formatReviewDate } from "@/utils/format";
import { canPostRepliesViaApi } from "@/lib/sync-status";
import { isLikelyEnglish } from "@/lib/language";
import { apiErrorMessage } from "@/lib/api-error-message";
import { ReviewTagEditor } from "./review-tag-editor";
import { Stars, ReviewerAvatar, shortTitle, ToneSelector, SENTIMENT_DOT } from "./review-primitives";
import { useMarkReplied, useMarkDraft } from "../hooks/use-review-cache";

/**
 * The single-review reply composer (the right-hand pane of the inbox).
 *
 * Extracted from review-queue.tsx unchanged. Named *-panel deliberately:
 * src/lib/reply-composer.ts already exists and does something different
 * (reply-text composition), and two files with the same name would be exactly
 * the kind of ambiguity a future agent resolves wrongly.
 */

const CHAR_LIMIT: Record<AppReview["source"], number> = {
  "Google Play": 350,
  "App Store":   5950,
};


const SENTIMENT_BADGE: Record<ReviewSentiment, { label: string; className: string }> = {
  critical: { label: "Critical",  className: "bg-[var(--rb-red-100)]   text-[var(--rb-red-600)]"   },
  negative: { label: "Negative",  className: "bg-[var(--rb-red-100)]   text-[var(--rb-red-600)]"   },
  mixed:    { label: "Mixed",     className: "bg-[var(--rb-bg-sunken)]  text-[var(--rb-fg-3)]"      },
  positive: { label: "Positive",  className: "bg-[var(--rb-green-100)] text-[var(--rb-green-600)]" },
};

/**
 * Drafts already fetched this session, keyed `${reviewId}|${tone}`.
 *
 * Module scope, not component state: the composer unmounts every time you move
 * to another review, so component state would forget the draft the moment you
 * navigated away and re-request it when you came back. Reading through an
 * inbox is a normal thing to do and shouldn't cost a request per glance.
 *
 * Deliberately not persisted — a page reload should be able to get a fresh
 * answer, and the server's Redis cache already covers the expensive part.
 */
const draftMemo = new Map<string, string>();

// ── Reviewer avatar ───────────────────────────────────────────────────────────
//
// Initials on a colour derived from the reviewer's name, with the store's mark
// badged in the corner.
//
// It used to be one flat tile per row showing a single "G" or "A" for the
// platform — so twenty rows carried the same letter in the same colour, in the
// one position in a list whose whole job is telling rows apart, spent on a
// fact the row already states twice (the Android/iOS tag beside the author,
// and the Play/App Store filter chips above). The store is still identifiable
// at a glance, just moved to the badge where it costs nothing.

async function postReplyState(
  reviewId: string,
  body: Record<string, unknown>,
): Promise<{ message: string; code?: string } | null> {
  try {
    const res = await fetch(`/api/reviews/${reviewId}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;

    // The API returns { error: { code, message } } — a nested object. Reading
    // it as a flat string is what once made a whole branch of specific,
    // actionable messages unreachable, so parse the real shape.
    const data = (await res.json().catch(() => null)) as
      | { error?: { code?: string } }
      | null;
    return {
      code: data?.error?.code,
      message: apiErrorMessage(data, "Something went wrong."),
    };
  } catch {
    return { message: "Network error — check your connection." };
  }
}

// ── ReplyComposer ─────────────────────────────────────────────────────────────

export function ReplyComposer({
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

  // Credential-aware action hierarchy. A connected app publishes from one
  // button; an unconnected one is sent to connect. Copy-and-paste is never the
  // hero — asking the customer to paste the reply themselves is the work they
  // bought the product to remove.
  //
  // This asked `has_credentials` for both stores, which is the App Store's
  // per-app key pair. A Google Play app never has one — its auth is the
  // workspace service account — so the check was permanently false on Android
  // and every Play customer was told to paste their reply into Play Console
  // by hand. canPostRepliesViaApi asks the right question per platform.
  //
  // Fallback when appId is missing (pre-deploy rows in cache): any connected
  // app on the same platform counts.
  const { apps } = useApps();
  const reviewPlatform = review.source === "App Store" ? "app_store" : "google_play";
  const composerApp = review.appId ? apps.find((a) => a.id === review.appId) : undefined;
  const canPostViaApi = composerApp
    ? canPostRepliesViaApi(composerApp)
    : apps.some((a) => a.platform === reviewPlatform && canPostRepliesViaApi(a));

  // Translation state
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState<string | null>(null);
  const [sourceLang, setSourceLang]         = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);

  // Decided locally, before any request: no point offering translation on a
  // review that is already in English.
  const needsTranslation = useMemo(() => !isLikelyEnglish(review.text), [review.text]);

  // Tags are editable, so the pane holds its own copy: the list query behind it
  // is invalidated on save, but waiting for that refetch would make the chips
  // flicker back to their old values for a beat.
  const [localTags, setLocalTags] = useState<string[]>(review.issueTags);
  useEffect(() => { setLocalTags(review.issueTags); }, [review.id, review.issueTags]);

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

  const handleGenerate = useCallback(async (selectedTone: AIReplyTone, force = false) => {
    // Already have this review's draft in this tone — reuse it rather than
    // asking the server again. Opening a review auto-drafts and every tone
    // switch re-drafts, so without this, flipping Professional → Empathetic →
    // Professional costs three requests to end up where you started, and
    // simply re-reading a review you looked at ten minutes ago costs another.
    // "Regenerate" passes force:true, which is the one case where the user is
    // explicitly asking for a different answer.
    const memoKey = `${review.id}|${selectedTone}`;
    if (!force) {
      const remembered = draftMemo.get(memoKey);
      if (remembered) {
        setAiSuggestion(remembered);
        setText(remembered);
        setOriginalDraft(remembered);
        return;
      }
    }

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
      draftMemo.set(memoKey, data.reply);
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
      const failure = await postReplyState(review.id, {
        replyText:   text,
        status:      "sent",
        draftSource: draftSource ?? "manual",
        draftEdited: originalDraft !== null && text.trim() !== originalDraft.trim(),
      });

      if (failure) {
        // Switch on error.code, never the message (D004). Comparing the
        // nested error OBJECT against code strings is what once made every
        // one of these specific, actionable messages unreachable dead code.
        const code = failure.code;
        const isCredentialError =
          code === "APP_STORE_NOT_CONNECTED" ||
          code === "GOOGLE_PLAY_NOT_CONFIGURED";
        const msg =
          code === "APP_STORE_NOT_CONNECTED"   ? "App Store credentials not connected."      :
          code === "GOOGLE_PLAY_NOT_CONFIGURED"? "Google Play service account not configured." :
          code === "STORE_RATE_LIMITED"        ? "Store rate limit — try again in a few minutes." :
          code === "REVIEW_NOT_FOUND_ON_STORE" ? "Review no longer available on the store."   :
          code === "STORE_SUBMIT_FAILED"       ? "Store rejected the reply — check credentials." :
          code === "REPLY_TOO_LONG"            ? "Reply exceeds the store's character limit."  :
          failure.message;
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
    setSendFeedback(null);
    setSendError(null);
    setSendErrorLink(null);
    try {
      const failure = await postReplyState(review.id, {
        replyText:   text,
        status:      "manual_replied",
        draftSource: draftSource ?? "manual",
        draftEdited: originalDraft !== null && text.trim() !== originalDraft.trim(),
      });

      if (failure) {
        // Stays on screen. The user has already posted this reply on the
        // store — telling them we failed to record it is the whole point,
        // and auto-clearing the message would put them back where they were.
        setSendFeedback("error");
        setSendError(`Couldn't record your reply — ${failure.message}`);
        return;
      }

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
    } finally {
      setIsMarking(false);
    }
  }

  async function handleSaveDraft() {
    if (!text.trim() || isSavingDraft) return;
    setIsSavingDraft(true);
    setDraftSaved(false);
    setSendFeedback(null);
    setSendError(null);
    try {
      const failure = await postReplyState(review.id, {
        replyText: text,
        status:    "draft",
      });

      if (failure) {
        setSendFeedback("error");
        setSendError(`Couldn't save your draft — ${failure.message}`);
        setTimeout(() => { setSendFeedback(null); setSendError(null); }, 6000);
        return;
      }

      markDraft(review.id, text.trim());
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 3000);
    } finally {
      setIsSavingDraft(false);
    }
  }

  return (
    <div className={cn("flex w-full sm:w-[420px] shrink-0 flex-col border-l border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)]", className)}>
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-[var(--rb-border-1)] px-5 py-4">
        <ReviewerAvatar author={review.author} source={review.source} size="xs" />
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
      <div className="border-b border-[var(--rb-border-1)] px-5 py-4">
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
          {/* Not sliced to 3 any more. The cap made sense when tags were
              automatic and decorative; once they are a thing you edit, a
              hidden fourth tag is a tag you cannot remove. */}
          <ReviewTagEditor
            reviewId={review.id}
            tags={localTags}
            autoTags={review.autoIssueTags}
            edited={review.tagsEdited}
            onSaved={setLocalTags}
          />
          {/* Translate button. Hidden when the review is already English —
              clicking it there spent a Groq call and an hourly rate-limit slot
              to render the words "Already in English." */}
          {needsTranslation && (
          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="ml-auto flex items-center gap-1 rounded-full border border-[var(--rb-border-2)] bg-[var(--rb-bg-surface)] px-2.5 py-0.5 text-[11px] font-semibold text-[var(--rb-fg-2)] transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-50"
          >
            {isTranslating ? (
              <Loader2 className="size-2.5 animate-spin" />
            ) : (
              <Languages className="size-3" strokeWidth={1.75} />
            )}
            {showTranslation ? "Original" : "Translate"}
          </button>
          )}
        </div>

        {/* Review metadata, one line.
            It was a 2x2 card of labelled cells taking ~90px of the detail
            pane's vertical budget — above the fold, ahead of the reply
            composer, for four short facts nobody reads in isolation. They are
            context you glance at, not fields you study, so they get one dotted
            line and the space goes to the reply. Empty values drop out rather
            than rendering an em dash placeholder each. */}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-[var(--rb-fg-3)]">
          {[
            review.source === "App Store" ? "iOS" : "Android",
            review.appVersion ? `v${review.appVersion}` : null,
            review.device || null,
            review.country || null,
          ]
            .filter(Boolean)
            .map((value, i) => (
              <span key={`${value}-${i}`} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true" className="text-[var(--rb-fg-4)]">·</span>}
                <span className="truncate">{value}</span>
              </span>
            ))}
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
        <div className="border-b border-[var(--rb-border-1)] bg-[var(--rb-green-50)] px-5 py-3.5">
          <div className="mb-1 text-[11px] font-semibold text-[var(--rb-green-600)]">Your reply</div>
          <p className="text-[12px] leading-relaxed text-[var(--rb-fg-2)]">{review.replyText}</p>
        </div>
      )}

      {/* Composer */}
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">

        {/* AI tone bar — shows while generating or after AI text is ready */}
        {!alreadyReplied && (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {isGenerating ? (
                <Loader2 className="size-3 animate-spin text-[var(--rb-blue-500)]" strokeWidth={1.5} />
              ) : (
                <PenLine className="size-3 text-[var(--rb-blue-500)]" />
              )}
              <span className={cn(
                "text-[11px] font-semibold",
                draftSource === "composer" ? "text-[var(--rb-amber-600)]" : "text-[var(--rb-blue-500)]",
              )}>
                {/* `composer` is Tier 4: both Groq and Gemini failed and the
                    server returned a deterministic, stitched-together reply.
                    That degradation used to be invisible, so an outage looked
                    like the AI simply writing badly. Say which it is. */}
                {isGenerating
                  ? "Generating…"
                  : draftSource === "composer"
                    ? "AI unavailable · basic draft"
                    : aiSuggestion
                      ? "AI draft, edit or publish"
                      : "AI reply"}
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
              onClick={() => handleGenerate(tone, true)}
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
              "w-full resize-none rounded-lg border bg-[var(--rb-bg-surface)] p-3 text-[13px] leading-relaxed text-[var(--rb-fg-1)] placeholder:text-[var(--rb-fg-3)] outline-none transition-colors",
              overLimit
                ? "border-[var(--rb-red-400)] focus:border-[var(--rb-red-400)]"
                : "border-[var(--rb-border-2)] focus:border-[var(--rb-blue-400)]",
            )}
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
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--rb-green-500)]"><Check className="size-3.5" strokeWidth={3} />Marked as replied, moving to next…</p>
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
                  {/* One button, and it publishes. D018 made copy-and-paste
                      the launch path only because the API write-back could not
                      be verified without store admin access; it sequenced
                      one-click posting for "when a customer (or we) hold store
                      admin/API access". That condition is met, so a connected
                      app gets the thing the product is for. */}
                  <button
                    onClick={handleSend}
                    disabled={isSending || !text.trim() || overLimit}
                    className="h-10 w-full rounded-[8px] bg-[var(--rb-blue-500)] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--rb-blue-600)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] focus-visible:ring-offset-1"
                  >
                    {isSending ? "Publishing…" : "Publish reply"}
                  </button>
                  <p className="text-[10px] leading-relaxed text-[var(--rb-fg-3)]">
                    Publishes to {review.source === "App Store" ? "the App Store" : "Google Play"} under your developer name — the review page updates in minutes.
                    {overLimit && <span className="ml-1 text-[var(--rb-red-500)]">Reply is over the {limit}-char store limit.</span>}
                  </p>
                </>
              ) : (
                <>
                  {/* Not connected yet. The primary action still points at
                      publishing — it just routes to the two-minute connection
                      instead of promising something we can't do. Offering
                      "Copy reply" as the hero here is what made the product
                      feel pointless: it asks the customer to do by hand the
                      exact work they bought it to remove. */}
                  <Link
                    href="/settings"
                    className="flex h-10 w-full items-center justify-center rounded-[8px] bg-[var(--rb-blue-500)] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--rb-blue-600)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF] focus-visible:ring-offset-1"
                  >
                    Connect {review.source === "App Store" ? "App Store Connect" : "Google Play"} to publish
                  </Link>
                  <p className="text-[10px] leading-relaxed text-[var(--rb-fg-3)]">
                    Takes about two minutes. Until then you can copy the reply and paste it into {review.source === "App Store" ? "App Store Connect" : "Play Console"} yourself.
                    {overLimit && <span className="ml-1 text-[var(--rb-red-500)]">Reply is over the {limit}-char store limit.</span>}
                  </p>

                  {/* Draft Mode stays reachable, demoted: copy, then record it. */}
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      disabled={!text.trim()}
                      className={cn(
                        "h-9 flex-1 rounded-[8px] border border-[var(--rb-border-3)] text-[12px] font-semibold transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]",
                        copied
                          ? "border-[var(--rb-green-500)]/30 bg-[var(--rb-green-500)]/10 text-[var(--rb-green-500)]"
                          : "bg-surface text-[var(--rb-fg-1)] hover:bg-[var(--rb-bg-hover)]",
                      )}
                    >
                      {copied ? <><Check className="size-3.5" strokeWidth={3} />Copied</> : "Copy reply"}
                    </button>
                    <button
                      onClick={handleMarkReplied}
                      disabled={!text.trim() || overLimit || isMarking}
                      className="h-9 flex-1 rounded-[8px] border border-[var(--rb-border-3)] bg-surface text-[12px] font-semibold text-[var(--rb-fg-1)] transition-colors hover:bg-[var(--rb-bg-hover)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0A84FF]"
                    >
                      {isMarking ? "Saving…" : alreadyReplied ? "Update reply" : "Mark as replied"}
                    </button>
                  </div>
                </>
              )}

              {/* Secondary row */}
              <div className="flex items-center gap-3">
                <button
                  onClick={handleSaveDraft}
                  disabled={!text.trim() || isSavingDraft}
                  className="text-[11px] font-medium text-[var(--rb-fg-3)] transition-colors hover:text-[var(--rb-fg-2)] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0A84FF]"
                >
                  {isSavingDraft ? "Saving…" : draftSaved ? <><Check className="size-3.5" strokeWidth={3} />Saved</> : "Save draft"}
                </button>
                {!alreadyReplied && aiSuggestion && (
                  <button
                    onClick={() => handleGenerate(tone, true)}
                    disabled={isGenerating}
                    className="text-[11px] font-medium text-[var(--rb-fg-3)] transition-colors hover:text-[var(--rb-fg-2)] disabled:opacity-40"
                  >
                    Regenerate
                  </button>
                )}
                {/* No "Post via API" escape hatch. It was a tertiary link that
                    posted for real, sitting under a hero that told you to copy
                    and paste — two contradictory answers to "how do I reply?"
                    on one screen. Connected apps publish from the button
                    above; unconnected ones connect first. */}
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

