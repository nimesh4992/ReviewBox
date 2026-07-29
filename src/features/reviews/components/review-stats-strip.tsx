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
      ? "text-[var(--rb-green-500)]"
      : replyRate >= 50
      ? "text-amber-600"
      : "text-red-600";

  const tiles = [
    { label: "Reviews", value: String(total), className: "text-fg-1" },
    { label: "Avg rating", value: avgRating, className: "text-fg-1" },
    { label: "Reply rate", value: `${replyRate}%`, className: replyRateColor },
    {
      label: "No reply",
      value: String(noReply),
      className: noReply > 0 ? "text-amber-600" : "text-fg-1",
    },
    {
      label: "Urgent",
      value: String(urgent),
      className: urgent > 0 ? "text-red-600" : "text-fg-1",
    },
  ];

  return (
    <div className="rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-sm">
      <div className="grid grid-cols-5 divide-x divide-[var(--rb-border-1)]">
        {tiles.map((tile) => (
          <div key={tile.label} className="flex flex-col px-5 py-3.5">
            <span className="text-[11px] text-fg-3">{tile.label}</span>
            <span className={`mt-0.5 text-xl font-bold ${tile.className}`}>{tile.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
