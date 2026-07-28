export default function SettingsLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-8 max-w-[1024px] mx-auto animate-pulse">
      <div>
        <div className="h-3 w-20 rounded bg-[var(--rb-bg-sunken)]" />
        <div className="mt-2 h-7 w-32 rounded bg-[var(--rb-bg-sunken)]" />
      </div>

      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-[14px] border border-[var(--rb-border-1)] bg-surface p-6 space-y-4">
          <div>
            <div className="h-4 w-40 rounded bg-[var(--rb-bg-sunken)]" />
            <div className="mt-2 h-3 w-72 rounded bg-[var(--rb-bg-sunken)]" />
          </div>
          <div className="space-y-2">
            <div className="h-9 rounded bg-[var(--rb-bg-sunken)]" />
            <div className="h-9 rounded bg-[var(--rb-bg-sunken)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
