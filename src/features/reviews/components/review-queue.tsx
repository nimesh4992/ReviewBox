"use client";

import { useState } from "react";
import Link from "next/link";

import {
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Inbox,
  Loader2,
  MessageSquareReply,
  ShieldAlert,
  Star,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  AppReview,
  EscalationState,
  ReplyStatus,
  ReviewIssueTag,
  ReviewPriority,
  ReviewSentiment,
  ReviewSource,
} from "@/types/review";
import { avatarColor, avatarInitials, countryFlag, humanizeToken } from "@/utils/format";

const SENTIMENT_BORDER: Record<ReviewSentiment, string> = {
  critical: "border-l-[3px] border-l-red-500",
  negative: "border-l-[3px] border-l-amber-400",
  mixed:    "border-l-[3px] border-l-gray-300",
  positive: "border-l-[3px] border-l-emerald-400",
};

const SENTIMENT_BADGE: Record<ReviewSentiment, { label: string; className: string }> = {
  critical: { label: "Critical",  className: "bg-red-50 text-red-600 border border-red-200" },
  negative: { label: "Negative",  className: "bg-amber-50 text-amber-600 border border-amber-200" },
  mixed:    { label: "Mixed",     className: "bg-gray-50 text-gray-500 border border-gray-200" },
  positive: { label: "Positive",  className: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
};

const TAG_STYLE: Record<ReviewIssueTag, string> = {
  "crash":              "bg-red-50 text-red-600 border-red-200",
  "release-regression": "bg-red-50 text-red-600 border-red-200",
  "billing":            "bg-amber-50 text-amber-600 border-amber-200",
  "login":              "bg-amber-50 text-amber-600 border-amber-200",
  "support-delay":      "bg-amber-50 text-amber-600 border-amber-200",
  "performance":        "bg-orange-50 text-orange-600 border-orange-200",
  "feature-request":    "bg-blue-50 text-blue-600 border-blue-200",
  "localization":       "bg-gray-50 text-gray-500 border-gray-200",
};

// 3-color palette: red / amber / gray
const PRIORITY_BADGE: Record<ReviewPriority, string> = {
  urgent: "bg-red-50 text-red-600 border-red-200",
  high: "bg-amber-50 text-amber-600 border-amber-200",
  normal: "bg-gray-50 text-gray-500 border-gray-200",
  low: "bg-gray-50 text-gray-400 border-gray-100",
};

const REPLY_STATUS: Record<ReplyStatus, { label: string; Icon: typeof Bot; className: string }> = {
  needs_reply: { label: "Needs reply", Icon: MessageSquareReply, className: "text-red-500" },
  draft_ready: { label: "Draft ready", Icon: Bot, className: "text-gray-500" },
  replied: { label: "Replied", Icon: CheckCircle2, className: "text-gray-400" },
  waiting: { label: "Waiting", Icon: Clock3, className: "text-amber-500" },
};

const ESCALATION: Record<EscalationState, { label: string; className: string }> = {
  none: { label: "—", className: "text-gray-300" },
  support: { label: "Support", className: "text-gray-500" },
  product: { label: "Product", className: "text-gray-500" },
  engineering: { label: "Engineering", className: "text-gray-500" },
  incident: { label: "Incident", className: "text-red-500" },
};

const TABS = [
  { value: "all", label: "All", count: (r: AppReview[]) => r.length },
  { value: "no_reply", label: "No reply", count: (r: AppReview[]) => r.filter(x => x.replyStatus === "needs_reply").length },
  { value: "pending", label: "Pending", count: (r: AppReview[]) => r.filter(x => x.replyStatus === "draft_ready" || x.replyStatus === "waiting").length },
  { value: "urgent", label: "Urgent", count: (r: AppReview[]) => r.filter(x => x.priority === "urgent").length },
];

function StarRating({ rating }: { rating: AppReview["rating"] }) {
  return (
    <div className="flex items-center gap-0.5">
      {([1, 2, 3, 4, 5] as const).map((n) => (
        <Star
          key={n}
          className={cn("size-3 fill-current", n <= rating ? "text-amber-400" : "text-gray-200")}
        />
      ))}
    </div>
  );
}

function PlatformBadge({ source }: { source: ReviewSource }) {
  return (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
      {source === "App Store" ? "App Store" : "Google Play"}
    </span>
  );
}

type ToneOption = "professional" | "empathetic" | "casual" | "direct";

const TONE_OPTIONS: { value: ToneOption; label: string }[] = [
  { value: "professional", label: "General" },
  { value: "empathetic",   label: "Apology" },
  { value: "casual",       label: "Feature Issue" },
  { value: "direct",       label: "Technical" },
];

function ReviewCard({ review }: { review: AppReview }) {
  const [draftOpen, setDraftOpen] = useState(false);
  const [tone, setTone] = useState<ToneOption>("professional");
  const [draftText, setDraftText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<"success" | "error" | null>(null);
  const [localReplyStatus, setLocalReplyStatus] = useState<ReplyStatus>(review.replyStatus);
  const [localReplyText, setLocalReplyText] = useState<string | undefined>(review.replyText);

  const reply = REPLY_STATUS[localReplyStatus];
  const escalation = ESCALATION[review.escalationState];
  const ReplyIcon = reply.Icon;

  async function handleGenerate() {
    setIsLoading(true);
    setDraftError(null);
    try {
      const res = await fetch("/api/reply/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewId: review.id,
          reviewBody: review.text,
          rating: review.rating,
          tags: review.issueTags,
          tone,
        }),
      });

      if (res.status === 429) {
        setDraftError("Daily AI limit reached. Upgrade to get more.");
        return;
      }

      if (res.status === 503) {
        setDraftError("AI unavailable — try again shortly.");
        return;
      }

      if (!res.ok) {
        setDraftError("Something went wrong. Please try again.");
        return;
      }

      const data = (await res.json()) as { source: string; reply: string };
      setDraftText(data.reply);
    } catch {
      setDraftError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSend() {
    if (!draftText.trim()) return;
    setIsSending(true);
    setSendFeedback(null);
    try {
      const res = await fetch(`/api/reviews/${review.id}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyText: draftText, status: "sent" }),
      });

      if (!res.ok) {
        setSendFeedback("error");
        setTimeout(() => setSendFeedback(null), 2000);
        return;
      }

      setLocalReplyStatus("replied");
      setLocalReplyText(draftText);
      setSendFeedback("success");
      setTimeout(() => {
        setSendFeedback(null);
        setDraftOpen(false);
      }, 2000);
    } catch {
      setSendFeedback("error");
      setTimeout(() => setSendFeedback(null), 2000);
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow duration-150 hover:shadow-md",
        SENTIMENT_BORDER[review.sentiment],
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        {/* Header row */}
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                avatarColor(review.author),
              )}
            >
              {avatarInitials(review.author)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-sm font-semibold text-gray-900">{review.author}</span>
                <span className="text-sm">{countryFlag(review.country)}</span>
                <PlatformBadge source={review.source} />
                <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", SENTIMENT_BADGE[review.sentiment].className)}>
                  {SENTIMENT_BADGE[review.sentiment].label}
                </span>
                <span className="text-[11px] text-gray-400">{review.createdAt}</span>
              </div>
              <div className="mt-0.5 flex items-center gap-2">
                <StarRating rating={review.rating} />
                <span className="font-mono text-[11px] text-gray-400">{review.appVersion}</span>
                <span className="text-[11px] text-gray-400">{review.device}</span>
              </div>
            </div>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "h-5 shrink-0 rounded-full border px-2 text-[10px] font-medium capitalize",
              PRIORITY_BADGE[review.priority],
            )}
          >
            {review.priority}
          </Badge>
        </div>

        {/* Review text */}
        <p className="text-sm leading-5 text-gray-600 line-clamp-2">{review.text}</p>

        {/* Sent reply preview */}
        {localReplyStatus === "replied" && localReplyText && (
          <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
            <p className="text-[10px] font-medium text-gray-400 mb-1">Your reply</p>
            <p className="text-xs leading-4 text-gray-600">{localReplyText}</p>
          </div>
        )}

        {/* Footer row */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3">
            {/* Tags */}
            <div className="flex flex-wrap gap-1">
              {review.issueTags.map((tag) => (
                <span
                  key={tag}
                  className={cn("rounded border px-1.5 py-0.5 text-[10px] font-medium", TAG_STYLE[tag])}
                >
                  {humanizeToken(tag)}
                </span>
              ))}
            </div>

            {/* Reply status */}
            <span className={cn("flex items-center gap-1 text-xs", reply.className)}>
              <ReplyIcon className="size-3.5" strokeWidth={1.5} />
              {reply.label}
            </span>

            {/* Escalation — only show incident level */}
            {review.escalationState === "incident" && (
              <span className="flex items-center gap-1 text-xs text-red-500">
                <ShieldAlert className="size-3.5" strokeWidth={1.5} />
                {escalation.label}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            {review.hasAiSuggestion && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 border-gray-200 px-2 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
                    onClick={() => setDraftOpen(!draftOpen)}
                  >
                    <Bot className="size-3.5" strokeWidth={1.5} />
                    AI Draft
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Generate AI reply draft</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-gray-300 hover:text-gray-500"
                  aria-label="Open review"
                >
                  <ExternalLink className="size-3.5" strokeWidth={1.5} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Open review</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      {/* Inline AI draft panel */}
      {draftOpen && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          {/* Tone selector row */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] text-gray-400">Tone:</span>
            {TONE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTone(opt.value)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] text-gray-600 hover:bg-gray-100",
                  tone === opt.value
                    ? "border-gray-400 bg-gray-100 font-medium"
                    : "border-gray-200 bg-white",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Draft text area */}
          <textarea
            className="w-full resize-none rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700 transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-gray-300"
            rows={4}
            value={draftText}
            placeholder="Click Generate to create an AI draft reply…"
            onChange={(e) => setDraftText(e.target.value)}
          />
          {/* Error message */}
          {draftError && (
            <p className="mt-1.5 text-[11px] text-red-500">{draftError}</p>
          )}
          {/* Actions */}
          <div className="mt-2 flex items-center justify-between">
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                  Generating…
                </>
              ) : draftText ? (
                "Regenerate"
              ) : (
                "Generate"
              )}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setDraftOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
              >
                Discard
              </button>
              <button
                onClick={handleSend}
                disabled={isSending || !draftText.trim() || sendFeedback === "success"}
                className={cn(
                  "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                  sendFeedback === "success"
                    ? "bg-emerald-600 text-white"
                    : sendFeedback === "error"
                      ? "bg-red-600 text-white"
                      : "bg-gray-900 text-white hover:bg-gray-800",
                )}
              >
                {isSending ? (
                  <>
                    <Loader2 className="size-3 animate-spin" strokeWidth={1.5} />
                    Sending…
                  </>
                ) : sendFeedback === "success" ? (
                  "✓ Reply sent"
                ) : sendFeedback === "error" ? (
                  "Failed to send — try again"
                ) : (
                  "Send reply"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ReviewQueueProps {
  reviews: AppReview[];
  title?: string;
  description?: string;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

export function ReviewQueue({
  reviews,
  title = "Review queue",
  description = "Critical reviews requiring triage",
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
}: ReviewQueueProps) {
  const [activeTab, setActiveTab] = useState<string>("all");

  const urgentCount = reviews.filter((r) => r.priority === "urgent").length;

  const filteredReviews = reviews.filter((r) => {
    if (activeTab === "all") return true;
    if (activeTab === "no_reply") return r.replyStatus === "needs_reply";
    if (activeTab === "pending") return r.replyStatus === "draft_ready" || r.replyStatus === "waiting";
    if (activeTab === "urgent") return r.priority === "urgent";
    return true;
  });

  return (
    <section className="min-w-0">
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
            {urgentCount > 0 && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                {urgentCount} urgent
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-gray-400">{description}</p>
        </div>

        <div className="flex gap-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                activeTab === tab.value
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700",
              )}
            >
              {tab.label}
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                activeTab === tab.value ? "bg-gray-100 text-gray-600" : "text-gray-400",
              )}>
                {tab.count(reviews)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filteredReviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
            <Inbox className="size-12 text-gray-200" strokeWidth={1.5} />
            <h3 className="mt-4 text-sm font-semibold text-gray-900">No reviews yet</h3>
            <p className="mt-1 max-w-xs text-xs text-gray-400">
              Connect Google Play Console or App Store Connect in Settings to start syncing reviews.
            </p>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="mt-4 h-8 border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
            >
              <Link href="/settings">Go to Settings</Link>
            </Button>
          </div>
        ) : (
          filteredReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))
        )}
      </div>

      {/* Load more */}
      {hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            className="h-8 border-gray-200 text-xs text-gray-600 hover:bg-gray-50"
            onClick={() => fetchNextPage?.()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? (
              <>
                <Loader2 className="size-3.5 animate-spin" strokeWidth={1.5} />
                Loading…
              </>
            ) : (
              "Load more"
            )}
          </Button>
        </div>
      )}
    </section>
  );
}
