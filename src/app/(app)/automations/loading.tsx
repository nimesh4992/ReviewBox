export default function AutomationsLoading() {
  return (
    <div className="min-w-0 animate-pulse">
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="h-3 w-20 rounded bg-gray-100" />
        <div className="mt-2 h-6 w-44 rounded bg-gray-200" />
      </div>
      <div className="p-6 space-y-3">
        {/* Tab bar */}
        <div className="flex gap-4 border-b border-gray-100 pb-3">
          <div className="h-4 w-20 rounded bg-gray-200" />
          <div className="h-4 w-16 rounded bg-gray-100" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-gray-100 bg-white p-5">
            <div className="flex justify-between items-center">
              <div className="space-y-2 flex-1">
                <div className="h-4 w-48 rounded bg-gray-200" />
                <div className="h-3 w-64 rounded bg-gray-100" />
              </div>
              <div className="h-6 w-10 rounded-full bg-gray-200 ml-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
