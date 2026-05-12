"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0d0f14] text-white">
        <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#5B5BD6] text-xl font-bold text-white shadow-lg shadow-[#5B5BD6]/30">
            R
          </div>

          <h1 className="mt-6 text-2xl font-bold text-white">
            Something went wrong
          </h1>
          <p className="mt-2 max-w-sm text-sm text-white/50">
            {error.message
              ? error.message
              : "An unexpected error occurred. Our team has been notified."}
          </p>
          {error.digest && (
            <p className="mt-1 font-mono text-xs text-white/25">
              Error ID: {error.digest}
            </p>
          )}

          <div className="mt-8 flex items-center gap-3">
            <button
              onClick={() => router.refresh()}
              className="rounded-lg bg-[#5B5BD6] px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              Refresh page
            </button>
            <button
              onClick={reset}
              className="rounded-lg border border-white/[0.12] px-5 py-2 text-sm font-semibold text-white/80 transition-colors hover:border-white/25 hover:text-white"
            >
              Try again
            </button>
          </div>

          <Link
            href="/dashboard"
            className="mt-4 text-sm text-white/40 underline-offset-4 transition-colors hover:text-white/70 hover:underline"
          >
            Back to Dashboard
          </Link>
        </div>
      </body>
    </html>
  );
}
