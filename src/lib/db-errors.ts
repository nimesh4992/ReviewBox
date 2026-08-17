/**
 * Recognising "this column/table isn't there" across BOTH of Supabase's error
 * surfaces.
 *
 * PostgREST reports the same missing column two completely different ways
 * depending on where the column appears in the request:
 *
 *   READ  — `.select("store_country")`, `.eq("store_country", …)`
 *           The column name is compiled into SQL and sent to Postgres, which
 *           answers `42703 undefined_column`.
 *
 *   WRITE — `.insert({ store_country })`, `.update({ store_country })`
 *           PostgREST validates the payload against its own cached copy of the
 *           schema BEFORE building any SQL, and rejects the request itself with
 *           `PGRST204` — "Could not find the 'store_country' column of 'apps'
 *           in the schema cache". Postgres never sees the statement, so 42703
 *           never appears.
 *
 * Every degrade-on-pending-migration fallback in this codebase was written
 * against 42703 alone. On a write that check can never fire. That is exactly
 * how onboarding 500'd for every new signup on production: `apps.store_country`
 * (migration 019) wasn't in the schema cache, the insert failed with PGRST204,
 * the "retry without the metadata columns" branch was gated on 42703, and the
 * route fell straight through to INTERNAL_SERVER_ERROR.
 *
 * PGRST204 also fires when the column DOES exist but PostgREST hasn't reloaded
 * its cache since the migration ran — same symptom, different fix
 * (`notify pgrst, 'reload schema'`). `/api/admin/probe/schema` tells the two
 * apart.
 */

/** Minimal shape of a PostgrestError — anything with a code and a message. */
export type DbError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
} | null | undefined;

/** Postgres: relation does not exist. */
const PG_UNDEFINED_TABLE = "42P01";
/** Postgres: column does not exist (read path). */
const PG_UNDEFINED_COLUMN = "42703";
/** PostgREST: column absent from the schema cache (write path). */
const PGRST_UNKNOWN_COLUMN = "PGRST204";
/** PostgREST: table absent from the schema cache. */
const PGRST_UNKNOWN_TABLE = "PGRST205";

/**
 * True when an error means "that column isn't available", whichever side of
 * the request it came from. Use this for every pending-migration fallback —
 * never a bare `error.code === "42703"`.
 */
export function isMissingColumnError(error: DbError): boolean {
  return error?.code === PG_UNDEFINED_COLUMN || error?.code === PGRST_UNKNOWN_COLUMN;
}

/**
 * True when a table isn't available — migration not applied (42P01) or not yet
 * in PostgREST's schema cache (PGRST205). Callers degrade gracefully instead of
 * 500ing; this is how Competitors survives a pending migration 016 and Support
 * Tickets a pending 017.
 */
export function isMissingTableError(error: DbError): boolean {
  return error?.code === PG_UNDEFINED_TABLE || error?.code === PGRST_UNKNOWN_TABLE;
}

/** PostgREST: `.single()` matched zero rows (or more than one). */
const PGRST_NO_SINGLE_ROW = "PGRST116";

/**
 * True when an error means "nothing matched", not "the query failed".
 *
 * `.single()` conflates the two: an UPDATE that matches no rows returns a
 * non-null error with the same shape as a genuine database fault. Routes that
 * checked `if (error) return 500` before `if (!data) return 404` therefore
 * always took the 500 branch, and their 404 branch was unreachable for the one
 * case it existed to handle — so editing an item already deleted in another
 * tab answered "Something went wrong on our end. We've been notified," which
 * was also untrue, since those branches notify nothing.
 */
export function isNoRowsError(error: DbError): boolean {
  return error?.code === PGRST_NO_SINGLE_ROW;
}

/**
 * Pull the offending column name out of a missing-column error so a retry can
 * drop just that one field instead of every optional field.
 *
 * Both wordings carry the name in single quotes or double quotes:
 *   PGRST204 → Could not find the 'store_country' column of 'apps' in the schema cache
 *   42703    → column "store_country" of relation "apps" does not exist
 *
 * Returns null when the message doesn't match — callers fall back to dropping
 * all optional columns.
 */
export function missingColumnName(error: DbError): string | null {
  if (!isMissingColumnError(error)) return null;
  const message = error?.message ?? "";

  const pgrst = /find the ['"]([^'"]+)['"] column/i.exec(message);
  if (pgrst) return pgrst[1];

  const pgQuoted = /column ['"]([^'"]+)['"] (?:of relation |does not exist)/i.exec(message);
  if (pgQuoted) return pgQuoted[1];

  // A bad column in a select list comes back unqualified or table-qualified
  // and unquoted: `column apps.store_country does not exist`.
  const pgBare = /column (?:\w+\.)?(\w+) does not exist/i.exec(message);
  if (pgBare) return pgBare[1];

  return null;
}

type DbResult<T> = { data: T | null; error: DbError };

/**
 * Run an insert/update whose payload contains columns that may not exist yet,
 * dropping only the columns the database actually rejects.
 *
 * `required` columns are always sent. `optional` columns are sent on the first
 * attempt; each missing-column error removes the named column and retries. If
 * the error doesn't name a column, every remaining optional column is dropped
 * in one go.
 *
 * Motivation: the old fallbacks were all-or-nothing — one absent column
 * (`store_country`) discarded the icon, developer and rating too, so a
 * workspace created during a pending migration came out visibly degraded even
 * though four of the five columns were fine.
 *
 * Attempts are bounded by the number of optional columns, so a persistent
 * error can't loop.
 */
export async function writeWithOptionalColumns<T>(
  run: (payload: Record<string, unknown>) => PromiseLike<DbResult<T>>,
  required: Record<string, unknown>,
  optional: Record<string, unknown>,
): Promise<DbResult<T> & { droppedColumns: string[] }> {
  const remaining = { ...optional };
  const droppedColumns: string[] = [];
  // +1 so the final attempt (all optional columns dropped) still runs.
  const maxAttempts = Object.keys(optional).length + 1;

  let result: DbResult<T> = { data: null, error: null };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    result = await run({ ...required, ...remaining });
    if (!isMissingColumnError(result.error)) break;

    const column = missingColumnName(result.error);
    if (column && column in remaining) {
      delete remaining[column];
      droppedColumns.push(column);
      continue;
    }

    // Unparseable, or it named a required column (nothing we can do about
    // that) — shed everything optional and make one last attempt.
    const rest = Object.keys(remaining);
    if (rest.length === 0) break;
    for (const key of rest) delete remaining[key];
    droppedColumns.push(...rest);
  }

  return { ...result, droppedColumns };
}
