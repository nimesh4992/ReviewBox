"use client";

/**
 * Currency selector on /pricing. Cosmetic only — it cannot switch anything.
 *
 * `PLAN_PRICING` (src/lib/plans.ts) carries exactly one currency, USD, and a
 * mutation-tested contract (billing-interval-contract.test.ts) fails the
 * build if `/pricing`, the pricing cards, or /billing ever quote another one.
 * That guard exists because this page used to show "India: ₹2,999/month"
 * with no matching Stripe price object — a bill nobody could actually pay.
 * Founder decision, 2026-08-18: remove it rather than build real multi-
 * currency billing on the spot.
 *
 * This component is the deliberately narrow alternative: a real control that
 * gives currency a home in the layout, states plainly that USD is the only
 * one billed today, and names no specific currency it doesn't support yet —
 * so it can't repeat the mistake it sits next to. Wiring in a second currency
 * means a Stripe price object for it, currency selection at checkout, and a
 * rule for which currency an existing subscriber is billed in — not a new
 * item in this menu.
 */

import { Check, ChevronDown, Globe } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CurrencySelector() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Currency: US Dollar"
        className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rb-border-2)] bg-[var(--rb-bg-sunken)] px-3.5 py-1.5 text-[13px] font-semibold text-fg-1 outline-none transition-colors hover:bg-[var(--rb-bg-hover)]"
      >
        <Globe className="size-3.5 text-fg-3" strokeWidth={1.5} />
        USD
        <ChevronDown className="size-3.5 text-fg-3" strokeWidth={2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64">
        <DropdownMenuLabel className="text-[11px] font-semibold uppercase tracking-wide text-fg-3">
          Currency
        </DropdownMenuLabel>
        <DropdownMenuItem className="justify-between text-fg-1">
          US Dollar — $
          <Check className="size-3.5 text-[var(--rb-blue-500)]" strokeWidth={2.5} />
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2 py-1.5 text-xs leading-relaxed text-fg-3">
          Every plan is billed in USD today, everywhere. More currencies are
          on the roadmap — this is where you&apos;ll pick one once it ships.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
