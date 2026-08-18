"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

/**
 * The product as the hero image: a hand-built rendering of the review inbox
 * inside a browser frame, with the reply draft typing itself in.
 *
 * This is an illustration of the UI, not a screenshot pipeline — but it must
 * stay faithful to what the inbox actually looks like (two panes, priority
 * dots, tag chips, suggested-reply block). If the real inbox changes shape,
 * this changes with it. The reviews are fictional and presented as product
 * UI, the same "show, don't claim" rule as the rest of the site — no invented
 * customers, no invented numbers.
 */

const DRAFT =
  "Thanks for flagging the iPad freeze on 4.2.1. We reproduced it this morning and a fix is rolling out this week. In the meantime, force-quitting and reopening restores the session. I'll follow up here the moment 4.2.2 lands.";

const LIST = [
  {
    title: "Crashes on iPad after 4.2.1",
    snippet: "Every time I open the budgets tab on iPad it freezes…",
    rating: 1,
    tag: "crash",
    dot: "var(--rb-red-500)",
    time: "2m",
    selected: true,
  },
  {
    title: "Charged twice for annual plan",
    snippet: "Upgraded last week and my card shows two charges…",
    rating: 2,
    tag: "billing",
    dot: "var(--rb-amber-500)",
    time: "26m",
    selected: false,
  },
  {
    title: "Great app, but needs dark mode",
    snippet: "Been using it for three months. One request…",
    rating: 4,
    tag: "feature-request",
    dot: "var(--rb-green-500)",
    time: "1h",
    selected: false,
  },
  {
    title: "Replaced our review spreadsheet",
    snippet: "Support finally sees the same queue we do…",
    rating: 5,
    tag: "support",
    dot: "var(--rb-green-500)",
    time: "3h",
    selected: false,
  },
];

/**
 * Real icons, not the "★" glyph. A text star resolves through whatever the OS
 * ships, so the core data type of a review product rendered at a different
 * weight and baseline on Windows than on the Mac it was designed on. `role`
 * is required for the label to be exposed — a bare <span> is `generic`.
 */
function Stars({ rating }: { rating: number }) {
  return (
    <span
      role="img"
      aria-label={`${rating} out of 5 stars`}
      className="inline-flex items-center gap-px"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={
            i < rating ? "size-3 text-[var(--rb-amber-500)]" : "size-3 text-fg-3"
          }
          fill={i < rating ? "currentColor" : "none"}
          strokeWidth={i < rating ? 0 : 1.5}
        />
      ))}
    </span>
  );
}

function TypedDraft() {
  // SSR renders the full draft; the effect replays it as a typing animation.
  // Readers with reduced motion (or JS off) just see the finished text.
  const [typed, setTyped] = useState(DRAFT);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setTyped("");
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setTyped(DRAFT.slice(0, i));
      if (i >= DRAFT.length) clearInterval(id);
    }, 16);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="mt-2 min-h-[4.5rem] text-[13px] leading-relaxed text-fg-1 sm:min-h-[3.75rem]">
      {typed}
      {typed.length < DRAFT.length && (
        <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-[var(--rb-blue-500)] align-baseline" />
      )}
    </p>
  );
}

export function ProductFrame({ id }: { id?: string }) {
  return (
    <figure
      id={id}
      aria-label="The ReviewBox inbox: a queue of store reviews with a suggested reply drafted for the selected one"
      className="scroll-mt-24 overflow-hidden rounded-xl border border-[var(--rb-border-2)] bg-surface shadow-[var(--rb-shadow-lg)]"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-3 border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-[var(--rb-border-3)]" />
          <span className="size-2.5 rounded-full bg-[var(--rb-border-3)]" />
          <span className="size-2.5 rounded-full bg-[var(--rb-border-3)]" />
        </span>
        {/* The one legitimate monospace on the marketing site: an actual URL. */}
        <span className="mx-auto flex h-6 w-full max-w-[320px] items-center justify-center rounded-md border border-[var(--rb-border-1)] bg-surface font-[family-name:var(--rb-font-mono)] text-[11px] text-fg-3">
          app.tryreviewbox.com/reviews
        </span>
        <span className="w-[52px]" aria-hidden="true" />
      </div>

      <div className="grid md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        {/* Review list — hidden on small screens where two panes can't breathe */}
        <div className="hidden border-r border-[var(--rb-border-1)] md:block">
          <div className="flex items-center gap-4 border-b border-[var(--rb-border-1)] px-4 py-2.5">
            {["Needs reply", "Urgent", "All"].map((f, i) => (
              <span
                key={f}
                className={
                  i === 0
                    ? "text-[12px] font-medium text-fg-1"
                    : "text-[12px] text-fg-3"
                }
              >
                {f}
              </span>
            ))}
            <span className="ml-auto text-[11px] font-medium tabular-nums text-fg-3">
              23 open
            </span>
          </div>
          <ul>
            {LIST.map((r) => (
              <li
                key={r.title}
                className={
                  "border-b border-[var(--rb-border-1)] px-4 py-3 last:border-b-0 " +
                  (r.selected ? "bg-[var(--rb-bg-selected)]" : "")
                }
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: r.dot }}
                  />
                  <span className="truncate text-[13px] font-medium text-fg-1">
                    {r.title}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] text-fg-3">{r.time}</span>
                </div>
                <p className="mt-1 truncate pl-3.5 text-[12px] text-fg-3">{r.snippet}</p>
                <div className="mt-1.5 flex items-center gap-2 pl-3.5">
                  <Stars rating={r.rating} />
                  <span className="rounded bg-[var(--rb-bg-sunken)] px-1.5 py-px text-[10px] font-medium text-fg-3">
                    {r.tag}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Detail pane */}
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <span className="rb-eyebrow text-fg-3">
              App Store · iOS · v4.2.1
            </span>
            {/* Dot + label, matching the queue rows on the left. A solid
                red-100 fill made this the loudest thing in the frame while
                saying no more than the dot does, and put the meaning in the
                colour rather than in the word. */}
            <span className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-2 py-0.5 text-[11px] font-medium text-fg-2">
              <span
                aria-hidden="true"
                className="size-1.5 rounded-full bg-[var(--rb-red-500)]"
              />
              Urgent
            </span>
          </div>

          <h3 className="mt-3 text-[15px] font-semibold text-fg-1">
            Crashes on iPad after 4.2.1
          </h3>
          <div className="mt-1">
            <Stars rating={1} />
          </div>
          <p className="mt-2 text-[13px] leading-relaxed text-fg-2">
            Every time I open the budgets tab on iPad it freezes for five to ten
            seconds. Started after the last update. I use this daily for my small
            business.
          </p>

          <div className="mt-5 rounded-lg border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-4">
            <span className="rb-eyebrow text-fg-3">
              Suggested reply · your voice
            </span>
            <TypedDraft />
            {/* Illustrative controls — spans, not buttons, so nothing here
                pretends to be operable */}
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex h-7 items-center rounded-md bg-[var(--rb-blue-500)] px-3 text-[12px] font-medium text-white">
                Post reply
              </span>
              <span className="inline-flex h-7 items-center rounded-md border border-[var(--rb-border-2)] bg-surface px-3 text-[12px] font-medium text-fg-2">
                Edit
              </span>
              <span className="ml-auto hidden text-[11px] text-fg-4 sm:block">
                Posts to App Store Connect
              </span>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}
