"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-amber-50">
        <AlertTriangle className="size-7 text-amber-500" strokeWidth={1.5} />
      </div>
      <h1 className="text-[20px] font-semibold text-[var(--rb-fg-1)]">Something went wrong</h1>
      <p className="max-w-sm text-[14px] text-[var(--rb-fg-3)]">
        An unexpected error happened on this page. We&apos;ve been notified and will look into it.
      </p>
      {error.digest && (
        <p className="font-mono text-[11px] text-[var(--rb-fg-4)]">Ref: {error.digest}</p>
      )}
      <div className="mt-2 flex items-center gap-3">
        <button
          onClick={reset}
          className="rounded-[10px] bg-[#0A84FF] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#006EE0]"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="text-[13px] font-medium text-[var(--rb-fg-3)] underline-offset-2 hover:text-[var(--rb-fg-1)] hover:underline"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
