"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Gauge } from "lucide-react";

import type { ReviewUsage } from "@/lib/plan-enforcement";

/**
 * The customer-facing half of the soft cap.
 *
 * ADR 009 Option B is "never stop ingesting; tell them and ask" — and the
 * telling is the part that was missing. The version this replaces did the
 * opposite: it stopped ingesting and told nobody.
 *
 * Two thresholds, and the first of them is a promise being kept rather than a
 * design choice. `/pricing` and `/faq` have both said *"We'll notify you when
 * you hit 80% of your quota"* while nothing in the codebase implemented any
 * such notice (backlog QT1). This is that notice.
 *
 *   ≥80%   approaching — quiet, informational, no alarm
 *   ≥100%  over — still syncing, still complete, upgrade to stay inside the plan
 *
 * **The over-limit copy has to work harder than it looks.** A customer who has
 * seen other tools cap them will assume "over your limit" means data is being
 * withheld, and will go looking for what they lost. It says plainly that
 * nothing has stopped.
 */
export function ReviewQuotaBanner() {
  const [usage, setUsage] = useState<ReviewUsage | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/usage");
      if (!res.ok) return; // AU5: a failed read must not become a usage claim
      const d = (await res.json()) as { reviews?: ReviewUsage };
      if (d.reviews && !d.reviews.unknown) setUsage(d.reviews);
    } catch {
      /* best-effort: this banner is an aside, never the reason a page fails */
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(sessionStorage.getItem("rb-quota-banner-dismissed") === "1");
  }, []);

  if (!usage || dismissed) return null;

  // `unknown` is filtered above, so a rendered banner always rests on a real
  // count. Below the notice threshold there is nothing worth the space.
  const NOTICE_AT = 80;
  if (usage.percentUsed < NOTICE_AT) return null;

  const over = usage.over;

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("rb-quota-banner-dismissed", "1");
    }
  }

  return (
    <div
      role="status"
      className={
        over
          ? "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[13px] dark:border-amber-900/40 dark:bg-amber-950/20"
          : "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-[var(--rb-border-1)] bg-surface px-4 py-2.5 text-[13px] shadow-[var(--rb-shadow-xs)]"
      }
    >
      <Gauge
        className={over ? "size-4 shrink-0 text-amber-600" : "size-4 shrink-0 text-[#0A84FF]"}
        strokeWidth={1.5}
      />
      <span className={over ? "text-amber-900 dark:text-amber-200" : "text-fg-2"}>
        <span className="font-semibold">
          {over
            ? "You're over your plan's monthly review volume"
            : `You've used ${usage.percentUsed}% of your monthly review volume`}
        </span>
        <span className="ml-1.5 text-fg-3">
          {usage.used.toLocaleString()} of {usage.limit.toLocaleString()} this month
          {over
            ? " — we're still syncing everything, nothing has been withheld."
            : "."}
        </span>
      </span>
      <Link
        href="/billing"
        className="ml-auto rounded-md bg-[#0A84FF] px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-[#006EE0]"
      >
        {over ? "Upgrade" : "See plans"}
      </Link>
      <button
        onClick={dismiss}
        className="text-fg-3 transition-colors hover:text-fg-1"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
