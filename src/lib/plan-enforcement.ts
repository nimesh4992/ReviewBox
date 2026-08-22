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
 * How much of the plan's monthly review allowance a workspace has used.
 *
 * **This is a report, not a gate — deliberately, and the naming carries that.**
 *
 * Its predecessor was `checkReviewLimit()`, which returned *an error string*,
 * and `syncWorkspaceApps()` returned early on it. That is ADR 009's Option A,
 * the option the ADR says in writing not to build: over the line, the whole
 * workspace stopped syncing on every scheduled run until the 1st, with no
 * email, no banner and no `last_sync_error` — the app row still read healthy
 * while reviews silently stopped arriving for up to a month.
 *
 * Founder decision 2026-08-22: **Option B, soft cap.** Nothing is ever
 * withheld; the customer is told and asked. So this function cannot refuse
 * anything — there is no error to return, and a caller that wanted to gate on
 * it would have to write the comparison itself, in the open, on purpose.
 *
 * **Fails open, and says so.** If the count cannot be read, `unknown` is true
 * and `over` is false. A banner must render nothing in that case rather than
 * assert a number: this is the AU5 lesson — a failed read that renders as a
 * confident figure is worse than one that renders as nothing.
 */
export interface ReviewUsage {
  /** Reviews first stored this calendar month. */
  used: number;
  /** The plan's monthly allowance. */
  limit: number;
  /** Past the allowance. Informational only — ingestion continues regardless. */
  over: boolean;
  /** Whole-number percent of the allowance used. Can exceed 100. */
  percentUsed: number;
  /** The count could not be read. Callers must not claim a usage state. */
  unknown: boolean;
}

/**
 * The share of the allowance at which the customer is told.
 *
 * 80% is not an arbitrary choice — it is the number already promised on
 * `/pricing` and `/faq` ("We'll notify you when you hit 80% of your quota"),
 * which until now nothing in the codebase implemented. Changing it here
 * silently makes those two sentences false again, so `src/lib/plans.test.ts`
 * is the wrong place to look for permission: change the pages first.
 */
export const REVIEW_USAGE_NOTICE_PERCENT = 80;

export async function getReviewUsage(
  workspaceId: string,
  plan: string,
): Promise<ReviewUsage> {
  const resolved = resolvePlan(plan);
  const limit = PLAN_LIMITS[resolved].reviewsPerMonth;

  try {
    const sb = getServiceClient();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const { count, error } = await sb
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .gte("created_at", startOfMonth);

    if (error) {
      console.error("[plan] review usage count failed:", error);
      return { used: 0, limit, over: false, percentUsed: 0, unknown: true };
    }

    const used = count ?? 0;
    return {
      used,
      limit,
      over: used >= limit,
      percentUsed: limit > 0 ? Math.floor((used / limit) * 100) : 0,
      unknown: false,
    };
  } catch (err) {
    console.error("[plan] review usage count threw:", err);
    return { used: 0, limit, over: false, percentUsed: 0, unknown: true };
  }
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
