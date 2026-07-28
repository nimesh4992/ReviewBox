export default function ReviewsLoading() {
  return (
    <div className="min-w-0 animate-pulse">
      {/* Header */}
      <div className="border-b border-[var(--rb-border-1)] px-6 py-5">
        <div className="h-3 w-20 rounded bg-[var(--rb-bg-sunken)]" />
        <div className="mt-2 h-6 w-32 rounded bg-[var(--rb-bg-sunken)]" />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-5 divide-x divide-[var(--rb-border-1)] border-b border-[var(--rb-border-1)] bg-surface">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-5 py-4 space-y-2">
            <div className="h-3 w-16 rounded bg-[var(--rb-bg-sunken)]" />
            <div className="h-6 w-10 rounded bg-[var(--rb-bg-sunken)]" />
          </div>
        ))}
      </div>

      <div className="flex gap-0">
        {/* Review cards */}
        <div className="flex-1 p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--rb-border-1)] bg-surface p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 rounded bg-[var(--rb-bg-sunken)]" />
                <div className="h-4 w-16 rounded bg-[var(--rb-bg-sunken)]" />
              </div>
              <div className="h-3 w-full rounded bg-[var(--rb-bg-sunken)]" />
              <div className="h-3 w-5/6 rounded bg-[var(--rb-bg-sunken)]" />
              <div className="h-3 w-4/6 rounded bg-[var(--rb-bg-sunken)]" />
              <div className="flex gap-2">
                <div className="h-5 w-14 rounded-full bg-[var(--rb-bg-sunken)]" />
                <div className="h-5 w-14 rounded-full bg-[var(--rb-bg-sunken)]" />
              </div>
            </div>
          ))}
        </div>

        {/* Filter panel */}
        <div className="hidden lg:block w-56 border-l border-[var(--rb-border-1)] p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-[var(--rb-bg-sunken)]" />
              <div className="h-3 w-full rounded bg-[var(--rb-bg-sunken)]" />
              <div className="h-3 w-3/4 rounded bg-[var(--rb-bg-sunken)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
