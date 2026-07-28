export default function AsoLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-8 max-w-[1240px] mx-auto animate-pulse">
      <div>
        <div className="h-3 w-20 rounded bg-[var(--rb-bg-sunken)]" />
        <div className="mt-2 h-7 w-24 rounded bg-[var(--rb-bg-sunken)]" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-[12px] border border-[var(--rb-border-1)] bg-surface p-[18px]">
            <div className="h-3 w-20 rounded bg-[var(--rb-bg-sunken)]" />
            <div className="mt-3 h-7 w-12 rounded bg-[var(--rb-bg-sunken)]" />
          </div>
        ))}
      </div>

      <div className="rounded-[14px] border border-[var(--rb-border-1)] bg-surface">
        <div className="border-b border-[var(--rb-border-1)] px-5 py-4">
          <div className="h-4 w-32 rounded bg-[var(--rb-bg-sunken)]" />
        </div>
        <div className="divide-y divide-[var(--rb-border-1)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-5 py-3 flex items-center gap-4">
              <div className="h-4 w-32 rounded bg-[var(--rb-bg-sunken)]" />
              <div className="ml-auto h-4 w-12 rounded bg-[var(--rb-bg-sunken)]" />
              <div className="h-4 w-16 rounded bg-[var(--rb-bg-sunken)]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
