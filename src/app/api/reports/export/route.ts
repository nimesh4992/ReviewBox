/**
 * GET /api/reports/export
 *
 * Download reviews as CSV.
 *
 * Query params:
 *   format   = csv (default) | json
 *   days     = 7 | 30 | 90 | all  (default: 30)
 *   appId    = UUID (optional — filter to one app)
 *   priority = urgent | high | normal | low (optional)
 *   rating   = 1-5 (optional — exact match)
 *
 * Returns:
 *   Content-Type: text/csv; charset=utf-8
 *   Content-Disposition: attachment; filename="reviews-YYYY-MM-DD.csv"
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError } from "@/lib/api-response";
import { rateLimit } from "@/lib/api-rate-limit";

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Wrap in quotes if contains comma, newline, or double-quote
  if (str.includes(",") || str.includes("\n") || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsv(cols: unknown[]): string {
  return cols.map(escapeCsv).join(",");
}

const CSV_HEADERS = [
  "id",
  "source",
  "author",
  "rating",
  "sentiment",
  "priority",
  "reply_status",
  "issue_tags",
  "app_version",
  "country",
  "store_created_at",
  "body",
  "reply_text",
];

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) return apiError("UNAUTHORIZED", 401);

  const workspaceId = await getWorkspaceId(session.userId);
  if (!workspaceId) return apiError("NO_WORKSPACE", 404);

  const rl = await rateLimit(req, session.userId, { bucket: "reports-export", limit: 10, window: "1 h" });
  if (!rl.allowed) return apiError("RATE_LIMITED", 429);

  const params = req.nextUrl.searchParams;
  const format   = params.get("format")   ?? "csv";
  const days     = params.get("days")     ?? "30";
  const appId    = params.get("appId")    ?? null;
  const priority = params.get("priority") ?? null;
  const rating   = params.get("rating")   ?? null;

  const sb = getServiceClient();

  // First: get total count matching filters (for X-Total-Count header)
  let countQuery = sb
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId);

  if (days !== "all") {
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
    countQuery = countQuery.gte("store_created_at", since);
  }
  if (appId)    countQuery = countQuery.eq("app_id", appId);
  if (priority) countQuery = countQuery.eq("priority", priority);
  if (rating)   countQuery = countQuery.eq("rating", Number(rating));

  const { count: totalMatching } = await countQuery;

  // Then: fetch up to 5000 rows for the actual export
  let query = sb
    .from("reviews")
    .select(
      "external_id, source, author, rating, sentiment, priority, reply_status, issue_tags, app_version, country, store_created_at, body, reply_text",
    )
    .eq("workspace_id", workspaceId)
    .order("store_created_at", { ascending: false })
    .limit(5000); // hard cap — no one needs more than 5K in one export

  if (days !== "all") {
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte("store_created_at", since);
  }

  if (appId)    query = query.eq("app_id", appId);
  if (priority) query = query.eq("priority", priority);
  if (rating)   query = query.eq("rating", Number(rating));

  const { data, error } = await query;

  if (error) {
    console.error("[export]", error);
    return apiError("INTERNAL_SERVER_ERROR", 500);
  }

  const rows = data ?? [];
  const truncated = (totalMatching ?? 0) > rows.length;

  // ── JSON format ──────────────────────────────────────────────────────────────
  if (format === "json") {
    return NextResponse.json({
      reviews: rows,
      count: rows.length,
      totalMatching: totalMatching ?? rows.length,
      truncated,
    });
  }

  // ── CSV format ───────────────────────────────────────────────────────────────
  const lines: string[] = [CSV_HEADERS.join(",")];

  for (const r of rows) {
    const row = r as Record<string, unknown>;
    lines.push(rowToCsv([
      row["external_id"],
      row["source"],
      row["author"],
      row["rating"],
      row["sentiment"],
      row["priority"],
      row["reply_status"],
      Array.isArray(row["issue_tags"]) ? (row["issue_tags"] as string[]).join("|") : "",
      row["app_version"],
      row["country"],
      row["store_created_at"],
      row["body"],
      row["reply_text"],
    ]));
  }

  const csv = lines.join("\n");
  const date = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reviews-${date}.csv"`,
      "Cache-Control":       "no-store",
      "X-Total-Count":       String(totalMatching ?? rows.length),
      "X-Returned-Count":    String(rows.length),
      "X-Truncated":         truncated ? "true" : "false",
    },
  });
}
