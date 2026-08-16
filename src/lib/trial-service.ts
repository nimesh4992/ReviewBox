/**
 * Database side of the trial lifecycle. Decision logic lives in trial.ts.
 */

import { getServiceClient } from "@/lib/supabase-server";
import { isMissingColumnError, isMissingTableError } from "@/lib/db-errors";
import { TRIAL_DAYS, type PlanName } from "@/lib/plans";
import { decideExtension, resolveTrialEligibility, type TrialWorkspace } from "@/lib/trial";

/**
 * Claim the trial for an app, and report what plan the workspace should be on.
 *
 * Insert-then-read rather than read-then-insert: the unique index on
 * (platform, store_id) is the arbiter, so two workspaces racing on the same
 * app can't both win. `on conflict do nothing` means the insert quietly loses
 * the race, and the follow-up read tells us who holds it.
 *
 * Fails OPEN — a missing table (migration 023 not applied) or any DB error
 * grants the trial. Anti-abuse machinery that breaks signup is worse than the
 * abuse it prevents; the downside here is a few extra free fortnights.
 */
export async function claimTrialForApp(params: {
  workspaceId: string;
  platform: string;
  storeId: string;
}): Promise<{ plan: PlanName; previouslyClaimed: boolean }> {
  const { workspaceId, platform, storeId } = params;
  const grant = { plan: "trial" as PlanName, previouslyClaimed: false };

  if (!storeId?.trim()) return grant;

  try {
    const sb = getServiceClient();
    const normalisedStoreId = storeId.trim().toLowerCase();

    const insert = await sb
      .from("trial_claims")
      .insert({ platform, store_id: normalisedStoreId, workspace_id: workspaceId });

    // No error means we took the claim.
    if (!insert.error) return grant;

    // 23505 is the expected path when the app has been claimed before — that
    // conflict IS the check, not a failure.
    if (insert.error.code !== "23505") {
      if (isMissingTableError(insert.error) || isMissingColumnError(insert.error)) {
        console.warn("[trial] trial_claims not available — granting trial:", insert.error.message);
      } else {
        console.error("[trial] claim insert failed — granting trial:", insert.error);
      }
      return grant;
    }

    const { data: holder } = await sb
      .from("trial_claims")
      .select("workspace_id")
      .eq("platform", platform)
      .eq("store_id", normalisedStoreId)
      .maybeSingle();

    const decision = resolveTrialEligibility({
      claimedByWorkspaceId: (holder?.workspace_id as string | null) ?? null,
      thisWorkspaceId: workspaceId,
    });

    if (decision.previouslyClaimed) {
      console.log(
        `[trial] ${platform}:${normalisedStoreId} already trialled by another workspace — ` +
          `workspace ${workspaceId} starts on ${decision.plan}`,
      );
    }
    return decision;
  } catch (err) {
    console.error("[trial] claim threw — granting trial:", err);
    return grant;
  }
}

/** Fields the trial logic needs. Selected in one place so the shape stays honest. */
const TRIAL_COLUMNS = "id, name, plan, trial_ends_at, trial_extensions_used";

export interface TrialWorkspaceRow extends TrialWorkspace {
  id: string;
  name: string;
}

/** Load a workspace's trial state. Null when it can't be read. */
export async function getTrialWorkspace(workspaceId: string): Promise<TrialWorkspaceRow | null> {
  const sb = getServiceClient();
  const full = await sb.from("workspaces").select(TRIAL_COLUMNS).eq("id", workspaceId).maybeSingle();

  if (!full.error) return (full.data as TrialWorkspaceRow | null) ?? null;

  // Migration 023 pending: retry without the extension counter rather than
  // failing, so trial status still renders on an un-migrated database.
  if (isMissingColumnError(full.error)) {
    const { data } = await sb
      .from("workspaces")
      .select("id, name, plan, trial_ends_at")
      .eq("id", workspaceId)
      .maybeSingle();
    return data ? ({ ...data, trial_extensions_used: 0 } as TrialWorkspaceRow) : null;
  }

  console.error("[trial] workspace read failed:", full.error);
  return null;
}

/**
 * Extend a workspace's trial once. Returns the new end date, or a reason why
 * not — which is surfaced to the customer verbatim, so it has to read like
 * something a person would say.
 */
export async function extendTrial(
  workspaceId: string,
): Promise<{ ok: true; newEndsAt: string } | { ok: false; reason: string }> {
  const ws = await getTrialWorkspace(workspaceId);
  if (!ws) return { ok: false, reason: "We couldn't find that workspace." };

  const decision = decideExtension(ws);
  if (!decision.allowed) return { ok: false, reason: decision.reason ?? "Trial can't be extended." };

  const sb = getServiceClient();
  const { error } = await sb
    .from("workspaces")
    .update({
      trial_ends_at: decision.newEndsAt,
      trial_extensions_used: (ws.trial_extensions_used ?? 0) + 1,
      // Extending revives a lapsed trial, so clear the downgrade stamp.
      trial_ended_at: null,
      plan: "trial",
    })
    .eq("id", workspaceId);

  if (error) {
    console.error("[trial] extend failed:", error);
    return { ok: false, reason: "Something went wrong on our end. Try again in a moment." };
  }

  return { ok: true, newEndsAt: decision.newEndsAt! };
}

/** Fresh trial end date, for stamping at signup. */
export function freshTrialEndsAt(now: Date = new Date()): string {
  return new Date(now.getTime() + TRIAL_DAYS * 86_400_000).toISOString();
}
