/**
 * GET /api/admin/probe/schema
 *
 * Reports which columns the code depends on are actually present in THIS
 * database. Read-only.
 *
 * Why this exists: the same failure has now happened four times — code
 * referencing a column or constraint that production doesn't match, surfacing
 * as an unexplained 500 in a feature that "just doesn't work". Reply templates
 * (char(5) overflow), automation presets (NOT NULL violation), Settings → Team
 * (a column no migration ever created), and onboarding setup (columns behind
 * unapplied migrations). Each one cost a round-trip of screenshots and
 * guesswork to identify.
 *
 * Diffing code against `supabase/migrations/` can't settle it either, because
 * several columns were applied by hand and never committed. Only the live
 * database knows. This asks it.
 *
 * Auth: platform admin session, or Bearer CRON_SECRET.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireAdminUser } from "@/lib/admin-auth";
import { getServiceClient } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function cronAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // fail closed
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Columns the application reads or writes, with the migration that adds them.
 * A missing entry here is a feature that will 500 rather than degrade.
 */
const EXPECTED: ReadonlyArray<{
  table: string;
  column: string;
  migration: string;
  breaks: string;
}> = [
  { table: "workspaces", column: "trial_ends_at",        migration: "001",  breaks: "trial nudge emails, admin trial dates" },
  { table: "workspaces", column: "brand_voice",          migration: "007a", breaks: "onboarding setup, AI reply voice" },
  { table: "workspaces", column: "app_category",         migration: "008",  breaks: "onboarding setup" },
  { table: "workspaces", column: "support_email",        migration: "007a", breaks: "workspace defaults in Settings" },
  { table: "workspaces", column: "deleted_at",           migration: "005",  breaks: "account soft-delete" },

  { table: "apps", column: "icon_url",                   migration: "012",  breaks: "app icons" },
  { table: "apps", column: "developer",                  migration: "012",  breaks: "app developer name" },
  { table: "apps", column: "lifetime_rating",            migration: "012",  breaks: "dashboard rating" },
  { table: "apps", column: "lifetime_review_count",      migration: "012",  breaks: "dashboard review count" },
  { table: "apps", column: "metadata_refreshed_at",      migration: "012",  breaks: "metadata refresh scheduling" },
  { table: "apps", column: "last_sync_attempted_at",     migration: "013",  breaks: "sync banner" },
  { table: "apps", column: "last_sync_status",           migration: "013",  breaks: "sync status / error reporting" },
  { table: "apps", column: "last_sync_error",            migration: "013",  breaks: "sync error detail" },
  { table: "apps", column: "deleted_at",                 migration: "015",  breaks: "app delete" },
  { table: "apps", column: "publisher_api_connected",    migration: "018",  breaks: "Play Console connection banner" },
  { table: "apps", column: "store_country",              migration: "019",  breaks: "region-locked apps (the Mumbai One bug)" },

  { table: "reviews", column: "issue_tags",              migration: "001",  breaks: "tagging" },
  { table: "reviews", column: "escalation_state",        migration: "001",  breaks: "escalation" },
  { table: "reviews", column: "draft_source",            migration: "001",  breaks: "automation attribution" },

  { table: "automation_rules", column: "action_config",  migration: "001",  breaks: "automation actions" },
  { table: "automation_rules", column: "action_label",   migration: "020",  breaks: "creating automation rules" },

  { table: "alert_preferences", column: "channels",              migration: "020", breaks: "alert preferences" },
  { table: "alert_preferences", column: "label",                 migration: "020", breaks: "alert preferences" },
  { table: "alert_preferences", column: "schedule_day_of_week",  migration: "020", breaks: "digest scheduling" },
  { table: "alert_preferences", column: "schedule_day_of_month", migration: "020", breaks: "monthly report scheduling" },

  { table: "reply_templates", column: "language",        migration: "001",  breaks: "reply templates" },
  { table: "workspace_members", column: "created_at",    migration: "001",  breaks: "Settings → Team" },

  { table: "aso_keywords", column: "volume_estimate",    migration: "007",  breaks: "ASO keywords (the pending_combined.sql conflict)" },
  { table: "aso_keywords", column: "trend_data",         migration: "007",  breaks: "ASO keyword trends" },

  { table: "competitor_apps", column: "workspace_id",    migration: "016",  breaks: "competitors" },
  { table: "support_tickets", column: "workspace_id",    migration: "017",  breaks: "support tickets" },
  { table: "webhook_events",  column: "id",              migration: "004",  breaks: "Stripe webhook dedup" },
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const isAdmin = await requireAdminUser();
  if (!isAdmin && !cronAuthorized(req)) {
    return apiError("FORBIDDEN", 403);
  }

  const sb = getServiceClient();

  // `limit(0)` asks PostgREST to resolve the column without returning rows —
  // a missing column answers 42703, a missing table 42P01.
  const results = await Promise.all(
    EXPECTED.map(async (entry) => {
      const { error } = await sb.from(entry.table).select(entry.column).limit(0);
      if (!error) return { ...entry, present: true as const, problem: null };
      return {
        ...entry,
        present: false as const,
        problem: error.code === "42P01" ? "table missing" : error.code === "42703" ? "column missing" : error.message,
      };
    }),
  );

  const missing = results.filter((r) => !r.present);

  return NextResponse.json({
    checkedAt: new Date().toISOString(),
    ok: missing.length === 0,
    checked: results.length,
    missingCount: missing.length,
    // The actionable part: which migrations to run, in order.
    migrationsToApply: [...new Set(missing.map((m) => m.migration))].sort(),
    missing: missing.map((m) => ({
      table: m.table,
      column: m.column,
      migration: m.migration,
      problem: m.problem,
      breaks: m.breaks,
    })),
  });
}
