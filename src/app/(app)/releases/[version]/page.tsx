import Link from "next/link";
import { ArrowLeft, GitBranch, MessageSquare, Star, TrendingDown, TrendingUp } from "lucide-react";
import { auth } from "@clerk/nextjs/server";

import { PageHeader } from "@/components/layout/page-header";
import { ReleaseActions } from "@/features/releases/components/release-actions";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { getLiveApps } from "@/lib/live-apps";
import { cn } from "@/lib/utils";
import { isMissingColumnError } from "@/lib/db-errors";
import {
  compareReleases,
  findPreviousVersion,
  type ReleaseComparison,
  type TaggedReviewRow,
} from "@/lib/release-regression";
import { deriveVersions, type ReleaseReviewRow } from "@/lib/release-versions";
import { ReleaseRegressionCard } from "@/features/releases/components/release-regression-card";
import { readTagLabels } from "@/services/tag-label-service";
import type { TagLabelMap } from "@/lib/tag-labels";

export const dynamic = "force-dynamic";

// ── DB row (reviews table) ─────────────────────────────────────────────────────

interface DbReview {
  id: string;
  author: string;
  rating: number;
  body: string;
  sentiment: string | null;
  issue_tags: string[] | null;
  reply_status: string;
  store_created_at: string;
  source: string;
  country: string | null;
}

// ── Derived release health ─────────────────────────────────────────────────────

type DerivedStatus = "degraded" | "monitoring" | "healthy";

interface ReleaseStats {
  version: string;
  status: DerivedStatus;
  reviewCount: number;
  avgRating: number;
  dist: [number, number, number, number, number]; // 1★→5★ counts
  positiveShare: number;
  negativeShare: number;
  topTags: { tag: string; count: number }[];
  firstSeen: string | null;
  reviews: DbReview[];
}

function deriveStats(version: string, rows: DbReview[]): ReleaseStats {
  if (rows.length === 0) {
    return {
      version, status: "healthy", reviewCount: 0,
      avgRating: 0, dist: [0,0,0,0,0],
      positiveShare: 0, negativeShare: 0,
      topTags: [], firstSeen: null, reviews: [],
    };
  }

  const dist: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let ratingSum = 0;
  let posCount = 0;
  let negCount = 0;
  const tagCounts: Record<string, number> = {};

  for (const r of rows) {
    const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1|2|3|4|5;
    dist[star - 1]++;
    ratingSum += r.rating;
    const s = r.sentiment ?? "";
    if (s === "positive") posCount++;
    if (s === "critical" || s === "negative") negCount++;
    for (const t of r.issue_tags ?? []) {
      tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    }
  }

  const n = rows.length;
  const avgRating = ratingSum / n;
  const status: DerivedStatus =
    avgRating < 3.0 ? "degraded" :
    avgRating < 4.0 ? "monitoring" : "healthy";

  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  const dates = rows.map(r => r.store_created_at).sort();
  const firstSeen = dates[0]
    ? new Date(dates[0]).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return {
    version, status, reviewCount: n,
    avgRating: Math.round(avgRating * 10) / 10,
    dist,
    positiveShare: Math.round((posCount / n) * 100),
    negativeShare: Math.round((negCount / n) * 100),
    topTags, firstSeen,
    reviews: rows.slice(0, 20),
  };
}

// ── Release-over-release comparison (II0) ─────────────────────────────────────

/**
 * Cap on rows read for the comparison. Matches the releases list. If a version
 * ever exceeds it the card SAYS the comparison is based on the most recent
 * 5,000 reviews — an undisclosed sample is how a percentage stops meaning what
 * a customer reads it to mean.
 */
const REGRESSION_ROW_CAP = 5000;

type ComparisonRow = ReleaseReviewRow & TaggedReviewRow;

/**
 * Read one app's reviews and compare this version against the one before it.
 *
 * Scoped to a single app id: version numbers are unique only within an app, and
 * `findPreviousVersion` chains within the app rather than trusting adjacency.
 */
