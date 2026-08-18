"use client";

/**
 * Monthly / Yearly switch, shared by /pricing and /billing.
 *
 * Shared on purpose. The defect this work fixes was the two surfaces
 * disagreeing about price, and giving each its own toggle would leave exactly
 * the same seam — two controls that can drift apart in label, default, or in
 * what the saving is called.
 *
 * The caller decides whether to render it at all: neither page should offer an
 * interval that has no Stripe price behind it.
 */

import { cn } from "@/lib/utils";
import { BILLING_INTERVALS, type BillingInterval } from "@/lib/plans";

const LABELS: Record<BillingInterval, string> = {
  monthly: "Monthly",
  annual: "Yearly",
};

interface BillingIntervalToggleProps {
  value: BillingInterval;
  onChange: (next: BillingInterval) => void;
  /** e.g. 20 — renders a "Save 20%" hint beside the yearly option. */
  savingsPercent?: number | null;
  className?: string;
}

export function BillingIntervalToggle({
  value,
  onChange,
  savingsPercent = null,
  className,
}: BillingIntervalToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing interval"
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-[var(--rb-border-2)] bg-[var(--rb-bg-sunken)] p-1",
        className,
      )}
    >
      {BILLING_INTERVALS.map((option) => {
        const selected = option === value;
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option)}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors",
              selected
                ? "bg-surface text-fg-1 shadow-[var(--rb-shadow-xs)]"
                : "text-fg-3 hover:text-fg-2",
            )}
          >
            {LABELS[option]}
            {option === "annual" && savingsPercent !== null && savingsPercent > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                  selected
                    ? "bg-[#1F8A5B]/10 text-[#1F8A5B]"
                    : "bg-[var(--rb-bg-hover)] text-fg-3",
                )}
              >
                Save {savingsPercent}%
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
