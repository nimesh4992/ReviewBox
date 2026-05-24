export default function SentimentLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-8 max-w-[1240px] mx-auto animate-pulse">
      {/* Header */}
      <div>
        <div className="h-3 w-24 rounded bg-gray-100" />
        <div className="mt-2 h-7 w-32 rounded bg-gray-200" />
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[12px] border border-[var(--rb-border-1)] bg-surface p-[18px]">
            <div className="h-3 w-20 rounded bg-gray-100" />
            <div className="mt-3 h-7 w-16 rounded bg-gray-200" />
            <div className="mt-2 h-2.5 w-24 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rounded-[14px] border border-[var(--rb-border-1)] bg-surface">
        <div className="border-b border-[var(--rb-border-1)] px-5 py-4">
          <div className="h-4 w-32 rounded bg-gray-200" />
        </div>
        <div className="p-5">
          <div className="h-[200px] rounded-lg bg-[var(--rb-bg-sunken)]" />
        </div>
      </div>

      {/* Topics table */}
      <div className="rounded-[14px] border border-[var(--rb-border-1)] bg-surface">
        <div className="border-b border-[var(--rb-border-1)] px-5 py-4">
          <div className="h-4 w-40 rounded bg-gray-200" />
        </div>
        <div className="px-5 py-3 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
