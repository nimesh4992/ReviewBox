import { getServiceClient } from "@/lib/supabase-server";

/**
 * Record one AI-assisted action.
 *
 * `ai_usage` has existed since migration 001 and is read in four places — the
 * dashboard's "AI drafts this week", the admin overview, customer detail, and
 * admin analytics. Nothing had ever written to it, so all four reported a
 * number that was structurally always zero, including the founder's only view
 * of AI cost and abuse.
 *
 * `model` is the tier that actually produced the reply, not a category. That
 * distinction is the entire point: a draft served from a saved template costs
 * nothing and a draft from Groq spends quota, and a single count that mixes
 * them cannot tell you which you are paying for.
 *
 * Never throws and never blocks. Metering is bookkeeping; failing a customer's
 * reply because we could not write a usage row would be the wrong trade.
 */
export async function recordAiUsage(params: {
  workspaceId: string | null | undefined;
  clerkUserId: string;
  action: "draft_reply" | "semantic_tag" | "sentiment" | "translate" | "aso_suggest";
  model: string;
  tokensUsed?: number;
}): Promise<void> {
  const { workspaceId, clerkUserId, action, model, tokensUsed = 0 } = params;

  // workspace_id is nullable in the schema, but a row we cannot attribute to a
  // workspace is invisible to every reader, so there is nothing to gain.
  if (!workspaceId) return;

  try {
    const { error } = await getServiceClient().from("ai_usage").insert({
      workspace_id: workspaceId,
      clerk_user_id: clerkUserId,
      action,
      model,
      tokens_used: tokensUsed,
    });
    if (error) console.error("[ai-usage] insert failed:", error);
  } catch (err) {
    console.error("[ai-usage] insert threw:", err);
  }
}
