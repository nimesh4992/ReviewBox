import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { isMissingColumnError, missingColumnName, type DbError } from "@/lib/db-errors";

/**
 * Canonical error codes returned from API routes.
 * Clients should switch on `error.code`, never on `error.message`.
 *
 * Keep this union small and stable — adding codes is fine, renaming is a
 * breaking change for any client (including our own UI) reading them.
 */
export type ApiErrorCode =
  // Auth + access
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NO_WORKSPACE"
  // Request shape
  | "MISSING_FIELDS"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  // Conflict / business rules
  | "ALREADY_EXISTS"
  | "SLUG_TAKEN"
  | "SLUG_RESERVED"
  | "PLAN_REQUIRED"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "WORKSPACE_DELETED"
  // Feature is coded but its migration has not been applied to this database
  | "MIGRATION_PENDING"
  // External
  | "STORE_RATE_LIMITED"
  | "STORE_SUBMIT_FAILED"
  | "REPLY_TOO_LONG"
  | "REVIEW_NOT_FOUND_ON_STORE"
  | "APP_STORE_NOT_CONNECTED"
  | "GOOGLE_PLAY_NOT_CONFIGURED"
  | "STRIPE_NOT_CONFIGURED"
  | "INTERVAL_NOT_AVAILABLE"
  // Fallbacks
  | "INTERNAL_SERVER_ERROR"
  | "SERVICE_UNAVAILABLE";

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
  };
}

/**
 * Build a JSON error response with the canonical envelope.
 */
export function apiError(
  code: ApiErrorCode,
  status: number,
  message?: string,
): NextResponse<ApiErrorBody> {
  return NextResponse.json(
    { error: { code, message: message ?? defaultMessage(code) } },
    { status },
  );
}

/**
 * A database write failed. If the cause was a column the schema doesn't have,
 * return an accurate 503; otherwise return null so the caller falls through to
 * whatever it already did.
 *
 * ── Why this is not `writeWithOptionalColumns` ───────────────────────────────
 *
 * There are two honest responses to "this column isn't available", and picking
 * the wrong one is worse than doing nothing:
 *
 *   - **Drop the column and carry on** — correct when the column is enrichment.
 *     A synced app is still a synced app without `store_country`. That is what
 *     `writeWithOptionalColumns()` is for.
 *   - **Fail, and say why** — correct when the column IS the write. Dropping
 *     `deleted_at` from "cancel my account" leaves the account live while the
 *     UI says it's gone; dropping `slack_webhook_url` from "connect Slack"
 *     produces a green badge that never delivers an alert. Silently succeeding
 *     at nothing is the exact failure this codebase keeps having to remove.
 *
 * So most writes belong here, not in `writeWithOptionalColumns`. Blanket
 * wrapping every write in the retry helper would convert a loud failure into a
 * silent no-op across half the product.
 *
 * The message avoids naming the column: PGRST204 also fires when the column
 * EXISTS but PostgREST hasn't reloaded its schema cache since the migration,
 * which resolves on its own. The column name goes to the server log, where
 * whoever is debugging can act on it.
 *
 * @param feature Sentence-initial description of what the user was doing, e.g.
 *                "Cancelling your account".
 */
export function migrationPendingError(
  error: DbError,
  feature: string,
): NextResponse<ApiErrorBody> | null {
  if (!isMissingColumnError(error)) return null;

  console.error(
    `[migration-pending] ${feature}: column "${missingColumnName(error) ?? "unknown"}" is not in the schema`,
    error,
  );

  return apiError(
    "MIGRATION_PENDING",
    503,
    `${feature} needs a database update that hasn't been applied yet. If one was just applied, this clears by itself once the schema cache reloads.`,
  );
}

/**
 * Capture an unexpected error to Sentry and return a generic 500.
 * Use in API route catch blocks for anything you didn't anticipate.
 */
export function captureAndError(err: unknown, context?: string): NextResponse<ApiErrorBody> {
  if (context) console.error(`[${context}]`, err);
  else console.error(err);
  Sentry.captureException(err, context ? { tags: { route: context } } : undefined);
  return apiError("INTERNAL_SERVER_ERROR", 500);
}

function defaultMessage(code: ApiErrorCode): string {
  switch (code) {
    case "UNAUTHORIZED":          return "You must be signed in.";
    case "FORBIDDEN":             return "You don't have access to this resource.";
    case "NO_WORKSPACE":          return "No workspace found for your account.";
    case "MISSING_FIELDS":        return "One or more required fields are missing.";
    case "INVALID_INPUT":         return "The request contains invalid data.";
    case "NOT_FOUND":             return "The requested resource was not found.";
    case "ALREADY_EXISTS":        return "This item already exists.";
    case "SLUG_TAKEN":            return "That workspace URL is already taken.";
    case "SLUG_RESERVED":         return "That workspace URL is reserved.";
    case "PLAN_REQUIRED":         return "This feature requires an upgraded plan.";
    case "QUOTA_EXCEEDED":        return "You've hit your plan quota for this period.";
    case "RATE_LIMITED":          return "Too many requests. Please slow down.";
    case "WORKSPACE_DELETED":     return "This workspace has been deleted.";
    case "MIGRATION_PENDING":     return "This feature needs a database update that hasn't been applied yet.";
    case "STORE_RATE_LIMITED":    return "The app store is rate-limiting us. Try again in a minute.";
    case "STORE_SUBMIT_FAILED":   return "Couldn't submit your reply to the store.";
    case "REPLY_TOO_LONG":        return "Reply exceeds the store's character limit.";
    case "REVIEW_NOT_FOUND_ON_STORE": return "This review no longer exists on the store.";
    case "APP_STORE_NOT_CONNECTED":   return "App Store credentials are missing. Add them in Settings.";
    case "GOOGLE_PLAY_NOT_CONFIGURED": return "Google Play isn't connected yet. Set it up in Settings.";
    case "STRIPE_NOT_CONFIGURED": return "Billing isn't set up yet.";
    case "INTERVAL_NOT_AVAILABLE": return "That billing option isn't available yet.";
    case "INTERNAL_SERVER_ERROR": return "Something went wrong on our end. We've been notified.";
    case "SERVICE_UNAVAILABLE":   return "Service temporarily unavailable. Try again shortly.";
  }
}
