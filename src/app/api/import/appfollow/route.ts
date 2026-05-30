import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { getServiceClient, getWorkspaceId } from "@/lib/supabase-server";
import { apiError, captureAndError } from "@/lib/api-response";
import { buildEnrichedRow } from "@/lib/review-mapper";
import { rateLimit } from "@/lib/api-rate-limit";

// ── CSV parsing ───────────────────────────────────────────────────────────────

// Parse a CSV line respecting double-quoted fields with embedded commas/newlines.
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote inside a quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Normalise line endings; split on newlines but handle quoted multi-line fields
  const lines: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
        current += ch;
      }
    } else if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      if (current.trim()) lines.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h) =>
    h.replace(/^["']|["']$/g, "").trim().toLowerCase(),
  );
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
}

// ── Column detection ──────────────────────────────────────────────────────────

interface ColumnMap {
  reviewId: number;
  date: number;
  rating: number;
  author: number;
  title: number;
  body: number;
  version: number;
  country: number;
  platform: number;
  replyText: number;
}

const COLUMN_PATTERNS: Record<keyof ColumnMap, RegExp> = {
  reviewId: /review.?id|id/i,
  date:     /date|reviewed.?at|created.?at|time/i,
  rating:   /rating|stars?|score/i,
  author:   /author|reviewer|user.?name|name/i,
  title:    /title|subject/i,
  body:     /review$|body|content|text|comment/i,
  version:  /version|app.?version|ver$/i,
  country:  /country|territory|locale|language/i,
  platform: /platform|store|source/i,
  replyText:/reply|developer.?reply|response/i,
};

function detectColumns(headers: string[]): ColumnMap {
  const map = {} as ColumnMap;
  for (const [field, pattern] of Object.entries(COLUMN_PATTERNS) as [keyof ColumnMap, RegExp][]) {
    const idx = headers.findIndex((h) => pattern.test(h));
    map[field] = idx; // -1 = not found
  }
  return map;
}

