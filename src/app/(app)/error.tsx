"use client";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
          <svg
            className="h-5 w-5 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>

        <h2 className="mt-4 text-base font-semibold text-gray-900">
          Something went wrong
        </h2>
        <p className="mt-1.5 text-sm text-gray-500">
          {error.message
            ? error.message
            : "This section encountered an error. Your other work is unaffected."}
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-gray-400">
            Error ID: {error.digest}
          </p>
        )}

        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-[#5B5BD6] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
