"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

import { TooltipProvider } from "@/components/ui/tooltip";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            // Keep inactive cache entries for 30 min (default is 5 min).
            // Without this, navigating away and returning after >5 min blows
            // away cached metrics/apps and the dashboard shows an empty loading
            // state for 1-2s before the next fetch resolves — looks like a fresh
            // sync on every visit.
            gcTime: 30 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>{children}</TooltipProvider>
    </QueryClientProvider>
  );
}
