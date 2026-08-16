"use client";

/**
 * InboxRouter — smart first-visit routing per session.
 *
 * On landing at /dashboard, checks whether there are unreplied reviews.
 * If yes and the user has connected apps, redirects to /reviews so they
 * land where the work actually is.
 *
 * Uses sessionStorage so the redirect only fires once per browser session —
 * if the user explicitly navigates back to /dashboard they stay there.
 *
 * D016: this is intentionally simple. No edge cases, no server-side logic.
 */

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";

import { useDashboardMetrics } from "@/hooks/use-dashboard-metrics";
import { useApps } from "@/hooks/use-apps";
import { useWorkspaceStore } from "@/store/use-workspace-store";
import { resolveSelectedApp } from "@/lib/selected-app";

const SESSION_KEY = "rb_inbox_routed";

export function InboxRouter() {
  const router   = useRouter();
  const pathname = usePathname();
  const fired    = useRef(false);

  const { apps,          isLoading: appsLoading     } = useApps();
  // Same scope as the inbox we'd redirect to: with app B selected and only
  // app A holding unreplied reviews, the workspace-wide count bounced the
  // user to an inbox that reads empty.
  const selectedApp = useWorkspaceStore((s) => s.selectedApp);
  const { appId: selectedAppId } = resolveSelectedApp(apps, selectedApp);
  const { data: metrics, isLoading: metricsLoading } = useDashboardMetrics(selectedAppId);

  useEffect(() => {
    // Only act on /dashboard
    if (pathname !== "/dashboard") return;
    // Wait for both queries to settle
    if (metricsLoading || appsLoading) return;
    // Fire at most once per component lifetime AND once per session
    if (fired.current) return;
    if (typeof window !== "undefined" && sessionStorage.getItem(SESSION_KEY)) return;

    fired.current = true;
    if (typeof window !== "undefined") sessionStorage.setItem(SESSION_KEY, "1");

    const hasApps      = apps.length > 0;
    const hasUnreplied = (metrics?.unrepliedCount ?? 0) > 0;

    if (hasApps && hasUnreplied) {
      router.replace("/reviews");
    }
  }, [pathname, metricsLoading, appsLoading, metrics, apps, router]);

  return null;
}
