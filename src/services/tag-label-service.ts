import { getServiceClient } from "@/lib/supabase-server";
import { isMissingTableError } from "@/lib/db-errors";
import type { TagLabelMap } from "@/lib/tag-labels";

/**
 * A workspace's custom tag names, as a plain map.
 *
 * A missing table (migration 024 pending) reads as "no custom names", which is
 * exactly the default behaviour — the feature degrades to read-only rather than
 * breaking the inbox or the digest cron.
 */
export async function readTagLabels(workspaceId: string): Promise<TagLabelMap> {
  const { data, error } = await getServiceClient()
    .from("tag_labels")
    .select("tag, label")
    .eq("workspace_id", workspaceId);

  if (error) {
    if (!isMissingTableError(error)) console.error("[tags] label read failed:", error);
    return {};
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) map[row.tag as string] = row.label as string;
  return map;
}
