import { getServiceClient } from "@/lib/supabase-server";
import { cn } from "@/lib/utils";

// Note: set ADMIN_CLERK_USER_ID in .env.local to your Clerk user ID (Clerk dashboard > Users)

// Local to the badge styling — deliberately not the PlanName from lib/plans,
// so adding a plan there can't silently change admin colours. It does need
// every real plan name though: `trial` was missing, so every workspace on a
// trial (which is every new signup) was shown as "free" here.
type PlanName = "free" | "trial" | "starter" | "pro" | "team";

const PLAN_BADGE: Record<PlanName, string> = {
  free:    "bg-gray-100 text-gray-500 border border-gray-200",
  trial:   "bg-amber-50 text-amber-700 border border-amber-200",
  starter: "bg-blue-50 text-blue-600 border border-blue-200",
  pro:     "bg-indigo-50 text-indigo-600 border border-indigo-200",
  team:    "bg-purple-50 text-purple-700 border border-purple-200",
};

interface WorkspaceRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
  owner_clerk_id: string | null;
  app_count: number;
}

export default async function AdminCustomersPage() {
  const sb = getServiceClient();

  // Fetch workspaces with owner clerk_user_id and app count
  const { data: workspaces, error } = await sb
    .from("workspaces")
    .select(`
      id,
      name,
      slug,
      plan,
      created_at,
      workspace_members!inner(clerk_user_id, role),
      apps(id)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div>
        <h1 className="mb-6 text-lg font-semibold text-gray-900">Customers</h1>
        <p className="text-sm text-red-500">Failed to load customers: {error.message}</p>
      </div>
    );
  }

  const rows: WorkspaceRow[] = (workspaces ?? []).map((ws) => {
    const members = ws.workspace_members as { clerk_user_id: string; role: string }[];
    const apps = ws.apps as { id: string }[];
    const owner = members.find((m) => m.role === "owner");
    return {
      id: ws.id,
      name: ws.name,
      slug: ws.slug,
      plan: ws.plan ?? "free",
      created_at: ws.created_at,
      owner_clerk_id: owner?.clerk_user_id ?? null,
      app_count: apps?.length ?? 0,
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
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Joined</th>
              <th className="px-4 py-3 text-xs font-medium text-gray-500">Owner ID</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">
                  No customers yet.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const plan = (row.plan in PLAN_BADGE ? row.plan : "free") as PlanName;
                const joined = new Date(row.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{row.name}</p>
                      <p className="text-xs text-gray-400">{row.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
                          PLAN_BADGE[plan],
                        )}
                      >
                        {plan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.app_count}</td>
                    <td className="px-4 py-3 text-gray-500">{joined}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">
                      {row.owner_clerk_id ?? "—"}
                    </td>
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
