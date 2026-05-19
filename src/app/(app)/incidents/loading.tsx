export default function IncidentsLoading() {
  return (
    <div className="min-w-0 animate-pulse">
      <div className="border-b border-gray-100 px-6 py-5">
        <div className="h-3 w-20 rounded bg-gray-100" />
        <div className="mt-2 h-6 w-36 rounded bg-gray-200" />
      </div>
      <div className="p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
            <div className="h-1 w-full bg-gray-200" />
            <div className="p-5 space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-48 rounded bg-gray-200" />
                <div className="h-4 w-16 rounded bg-gray-100" />
              </div>
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="h-3 w-2/3 rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
