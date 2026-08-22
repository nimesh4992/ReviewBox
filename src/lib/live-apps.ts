/**
 * live-apps.ts
 *
 * The one way to answer "which apps does this workspace actually have?" on the
 * server, and to honour a client-supplied app filter safely.
 *
 * Apps are soft-deleted (`apps.deleted_at`), but their reviews stay in the
 * `reviews` table. Any aggregate filtered by `workspace_id` alone therefore
 * counts phantom data from disconnected apps — the class of bug that once
 * showed "200 reviews, 4.32 average" on a workspace with nothing connected,
 * and that sent digest emails blending a deleted app's numbers under a live
 * app's name. Every reviews query must go through a live-app id list.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { isMissingColumnError } from "@/lib/db-errors";

export interface LiveApp {
  id: string;
  name: string;
  /**
   * Which store. Present since migration 001 and NOT NULL, so it is safe to
   * select unconditionally — unlike the `deleted_at` column below.
   *
   * Needed because two live apps can legitimately share a display name: the
   * same product on both stores. Without it, a list that shows names alone
   * renders them as indistinguishable duplicates.
   */
  platform: "google_play" | "app_store";
}

/**
 * The workspace's live (non-deleted) apps, id + display name.
 *
 * Returns `null` when the lookup itself failed — callers must fail CLOSED on
 * null (skip the email, return empty metrics), never fall back to an
 * unscoped query.
 *
 * Tolerates a database without migration 015: no `deleted_at` column means
 * nothing was ever soft-deleted, so the unfiltered list is equivalent.
 */
export async function getLiveApps(
  sb: SupabaseClient,
  workspaceId: string,
): Promise<LiveApp[] | null> {
  const full = await sb
    .from("apps")
    .select("id, name, platform")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null);
  if (!full.error) return (full.data ?? []) as LiveApp[];

  if (isMissingColumnError(full.error)) {
    const retry = await sb
      .from("apps")
      .select("id, name, platform")
      .eq("workspace_id", workspaceId);
    if (!retry.error) return (retry.data ?? []) as LiveApp[];
  }

  return null;
}

/** IDs of the workspace's live apps — see getLiveApps for semantics. */
export async function getLiveAppIds(
  sb: SupabaseClient,
  workspaceId: string,
): Promise<string[] | null> {
  const apps = await getLiveApps(sb, workspaceId);
  return apps === null ? null : apps.map((a) => a.id);
}

/**
 * Narrow a live-app list to a client-requested app.
 *
 * The request is honoured ONLY when the id is one of the workspace's own live
 * apps — the same contract as /api/reviews. An unknown or deleted app id
 * yields `[]`, which every caller treats as "nothing to show", rather than
 * silently widening back to the whole workspace.
 */
export function scopeAppIds(
  liveAppIds: readonly string[],
  requestedAppId: string | null | undefined,
): string[] {
  const id = requestedAppId?.trim();
  if (!id) return [...liveAppIds];
  return liveAppIds.includes(id) ? [id] : [];
}