function cellValue(row: string[], idx: number): string {
  if (idx < 0 || idx >= row.length) return "";
  return (row[idx] ?? "").replace(/^["']|["']$/g, "").trim();
}

// ── Row → enriched DB row ─────────────────────────────────────────────────────

interface ParsedRow {
  reviewId: string;
  date: string;
  rating: number;
  author: string;
  body: string;
  version: string | null;
  country: string | null;
  platform: "google_play" | "app_store";
  replyText: string | null;
}

function parseRow(
  row: string[],
  map: ColumnMap,
  rowIndex: number,
  defaultPlatform: "google_play" | "app_store",
): ParsedRow | null {
  const body = cellValue(row, map.body);
  if (!body) return null; // skip blank review rows

  const rawRating = cellValue(row, map.rating);
  const rating = rawRating ? Math.min(5, Math.max(1, Math.round(parseFloat(rawRating)))) : 3;
  if (isNaN(rating)) return null;

  const rawDate = cellValue(row, map.date);
  let date: string;
  try {
    date = rawDate ? new Date(rawDate).toISOString() : new Date().toISOString();
  } catch {
    date = new Date().toISOString();
  }

  const rawPlatform = cellValue(row, map.platform).toLowerCase();
  let platform: "google_play" | "app_store" = defaultPlatform;
  if (rawPlatform.includes("google") || rawPlatform.includes("play") || rawPlatform.includes("android")) {
    platform = "google_play";
  } else if (rawPlatform.includes("apple") || rawPlatform.includes("ios") || rawPlatform.includes("app store")) {
    platform = "app_store";
  }

  const title = cellValue(row, map.title);
  const fullBody = title ? `${title}\n\n${body}` : body;

  const rawReply = cellValue(row, map.replyText);

  return {
    reviewId: cellValue(row, map.reviewId) || `csv-${rowIndex}`,
    date,
    rating,
    author: cellValue(row, map.author) || "Anonymous",
    body: fullBody,
    version: cellValue(row, map.version) || null,
    country: cellValue(row, map.country) || null,
    platform,
    replyText: rawReply || null,
  };
}

// ── POST /api/import/appfollow ─────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    const userId = session?.userId;
    if (!userId) return apiError("UNAUTHORIZED", 401);

    const rl = await rateLimit(req, userId, { bucket: "import-appfollow", limit: 10, window: "1 h" });
    if (!rl.allowed) return apiError("RATE_LIMITED", 429);

    const workspaceId = await getWorkspaceId(userId);
    if (!workspaceId) return apiError("NO_WORKSPACE", 404);

    // Parse multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file");
    const defaultPlatform = (formData.get("platform") as string | null) ?? "google_play";
    const appIdParam = formData.get("appId") as string | null;

    if (!file || typeof file === "string") {
      return apiError("MISSING_FIELDS", 400, "No file uploaded.");
    }

    // Get the first connected app for this workspace if none specified
    const sb = getServiceClient();
    let appId: string | null = appIdParam;

    if (!appId) {
      const { data: apps } = await sb
        .from("apps")
        .select("id, platform")
        .eq("workspace_id", workspaceId)
        .is("deleted_at", null)
        .limit(1);
      appId = apps?.[0]?.id ?? null;
    }

    if (!appId) {
      return apiError("NOT_FOUND", 404, "No app connected to this workspace. Add an app in Settings first.");
    }

    // Validate app belongs to workspace
    const { data: appRow } = await sb
      .from("apps")
      .select("id, workspace_id, platform")
      .eq("id", appId)
      .eq("workspace_id", workspaceId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!appRow) return apiError("NOT_FOUND", 404, "App not found in this workspace.");

    // Read CSV
    const csvText = await (file as File).text();
    if (csvText.length > 10 * 1024 * 1024) {
      return apiError("INVALID_INPUT", 400, "File exceeds 10 MB limit.");
    }

    const { headers, rows } = parseCsv(csvText);
    if (headers.length === 0) {
      return apiError("INVALID_INPUT", 400, "Could not parse CSV — empty or invalid format.");
    }

    const colMap = detectColumns(headers);

    // Require at least a body/review column
    if (colMap.body < 0) {
      return apiError(
        "INVALID_INPUT",
        400,
        `Could not find a review text column. Headers found: ${headers.slice(0, 10).join(", ")}`,
      );
    }

    const platform = (appRow.platform as "google_play" | "app_store") ??
      (defaultPlatform as "google_play" | "app_store");

    // Parse rows → enriched DB rows
    const enrichedRows: ReturnType<typeof buildEnrichedRow>[] = [];
    let skipped = 0;

    for (let i = 0; i < rows.length; i++) {
      const parsed = parseRow(rows[i], colMap, i, platform);
      if (!parsed) { skipped++; continue; }

      enrichedRows.push(
        buildEnrichedRow(
          appId,
          workspaceId,
          `import-${parsed.platform}-${parsed.reviewId}`,
          parsed.platform,
          parsed.author,
          parsed.rating,
          parsed.body,
          parsed.version,
          null,
          parsed.country,
          parsed.date,
          !!parsed.replyText,
          parsed.replyText,
        ),
      );
    }

    if (enrichedRows.length === 0) {
      return apiError("INVALID_INPUT", 400, `No valid reviews found. ${skipped} rows skipped.`);
    }

    // Upsert in batches of 200 to stay under Supabase request size limits
    const BATCH = 200;
    let upserted = 0;
    for (let i = 0; i < enrichedRows.length; i += BATCH) {
      const batch = enrichedRows.slice(i, i + BATCH);
      const { error } = await sb
        .from("reviews")
        .upsert(batch, { onConflict: "app_id,external_id" });

      if (error) {
        console.error("[import/appfollow] upsert error:", error);
        return captureAndError(error, "POST /api/import/appfollow");
      }
      upserted += batch.length;
    }

    // Update app's last_synced_at so the UI shows import happened
    await sb
      .from("apps")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", appId);

    return NextResponse.json({
      imported: upserted,
      skipped,
      total: rows.length,
    });
  } catch (err) {
    return captureAndError(err, "POST /api/import/appfollow");
  }
}

// ── GET /api/import/appfollow ─ return detected columns from header preview ────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth();
    if (!session?.userId) return apiError("UNAUTHORIZED", 401);

    const headerLine = req.nextUrl.searchParams.get("headers");
    if (!headerLine) return apiError("MISSING_FIELDS", 400, "Pass ?headers= with comma-separated column names.");

    const headers = headerLine
      .split(",")
      .map((h) => h.trim().toLowerCase());

    const colMap = detectColumns(headers);

    return NextResponse.json({
      headers,
      detected: {
        reviewId: colMap.reviewId >= 0 ? headers[colMap.reviewId] : null,
        date:     colMap.date     >= 0 ? headers[colMap.date]     : null,
        rating:   colMap.rating   >= 0 ? headers[colMap.rating]   : null,
        author:   colMap.author   >= 0 ? headers[colMap.author]   : null,
        body:     colMap.body     >= 0 ? headers[colMap.body]     : null,
        version:  colMap.version  >= 0 ? headers[colMap.version]  : null,
        country:  colMap.country  >= 0 ? headers[colMap.country]  : null,
        platform: colMap.platform >= 0 ? headers[colMap.platform] : null,
        replyText:colMap.replyText>= 0 ? headers[colMap.replyText]: null,
      },
      bodyFound: colMap.body >= 0,
    });
  } catch (err) {
    return captureAndError(err, "GET /api/import/appfollow");
  }
}
