"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
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
    <html>
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F5F5F7] p-8 text-center font-sans">
        <div className="text-[48px]">âš ï¸</div>
        <h1 className="text-[22px] font-semibold text-[#1D1D1F]">Something went wrong</h1>
        <p className="max-w-sm text-[15px] text-[#86868B]">
          An unexpected error occurred. Our team has been notified automatically.
        </p>
        <button
          onClick={reset}
          className="mt-2 rounded-[10px] bg-[#0A84FF] px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-[#006EE0]"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
