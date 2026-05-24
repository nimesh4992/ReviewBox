/**
 * GET /api/onboarding/search-app?platform=app-store|google-play&query=spotify
 *
 * Searches the App Store or Google Play for apps matching the query.
 * Used by the onboarding wizard so users can pick their app from real results
 * instead of typing a bundle ID or package name from memory.
 *
 * Rate-limited per user to prevent quota abuse on Apple's iTunes Search and
 * to keep us under Google's scraping radar.
 */

import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { searchStore, type StorePlatform } from "@/services/store-search";
import { rateLimit } from "@/lib/api-rate-limit";
import { apiError } from "@/lib/api-response";

export const dynamic = "force-dynamic";

function isValidPlatform(value: string | null): value is StorePlatform {
  return value === "app-store" || value === "google-play";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.userId) {
    return apiError("UNAUTHORIZED", 401);
  }

  // Tight rate limit — search shouldn't be hammered. 30/min is plenty for
  // someone typing in a search box even with debounce miss-fires.
  const rl = await rateLimit(req, session.userId, {
    bucket: "onboarding-search",
    limit: 30,
    window: "1 m",
  });
  if (!rl.allowed) {
    return apiError("RATE_LIMITED", 429);
  }

  const platformParam = req.nextUrl.searchParams.get("platform");
  const query = (req.nextUrl.searchParams.get("query") ?? "").trim();

  if (!isValidPlatform(platformParam)) {
    return apiError("INVALID_INPUT", 400, "platform must be app-store or google-play");
  }
  if (query.length < 2) {
    // Don't bother the upstream APIs for 1-character queries
    return NextResponse.json({ results: [] });
  }
  if (query.length > 100) {
    return apiError("INVALID_INPUT", 400, "query too long");
  }

  try {
    const results = await searchStore(platformParam, query, 10);
    return NextResponse.json({ results });
  } catch (err) {
    // Don't bubble upstream errors to the user — return empty + flag so the
    // UI can show "couldn't search, enter manually" instead of a hard failure.
    console.error("[search-app] upstream failure:", err);
    return NextResponse.json({ results: [], searchFailed: true });
  }
}
