import { AppReview } from "@/types/review";

export function ReviewStatsStrip({ reviews }: { reviews: AppReview[] }) {
  const total = reviews.length;
  const avgRating = total > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1)
    : "0.0";
  const replied = reviews.filter((r) => r.replyStatus === "replied").length;
  const replyRate = total > 0 ? Math.round((replied / total) * 100) : 0;
  const noReply = reviews.filter((r) => r.replyStatus === "needs_reply").length;
  const urgent = reviews.filter((r) => r.priority === "urgent").length;

  const replyRateColor =
    replyRate >= 70
      ? "text-emerald-600"
      : replyRate >= 50
      ? "text-amber-600"
      : "text-red-600";

  const tiles = [
    { label: "Reviews", value: String(total), className: "text-gray-900" },
    { label: "Avg rating", value: avgRating, className: "text-gray-900" },
    { label: "Reply rate", value: `${replyRate}%`, className: replyRateColor },
    {
      label: "No reply",
      value: String(noReply),
      className: noReply > 0 ? "text-amber-600" : "text-gray-900",
    },
    {
      label: "Urgent",
      value: String(urgent),
      className: urgent > 0 ? "text-red-600" : "text-gray-900",
    },
  ];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="grid grid-cols-5 divide-x divide-gray-100">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col px-5 py-3.5">
            <span className="text-[11px] text-gray-400">{tile.label}</span>
            <span className={`mt-0.5 text-xl font-bold ${tile.className}`}>{tile.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
