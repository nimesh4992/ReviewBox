import { getResend, FROM } from "./client";
import { getServiceClient } from "@/lib/supabase-server";
import { trialEndingEmail } from "./templates";
import { MAX_TRIAL_EXTENSIONS } from "@/lib/plans";

/**
 * Trial-ending email.
 *
 * The old version was a deadline and a feature list: "your trial ends in 2
 * days, here is what you lose". That is the weakest possible framing, because
 * it asks someone to act out of loss before they have been reminded of the
 * gain. The new copy leads with what they have already done with the product —
 * replies published, reviews handled — and only the final send leads with the
 * date. Those numbers have to be real, so this reads them.
 *
 * Best-effort throughout: a stat we cannot read becomes 0, and the template
 * omits a zero rather than boasting about it.
 */
export async function sendTrialExpiringEmail(params: {
  to: string;
  workspaceId: string;
  daysLeft: number;
}): Promise<void> {
  const { to, workspaceId, daysLeft } = params;

  if (!process.env.RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY is not set — skipping trial-expiring email");
    return;
  }

  const r = getResend();
  if (!r) return;

  let appName          = "your app";
  let repliesPublished = 0;
  let reviewsHandled   = 0;
  let extensionsUsed   = 0;

  try {
    const sb = getServiceClient();

    // `trial_extensions_used` lands with migration 023. Read it on its own so a
    // database without it still gets the rest of the stats — and treat the
    // missing column as "none used", which is what it means for every
    // workspace that predates the column.
    const ext = await sb
      .from("workspaces")
      .select("trial_extensions_used")
      .eq("id", workspaceId)
      .maybeSingle();
    extensionsUsed = Number(ext.data?.trial_extensions_used ?? 0) || 0;

    const [appRes, repliesRes, reviewsRes] = await Promise.all([
      sb.from("apps").select("name")
        .eq("workspace_id", workspaceId).is("deleted_at", null)
        .order("created_at", { ascending: true }).limit(1).maybeSingle(),
      // Same source of truth as the plan meter (lib/plan-enforcement.ts):
      // audit_log is written on every successful publish, so there is no second
      // counter to drift from it.
      sb.from("audit_log").select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId).eq("action", "reply.publish"),
      sb.from("reviews").select("id", { count: "exact", head: true })
        .eq("workspace_id", workspaceId).neq("reply_status", "needs_reply"),
    ]);

    appName          = (appRes.data?.name as string | undefined) || appName;
    repliesPublished = repliesRes.count ?? 0;
    reviewsHandled   = reviewsRes.count ?? 0;
  } catch (err) {
    console.error("[email] trial-ending: could not read workspace stats:", err);
  }

  const message = trialEndingEmail({
    appName,
    daysLeft,
    repliesPublished,
    reviewsHandled,
    extendAvailable: extensionsUsed < MAX_TRIAL_EXTENSIONS,
  });

  const { error } = await r.emails.send({
    from: FROM,
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  if (error) {
    console.error("[email] Failed to send trial-expiring email:", error);
  }
}
