import Link from "next/link";

import { getServiceClient } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";
import { requireAdminPage } from "@/lib/admin-auth";

// Note: set ADMIN_CLERK_USER_ID in .env.local to your Clerk user ID (Clerk dashboard > Users)

// Local to the badge styling — deliberately not the PlanName from lib/plans,
// so adding a plan there can't silently change admin colours. Covers the full
// D002 vocabulary (trial/starter/pro/team/past_due/canceled) plus legacy
// `free` rows that predate D002.
const PLAN_BADGE: Record<string, string> = {
  free:     "bg-gray-100 text-gray-500 border border-gray-200",
  trial:    "bg-amber-50 text-amber-700 border border-amber-200",
  starter:  "bg-blue-50 text-blue-600 border border-blue-200",
  pro:      "bg-indigo-50 text-indigo-600 border border-indigo-200",
  team:     "bg-purple-50 text-purple-700 border border-purple-200",
  past_due: "bg-red-50 text-red-600 border border-red-200",
  canceled: "bg-gray-100 text-gray-400 border border-gray-200",
};

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  deleted_at: string | null;
  trial_ends_at: string | null;
  app_count: number;
  review_count: number | null;
}

const BASE_SELECT = `
  id,
  name,
  slug,
  plan,
  created_at,
  deleted_at,
  trial_ends_at,
  apps(id)
`;

export default async function AdminCustomersPage() {
  await requireAdminPage();
  const sb = getServiceClient();

  // Embedded reviews(count) needs PostgREST aggregate support; fall back to
  // the same query without it rather than failing the whole page.
  const primary = await sb
    .from("workspaces")
    .select(`${BASE_SELECT}, reviews(count)`)
    .order("created_at", { ascending: false });

  let workspaceRows = primary.data as Record<string, unknown>[] | null;
  let queryError = primary.error;
  let hasReviewCounts = true;
  if (primary.error) {
    hasReviewCounts = false;
    const fallback = await sb
      .from("workspaces")
      .select(BASE_SELECT)
      .order("created_at", { ascending: false });
    workspaceRows = fallback.data as Record<string, unknown>[] | null;
    queryError = fallback.error;
  }

  if (queryError) {
    return (
      <div>
        <h1 className="mb-6 text-lg font-semibold text-gray-900">Customers</h1>
        <p className="text-sm text-red-500">Failed to load customers: {queryError.message}</p>
      </div>
    );
  }

  const rows: WorkspaceRow[] = (workspaceRows ?? []).map((ws) => {
    const apps = (ws.apps as { id: string }[] | null) ?? [];
    const reviewAgg = ws.reviews as { count: number }[] | undefined;
    return {
      id: ws.id as string,
      name: ws.name as string,
      slug: ws.slug as string,
      plan: (ws.plan as string | null) ?? "trial",
      created_at: ws.created_at as string,
      deleted_at: (ws.deleted_at as string | null) ?? null,
      trial_ends_at: (ws.trial_ends_at as string | null) ?? null,
      app_count: apps.length,
      review_count: hasReviewCounts ? (reviewAgg?.[0]?.count ?? 0) : null,
    };
  });

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-gray-900">
        Customers
        <span className="ml-2 text-sm font-normal text-gray-400">({rows.length})</span>
      </h1>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-left">
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Workspace</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Plan</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Apps</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Reviews</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Joined</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Trial ends</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">
                  No customers yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const badge = PLAN_BADGE[row.plan] ?? PLAN_BADGE.trial;
                const joined = new Date(row.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                const trialEnds = row.trial_ends_at
                  ? new Date(row.trial_ends_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : "—";
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/admin/customers/${row.id}`} className="font-medium text-gray-900 hover:underline">
                        {row.name}
                      </Link>
                      {row.deleted_at && (
                        <span className="ml-2 rounded-full border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                          deleted
                        </span>
                      )}
                      <p className="text-xs text-gray-400">{row.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          badge,
                        )}
                      >
                        {row.plan.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.app_count}</td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.review_count === null ? "—" : row.review_count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{joined}</td>
                    <td className="px-4 py-3 text-gray-500">{row.plan === "trial" ? trialEnds : "—"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
