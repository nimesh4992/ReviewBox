"use client";

import Link from "next/link";
import { ArrowRight, Star, TrendingDown, TrendingUp } from "lucide-react";

import { sparklinePoints } from "@/lib/sparkline";
import { PlatformHealth, ReviewSource } from "@/types/review";

const PLATFORM_CONFIG: Record<ReviewSource, { dot: string; sparkColor: string; href: string; iconBg: string }> = {
  "Google Play": { dot: "bg-emerald-500", sparkColor: "#10b981", href: "/reviews", iconBg: "bg-white border-gray-100" },
  "App Store":   { dot: "bg-blue-500",    sparkColor: "#0D96F6", href: "/reviews", iconBg: "bg-white border-gray-100" },
};

const STAR_COLORS = [
  "bg-red-400",    // 1★
  "bg-orange-400", // 2★
  "bg-amber-400",  // 3★
  "bg-lime-400",   // 4★
  "bg-emerald-500",// 5★
];

function GooglePlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      {/* Triangle left — teal */}
      <path d="M3.18 23.76a2.4 2.4 0 0 1-1.18-2.1V2.34A2.4 2.4 0 0 1 3.18.24l.1-.06 12.02 11.76-.1.1L3.18 23.76z" fill="#00C4FF" />
      {/* Top triangle — green */}
      <path d="M4.42 1.3l10.06 9.84-2.82 2.76L4.42 1.3z" fill="#5FE080" />
      {/* Bottom triangle — yellow */}
      <path d="M4.42 22.7l7.24-12.6 2.82 2.76L4.42 22.7z" fill="#FFDA00" />
      {/* Right arrow — red */}
      <path d="M18.6 14.98l-2.82-1.64-2.6 2.54 2.6 2.54 2.84-1.64a1.4 1.4 0 0 0 0-2.4z" fill="#FF3D00" />
    </svg>
  );
}

function AppStoreIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98l-.09.06c-.22.14-2.19 1.28-2.17 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.36 2.77M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"
        fill="#0D96F6"
      />
    </svg>
  );
}

function PlatformIcon({ platform }: { platform: ReviewSource }) {
  return platform === "Google Play" ? <GooglePlayIcon /> : <AppStoreIcon />;
}

function StarRatingDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`size-3.5 ${
            s <= Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "fill-gray-100 text-gray-100"
          }`}
        />
      ))}
    </div>
  );
}

function RatingDistribution({
  distribution,
}: {
  distribution: [number, number, number, number, number];
}) {
  return (
    <div className="space-y-1.5">
      {[...distribution].reverse().map((pct, i) => {
        const star = 5 - i;
        const colorIndex = star - 1;
        return (
          <div key={star} className="flex items-center gap-2">
            <span className="w-3 text-right text-[10px] tabular-nums text-gray-400">{star}</span>
            <div className="flex-1 overflow-hidden rounded-full bg-gray-100" style={{ height: 5 }}>
              <div
                className={`h-full rounded-full ${STAR_COLORS[colorIndex]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-right text-[10px] tabular-nums text-gray-400">{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}

function PlatformCard({ data }: { data: PlatformHealth }) {
  const cfg = PLATFORM_CONFIG[data.platform];
  const W = 200;
  const H = 32;

  return (
    <div className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow duration-150">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className={`flex size-8 items-center justify-center rounded-lg border ${cfg.iconBg}`}>
            <PlatformIcon platform={data.platform} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className={`size-1.5 rounded-full ${cfg.dot}`} />
              <span className="text-[13px] font-semibold text-gray-900">{data.platform}</span>
            </div>
            <p className="text-[11px] text-gray-400">
              {data.totalRatings.toLocaleString()} ratings
            </p>
          </div>
        </div>

        <Link
          href={cfg.href}
          className="flex items-center gap-1 text-[11px] font-medium text-gray-400 transition-colors duration-150 hover:text-gray-700"
        >
          View reviews
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {/* Body */}
      <div className="grid grid-cols-[1fr_auto] gap-5 p-5">
        {/* Left — rating + distribution */}
        <div>
          {/* Big rating */}
          <div className="mb-3 flex items-end gap-2">
            <span className="text-4xl font-bold tracking-tight text-gray-900">
              {data.rating.toFixed(1)}
            </span>
            <div className="mb-1 flex flex-col gap-1">
              <StarRatingDisplay rating={data.rating} />
              <div
                className={`flex items-center gap-0.5 text-[11px] font-medium ${
                  data.ratingDelta7d >= 0 ? "text-emerald-600" : "text-red-500"
                }`}
              >
                {data.ratingDelta7d >= 0 ? (
                  <TrendingUp className="size-3" />
                ) : (
                  <TrendingDown className="size-3" />
                )}
                {data.ratingDelta7d >= 0 ? "+" : ""}
                {data.ratingDelta7d.toFixed(1)} this week
              </div>
            </div>
          </div>

          {/* Distribution bars */}
          <RatingDistribution distribution={data.ratingDistribution} />
        </div>

        {/* Right — stats */}
        <div className="flex flex-col justify-between gap-4 border-l border-gray-100 pl-5">
          <div>
            <div className="text-[11px] text-gray-400">Reviews today</div>
            <div className="mt-0.5 text-xl font-bold text-gray-900">{data.reviewsToday}</div>
          </div>
          <div>
            <div className="text-[11px] text-gray-400">Pending replies</div>
            <div
              className={`mt-0.5 text-xl font-bold ${
                data.pendingReplies > 20 ? "text-amber-600" : "text-gray-900"
              }`}
            >
              {data.pendingReplies}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-gray-400">Response rate</div>
            <div
              className={`mt-0.5 text-xl font-bold ${
                data.responseRate < 80 ? "text-amber-600" : "text-gray-900"
              }`}
            >
              {data.responseRate}%
            </div>
          </div>
        </div>
      </div>

      {/* Sparkline footer */}
      <div className="border-t border-gray-100 px-5 pb-4 pt-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] text-gray-400">7-day rating trend</span>
          <span className="text-[11px] text-gray-400">
            {data.sparkline[0].toFixed(1)} → {data.sparkline[data.sparkline.length - 1].toFixed(1)}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          preserveAspectRatio="none"
          style={{ height: H }}
        >
          <polyline
            points={sparklinePoints(data.sparkline, W, H, 2)}
            fill="none"
            stroke={cfg.sparkColor}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.6"
          />
        </svg>
      </div>
    </div>
  );
}

export function PlatformHealthSection({ data }: { data: PlatformHealth[] }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900">Connected apps</h2>
        <span className="text-xs text-gray-400">Synced just now</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {data.map((d) => (
          <PlatformCard key={d.platform} data={d} />
        ))}
      </div>
    </div>
  );
}
