export default function DashboardLoading() {
  return (
    <div className="min-w-0 animate-pulse">
      {/* Page header skeleton */}
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="h-3 w-20 rounded bg-gray-100" />
        <div className="mt-2 h-6 w-40 rounded bg-gray-200" />
      </div>

      <div className="p-6 space-y-6">
        {/* Metrics row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5">
              <div className="h-3 w-24 rounded bg-gray-100" />
              <div className="mt-3 h-7 w-16 rounded bg-gray-200" />
              <div className="mt-2 h-2 w-20 rounded bg-gray-100" />
            </div>
          ))}
        </div>

        {/* Platform health row */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5 space-y-3">
              <div className="h-4 w-32 rounded bg-gray-200" />
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-3/4 rounded bg-gray-100" />
              <div className="h-16 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
