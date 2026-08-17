"use client";

import { InboxScreen } from "@/features/reviews/components/review-queue";
import { useReviewQueue } from "@/hooks/use-review-queue";
import { useApps } from "@/hooks/use-apps";
import { useWorkspaceStore } from "@/store/use-workspace-store";
import { resolveSelectedApp } from "@/lib/selected-app";

export default function InboxPage() {
  // Scope the inbox to the app picked in the sidebar.
  //
  // This must go through resolveSelectedApp — passing the stored value
  // straight to the API is the bug it exists to prevent. `selectedApp` is
  // persisted, so it can outlive the app it points at: disconnect an app and
  // the id stays in localStorage. The sidebar resolves that dangling id back
  // to "All apps" and looks fine, while the inbox kept sending it as a filter.
  // The API refuses an appId that isn't a live app of the workspace and
  // returns nothing — so the inbox read empty, under a heading that said "All
  // apps", with reviews that reappeared the moment you picked an app by hand.
  const selectedApp = useWorkspaceStore((s) => s.selectedApp);
  const { apps } = useApps();
  const { appId } = resolveSelectedApp(apps, selectedApp);

  const { reviews, fetchNextPage, hasNextPage, isFetchingNextPage, isFetching, isLoading, isError } =
    useReviewQueue(appId ? { appId } : {});

  return (
    <div className="flex h-[calc(100vh-52px)] flex-col overflow-hidden">
      {isLoading ? (
        <InboxSkeleton />
      ) : (
        <InboxScreen
          reviews={reviews}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isFetching={isFetching}
          loadError={isError}
          fetchNextPage={fetchNextPage}
          appId={appId}
        />
      )}
    </div>
  );
}

function InboxSkeleton() {
  return (
    <div className="flex flex-1 flex-col">
      <div className="shrink-0 border-b border-[var(--rb-border-1)] px-7 pb-3.5 pt-5">
        <div className="mb-3.5">
          <div className="h-3 w-32 animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
          <div className="mt-2 h-6 w-16 animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
        </div>
        <div className="flex gap-2">
          {[80, 110, 90, 90, 90].map((w, i) => (
            <div key={i} className="h-7 animate-pulse rounded-[7px] bg-[var(--rb-bg-sunken)]" style={{ width: w }} />
          ))}
        </div>
      </div>
      <div className="flex-1">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex gap-3 border-b border-[var(--rb-border-1)] px-4 py-3.5">
            <div className="size-9 shrink-0 animate-pulse rounded-[9px] bg-[var(--rb-bg-sunken)]" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
              <div className="h-3 w-full animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
              <div className="h-2.5 w-1/2 animate-pulse rounded bg-[var(--rb-bg-sunken)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
