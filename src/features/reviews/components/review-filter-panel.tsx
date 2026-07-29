// DEFAULT_FILTERS in page.tsx must also include: sentiment: [], countries: [], tags: [], versions: []
"use client";

import { Star } from "lucide-react";

export interface ReviewFilters {
  period: "7d" | "30d" | "90d" | "custom";
  stars: number[];
  replyStatus: string[];
  platforms: string[];
  sentiment: string[];
  countries: string[];
  tags: string[];
  versions: string[];
}

const PERIOD_OPTIONS: { label: string; value: ReviewFilters["period"] }[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "Custom", value: "custom" },
];

const REPLY_STATUS_OPTIONS: { label: string; value: string }[] = [
  { label: "Needs reply", value: "needs_reply" },
  { label: "Draft ready", value: "draft_ready" },
  { label: "Replied", value: "replied" },
  { label: "Waiting", value: "waiting" },
];

const PLATFORM_OPTIONS: { label: string; value: string }[] = [
  { label: "Google Play", value: "Google Play" },
  { label: "App Store", value: "App Store" },
];

const SENTIMENT_OPTIONS = [
  { label: "Critical",  value: "critical" },
  { label: "Negative",  value: "negative" },
  { label: "Mixed",     value: "mixed" },
  { label: "Positive",  value: "positive" },
];

const COUNTRY_OPTIONS = [
  { label: "United States",  value: "US" },
  { label: "Germany",        value: "DE" },
  { label: "United Kingdom", value: "GB" },
  { label: "India",          value: "IN" },
  { label: "France",         value: "FR" },
  { label: "Brazil",         value: "BR" },
  { label: "Japan",          value: "JP" },
];

const TAG_OPTIONS = [
  { label: "Crash",              value: "crash" },
  { label: "Billing",            value: "billing" },
  { label: "Login",              value: "login" },
  { label: "Performance",        value: "performance" },
  { label: "Release regression", value: "release-regression" },
  { label: "Feature request",    value: "feature-request" },
  { label: "Support delay",      value: "support-delay" },
  { label: "Localization",       value: "localization" },
];

const VERSION_OPTIONS = [
  { label: "5.42.0", value: "5.42.0" },
  { label: "5.41.2", value: "5.41.2" },
  { label: "3.9.1",  value: "3.9.1" },
];

function toggleArrayItem(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

function toggleNumberItem(arr: number[], item: number): number[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

export function ReviewFilterPanel({
  filters,
  onChange,
}: {
  filters: ReviewFilters;
  onChange: (filters: ReviewFilters) => void;
}) {
  return (
    <div className="w-56 rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-sm p-4">
      <div className="space-y-5">
        {/* Period */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-3 mb-2">
            Period
          </p>
          <div className="flex flex-wrap gap-1.5">
            {PERIOD_OPTIONS.map(({ label, value }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ ...filters, period: value })}
                className={
                  filters.period === value
                    ? "rounded-full px-2.5 py-1 text-xs font-medium bg-[var(--rb-fg-1)] text-[var(--rb-bg-surface)] transition-colors duration-150"
                    : "rounded-full px-2.5 py-1 text-xs font-medium bg-[var(--rb-bg-sunken)] text-fg-3 hover:bg-[var(--rb-bg-sunken)] transition-colors duration-150"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Review rating */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-3 mb-2">
            Review rating
          </p>
          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((star) => (
              <label
                key={star}
                className="flex items-center gap-2 text-sm text-fg-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="accent-gray-900"
                  checked={filters.stars.includes(star)}
                  onChange={() =>
                    onChange({
                      ...filters,
                      stars: toggleNumberItem(filters.stars, star),
                    })
                  }
                />
                <span className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      size={12}
                      className={
                        i < star
                          ? "fill-amber-400 text-amber-400"
                          : "fill-[var(--rb-border-3)] text-[var(--rb-border-3)]"
                      }
                    />
                  ))}
                </span>
                <span>
                  {star} {star === 1 ? "star" : "stars"}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Reply status */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-3 mb-2">
            Reply status
          </p>
          <div className="space-y-1.5">
            {REPLY_STATUS_OPTIONS.map(({ label, value }) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-fg-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="accent-gray-900"
                  checked={filters.replyStatus.includes(value)}
                  onChange={() =>
                    onChange({
                      ...filters,
                      replyStatus: toggleArrayItem(filters.replyStatus, value),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Platform */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-3 mb-2">
            Platform
          </p>
          <div className="space-y-1.5">
            {PLATFORM_OPTIONS.map(({ label, value }) => (
              <label
                key={value}
                className="flex items-center gap-2 text-sm text-fg-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="accent-gray-900"
                  checked={filters.platforms.includes(value)}
                  onChange={() =>
                    onChange({
                      ...filters,
                      platforms: toggleArrayItem(filters.platforms, value),
                    })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Sentiment */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-3 mb-2">
            Sentiment
          </p>
          <div className="space-y-1.5">
            {SENTIMENT_OPTIONS.map(({ label, value }) => (
              <label key={value} className="flex items-center gap-2 text-sm text-fg-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-gray-900"
                  checked={filters.sentiment.includes(value)}
                  onChange={() => onChange({ ...filters, sentiment: toggleArrayItem(filters.sentiment, value) })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-3 mb-2">
            Tags
          </p>
          <div className="space-y-1.5">
            {TAG_OPTIONS.map(({ label, value }) => (
              <label key={value} className="flex items-center gap-2 text-sm text-fg-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-gray-900"
                  checked={filters.tags.includes(value)}
                  onChange={() => onChange({ ...filters, tags: toggleArrayItem(filters.tags, value) })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Version */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-3 mb-2">
            Version
          </p>
          <div className="space-y-1.5">
            {VERSION_OPTIONS.map(({ label, value }) => (
              <label key={value} className="flex items-center gap-2 text-sm text-fg-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-gray-900"
                  checked={filters.versions.includes(value)}
                  onChange={() => onChange({ ...filters, versions: toggleArrayItem(filters.versions, value) })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Country */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-3 mb-2">
            Country
          </p>
          <div className="space-y-1.5">
            {COUNTRY_OPTIONS.map(({ label, value }) => (
              <label key={value} className="flex items-center gap-2 text-sm text-fg-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-gray-900"
                  checked={filters.countries.includes(value)}
                  onChange={() => onChange({ ...filters, countries: toggleArrayItem(filters.countries, value) })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
