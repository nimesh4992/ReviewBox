"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";
import { AppReview, ReviewSentiment, AIReplyTone } from "@/types/review";
import { avatarInitials } from "@/utils/format";
import { avatarColorVar } from "@/lib/avatar-color";

/**
 * Small presentational pieces shared by the review row, the reply composer and
 * the group-reply panel.
 *
 * Extracted from review-queue.tsx unchanged. Each of these was used by two or
 * three of those components while living in the same 2,000-line module as all
 * of them, which is precisely the shape that made concurrent PRs collide.
 */

// ── Stars ─────────────────────────────────────────────────────────────────────

export function Stars({ rating, size = 12 }: { rating: number; size?: number }) {
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

export const SENTIMENT_DOT: Record<ReviewSentiment, string> = {
  critical: "bg-[var(--rb-red-500)]",
  negative: "bg-[var(--rb-amber-500)]",
  mixed:    "bg-[var(--rb-fg-4)]",
  positive: "bg-[var(--rb-green-500)]",
};

// at a glance, just moved to the badge where it costs nothing.

export function GooglePlayMark({ className }: { className?: string }) {
  // Official Google Play geometry, split into its four wedges so each can take
  // its own brand colour — the mark is only readable as Google Play in colour,
  // so this can't collapse to a single path. Path data from the simple-icons
  // project (CC0); copied rather than depended on, for four paths.
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924z"
        fill="#00A0FF"
      />
      <path
        d="M13.544 10.989l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973z"
        fill="#00E676"
      />
      <path
        d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594z"
        fill="#FFCE00"
      />
      <path
        d="M13.544 13.056l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z"
        fill="#FF3A44"
      />
    </svg>
  );
}

/** The App Store "A", official outline. simple-icons (CC0). */
const APP_STORE_GLYPH =
  "M8.8086 14.9194l6.1107-11.0368c.0837-.1513.1682-.302.2437-.4584.0685-.142.1267-.2854.1646-.4403.0803-.3259.0588-.6656-.066-.9767-.1238-.3095-.3417-.5678-.6201-.7355a1.4175 1.4175 0 0 0-.921-.1924c-.3207.043-.6135.1935-.8443.4288-.1094.1118-.1996.2361-.2832.369-.092.1463-.175.2979-.259.4492l-.3864.6979-.3865-.6979c-.0837-.1515-.1667-.303-.2587-.4492-.0837-.1329-.1739-.2572-.2835-.369-.2305-.2353-.5233-.3857-.844-.429a1.4181 1.4181 0 0 0-.921.1926c-.2784.1677-.4964.426-.6203.7355-.1246.311-.1461.6508-.066.9767.038.155.0962.2984.1648.4403.0753.1564.1598.307.2437.4584l1.248 2.2543-4.8625 8.7825H2.0295c-.1676 0-.3351-.0007-.5026.0092-.1522.009-.3004.0284-.448.0714-.3108.0906-.5822.2798-.7783.548-.195.2665-.3006.5929-.3006.9279 0 .3352.1057.6612.3006.9277.196.2683.4675.4575.7782.548.1477.043.296.0623.4481.0715.1675.01.335.009.5026.009h13.0974c.0171-.0357.059-.1294.1-.2697.415-1.4151-.6156-2.843-2.0347-2.843zM3.113 18.5418l-.7922 1.5008c-.0818.1553-.1644.31-.2384.4705-.067.1458-.124.293-.1611.452-.0785.3346-.0576.6834.0645 1.0029.1212.3175.3346.583.607.7549.2727.172.5891.2416.9013.1975.3139-.044.6005-.1986.8263-.4402.1072-.1148.1954-.2424.2772-.3787.0902-.1503.1714-.3059.2535-.4612L6 19.4636c-.0896-.149-.9473-1.4704-2.887-.9218m20.5861-3.0056a1.4707 1.4707 0 0 0-.779-.5407c-.1476-.0425-.2961-.0616-.4483-.0705-.1678-.0099-.3352-.0091-.503-.0091H18.648l-4.3891-7.817c-.6655.7005-.9632 1.485-1.0773 2.1976-.1655 1.0333.0367 2.0934.546 3.0004l5.2741 9.3933c.084.1494.167.299.2591.4435.0837.131.1739.2537.2836.364.231.2323.5238.3809.8449.4232.3192.0424.643-.0244.9217-.1899.2784-.1653.4968-.4204.621-.7257.1246-.3072.146-.6425.0658-.9641-.0381-.1529-.0962-.2945-.165-.4346-.0753-.1543-.1598-.303-.2438-.4524l-1.216-2.1662h1.596c.1677 0 .3351.0009.5029-.009.1522-.009.3007-.028.4483-.0705a1.4707 1.4707 0 0 0 .779-.5407A1.5386 1.5386 0 0 0 24 16.452a1.539 1.539 0 0 0-.3009-.9158Z";

