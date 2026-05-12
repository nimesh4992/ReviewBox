import { getServiceClient } from "@/lib/supabase-server";
import { PLAN_LIMITS, PlanName } from "@/lib/plans";

function resolvePlan(plan: string): PlanName {
  return plan in PLAN_LIMITS ? (plan as PlanName) : "free";
}

/**
 * Returns true if the workspace can add another app under the given plan.
 */
export async function canAddApp(
  workspaceId: string,
  plan: string,
): Promise<boolean> {
  const sb = getServiceClient();
  const { count, error } = await sb
    .from("apps")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(`canAddApp: ${error.message}`);

  const resolved = resolvePlan(plan);
  const limit = PLAN_LIMITS[resolved].appsMax;
  return (count ?? 0) < limit;
}

/**
 * Returns an error string if the workspace has exceeded its monthly review
 * limit, or null if within limit.
 */
export async function checkReviewLimit(
  workspaceId: string,
  plan: string,
): Promise<string | null> {
  const sb = getServiceClient();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { count, error } = await sb
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .gte("created_at", startOfMonth);

  if (error) throw new Error(`checkReviewLimit: ${error.message}`);

  const resolved = resolvePlan(plan);
  const limit = PLAN_LIMITS[resolved].reviewsPerMonth;

  if ((count ?? 0) >= limit) {
    return `Monthly review limit reached (${limit.toLocaleString()} reviews). Upgrade your plan to sync more reviews.`;
  }

  return null;
}
