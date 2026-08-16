import { getServiceClient } from "@/lib/supabase-server";
import { PLAN_LIMITS, PlanName } from "@/lib/plans";
import { isMissingColumnError } from "@/lib/db-errors";

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
  // Deleted apps must not count against the limit. Without this filter a
  // customer on a 1-app plan who disconnected an app could never add another:
  // the row is still there (soft delete), so the count never drops and every
  // attempt is refused with "you've reached your app limit" for an app they
  // can no longer see anywhere in the product.
  let { count, error } = await sb
    .from("apps")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);

  // No `deleted_at` column (migration 015 pending) means nothing has ever been
  // soft-deleted, so counting every row is equivalent.
  if (isMissingColumnError(error)) {
    ({ count, error } = await sb
      .from("apps")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId));
  }

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

/**
 * Can this workspace publish another reply to the store this month?
 *
 * Published replies are the commercial meter (lib/plans.ts): a reply posted to
 * the store is the thing the customer is actually buying, it is measurable,
 * and it grows with them — unlike "apps", which charges someone with ten
 * dormant listings like a heavy user.
 *
 * Counted from the audit log rather than a counter column: `reply.publish` is
 * already written on every successful publish, so there is no second source of
 * truth to drift. Rolling 30 days rather than calendar month, so nobody gets a
 * cliff at midnight on the 1st.
 *
 * Fails OPEN. If the count can't be read we let the reply through — refusing
 * to publish someone's reply because our own query failed is a worse outcome
 * than one reply over the line.
 */
export async function canPublishReply(
  workspaceId: string,
  plan: string,
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const resolved = resolvePlan(plan);
  const limit = PLAN_LIMITS[resolved].publishedRepliesPerMonth;

  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  try {
    const sb = getServiceClient();
    const { count, error } = await sb
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("action", "reply.publish")
      .gte("created_at", since);

    if (error) {
      console.error("[plan] published-reply count failed, allowing:", error);
      return { allowed: true, used: 0, limit };
    }

    const used = count ?? 0;
    return { allowed: used < limit, used, limit };
  } catch (err) {
    console.error("[plan] published-reply count threw, allowing:", err);
    return { allowed: true, used: 0, limit };
  }
}