export function AppStoreMark({ className }: { className?: string }) {
  // The tile as it appears on a device: blue gradient rounded square with the
  // white glyph inset. The glyph's own artwork fills a 24-unit box, so it is
  // scaled to 70% and centred (24 - 16.8) / 2 = 3.6 to leave the tile's margin.
  //
  // useId: the badge renders once per row, and a hardcoded gradient id would
  // be duplicated across every one of them — invalid markup, and the kind that
  // breaks unpredictably once a second SVG on the page claims the same name.
  const gradId = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1AC8FB" />
          <stop offset="100%" stopColor="#1A66E8" />
        </linearGradient>
      </defs>
      <rect width="24" height="24" rx="5.4" fill={`url(#${gradId})`} />
      <g transform="translate(3.6 3.6) scale(0.7)">
        <path d={APP_STORE_GLYPH} fill="#fff" />
      </g>
    </svg>
  );
}

export function ReviewerAvatar({ author, source, size = "sm" }: {
  author: string;
  source: AppReview["source"];
  size?: "sm" | "xs";
}) {
  const isIos = source === "App Store";
  const isSm  = size === "sm";
  // Fall back to "?" rather than an empty tile — Google Play returns a blank
  // author for reviews left without a profile name.
  const initials = avatarInitials(author) || "?";
  const label = author || "Anonymous reviewer";
  const store = isIos ? "App Store" : "Google Play";

  return (
    <div className={cn("relative shrink-0", isSm ? "size-9" : "size-7")}>
      <div
        title={`${label} · ${store}`}
        className={cn(
          "flex size-full items-center justify-center font-bold text-white",
          isSm ? "rounded-[9px] text-[13px]" : "rounded-[7px] text-[11px]",
        )}
        // Colour comes from the --rb-avatar-* palette, indexed by a hash of
        // the name, so it is stable per reviewer across renders and screens.
        style={{ backgroundColor: avatarColorVar(author) }}
      >
        {initials}
      </div>

      {/* Store badge. The white ring keeps both marks legible whichever colour
          the avatar landed on, and against the row background in dark mode. */}
      <span
        className={cn(
          "absolute -bottom-[3px] -right-[3px] flex items-center justify-center rounded-full bg-white ring-1 ring-black/[0.06]",
          isSm ? "size-4" : "size-[13px]",
        )}
      >
        {isIos ? (
          <AppStoreMark className={isSm ? "size-3 rounded-[3px]" : "size-2.5 rounded-[2px]"} />
        ) : (
          // The Play wedge is wider than the App Store tile is square, so it
          // gets slightly less room to keep both badges optically equal.
          <GooglePlayMark className={isSm ? "size-2.5" : "size-2"} />
        )}
      </span>
    </div>
  );
}

// ── Short title ───────────────────────────────────────────────────────────────

export function shortTitle(text: string): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= 6) return text;
  return words.slice(0, 6).join(" ") + "…";
}

// ── ReviewRow ─────────────────────────────────────────────────────────────────

// ── Tone selector ─────────────────────────────────────────────────────────────

export const TONES: { value: AIReplyTone; label: string }[] = [
  { value: "professional", label: "Professional" },
  { value: "empathetic",   label: "Empathetic"   },
  { value: "casual",       label: "Casual"        },
  { value: "direct",       label: "Direct"        },
];

export function ToneSelector({ tone, onChange }: {
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

// ── Reply POST ────────────────────────────────────────────────────────────────

/**
 * POST a reply state change for one review. Returns `null` on success, or a
 * human-readable failure message.
 *
 * Every reply action goes through here so a fix lands once. They used to each
 * hand-roll the fetch, and only `handleSend` was ever hardened: the two Draft
 * Mode actions beside it checked `res.ok` with no else branch and swallowed
 * throws in an empty catch, so a failure just reverted the button label with
 * no message anywhere.
 *
 * That mattered most for "Mark as replied" — the core action of the D018
 * launch tier, where the customer has ALREADY posted their reply on the store
 * and is only telling us about it. A silent failure there leaves the review
 * sitting in `needs_reply` forever while the customer believes it's recorded,
 * with nothing on screen to suggest otherwise.
 */
