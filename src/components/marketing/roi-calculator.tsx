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
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161618] p-8">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-[#F5F5F7] mb-1">
        How much could you save?
      </h3>
      <p className="text-sm text-gray-500 dark:text-[#86868B] mb-8">
        Adjust the sliders to match your setup.
      </p>

      <div className="space-y-6">
        {/* Apps slider */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-[#C7C7CC]">
              Apps you manage
            </label>
            <span className="text-sm font-semibold text-[#0A84FF]">{apps}</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            value={apps}
            onChange={(e) => setApps(Number(e.target.value))}
            className="w-full accent-[#0A84FF]"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>1</span><span>20</span>
          </div>
        </div>

        {/* Reviews slider */}
        <div>
          <div className="flex justify-between mb-2">
            <label className="text-sm font-medium text-gray-700 dark:text-[#C7C7CC]">
              Reviews per month
            </label>
            <span className="text-sm font-semibold text-[#0A84FF]">{reviews.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={50}
            max={5000}
            step={50}
            value={reviews}
            onChange={(e) => setReviews(Number(e.target.value))}
            className="w-full accent-[#0A84FF]"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>50</span><span>5,000</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="mt-8 grid grid-cols-3 gap-4 text-center">
        <div className="rounded-xl bg-gray-50 dark:bg-[#0E0E11] p-4">
          <p className="text-xs text-gray-400 mb-1">AppFollow/mo</p>
          <p className="text-xl font-bold text-gray-500">{fmt(afMonthly)}</p>
        </div>
        <div className="rounded-xl bg-blue-50 dark:bg-[#0A84FF]/10 p-4 border border-[#0A84FF]/20">
          <p className="text-xs text-[#0A84FF] mb-1">ReviewBox/mo</p>
          <p className="text-xl font-bold text-[#0A84FF]">{fmt(rbMonthly)}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 p-4 border border-emerald-200 dark:border-emerald-800">
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">You save/year</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{fmt(annualSavings)}</p>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400">
        AppFollow estimate based on published pricing. ReviewBox flat {fmt(REVIEWBOX_PRICE)}/mo, unlimited apps.
      </p>
    </div>
  );
}
