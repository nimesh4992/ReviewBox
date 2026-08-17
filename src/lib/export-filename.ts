/**
 * export-filename.ts
 *
 * Names a CSV export after the scope it actually covers.
 *
 * The exported file carries no app name and no app_id column, so once it is
 * downloaded there is nothing inside it to say which app it describes. Both
 * export buttons (dashboard header, Reports screen) previously produced the
 * same `reviews-2026-08-16.csv` whether the user had one app selected or all
 * of them — two different datasets, one filename, and the second download
 * silently overwrote the first in the browser's downloads folder.
 */

/** `Mumbai One` → `mumbai-one`. Empty/undefined names fall back to "app". */
export function slugifyAppName(name: string | undefined | null): string {
  const slug = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, 40)
    // Trim AFTER truncating too — a cut that lands on a separator would
    // otherwise leave "reviews-acme-pay--2026-08-16.csv".
    .replace(/^-+|-+$/g, "");
  return slug || "app";
}

/**
 * @param appName  Display name from `resolveSelectedApp`.
 * @param appId    Undefined means "all apps" — the name is then irrelevant.
 * @param date     Injectable for tests; defaults to now.
 */
export function exportFileName(
  appName: string | undefined,
  appId: string | undefined,
  date: Date = new Date(),
): string {
  const day = date.toISOString().split("T")[0];
  const scope = appId ? slugifyAppName(appName) : "all-apps";
  return `reviews-${scope}-${day}.csv`;
}
