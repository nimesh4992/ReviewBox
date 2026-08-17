import { getServiceClient } from "@/lib/supabase-server";

/**
 * incident-service.ts — one definition of "read one incident".
 *
 * The incident detail page and `GET /api/incidents/[id]` were two independent
 * copies of the same read, with two independently hand-maintained column
 * lists: the route used `select("*")`, the page named nine columns. Neither
 * imported the other, so there was nothing to make them drift *loudly*.
 *
 * That is the exact shape of this codebase's recurring wrong-layer bugs. A
 * migration adds a column, an agent updates the route because some other
 * feature needs it, and the page keeps rendering exactly as before with the
 * new field silently missing — both paths compile, both type-check, CI is
 * green, and the only symptom is a value that never appears on screen.
 *
 * The fix is not "pick the same column list twice". It is to have one place
 * that can be wrong, so that fixing it fixes both callers.
 */

/** An incident row as stored. Shared so the mappers agree on the shape. */
export interface DbIncident {
  id: string;
  workspace_id: string;
  app_id: string | null;
  title: string;
  description: string | null;
  severity: "critical" | "high" | "medium";
  status: "active" | "investigating" | "resolved";
  owner: string | null;
  detected_at: string;
  resolved_at: string | null;
  created_at: string;
}

/**
 * The columns every incident reader needs. Adding a column here reaches the
 * page and the API route in the same edit — which is the entire point.
 *
 * This is every column the table has. It is spelled out rather than `*` so
 * that a migration adding a column is a decision someone makes here, not a
 * silent change in what two unrelated callers receive.
 */
export const INCIDENT_COLUMNS =
  "id,workspace_id,app_id,title,description,severity,status,owner,detected_at,resolved_at,created_at";

/**
 * Read one incident, scoped to the workspace.
 *
 * Returns null for "not found" — including the workspace-mismatch case, which
 * must be indistinguishable from a genuinely missing row so an id from another
 * tenant can't be confirmed to exist.
 */
export async function getIncidentDetail(
  workspaceId: string,
  incidentId: string,
): Promise<DbIncident | null> {
  const { data, error } = await getServiceClient()
    .from("incidents")
    .select(INCIDENT_COLUMNS)
    .eq("id", incidentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  // `.maybeSingle()` rather than `.single()`: zero rows is the normal
  // not-found case here, not a database fault, and `.single()` reports the two
  // identically (see lib/db-errors.ts — the same conflation put four PATCH
  // routes' 404 branches permanently out of reach).
  if (error) {
    console.error("[incidents] detail read failed:", error);
    return null;
  }

  return (data as DbIncident | null) ?? null;
}
