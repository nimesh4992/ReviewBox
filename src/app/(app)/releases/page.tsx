import Link from "next/link";
import { Rocket } from "lucide-react";
import { auth } from "@clerk/nextjs/server";

import { PageHeader } from "@/components/layout/page-header";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { getLiveApps } from "@/lib/live-apps";
import {
  deriveVersions,
  type ReleaseReviewRow,
  type VersionRow,
} from "@/lib/release-versions";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReleasesPage() {
  const { userId } = await auth();
  let versions: VersionRow[] = [];
  let unversionedCount = 0;
  let hasWorkspace = false;
  let multiApp = false;

  if (userId) {
    const workspaceId = await getWorkspaceId(userId);
    if (workspaceId) {
      hasWorkspace = true;
      const sb = getServiceClient();
      // Live apps only — a disconnected app's releases lingered in this table
      // forever. `app_id` is selected because version numbers are unique only
      // WITHIN an app: keying the buckets on the version string alone fused
      // two apps' "2.1.0" into one fabricated row.
      const liveApps = (await getLiveApps(sb, workspaceId)) ?? [];
      multiApp = liveApps.length > 1;
      const appNames = new Map(liveApps.map((a) => [a.id, a.name]));

      if (liveApps.length) {
        const { data } = await sb
          .from("reviews")
          .select("app_id, app_version, rating, store_created_at")
          .eq("workspace_id", workspaceId)
          .in("app_id", [...appNames.keys()])
          .order("store_created_at", { ascending: false })
          .limit(5000);
        const rows = (data ?? []) as ReleaseReviewRow[];
        versions = deriveVersions(rows, appNames);
        unversionedCount = rows.filter((r) => !r.app_version?.trim()).length;
      }
    }
  }

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Release monitor"
        title="Releases"
        description="Each version your reviews mention, with its rating movement — click one for the full breakdown."
      />

      <div className="p-4 md:p-6">
        {versions.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-[var(--rb-border-1)] bg-surface p-6">
            <Rocket className="size-5 text-fg-3" strokeWidth={1.5} />
            <p className="text-rb-base font-medium text-fg-1">No version data yet</p>
            <p className="max-w-md text-rb-sm text-fg-3">
              {!hasWorkspace
                ? "Connect an app and sync reviews — versions appear here as soon as reviews carry them."
                : unversionedCount > 0
                  ? `${unversionedCount.toLocaleString()} reviews are synced, but none include an app version — some stores omit it. Versions appear here as soon as one does.`
                  : "Versions appear here automatically as reviews sync."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-[var(--rb-border-1)] bg-surface">
            <table className="w-full text-rb-base">
              <thead>
                <tr className="border-b border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] text-left">
                  <th className="px-4 py-2.5 text-rb-xs font-medium uppercase tracking-[0.08em] text-fg-3">Version</th>
                  {multiApp && (
                    <th className="px-4 py-2.5 text-rb-xs font-medium uppercase tracking-[0.08em] text-fg-3">App</th>
                  )}
                  <th className="px-4 py-2.5 text-right text-rb-xs font-medium uppercase tracking-[0.08em] text-fg-3">Reviews</th>
                  <th className="px-4 py-2.5 text-right text-rb-xs font-medium uppercase tracking-[0.08em] text-fg-3">Avg rating</th>
                  <th className="px-4 py-2.5 text-right text-rb-xs font-medium uppercase tracking-[0.08em] text-fg-3">vs previous</th>
                  <th className="px-4 py-2.5 text-right text-rb-xs font-medium uppercase tracking-[0.08em] text-fg-3">First seen</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr
                    key={`${v.appId}|${v.version}`}
                    className="border-b border-[var(--rb-border-1)] last:border-b-0 hover:bg-[var(--rb-bg-hover)]"
                  >
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/releases/${encodeURIComponent(v.version)}?appId=${encodeURIComponent(v.appId)}`}
                        className="font-medium text-fg-1 hover:text-[var(--rb-blue-600)] hover:underline"
                      >
                        {v.version}
                      </Link>
                    </td>
                    {multiApp && (
                      <td className="px-4 py-2.5 text-fg-2">{v.appName}</td>
                    )}
                    <td className="px-4 py-2.5 text-right tabular-nums text-fg-2">
                      {v.reviewCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-fg-1">
                      {v.avgRating.toFixed(2)}★
                    </td>
                    <td
                      className={cn(
                        "px-4 py-2.5 text-right tabular-nums",
                        v.ratingDelta === null
                          ? "text-fg-4"
                          : v.ratingDelta >= 0.05
                            ? "text-[var(--rb-green-600)]"
                            : v.ratingDelta <= -0.05
                              ? "text-[var(--rb-red-600)]"
                              : "text-fg-3",
                      )}
                    >
                      {v.ratingDelta === null
                        ? "—"
                        : `${v.ratingDelta >= 0 ? "+" : "−"}${Math.abs(v.ratingDelta).toFixed(2)}`}
                    </td>
                    <td className="px-4 py-2.5 text-right text-fg-3">
                      {new Date(v.firstSeen).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
