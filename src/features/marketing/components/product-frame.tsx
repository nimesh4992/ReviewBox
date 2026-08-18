"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowUpDown,
  CheckCircle2,
  Search,
  TrendingUp,
} from "lucide-react";

import { Stars } from "@/features/marketing/components/primitives";

/**
 * The product as the hero image: a hand-built rendering of the review inbox,
 * with the reply draft typing itself in.
 *
 * Two rules govern this file.
 *
 * 1. It must stay faithful to the inbox the customer actually gets.
 *    The previous version showed a narrow 340px list on the left and a wide
 *    detail pane on the right, with no search field, no filter chips and no
 *    sort control. The real queue
 *    (src/features/reviews/components/review-queue.tsx) is the other way
 *    round — the list is the flexible, wide pane and the detail is a fixed
 *    420px column beside it — and it leads with a search box and a row of
 *    filter chips. A visitor who signed up off the old mock met a different
 *    screen. The layout below matches the real one.
 *
 * 2. Nothing here may be hidden or overlapped at any width.
 *    The three signal cards (rating trend, spike alert, reply posted) used to
 *    float in the page gutter at `2xl:block` — which meant they were invisible
 *    on every laptop below 1536px, and at 1920px they overlapped the frame and
 *    covered the "Urgent" badge they were sitting next to. They are now part
 *    of the composition: a squared three-up row directly under the window, so
 *    they render identically from 390px to 2560px. The review list is likewise
 *    no longer `hidden md:block` — the "one inbox" story survives on a phone.
 *
 * The reviews are fictional and presented as product UI, the same "show, don't
 * claim" rule as the rest of the site — no invented customers, no invented
 * numbers.
 */

const DRAFT =
  "Thanks for flagging the iPad freeze on 4.2.1. We reproduced it this morning and a fix is rolling out this week. In the meantime, force-quitting and reopening restores the session. I'll follow up here the moment 4.2.2 lands.";

const LIST = [
  {
    title: "Crashes on iPad after 4.2.1",
    snippet: "Every time I open the budgets tab on iPad it freezes…",
    rating: 1,
    tag: "crash",
    store: "App Store",
    dot: "var(--rb-red-500)",
    time: "2m",
    selected: true,
  },
  {
    title: "Charged twice for annual plan",
    snippet: "Upgraded last week and my card shows two charges…",
    rating: 2,
    tag: "billing",
    store: "Google Play",
    dot: "var(--rb-amber-500)",
    time: "26m",
    selected: false,
  },
  {
    title: "Great app, but needs dark mode",
    snippet: "Been using it for three months. One request…",
    rating: 4,
    tag: "feature-request",
    store: "App Store",
    dot: "var(--rb-green-500)",
    time: "1h",
    selected: false,
  },
  {
    title: "Replaced our review spreadsheet",
    snippet: "Support finally sees the same queue we do…",
    rating: 5,
    tag: "support",
    store: "Google Play",
    dot: "var(--rb-green-500)",
    time: "3h",
    selected: false,
  },
];

/** The filter chips the real queue opens with. */
const CHIPS = ["Needs reply", "Urgent", "Crashes", "Billing", "All"];

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
    <p className="mt-2 min-h-[7.5rem] text-[13px] leading-relaxed text-fg-1 sm:min-h-[6.5rem]">
      {typed}
      {typed.length < DRAFT.length && (
        <span className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.15em] bg-[var(--rb-blue-500)] align-baseline" />
      )}
    </p>
  );
}

/**
 * The three signal cards. Equal-width, equal-height, square-ish tiles that sit
 * under the window as one row — not floating overlays. Each carries its status
 * in an icon and a label, never in colour alone.
 */
const SIGNALS = [
  {
    icon: TrendingUp,
    iconClass: "text-[var(--rb-blue-500)]",
    iconBg: "bg-[var(--rb-blue-50)] dark:bg-[var(--rb-bg-accent-soft)]",
    label: "Avg rating · 30 days",
    value: "4.6",
    delta: "+0.3",
    body: "Tracked per app and per release, not just overall.",
  },
  {
    icon: AlertTriangle,
    iconClass: "text-[var(--rb-red-600)]",
    iconBg: "bg-[var(--rb-red-100)]",
    label: "Rating spike detected",
    value: "6",
    delta: "one-star · 24h",
    body: "Six one-star reviews landed on v4.2.1. Alert emailed.",
  },
  {
    icon: CheckCircle2,
    iconClass: "text-[var(--rb-green-600)]",
    iconBg: "bg-[var(--rb-green-100)]",
    label: "Reply posted",
    value: "1 click",
    delta: "App Store",
    body: "Sent through App Store Connect. No tab-switching.",
  },
] as const;

