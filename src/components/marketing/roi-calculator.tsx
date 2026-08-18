"use client";

import { useState } from "react";

const REVIEWBOX_PRICE = 49;

function appfollowEstimate(apps: number): number {
  // AppFollow: $149/mo base (1 app), ~$50 per additional app (rough mid-market estimate)
  return 149 + Math.max(0, apps - 1) * 50;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function RoiCalculator() {
  const [apps, setApps] = useState(3);
  const [reviews, setReviews] = useState(500);

  const afMonthly = appfollowEstimate(apps);
  const rbMonthly = REVIEWBOX_PRICE;
  const monthlySavings = afMonthly - rbMonthly;
  const annualSavings = monthlySavings * 12;

  return (
    <div className="rounded-2xl border border-[var(--rb-border-1)] bg-surface p-7 shadow-[var(--rb-shadow-xs)] sm:p-8">
      <h3 className="rb-h3 mb-1 text-fg-1">
        How much could you save?
      </h3>
      <p className="rb-body-sm mb-8 text-fg-2">
        Adjust the sliders to match your setup.
      </p>

      <div className="space-y-6">
        {/* Apps slider */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="rb-body-sm font-medium text-fg-2">
              Apps you manage
            </label>
            <span className="rb-body-sm font-semibold text-[var(--rb-blue-500)]">{apps}</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={apps}
            onChange={(e) => setApps(Number(e.target.value))}
            className="w-full accent-[var(--rb-blue-500)]"
          />
          <div className="rb-meta mt-1.5 flex justify-between font-normal text-fg-3">
            <span>1</span><span>20</span>
          </div>
        </div>

        {/* Reviews slider */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="rb-body-sm font-medium text-fg-2">
              Reviews per month
            </label>
            <span className="rb-body-sm font-semibold text-[var(--rb-blue-500)]">{reviews.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={50}
            max={5000}
            step={50}
            value={reviews}
            onChange={(e) => setReviews(Number(e.target.value))}
            className="w-full accent-[var(--rb-blue-500)]"
          />
          <div className="rb-meta mt-1.5 flex justify-between font-normal text-fg-3">
            <span>50</span><span>5,000</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-8 grid grid-cols-3 gap-4 text-center">
        <div className="rounded-xl bg-[var(--rb-bg-sunken)] p-4">
          <p className="rb-eyebrow mb-1.5 text-fg-3">AppFollow/mo</p>
          <p className="text-[22px] font-bold tracking-[-0.025em] text-fg-3">{fmt(afMonthly)}</p>
        </div>
        <div className="rounded-xl border border-[var(--rb-blue-500)]/30 bg-[var(--rb-blue-50)] p-4 dark:bg-[var(--rb-bg-accent-soft)]">
          <p className="rb-eyebrow mb-1.5 text-[var(--rb-blue-500)]">ReviewBox/mo</p>
          <p className="text-[22px] font-bold tracking-[-0.025em] text-[var(--rb-blue-500)]">{fmt(rbMonthly)}</p>
        </div>
        <div className="rounded-xl border border-[var(--rb-green-500)]/30 bg-[var(--rb-green-100)] p-4 dark:bg-[color-mix(in_oklab,var(--rb-green-500)_16%,transparent)]">
          <p className="rb-eyebrow mb-1.5 text-[var(--rb-green-600)]">You save/year</p>
          <p className="text-[22px] font-bold tracking-[-0.025em] text-[var(--rb-green-600)] dark:text-[var(--rb-green-100)]">{fmt(annualSavings)}</p>
        </div>
      </div>

      <p className="rb-meta mt-5 text-center font-normal text-fg-3">
        AppFollow estimate based on published pricing. ReviewBox flat {fmt(REVIEWBOX_PRICE)}/mo on Starter.
      </p>
    </div>
  );
}
