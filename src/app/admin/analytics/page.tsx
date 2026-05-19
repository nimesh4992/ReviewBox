import { getServiceClient } from "@/lib/supabase-server";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
}

function StatCard({ label, value, sub }: StatCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

export default async function AdminAnalyticsPage() {
  const sb = getServiceClient();

  // Total workspaces and breakdown by plan
  const { data: workspaces } = await sb
    .from("workspaces")
    .select("id, plan");

  // Total apps
  const { count: totalApps } = await sb
    .from("apps")
    .select("id", { count: "exact", head: true });

  // Total reviews
  const { count: totalReviews } = await sb
    .from("reviews")
    .select("id", { count: "exact", head: true });

  // Total AI drafts (ai_usage where action = 'draft_reply')
  const { count: totalAiDrafts } = await sb
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("action", "draft_reply");

  // Most active workspaces by review count (top 5)
  const { data: topWorkspaces } = await sb
    .from("reviews")
    .select("workspace_id, workspaces(name)")
    .limit(5000); // fetch then group client-side (no group-by in supabase postgrest without RPC)

  // Group top workspaces
  const workspaceReviewCounts = new Map<string, { name: string; count: number }>();
  for (const row of topWorkspaces ?? []) {
    const ws = (row.workspaces as unknown) as { name: string } | null;
    const name = ws?.name ?? row.workspace_id;
    const existing = workspaceReviewCounts.get(row.workspace_id);
    if (existing) {
      existing.count += 1;
    } else {
      workspaceReviewCounts.set(row.workspace_id, { name, count: 1 });
    }
  }
  const topFive = [...workspaceReviewCounts.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  // Plan breakdown
  const planCounts: Record<string, number> = {};
  for (const ws of workspaces ?? []) {
    const plan = ws.plan ?? "free";
    planCounts[plan] = (planCounts[plan] ?? 0) + 1;
  }
  const planBreakdown = Object.entries(planCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([plan, count]) => `${count} ${plan}`)
    .join(", ");

  const totalWorkspaces = workspaces?.length ?? 0;

  return (
    <div>
      <h1 className="mb-6 text-lg font-semibold text-gray-900">Analytics</h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total workspaces"
          value={totalWorkspaces}
          sub={planBreakdown || "â€”"}
        />
        <StatCard label="Total apps connected" value={totalApps ?? 0} />
        <StatCard label="Total reviews synced" value={totalReviews ?? 0} />
        <StatCard label="Total AI drafts generated" value={totalAiDrafts ?? 0} />
      </div>

      {/* Most active workspaces */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">
          Most active workspaces (by review count)
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-gray-500">Workspace</th>
                <th className="px-4 py-3 text-xs font-medium text-gray-500 text-right">Reviews</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {topFive.length === 0 ? (
                <tr>
                  <td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-400">
                    No review data yet.
                  </td>
                </tr>
              ) : (
                topFive.map(([id, { name, count }]) => (
                  <tr key={id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{name}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{count.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