function SignalRow() {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-3">
      {SIGNALS.map((s) => (
        <div
          key={s.label}
          className="flex flex-col rounded-2xl border border-[var(--rb-border-1)] bg-surface p-5 shadow-[var(--rb-shadow-xs)]"
        >
          <span
            className={`flex size-9 items-center justify-center rounded-xl ${s.iconBg}`}
          >
            <s.icon className={`size-4.5 ${s.iconClass}`} strokeWidth={2} />
          </span>
          <p className="rb-eyebrow mt-4 text-fg-3">{s.label}</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-[26px] font-bold tracking-[-0.03em] text-fg-1">
              {s.value}
            </span>
            <span className="rb-meta text-fg-3">{s.delta}</span>
          </div>
          <p className="rb-body-sm mt-2 text-fg-2">{s.body}</p>
        </div>
      ))}
    </div>
  );
}

export function ProductFrame({ id }: { id?: string }) {
  return (
    <figure
      id={id}
      aria-label="The ReviewBox inbox: a searchable, filtered queue of App Store and Google Play reviews, with a reply drafted for the selected one"
      className="scroll-mt-24"
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--rb-border-2)] bg-surface shadow-[var(--rb-shadow-lg)]">
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

        {/* List is the wide pane, detail is the fixed column — as in the app. */}
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* ── Queue ── */}
          <div className="min-w-0 border-b border-[var(--rb-border-1)] lg:border-r lg:border-b-0">
            <div className="border-b border-[var(--rb-border-1)] px-4 py-3.5 sm:px-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-fg-1">
                    Inbox
                  </p>
                  <p className="mt-0.5 text-[12px] text-fg-3">
                    <span className="font-medium text-fg-2">23</span> need a reply ·
                    2 apps
                  </p>
                </div>
                <span className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--rb-border-2)] bg-surface px-2.5 text-[11px] font-medium text-fg-2">
                  <ArrowUpDown className="size-3" strokeWidth={2} />
                  Priority
                </span>
              </div>

              {/* Search — the real queue's first control, absent from the old mock */}
              <div className="relative mt-3">
                <Search
                  className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-fg-3"
                  strokeWidth={1.75}
                />
                <div className="flex h-8 items-center rounded-lg border border-[var(--rb-border-2)] bg-[var(--rb-bg-sunken)] pl-8 text-[12px] text-fg-3">
                  Search reviews…
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {CHIPS.map((c, i) => (
                  <span
                    key={c}
                    className={
                      i === 0
                        ? "rounded-full bg-[var(--rb-blue-500)] px-2.5 py-1 text-[11px] font-medium text-white"
                        : "rounded-full border border-[var(--rb-border-2)] bg-surface px-2.5 py-1 text-[11px] font-medium text-fg-2"
                    }
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            <ul>
              {LIST.map((r) => (
                <li
                  key={r.title}
                  className={
                    "border-b border-[var(--rb-border-1)] px-4 py-3.5 last:border-b-0 sm:px-5 " +
                    (r.selected ? "bg-[var(--rb-bg-selected)]" : "")
                  }
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: r.dot }}
                    />
                    <span className="truncate text-[13px] font-semibold text-fg-1">
                      {r.title}
                    </span>
                    <span className="ml-auto shrink-0 text-[11px] text-fg-4">
                      {r.time}
                    </span>
                  </div>
                  <p className="mt-1 truncate pl-3.5 text-[12px] text-fg-3">
                    {r.snippet}
                  </p>
                  <div className="mt-2 flex items-center gap-2 pl-3.5">
                    <Stars rating={r.rating} size={12} />
                    <span className="rounded bg-[var(--rb-bg-sunken)] px-1.5 py-px text-[10px] font-medium text-fg-3">
                      {r.tag}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] font-medium text-fg-4">
                      {r.store}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Detail ── */}
          <div className="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <span className="rb-eyebrow text-fg-3">App Store · iOS · v4.2.1</span>
              <span className="rounded-full bg-[var(--rb-red-100)] px-2 py-0.5 text-[11px] font-medium text-[var(--rb-red-600)]">
                Urgent
              </span>
            </div>

            <h3 className="mt-3 text-[16px] font-semibold tracking-[-0.015em] text-fg-1">
              Crashes on iPad after 4.2.1
            </h3>
            <div className="mt-1.5">
              <Stars rating={1} />
            </div>
            <p className="mt-2.5 text-[13px] leading-relaxed text-fg-2">
              Every time I open the budgets tab on iPad it freezes for five to ten
              seconds. Started after the last update. I use this daily for my small
              business.
            </p>

            <div className="mt-5 rounded-xl border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] p-4">
              <span className="rb-eyebrow text-fg-3">Suggested reply · your voice</span>
              <TypedDraft />
              {/* Illustrative controls — spans, not buttons, so nothing here
                  pretends to be operable */}
              <div className="mt-3 flex items-center gap-2">
                <span className="inline-flex h-8 items-center rounded-lg bg-[var(--rb-blue-500)] px-3.5 text-[12px] font-semibold text-white">
                  Post reply
                </span>
                <span className="inline-flex h-8 items-center rounded-lg border border-[var(--rb-border-2)] bg-surface px-3.5 text-[12px] font-semibold text-fg-2">
                  Edit
                </span>
              </div>
            </div>

            <p className="mt-3 text-[11px] text-fg-3">
              Posts through App Store Connect · nothing sends without your click
            </p>
          </div>
        </div>
      </div>

      <SignalRow />
    </figure>
  );
}
