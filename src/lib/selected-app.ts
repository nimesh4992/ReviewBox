/**
 * Resolving the sidebar's app selection.
 *
 * `useWorkspaceStore().selectedApp` holds the app's **UUID**, or `""` for
 * "all apps". This is easy to get wrong: the store used to hold the display
 * NAME, and after it was migrated to IDs three screens kept resolving it by
 * name (`apps.find(a => a.name === selectedApp)`). That never matches an ID,
 * so the lookup returned undefined and those screens silently ignored the
 * selector — showing workspace-wide data under one app's heading — while
 * Reports printed the raw UUID as its title.
 *
 * Both mistakes are invisible in review, so the resolution lives here as one
 * tested function rather than being open-coded per screen.
 */

export interface AppLike {
  id: string;
  name: string;
}

export interface ResolvedApp {
  /** Pass to APIs as `appId`. `undefined` means "all apps" — don't filter. */
  appId: string | undefined;
  /** Safe to render as a heading; never a raw UUID. */
  appName: string;
}

export const ALL_APPS_LABEL = "All apps";

export function resolveSelectedApp(
  apps: readonly AppLike[] | undefined | null,
  selectedApp: string | undefined | null,
): ResolvedApp {
  const id = selectedApp?.trim();
  if (!id) return { appId: undefined, appName: ALL_APPS_LABEL };

  const match = apps?.find((a) => a.id === id);
  // A selection that no longer resolves (deleted app, or a stale name-based
  // value persisted from before the migration) is treated as "all apps"
  // rather than filtering on a value the API can't honour.
  if (!match) return { appId: undefined, appName: ALL_APPS_LABEL };

  return { appId: match.id, appName: match.name };
}
