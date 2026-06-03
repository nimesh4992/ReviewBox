import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

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
  | "SLUG_TAKEN"
  | "SLUG_RESERVED"
  | "PLAN_REQUIRED"
  | "QUOTA_EXCEEDED"
  | "RATE_LIMITED"
  | "WORKSPACE_DELETED"
  // External
  | "STORE_RATE_LIMITED"
  | "STORE_SUBMIT_FAILED"
  | "REPLY_TOO_LONG"
  | "REVIEW_NOT_FOUND_ON_STORE"
  | "APP_STORE_NOT_CONNECTED"
  | "GOOGLE_PLAY_NOT_CONFIGURED"
  | "STRIPE_NOT_CONFIGURED"
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
    case "SLUG_TAKEN":            return "That workspace URL is already taken.";
    case "SLUG_RESERVED":         return "That workspace URL is reserved.";
    case "PLAN_REQUIRED":         return "This feature requires an upgraded plan.";
    case "QUOTA_EXCEEDED":        return "You've hit your plan quota for this period.";
    case "RATE_LIMITED":          return "Too many requests. Please slow down.";
    case "WORKSPACE_DELETED":     return "This workspace has been deleted.";
    case "STORE_RATE_LIMITED":    return "The app store is rate-limiting us. Try again in a minute.";
    case "STORE_SUBMIT_FAILED":   return "Couldn't submit your reply to the store.";
    case "REPLY_TOO_LONG":        return "Reply exceeds the store's character limit.";
    case "REVIEW_NOT_FOUND_ON_STORE": return "This review no longer exists on the store.";
    case "APP_STORE_NOT_CONNECTED":   return "App Store credentials are missing. Add them in Settings.";
    case "GOOGLE_PLAY_NOT_CONFIGURED": return "Google Play isn't connected yet. Set it up in Settings.";
    case "STRIPE_NOT_CONFIGURED": return "Billing isn't set up yet.";
    case "INTERNAL_SERVER_ERROR": return "Something went wrong on our end. We've been notified.";
    case "SERVICE_UNAVAILABLE":   return "Service temporarily unavailable. Try again shortly.";
  }
}
