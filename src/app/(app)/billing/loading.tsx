export default function BillingLoading() {
  return (
    <div className="flex w-full flex-col gap-6 p-8 max-w-[1024px] mx-auto animate-pulse">
      <div>
        <div className="h-3 w-20 rounded bg-gray-100" />
        <div className="mt-2 h-7 w-24 rounded bg-gray-200" />
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-[14px] border border-[var(--rb-border-1)] bg-surface p-6 space-y-4">
            <div className="h-5 w-24 rounded bg-gray-200" />
            <div className="h-9 w-32 rounded bg-gray-200" />
            <div className="space-y-2 pt-2">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-3 w-full rounded bg-gray-100" />
              ))}
            </div>
            <div className="h-9 rounded bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
