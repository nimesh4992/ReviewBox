/**
 * Trial state, extension, and stopping the same app trialling forever.
 *
 * Pure functions here; the database calls live in trial-service.ts. Splitting
 * them means the rules that decide whether someone still has a trial can be
 * tested without a database, which is what you want for logic that gates
 * revenue.
 */

import {
  MAX_TRIAL_EXTENSIONS,
  PLAN_AFTER_TRIAL,
  TRIAL_DAYS,
  TRIAL_EXTENSION_DAYS,
  type PlanName,
} from "@/lib/plans";

export interface TrialWorkspace {
  plan: string;
  /** ISO timestamp. Null on a workspace created before trials were stamped. */
  trial_ends_at: string | null;
  /** How many times this workspace has extended. Null/absent = never. */
  trial_extensions_used?: number | null;
}

export type TrialStatus =
  /** Not on a trial at all — free, or paying. */
  | { state: "not_trialling"; daysLeft: null }
  /** Trial running. */
  | { state: "active"; daysLeft: number }
  /** Trial running, but nearly out — the window where nudges should fire. */
  | { state: "ending_soon"; daysLeft: number }
  /** Trial is over and the workspace has not paid. */
  | { state: "expired"; daysLeft: 0 };

/** Days left before `endsAt`, rounded up. Never negative. */
export function daysUntil(endsAt: string, now: Date = new Date()): number {
  const end = new Date(endsAt).getTime();
  if (Number.isNaN(end)) return 0;
  const ms = end - now.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

/** Below this many days left, we start telling the customer. */
export const ENDING_SOON_DAYS = 3;

/**
 * Where a workspace stands.
 *
 * A workspace on `trial` with no `trial_ends_at` is treated as ACTIVE, not
 * expired. Those rows exist — trial_ends_at was added later and some
 * workspaces predate it — and defaulting them to expired would lock out real
 * customers to punish a data gap. Failing open here is the right direction:
 * the cost is a few unmetered accounts, the cost of the other choice is
 * cancelling someone mid-work.
 */
export function getTrialStatus(ws: TrialWorkspace, now: Date = new Date()): TrialStatus {
  if (ws.plan !== "trial") return { state: "not_trialling", daysLeft: null };
  if (!ws.trial_ends_at) return { state: "active", daysLeft: TRIAL_DAYS };

  const left = daysUntil(ws.trial_ends_at, now);
  if (left <= 0) return { state: "expired", daysLeft: 0 };
  if (left <= ENDING_SOON_DAYS) return { state: "ending_soon", daysLeft: left };
  return { state: "active", daysLeft: left };
}

/** True when the trial has run out and the workspace should be downgraded. */
export function isTrialExpired(ws: TrialWorkspace, now: Date = new Date()): boolean {
  return getTrialStatus(ws, now).state === "expired";
}

/** The plan an expired trial drops to. */
export function planAfterTrial(): PlanName {
  return PLAN_AFTER_TRIAL;
}

export interface ExtensionDecision {
  allowed: boolean;
  /** New end date, ISO. Only set when allowed. */
  newEndsAt?: string;
  reason?: string;
}

/**
 * Can this workspace extend, and to when?
 *
 * Extends from whichever is later: now, or the current end date. Extending
 * from `now` on a trial with days still left would silently shorten it, which
 * is the opposite of what the customer asked for — and they only get one
 * extension, so it would be unrecoverable.
 */
export function decideExtension(ws: TrialWorkspace, now: Date = new Date()): ExtensionDecision {
  if (ws.plan !== "trial") {
    return { allowed: false, reason: "This workspace is not on a trial." };
  }

  const used = ws.trial_extensions_used ?? 0;
  if (used >= MAX_TRIAL_EXTENSIONS) {
    return {
      allowed: false,
      reason: "This trial has already been extended once. Talk to us if you need longer.",
    };
  }

  const current = ws.trial_ends_at ? new Date(ws.trial_ends_at).getTime() : now.getTime();
  const base = Math.max(current, now.getTime());
  const newEndsAt = new Date(base + TRIAL_EXTENSION_DAYS * 86_400_000).toISOString();

  return { allowed: true, newEndsAt };
}

// ── Trial abuse ───────────────────────────────────────────────────────────────

/**
 * The unit that gets a trial is the APP, not the account.
 *
 * The obvious exploit is a new email address every fortnight for the same app:
 * accounts are free and unlimited, so gating on the account gates nothing.
 * What the exploiter cannot change is the thing they actually want managed —
 * the store listing. `com.mmrda.mumbaione` is one app in the world, and
 * whoever claims it first is the workspace whose trial it is.
 *
 * This is deliberately a claim, not a ban:
 *
 *   - It records WHICH workspace holds the claim, so support can release one.
 *     Legitimate collisions happen — an agency hands an app to the client, a
 *     customer deletes a workspace and starts over — and every one of those
 *     is a person we want to keep.
 *   - A second workspace adding a claimed app is not blocked from using the
 *     product. It simply starts on `free` rather than `trial`. Blocking the
 *     app outright would also block the genuine handover case, and would make
 *     an agency's second client look like fraud.
 *
 * Email heuristics (plus-addressing, disposable domains) are deliberately not
 * used. They catch the careless and annoy the legitimate — a founder using
 * `me+reviewbox@gmail.com` is a normal person, not an attacker — and Clerk
 * already blocks the worst disposable providers.
 */
export function trialClaimKey(platform: string, storeId: string): string {
  return `${platform.trim().toLowerCase()}:${storeId.trim().toLowerCase()}`;
}

export interface TrialEligibility {
  /** Plan the new workspace should start on. */
  plan: PlanName;
  /** True when a previous workspace already trialled this app. */
  previouslyClaimed: boolean;
}

/**
 * What plan a workspace should start on, given whether this app has trialled
 * before and who holds the claim.
 */
export function resolveTrialEligibility(params: {
  claimedByWorkspaceId: string | null;
  thisWorkspaceId: string;
}): TrialEligibility {
  const { claimedByWorkspaceId, thisWorkspaceId } = params;

  // Unclaimed, or re-claimed by the workspace that already holds it (a repeat
  // of onboarding, or the app removed and added back) — full trial.
  if (!claimedByWorkspaceId || claimedByWorkspaceId === thisWorkspaceId) {
    return { plan: "trial", previouslyClaimed: false };
  }

  return { plan: PLAN_AFTER_TRIAL, previouslyClaimed: true };
}
