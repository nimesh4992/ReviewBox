export default function ReportsLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-8 max-w-[1240px] mx-auto animate-pulse">
      <div>
        <div className="h-3 w-20 rounded bg-gray-100" />
        <div className="mt-2 h-7 w-28 rounded bg-gray-200" />
      </div>

      {/* Report cards */}
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-[14px] border border-[var(--rb-border-1)] bg-surface p-5 space-y-3">
            <div className="flex items-start gap-3">
              <div className="size-9 rounded-[10px] bg-gray-100" />
              <div className="flex-1">
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="mt-2 h-3 w-full rounded bg-gray-100" />
                <div className="mt-1.5 h-3 w-3/4 rounded bg-gray-100" />
              </div>
            </div>
            <div className="h-12 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      {/* CSV export card */}
      <div className="rounded-[14px] border border-[var(--rb-border-1)] bg-surface p-5">
        <div className="h-4 w-32 rounded bg-gray-200" />
        <div className="mt-2 h-3 w-72 rounded bg-gray-100" />
        <div className="mt-4 h-7 w-64 rounded bg-gray-100" />
      </div>
    </div>
  );
}
