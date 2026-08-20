/**
 * Types for the golden-set exporter's public surface.
 *
 * The exporter is `.mjs` so Node can run it directly with
 * `--experimental-strip-types` (see src/eval-cli-import-contract.test.ts for
 * why the CLIs stay Node-resolvable). `allowJs` is off in this project, so
 * without this file the tenant-isolation tests cannot import it under `tsc`.
 *
 * Keep this in step with the exports in export-golden-set.mjs.
 */

export interface WorkspaceScopedApp {
  id: string;
  name: string;
  workspace_id: string;
  [key: string]: unknown;
}

/** Read `--workspace <id>` or EVAL_WORKSPACE_ID. Null when absent or blank. */
export function parseWorkspaceId(
  argv?: readonly string[],
  env?: Record<string, string | undefined>,
): string | null;

/** As above, but throws with guidance rather than returning null. */
export function requireWorkspaceId(
  argv?: readonly string[],
  env?: Record<string, string | undefined>,
): string;

/** Throws if any row belongs to a workspace other than `workspaceId`. */
export function assertWorkspaceScoped<T extends { workspace_id?: unknown }>(
  apps: readonly T[] | null | undefined,
  workspaceId: string,
): T[];

/** Live apps for exactly one workspace: filtered in SQL, then re-checked. */
export function fetchWorkspaceApps(
  supabase: unknown,
  workspaceId: string,
): Promise<WorkspaceScopedApp[]>;
