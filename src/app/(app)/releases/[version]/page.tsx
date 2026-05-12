import Link from "next/link";
import { ArrowLeft, GitBranch, TrendingDown, TrendingUp } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { releaseHealth } from "@/features/dashboard/data/operations";
import { ReleaseActions } from "@/features/releases/components/release-actions";
import { cn } from "@/lib/utils";
import type { ReleaseHealth } from "@/types/review";

export const dynamic = "force-dynamic";

// ── Styling helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ReleaseHealth["status"],
  { badge: string; bar: string; label: string }
> = {
  degraded: {
    badge: "bg-red-50 text-red-700 border border-red-200",
    bar: "bg-red-400",
    label: "Degraded",
  },
  monitoring: {
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    bar: "bg-amber-400",
    label: "Monitoring",
  },
  healthy: {
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    bar: "bg-emerald-400",
    label: "Healthy",
  },
};

// ── Stat card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}

function StatCard({ label, value, positive, negative }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold",
          positive && "text-emerald-600",
          negative && "text-red-500",
          !positive && !negative && "text-gray-900",
        )}
      >
        {positive && <TrendingUp className="inline size-4 mr-1" strokeWidth={1.5} />}
        {negative && <TrendingDown className="inline size-4 mr-1" strokeWidth={1.5} />}
        {value}
      </p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface ReleaseDetailPageProps {
  params: Promise<{ version: string }>;
}

export default async function ReleaseDetailPage({
  params,
}: ReleaseDetailPageProps) {
  const { version: rawVersion } = await params;
  const version = decodeURIComponent(rawVersion);

  const release = releaseHealth.find((r) => r.version === version);

  if (!release) {
    return (
      <div className="min-w-0">
        <PageHeader
          eyebrow="Release monitor"
          title="Release not found"
          description="This version does not exist or has been removed."
        />
        <div className="p-6">
          <Link
            href="/releases"
            className="inline-flex items-center gap-1.5 text-sm text-[#5B5BD6] hover:underline"
          >
            <ArrowLeft className="size-3.5" strokeWidth={1.5} />
            Back to releases
          </Link>
        </div>
      </div>
    );
  }

  const config = STATUS_CONFIG[release.status];

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow="Release monitor"
        title={`Release ${release.version}`}
        description={`Staged rollout health — started ${release.startedAt}`}
      />

      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        {/* Back link */}
        <Link
          href="/releases"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          Back to releases
        </Link>

        {/* Version header card */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <GitBranch className="size-5 text-gray-300 shrink-0" strokeWidth={1.5} />
            <span className="font-mono text-xl font-semibold text-gray-900">
              {release.version}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                config.badge,
              )}
            >
              <span className={cn("size-1.5 rounded-full", config.bar)} />
              {config.label}
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-400">
            Started {release.startedAt} · Rollout {release.rollout}
          </p>
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Rating Δ"
            value={release.ratingDelta}
            positive={release.ratingDeltaNum > 0}
            negative={release.ratingDeltaNum < 0}
          />
          <StatCard
            label="Complaint Δ"
            value={release.complaintDelta}
            positive={release.complaintDelta.startsWith("-")}
            negative={release.complaintDelta.startsWith("+")}
          />
          <StatCard label="Rollout" value={release.rollout} />
        </div>

        {/* Rollout progress bar */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Rollout progress</h2>
            <span className="text-sm font-medium text-gray-700">
              {release.rollout}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={cn("h-full rounded-full transition-all duration-500", config.bar)}
              style={{ width: release.rollout }}
            />
          </div>
          <p className="mt-2 text-xs text-gray-400">
            {release.rolloutNum === 100
              ? "Full rollout complete"
              : `${100 - release.rolloutNum}% of users still on previous version`}
          </p>
        </div>

        {/* Reviews for this version */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">
            Reviews for this version
          </h2>
          <p className="text-sm text-gray-400">
            Reviews mentioning version {release.version} will appear here once
            Google Play sync is connected.
          </p>
        </div>

        {/* Actions */}
        <ReleaseActions />
      </div>
    </div>
  );
}