async function buildComparison(
  sb: ReturnType<typeof getServiceClient>,
  workspaceId: string,
  appId: string,
  version: string,
): Promise<{ comparison: ReleaseComparison; truncated: boolean } | null> {
  const read = (columns: string) =>
    sb
      .from("reviews")
      .select(columns)
      .eq("workspace_id", workspaceId)
      .eq("app_id", appId)
      .order("store_created_at", { ascending: false })
      .limit(REGRESSION_ROW_CAP);

  const BASE = "app_id,app_version,rating,store_created_at,issue_tags";
  // `issue_tags_override` arrives with migration 024; naming a column that does
  // not exist fails the whole select, so it is asked for once and dropped.
  let { data, error } = await read(`${BASE},issue_tags_override`);
  if (isMissingColumnError(error)) ({ data, error } = await read(BASE));
  if (error || !data) return null;

  const rows = data as unknown as ComparisonRow[];
  const versions = deriveVersions(rows);
  const previous = findPreviousVersion(versions, appId, version);
  const forVersion = (v: string) => rows.filter((r) => r.app_version?.trim() === v);

  return {
    comparison: compareReleases(
      version,
      forVersion(version),
      previous?.version ?? null,
      previous ? forVersion(previous.version) : [],
    ),
    truncated: rows.length >= REGRESSION_ROW_CAP,
  };
}

// ── Styling ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DerivedStatus, { badge: string; bar: string; label: string }> = {
  degraded:   { badge: "bg-[var(--rb-red-500)]/10 text-[var(--rb-red-500)] border border-[var(--rb-red-500)]/25",               bar: "bg-[var(--rb-red-400)]",    label: "Degraded" },
  monitoring: { badge: "bg-[var(--rb-amber-500)]/10 text-[var(--rb-amber-500)] border border-[var(--rb-amber-500)]/25",         bar: "bg-[var(--rb-amber-500)]",  label: "Monitoring" },
  healthy:    { badge: "bg-[var(--rb-green-500)]/10 text-[var(--rb-green-500)] border border-[var(--rb-green-500)]/25",   bar: "bg-[var(--rb-green-500)]", label: "Healthy" },
};

const SENTIMENT_BADGE: Record<string, string> = {
  critical: "bg-[var(--rb-red-500)]/10 text-[var(--rb-red-500)]",
  negative: "bg-[var(--rb-red-500)]/10 text-[var(--rb-red-500)]",
  mixed:    "bg-[var(--rb-amber-500)]/10 text-[var(--rb-amber-500)]",
  positive: "bg-[var(--rb-green-500)]/10 text-[var(--rb-green-500)]",
};

const TAG_LABELS: Record<string, string> = {
  crash: "Crash", billing: "Billing", login: "Login",
  performance: "Performance", "release-regression": "Regression",
  "feature-request": "Feature req.", "support-delay": "Support",
  localization: "Localization",
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, positive, negative,
}: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  return (
    <div className="rounded-xl border border-[var(--rb-border-1)] bg-surface px-5 py-4 shadow-sm">
      <p className="text-xs text-fg-3 font-medium">{label}</p>
      <p className={cn(
        "mt-1 text-xl font-semibold",
        positive && "text-[var(--rb-green-500)]",
        negative && "text-red-500",
        !positive && !negative && "text-fg-1",
      )}>
        {positive && <TrendingUp className="inline size-4 mr-1" strokeWidth={1.5} />}
        {negative && <TrendingDown className="inline size-4 mr-1" strokeWidth={1.5} />}
        {value}
      </p>
    </div>
  );
}

