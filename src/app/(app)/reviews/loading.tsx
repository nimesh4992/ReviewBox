export default function ReviewsLoading() {
  return (
    <div className="min-w-0 animate-pulse">
      {/* Header */}
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="h-3 w-20 rounded bg-gray-100" />
        <div className="mt-2 h-6 w-32 rounded bg-gray-200" />
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-5 divide-x divide-gray-100 border-b border-gray-100 bg-white">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="px-5 py-4 space-y-2">
            <div className="h-3 w-16 rounded bg-gray-100" />
            <div className="h-6 w-10 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      <div className="flex gap-0">
        {/* Review cards */}
        <div className="flex-1 p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-4 w-28 rounded bg-gray-200" />
                <div className="h-4 w-16 rounded bg-gray-100" />
              </div>
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-5/6 rounded bg-gray-100" />
              <div className="h-3 w-4/6 rounded bg-gray-100" />
              <div className="flex gap-2">
                <div className="h-5 w-14 rounded-full bg-gray-100" />
                <div className="h-5 w-14 rounded-full bg-gray-100" />
              </div>
            </div>
          ))}
        </div>

        {/* Filter panel */}
        <div className="hidden lg:block w-56 border-l border-gray-100 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-20 rounded bg-gray-200" />
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-3/4 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
