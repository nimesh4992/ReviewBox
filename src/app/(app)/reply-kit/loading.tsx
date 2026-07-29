export default function ReplyKitLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-8 max-w-[1240px] mx-auto animate-pulse">
      <div>
        <div className="h-3 w-20 rounded bg-[var(--rb-bg-sunken)]" />
        <div className="mt-2 h-7 w-32 rounded bg-[var(--rb-bg-sunken)]" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-[var(--rb-border-1)]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded bg-[var(--rb-bg-sunken)]" />
        ))}
      </div>

      {/* Content rows */}
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-[12px] border border-[var(--rb-border-1)] bg-surface p-5">
            <div className="h-4 w-40 rounded bg-[var(--rb-bg-sunken)]" />
            <div className="mt-2 h-3 w-full rounded bg-[var(--rb-bg-sunken)]" />
            <div className="mt-1.5 h-3 w-3/4 rounded bg-[var(--rb-bg-sunken)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
