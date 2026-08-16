import { getServiceClient } from "@/lib/supabase-server";
import { STARTER_REPLY_TEMPLATES } from "@/lib/brand-voice-stubs";

/**
 * Put the starter Reply-Kit templates in a workspace, once.
 *
 * These exist to make TIER 0 of /api/reply/draft useful on day one: a template
 * match costs nothing, an AI call costs quota. Six templates covering crash,
 * billing, login, feature requests, performance and 5-star praise handle most
 * of a normal inbox.
 *
 * They were seeded only from /api/onboarding/complete, gated on
 * `workspaceWasJustCreated`. The live 5-step wizard creates the workspace in
 * /api/onboarding/setup, so by the time `complete` runs the membership row
 * already exists, that flag is false, and the seed never ran — for anybody.
 * Every workspace has been starting with an empty Reply Kit, which means every
 * single draft has been falling through to the AI tier.
 *
 * Idempotent by count rather than by a "was just created" flag, so it is safe
 * to call from several places and it backfills a workspace that missed it.
 * Never overwrites: a workspace with any templates at all is left alone.
 */
export async function seedStarterTemplates(workspaceId: string): Promise<number> {
  const sb = getServiceClient();

  const { count, error: countError } = await sb
    .from("reply_templates")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (countError) {
    console.error("[seed-templates] count failed:", countError);
    return 0;
  }
  if ((count ?? 0) > 0) return 0;

  const rows = STARTER_REPLY_TEMPLATES.map((t) => ({
    workspace_id: workspaceId,
    name:         t.name,
    content:      t.content,
    tags:         t.tags,
    rating_min:   t.rating_min,
    rating_max:   t.rating_max,
    usage_count:  0,
  }));

  const { error } = await sb.from("reply_templates").insert(rows);
  if (error) {
    // Loud on purpose. Silence here is what hid the original bug: the seed
    // simply not happening looked identical to it happening and matching
    // nothing.
    console.error("[seed-templates] insert failed:", error);
    return 0;
  }

  console.log(`[seed-templates] ${workspaceId}: seeded ${rows.length} starter templates`);
  return rows.length;
}