function RatingBar({ star, count, total }: { star: number; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-4 text-right text-fg-3">{star}★</span>
      <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[var(--rb-bg-sunken)]">
        <div className="h-full rounded-full bg-[#0A84FF]" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-5 text-right text-fg-3 tabular-nums">{count}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface ReleaseDetailPageProps {
  params: Promise<{ version: string }>;
  searchParams: Promise<{ appId?: string }>;
}

export default async function ReleaseDetailPage({ params, searchParams }: ReleaseDetailPageProps) {
  const { version: rawVersion } = await params;
  const version = decodeURIComponent(rawVersion);
  const { appId: requestedAppId } = await searchParams;

  // ── Auth + workspace ──────────────────────────────────────────────────────
  const session     = await auth();
  const userId      = session?.userId;
  let stats: ReleaseStats = deriveStats(version, []);
  let hasData = false;
  let appName = "";
  let comparison: ReleaseComparison | null = null;
  let comparisonTruncated = false;
  let tagLabels: TagLabelMap = {};

  if (userId) {
    const workspaceId = await getWorkspaceId(userId);
    if (workspaceId) {
      const sb = getServiceClient();
      // A version number identifies a release only within one app, so this
      // page honours the appId the releases table links with. Without it,
      // two apps that both shipped this version rendered as a single release.
      // Live apps only, and an appId is accepted only if the workspace owns
      // it — the /api/reviews contract.
      const liveApps = (await getLiveApps(sb, workspaceId)) ?? [];
      const selected = requestedAppId
        ? liveApps.find((a) => a.id === requestedAppId)
        : undefined;
      const scopedAppIds = selected ? [selected.id] : liveApps.map((a) => a.id);

      if (scopedAppIds.length && !(requestedAppId && !selected)) {
        const { data } = await sb
          .from("reviews")
          .select("app_id,id,author,rating,body,sentiment,issue_tags,reply_status,store_created_at,source,country")
          .eq("workspace_id", workspaceId)
          .in("app_id", scopedAppIds)
          .eq("app_version", version)
          .order("store_created_at", { ascending: false })
          .limit(100);

        let rows = (data ?? []) as (DbReview & { app_id: string })[];

        // Reached without ?appId= — a bookmark, or a link from before the
        // releases table started carrying it. A version number is unique only
        // within an app, so rendering every app's rows as one release would
        // reintroduce exactly the blend this page was fixed to stop. Pick the
        // app with the most reviews for this version and say which one it is,
        // rather than silently merging.
        let resolvedApp = selected;
        if (!resolvedApp && rows.length) {
          const counts = new Map<string, number>();
          for (const r of rows) counts.set(r.app_id, (counts.get(r.app_id) ?? 0) + 1);
          const winner = liveApps
            .filter((a) => counts.has(a.id))
            .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))[0];
          if (winner) {
            resolvedApp = winner;
            rows = rows.filter((r) => r.app_id === winner.id);
          }
        }

        appName = resolvedApp?.name ?? (liveApps.length === 1 ? liveApps[0].name : "");

        if (rows.length > 0) {
          stats = deriveStats(version, rows as DbReview[]);
          hasData = true;
        }

        // "What changed vs the previous release" needs the OTHER version's
        // reviews too, so it is its own read rather than a slice of the list
        // above (which is capped at 100 and ordered for display).
        if (resolvedApp && rows.length > 0) {
          const [result, labels] = await Promise.all([
            buildComparison(sb, workspaceId, resolvedApp.id, version),
            readTagLabels(workspaceId),
          ]);
          if (result) {
            comparison = result.comparison;
            comparisonTruncated = result.truncated;
          }
          tagLabels = labels;
        }
      } else {
        appName = selected?.name ?? (liveApps.length === 1 ? liveApps[0].name : "");
      }
    }
  }

  const config = STATUS_CONFIG[stats.status];

  return (
    <div className="min-w-0">
      <PageHeader
        eyebrow={appName ? `Release monitor · ${appName}` : "Release monitor"}
        title={`Release ${version}`}
        description={
          stats.firstSeen
            ? `${stats.reviewCount} review${stats.reviewCount !== 1 ? "s" : ""} · first seen ${stats.firstSeen}`
            : "No reviews synced for this version yet"
        }
      />

      <div className="p-4 md:p-6 space-y-6 max-w-4xl">
        {/* Back link */}
        <Link
          href="/releases"
          className="inline-flex items-center gap-1.5 text-sm text-fg-3 hover:text-fg-1 transition-colors"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.5} />
          Back to releases
        </Link>

        {/* Version header card */}
        <div className="overflow-hidden rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-sm p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <GitBranch className="size-5 text-fg-4 shrink-0" strokeWidth={1.5} />
            <span className="font-mono text-xl font-semibold text-fg-1">{version}</span>
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", config.badge)}>
              <span className={cn("size-1.5 rounded-full", config.bar)} />
              {config.label}
            </span>
          </div>
          {stats.firstSeen && (
            <p className="mt-2 text-xs text-fg-3">First review {stats.firstSeen}</p>
          )}
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Avg rating"
            value={hasData ? `${stats.avgRating} / 5` : "—"}
            positive={stats.avgRating >= 4}
            negative={stats.avgRating > 0 && stats.avgRating < 3}
          />
          <StatCard label="Reviews" value={hasData ? String(stats.reviewCount) : "—"} />
          <StatCard
            label="Positive share"
            value={hasData ? `${stats.positiveShare}%` : "—"}
            positive={stats.positiveShare >= 60}
            negative={stats.positiveShare < 40 && stats.positiveShare > 0}
          />
        </div>

        {/* What changed vs the previous release (II0) */}
        {comparison && (
          <ReleaseRegressionCard
            comparison={comparison}
            labels={tagLabels}
            truncated={comparisonTruncated}
          />
        )}

        {/* Rating distribution */}
        {hasData && (
          <div className="rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-sm p-5">
            <h2 className="text-sm font-semibold text-fg-1 mb-4">Rating distribution</h2>
            <div className="space-y-2">
              {[5, 4, 3, 2, 1].map((star) => (
                <RatingBar key={star} star={star} count={stats.dist[star - 1]} total={stats.reviewCount} />
              ))}
            </div>
          </div>
        )}

        {/* Top issue tags */}
        {hasData && stats.topTags.length > 0 && (
          <div className="rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-sm p-5">
            <h2 className="text-sm font-semibold text-fg-1 mb-3">Issue tags</h2>
            <div className="flex flex-wrap gap-2">
              {stats.topTags.map(({ tag, count }) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-2.5 py-0.5 text-xs font-medium text-fg-2"
                >
                  {TAG_LABELS[tag] ?? tag}
                  <span className="tabular-nums text-fg-3">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Reviews list */}
        <div className="rounded-2xl border border-[var(--rb-border-1)] bg-surface shadow-sm">
          <div className="flex items-center border-b border-[var(--rb-border-1)] px-5 py-3">
            <h2 className="text-sm font-semibold text-fg-1">Reviews for v{version}</h2>
            {hasData && (
              <span className="ml-2 text-xs text-fg-3">
                showing {Math.min(20, stats.reviewCount)} of {stats.reviewCount}
              </span>
            )}
          </div>
          {!hasData ? (
            <div className="px-5 py-8 text-center">
              <MessageSquare className="mx-auto size-8 text-[var(--rb-border-3)] mb-2" strokeWidth={1.5} />
              <p className="text-sm text-fg-3">
                No reviews synced for version <span className="font-mono">{version}</span> yet.
              </p>
              <p className="mt-1 text-xs text-fg-3">
                Reviews appear here after the next Google Play sync.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[var(--rb-border-1)]">
              {stats.reviews.map((r) => (
                <li key={r.id} className="px-5 py-3 hover:bg-[var(--rb-bg-hover)]/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-fg-2">{r.author}</span>
                        {r.sentiment && (
                          <span className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize",
                            SENTIMENT_BADGE[r.sentiment] ?? "bg-[var(--rb-bg-sunken)] text-fg-3",
                          )}>
                            {r.sentiment}
                          </span>
                        )}
                        {r.country && (
                          <span className="text-[10px] text-fg-3">{r.country}</span>
                        )}
                      </div>
                      <p className="text-xs text-fg-3 leading-5 line-clamp-3">{r.body}</p>
                      {(r.issue_tags ?? []).length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(r.issue_tags ?? []).map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-[var(--rb-border-1)] bg-[var(--rb-bg-sunken)] px-1.5 py-0.5 text-[10px] text-fg-3"
                            >
                              {TAG_LABELS[t] ?? t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5 text-amber-400">
                      {Array.from({ length: Math.round(r.rating) }).map((_, i) => (
                        <Star key={i} className="size-3" fill="currentColor" strokeWidth={0} />
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Actions */}
        <ReleaseActions />
      </div>
    </div>
  );
}
